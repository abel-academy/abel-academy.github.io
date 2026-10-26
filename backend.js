// 아벨학원 홈페이지 ↔ Firebase(로그인·데이터 저장) 연결부
// 페이지 코드는 이 파일의 함수만 사용합니다.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {
  getAuth, initializeAuth, inMemoryPersistence, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
  EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  collection, query, where, orderBy, limit, serverTimestamp, increment, writeBatch, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { firebaseConfig, STUDENT_EMAIL_DOMAIN } from './firebase-config.js';
import { UNDER14_GRADES, DEFAULT_SPECIALS } from './common.js';

export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const FOUNDER_SLOTS = 2; // 승인 없이 바로 관리자가 될 수 있는 인원 (처음 2명)

let app = null, auth = null, db = null;
if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

function need() {
  if (!configured) throw Object.assign(new Error('Firebase 설정 전'), { code: 'app/not-configured' });
}

const toDate = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : v || null);
const rows = (snap, dateKeys = ['createdAt']) => snap.docs.map((d) => {
  const x = { id: d.id, ...d.data() };
  dateKeys.forEach((k) => { if (k in x) x[k] = toDate(x[k]); });
  return x;
});

export function normalizeLoginId(id) {
  return String(id || '').trim().toLowerCase();
}

function loginIdToEmail(idOrEmail) {
  const v = normalizeLoginId(idOrEmail);
  return v.includes('@') ? v : v + '@' + STUDENT_EMAIL_DOMAIN;
}

// 학생(일반 회원) 계정 주소인지 — 관리자 로그인·가입에서 막을 때 사용
export function isStudentEmail(email) {
  return normalizeLoginId(email).endsWith('@' + STUDENT_EMAIL_DOMAIN);
}

/* ── 로그인 ───────────────────────────────────── */
export function onUser(cb) {
  if (!configured) { cb(null); return () => {}; }
  return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
}

// 학생은 아이디, 관리자는 이메일로 로그인
export async function signIn(idOrEmail, password) {
  need();
  const cred = await signInWithEmailAndPassword(auth, loginIdToEmail(idOrEmail), password);
  return { uid: cred.user.uid, email: cred.user.email };
}

// 회원가입: 계정을 만들고(자동 로그인됨) 회원 정보를 저장.
// 중3~고3은 가입 즉시 사용, 초4~중2(만 14세 미만일 수 있음)는 학원이 보호자 동의를 확인한 뒤 사용
export async function signUp({ loginId, password, name, grade, guardianName, guardianPhone }) {
  need();
  const id = normalizeLoginId(loginId);
  const cred = await createUserWithEmailAndPassword(auth, loginIdToEmail(id), password);
  const needsGuardian = UNDER14_GRADES.includes(grade);
  const profile = { name, grade, loginId: id, active: !needsGuardian, loginCount: 0, lastLoginAt: null, selfSignup: true };
  if (needsGuardian) Object.assign(profile, { guardianName, guardianPhone, guardianStatus: 'pending' });
  try {
    await setDoc(doc(db, 'students', cred.user.uid), { ...profile, createdAt: serverTimestamp() });
  } catch (e) {
    await deleteUser(cred.user).catch(() => {}); // 정보 저장에 실패하면 만든 계정을 되돌림
    throw e;
  }
  return { uid: cred.user.uid, ...profile };
}

export async function signOutUser() {
  if (configured) await signOut(auth);
}

export async function changeMyPassword(currentPassword, newPassword) {
  need();
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('로그인 필요'), { code: 'auth/no-current-user' });
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}

// 관리자 비밀번호 재설정 메일: 메일의 링크에서 새 비밀번호를 정함 (학생 아이디는 실제 메일 주소가 아니라서 관리자만 사용)
// 메일을 다 바꾼 뒤 '계속'을 누르면 관리자 화면으로 돌아오도록 주소를 함께 보냄.
// 이 홈페이지 주소가 Firebase '승인된 도메인'에 없으면 돌아오는 주소 없이 다시 보냄
export async function sendAdminPasswordReset(email) {
  need();
  auth.languageCode = 'ko';
  const mail = normalizeLoginId(email);
  const back = new URL('admin.html', location.href).href;
  try {
    await sendPasswordResetEmail(auth, mail, { url: back });
  } catch (e) {
    if (!/continue-uri|unauthorized-domain|invalid-url/.test(String(e.code || ''))) throw e;
    await sendPasswordResetEmail(auth, mail);
  }
}

/* ── 역할 확인 ─────────────────────────────────── */
export async function getStudent(uid) {
  need();
  const snap = await getDoc(doc(db, 'students', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { uid, ...d, lastLoginAt: toDate(d.lastLoginAt), createdAt: toDate(d.createdAt) };
}

export async function isAdmin(uid) {
  need();
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

// 학생이 로그인할 때마다 접속 기록 1건 + 최근 접속 시각 갱신
export async function recordLogin(student) {
  need();
  const batch = writeBatch(db);
  batch.set(doc(collection(db, 'logins')), {
    uid: student.uid, name: student.name, grade: student.grade, loginId: student.loginId, at: serverTimestamp()
  });
  batch.update(doc(db, 'students', student.uid), { lastLoginAt: serverTimestamp(), loginCount: increment(1) });
  await batch.commit();
}

/* ── 관리자 가입·승인 ───────────────────────────── */
// 처음 2명은 가입하면 바로 관리자, 그 뒤로는 기존 관리자가 승인해야 관리자가 됨
export async function adminSlotsUsed() {
  need();
  const snap = await getDoc(doc(db, 'meta', 'adminSlots'));
  return snap.exists() ? Number(snap.data().count) || 0 : 0;
}

export async function registerAdmin({ name, email, password }) {
  need();
  const cred = await createUserWithEmailAndPassword(auth, normalizeLoginId(email), password);
  const uid = cred.user.uid;
  const mail = cred.user.email;
  const used = await adminSlotsUsed();
  if (used < FOUNDER_SLOTS) {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'admins', uid), { name, email: mail, via: 'founder', createdAt: serverTimestamp() });
      batch.set(doc(db, 'meta', 'adminSlots'), { count: used + 1 });
      await batch.commit();
      return { status: 'admin' };
    } catch (e) {
      // 동시에 다른 사람이 마지막 자리를 가져간 경우 → 승인 요청으로
      if (e.code !== 'permission-denied') throw e;
    }
  }
  await setDoc(doc(db, 'adminRequests', uid), { name, email: mail, createdAt: serverTimestamp() });
  return { status: 'pending' };
}

export async function getAdminRequest(uid) {
  need();
  const snap = await getDoc(doc(db, 'adminRequests', uid));
  return snap.exists() ? { uid, ...snap.data(), createdAt: toDate(snap.data().createdAt) } : null;
}

export async function listAdminRequests() {
  need();
  const snap = await getDocs(collection(db, 'adminRequests'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
}

export async function approveAdminRequest(req) {
  need();
  const batch = writeBatch(db);
  batch.set(doc(db, 'admins', req.uid), {
    name: req.name, email: req.email, via: 'approved', approvedBy: auth.currentUser.uid, createdAt: serverTimestamp()
  });
  batch.delete(doc(db, 'adminRequests', req.uid));
  await batch.commit();
}

export async function rejectAdminRequest(uid) {
  need();
  await deleteDoc(doc(db, 'adminRequests', uid));
}

export async function listAdmins() {
  need();
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
}

export async function removeAdmin(uid) {
  need();
  await deleteDoc(doc(db, 'admins', uid));
}

export function currentUid() {
  return auth && auth.currentUser ? auth.currentUser.uid : null;
}

/* ── 보충 강의 ─────────────────────────────────── */
export async function listVideos() {
  need();
  return rows(await getDocs(collection(db, 'videos')));
}

export async function addVideo(v) {
  need();
  const ref = await addDoc(collection(db, 'videos'), {
    grade: v.grade, subject: v.subject, title: v.title, youtube: v.youtube, date: v.date, createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function deleteVideo(id) {
  need();
  await deleteDoc(doc(db, 'videos', id));
}

// 학생이 보충 강의를 눌러 유튜브로 열 때 1건 기록 (시청 내역)
export async function recordView(student, video) {
  need();
  await addDoc(collection(db, 'views'), {
    uid: student.uid, name: student.name, grade: student.grade, loginId: student.loginId,
    videoId: video.id, title: String(video.title || '').slice(0, 80), subject: video.subject || '', videoGrade: video.grade || '',
    at: serverTimestamp()
  });
}

export async function listViews(max = 1000) {
  need();
  return rows(await getDocs(query(collection(db, 'views'), orderBy('at', 'desc'), limit(max))), ['at']);
}

/* ── 학생 계정 (관리자) ─────────────────────────── */
export async function listStudents() {
  need();
  const snap = await getDocs(collection(db, 'students'));
  return snap.docs.map((d) => {
    const x = d.data();
    return { uid: d.id, ...x, lastLoginAt: toDate(x.lastLoginAt), createdAt: toDate(x.createdAt) };
  });
}

// 관리자 로그인이 풀리지 않도록, 보조 연결을 잠깐 만들어 학생 계정을 생성
export async function createStudent({ loginId, password, name, grade }) {
  need();
  const id = normalizeLoginId(loginId);
  const secondary = initializeApp(firebaseConfig, 'create-student-' + Date.now());
  try {
    const secAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });
    const cred = await createUserWithEmailAndPassword(secAuth, loginIdToEmail(id), password);
    await setDoc(doc(db, 'students', cred.user.uid), {
      name, grade, loginId: id, active: true, loginCount: 0, lastLoginAt: null, createdAt: serverTimestamp()
    });
    await signOut(secAuth);
    return cred.user.uid;
  } finally {
    await deleteApp(secondary);
  }
}

export async function updateStudent(uid, fields) {
  need();
  const allowed = {};
  if ('active' in fields) allowed.active = Boolean(fields.active);
  if ('guardianStatus' in fields) allowed.guardianStatus = fields.guardianStatus;
  if ('grade' in fields) allowed.grade = fields.grade;
  if ('name' in fields) allowed.name = fields.name;
  await updateDoc(doc(db, 'students', uid), allowed);
}

// 보호자 동의를 전화로 확인한 뒤 계정 사용 시작
export async function approveGuardian(uid) {
  need();
  await updateDoc(doc(db, 'students', uid), { active: true, guardianStatus: 'confirmed' });
}

// 회원 정보 삭제 (보호자 동의가 확인되지 않은 가입 신청, 탈퇴 요청 등)
export async function deleteStudent(uid) {
  need();
  await deleteDoc(doc(db, 'students', uid));
}

export async function listLogins(max = 1000) {
  need();
  return rows(await getDocs(query(collection(db, 'logins'), orderBy('at', 'desc'), limit(max))), ['at']);
}

/* ── 학원 소식(공지) ─────────────────────────────── */
// 누구나 읽을 수 있고, 관리자만 올리고 지울 수 있음
export async function listNotices(max = 50) {
  need();
  return rows(await getDocs(query(collection(db, 'notices'), orderBy('date', 'desc'), limit(max))));
}

// 공지 + 사진(최대 3장). 사진은 줄인 그림 데이터로 noticeImages에 한 장씩 저장 (유료 저장소 없이 무료로 운영)
export async function addNotice(n) {
  need();
  const images = (n.images || []).slice(0, 3);
  const ref = doc(collection(db, 'notices'));
  const batch = writeBatch(db);
  batch.set(ref, {
    category: n.category, title: n.title, body: n.body || '', date: n.date, imageCount: images.length, createdAt: serverTimestamp()
  });
  images.forEach((img, i) => {
    batch.set(doc(collection(db, 'noticeImages')), { noticeId: ref.id, order: i, data: img.data, w: img.w, h: img.h });
  });
  await batch.commit();
  return ref.id;
}

export async function getNoticeImages(noticeId) {
  need();
  const snap = await getDocs(query(collection(db, 'noticeImages'), where('noticeId', '==', noticeId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order);
}

export async function deleteNotice(id) {
  need();
  const imgs = await getDocs(query(collection(db, 'noticeImages'), where('noticeId', '==', id)));
  const batch = writeBatch(db);
  imgs.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'notices', id));
  await batch.commit();
}

/* ── 특강 구분 (관리자가 추가·삭제) ─────────────────────── */
// settings/specials 문서 하나에 목록으로 저장. 누구나 읽고, 관리자만 바꿈
export async function getSpecials() {
  need();
  const snap = await getDoc(doc(db, 'settings', 'specials'));
  return snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [...DEFAULT_SPECIALS];
}

export async function saveSpecials(items) {
  need();
  await setDoc(doc(db, 'settings', 'specials'), { items, updatedAt: serverTimestamp() });
}

/* ── 상담·특강 신청서 ───────────────────────────── */
// 누구나 신청서를 1건 저장할 수 있고, 관리자만 열람·상태 변경·삭제
// 특강 신청은 특강 구분(special)이 꼭 있어야 하고, 입학 상담은 빈칸
export async function addApplication(a) {
  need();
  const ref = await addDoc(collection(db, 'applications'), {
    type: a.type, special: a.type === '특강 신청' ? (a.special || '') : '',
    studentName: a.studentName, grade: a.grade, phone: a.phone,
    subjects: a.subjects, preferredTime: a.preferredTime, message: a.message || '',
    month: a.month, status: 'new', createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function listApplications() {
  need();
  return rows(await getDocs(collection(db, 'applications')));
}

export async function setApplicationStatus(id, status) {
  need();
  await updateDoc(doc(db, 'applications', id), { status });
}

export async function deleteApplication(id) {
  need();
  await deleteDoc(doc(db, 'applications', id));
}

/* ── 클래스 · 숙제 · 스탬프 ─────────────────────────── */
// 학생이 들어간 클래스는 학생 정보(students/{uid})의 classIds 에 관리자만 기록 (한 학생이 여러 클래스 가능)
// 숙제는 classes/{id}/homework, 스탬프는 classes/{id}/stamps 에 한 건씩 저장

// 여러 건을 나눠서 저장 (보안 규칙이 건마다 문서를 확인하므로 한 번에 5건씩)
async function commitInChunks(ops, size = 5) {
  for (let i = 0; i < ops.length; i += size) {
    const batch = writeBatch(db);
    ops.slice(i, i + size).forEach((op) => op(batch));
    await batch.commit();
  }
}

export async function listClasses() {
  need();
  return rows(await getDocs(collection(db, 'classes')));
}

// 클래스마다 대표관리자(ownerId) 1명: 그 관리자만 숙제·스탬프·학생을 관리. 만든 사람이 아니어도 됨
export async function addClass(c) {
  need();
  const ref = await addDoc(collection(db, 'classes'), {
    name: c.name, subject: c.subject, memo: c.memo || '', stampMax: c.stampMax,
    ownerId: c.ownerId, createdBy: auth.currentUser.uid, stampRules: [], prize: '', createdAt: serverTimestamp()
  });
  return ref.id;
}

const CLASS_FIELDS = ['name', 'subject', 'memo', 'stampMax', 'ownerId', 'stampRules', 'prize'];
export async function updateClass(id, fields) {
  need();
  const v = {};
  CLASS_FIELDS.forEach((k) => { if (k in fields) v[k] = fields[k]; });
  await updateDoc(doc(db, 'classes', id), v);
}

// 서브관리자: 모든 클래스의 숙제·스탬프 현황과 기록을 볼 수만 있는 관리자 (settings/classStaff)
export async function getClassStaff() {
  need();
  const snap = await getDoc(doc(db, 'settings', 'classStaff'));
  return snap.exists() ? { exists: true, subIds: Array.isArray(snap.data().subIds) ? snap.data().subIds : [] } : { exists: false, subIds: [] };
}

export async function saveClassStaff(subIds) {
  need();
  await setDoc(doc(db, 'settings', 'classStaff'), { subIds, updatedAt: serverTimestamp() });
}

// 클래스 삭제: 숙제·스탬프 기록을 지우고, 학생들의 클래스 목록에서도 뺀 뒤 클래스를 지움
export async function deleteClass(id, memberUids = []) {
  need();
  const [hw, st] = await Promise.all([
    getDocs(collection(db, 'classes', id, 'homework')),
    getDocs(collection(db, 'classes', id, 'stamps'))
  ]);
  await commitInChunks([
    ...memberUids.map((uid) => (b) => b.update(doc(db, 'students', uid), { classIds: arrayRemove(id) })),
    ...hw.docs.map((d) => (b) => b.delete(d.ref)),
    ...st.docs.map((d) => (b) => b.delete(d.ref))
  ]);
  await deleteDoc(doc(db, 'classes', id));
}

export async function assignStudents(classId, uids) {
  need();
  await commitInChunks(uids.map((uid) => (b) => b.update(doc(db, 'students', uid), { classIds: arrayUnion(classId) })));
}

export async function unassignStudent(classId, uid) {
  need();
  await updateDoc(doc(db, 'students', uid), { classIds: arrayRemove(classId) });
}

export async function listHomework(classId) {
  need();
  const list = rows(await getDocs(collection(db, 'classes', classId, 'homework')));
  return list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0));
}

export async function addHomework(classId, h) {
  need();
  const ref = await addDoc(collection(db, 'classes', classId, 'homework'), {
    title: h.title, body: h.body || '', due: h.due || '', date: h.date, createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function deleteHomework(classId, id) {
  need();
  await deleteDoc(doc(db, 'classes', classId, 'homework', id));
}

// 관리자: 클래스의 스탬프 전체
export async function listStamps(classId) {
  need();
  return rows(await getDocs(collection(db, 'classes', classId, 'stamps')));
}

// 관리자: 여러 학생에게 스탬프 1개씩
export async function addStamps(classId, uids, reason) {
  need();
  const by = auth.currentUser.uid;
  await commitInChunks(uids.map((uid) => (b) => b.set(doc(collection(db, 'classes', classId, 'stamps')), {
    studentId: uid, reason: String(reason || '').slice(0, 40), by, createdAt: serverTimestamp()
  })));
}

export async function deleteStamp(classId, id) {
  need();
  await deleteDoc(doc(db, 'classes', classId, 'stamps', id));
}

// 스탬프 초기화: studentId를 주면 그 학생만, 없으면 클래스 전체
export async function resetStamps(classId, studentId) {
  need();
  const col = collection(db, 'classes', classId, 'stamps');
  const snap = await getDocs(studentId ? query(col, where('studentId', '==', studentId)) : col);
  await commitInChunks(snap.docs.map((d) => (b) => b.delete(d.ref)));
  return snap.size;
}

// 학생: 내가 들어간 클래스 + 숙제 + 내 스탬프
export async function myClasses(student) {
  need();
  const ids = Array.isArray(student.classIds) ? student.classIds : [];
  const out = await Promise.all(ids.map(async (id) => {
    const snap = await getDoc(doc(db, 'classes', id)).catch(() => null);
    if (!snap || !snap.exists()) return null;
    const [homework, stamps] = await Promise.all([
      listHomework(id),
      getDocs(query(collection(db, 'classes', id, 'stamps'), where('studentId', '==', student.uid))).then((s) => rows(s))
    ]);
    stamps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return { id, ...snap.data(), createdAt: toDate(snap.data().createdAt), homework, stamps };
  }));
  return out.filter(Boolean).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
}

/* ── 강의실별 시간표 (관리자만 봄) ──────────────────── */
// timetable/meta: 제목·메모·강의실·선생님 목록, teacherAdmins(선생님 id → 관리자 uid)
// timetableSlots: 수업 한 칸씩. 시간표 짜기는 아벨학원 계정만, 수업 정보는 담당 선생님도 고칠 수 있음 (보안 규칙)
export async function getTimetableMeta() {
  need();
  const snap = await getDoc(doc(db, 'timetable', 'meta'));
  if (!snap.exists()) return { exists: false };
  const d = snap.data();
  return { exists: true, title: d.title || '', note: d.note || '', rooms: d.rooms || [], teachers: d.teachers || [], teacherAdmins: d.teacherAdmins || {}, updatedAt: toDate(d.updatedAt), updatedBy: d.updatedBy || '' };
}

export async function saveTimetableMeta(m) {
  need();
  await setDoc(doc(db, 'timetable', 'meta'), {
    title: m.title, note: m.note, rooms: m.rooms, teachers: m.teachers, teacherAdmins: m.teacherAdmins || {},
    updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid
  });
}

export async function listTimetableSlots() {
  need();
  return rows(await getDocs(collection(db, 'timetableSlots')), ['updatedAt']);
}

const slotData = (s) => ({
  day: s.day, room: s.room, start: s.start, end: s.end, grade: s.grade || '', subject: s.subject,
  teacher: s.teacher || '', students: s.students || '', studentLinks: s.studentLinks || {}, classId: s.classId || '',
  memo: s.memo || '', updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid
});

export async function addTimetableSlots(list) {
  need();
  const ids = [];
  await commitInChunks(list.map((s) => (b) => { const ref = doc(collection(db, 'timetableSlots')); ids.push(ref.id); b.set(ref, slotData(s)); }));
  return ids;
}

export async function updateTimetableSlot(id, s) {
  need();
  await setDoc(doc(db, 'timetableSlots', id), slotData(s));
}

// 일부만 고치기: 옮기기(요일·강의실·시간)는 아벨학원 계정, 수업 정보(학년·학생·연결·메모)는 담당 선생님도
const SLOT_PATCH_KEYS = ['day', 'room', 'start', 'end', 'grade', 'subject', 'teacher', 'students', 'studentLinks', 'classId', 'memo'];
export async function patchTimetableSlot(id, fields) {
  need();
  const v = {};
  for (const k of SLOT_PATCH_KEYS) if (k in fields) v[k] = fields[k];
  await updateDoc(doc(db, 'timetableSlots', id), { ...v, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
}

export async function deleteTimetableSlot(id) {
  need();
  await deleteDoc(doc(db, 'timetableSlots', id));
}

// 초안 불러오기: 지금 수업을 모두 지우고 새 시간표로 바꿈
export async function replaceTimetable(meta, slots) {
  need();
  const old = await getDocs(collection(db, 'timetableSlots'));
  await commitInChunks(old.docs.map((d) => (b) => b.delete(d.ref)));
  await saveTimetableMeta(meta);
  return addTimetableSlots(slots);
}
