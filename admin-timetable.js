// 관리자 화면 → 시간표: 요일마다 강의실(열) × 시간(행) 격자
// · 선생님마다 색이 달라요. 시간표의 선생님은 이름이 같은 관리자 계정과 연결돼요
// · 수업을 누르면 옆에 '수업 정보'(학생 명단 · 학생 계정 연결 · 클래스 연결)가 보여요
// · 시간표 짜기(수업 추가·삭제·옮기기, 설정, 파일 불러오기)는 아벨학원 계정만 할 수 있어요
//   편집 모드에서 수업을 꾹 누른 채 끌면 옮기고, 휴지통에 놓으면 삭제, 빈 칸을 꾹 눌러 아래로 끌면 새 수업
// · 수업 정보(학년 · 학생 · 계정 연결 · 클래스 연결 · 메모)는 그 수업 담당 선생님과 아벨학원 계정만 고칠 수 있어요
// (보안 규칙 firestore.rules 에서도 똑같이 막아요)
import * as be from './backend.js';
import { TT_DAYS, TT_SUBJECTS, TT_DEFAULT_ROOMS, TT_COLORS, ACADEMY_EMAIL, STAMP_MAX_DEFAULT, el, friendlyError, todayString } from './common.js';

const $ = (s) => document.querySelector(s);
const STEP = 5;          // 격자 한 칸 = 5분
const ROW_PX = 6;        // 5분당 높이(px)
const TITLE_LEN = 60, NOTE_LEN = 200;
const LONG_MS = 450;     // 이만큼 꾹 누르면 끌기 시작
const MOVE_TOL = 8;      // 꾹 누르는 동안 이보다 많이 움직이면 화면 넘기기로 봄
// 예전 초안·기본값으로 만든 2·3강의실(r2·r3)은 쓰지 않아 정리 (설정에서 새로 추가한 강의실은 건드리지 않음)
const OLD_EMPTY_ROOMS = { r2: '2강의실', r3: '3강의실' };

const state = { meta: null, slots: null, day: null, teacher: '', sel: null, editMode: false, loaded: false };
// admin.js 가 넘겨 주는 정보: 로그인한 관리자, 관리자·학생·클래스 목록, 클래스 화면으로 가기 등
let ctx = { me: { uid: null, email: '', name: '' }, admins: [], students: [], classes: [], classesErr: '', roleOfClass: () => 'none', goToClass: () => {}, classesChanged: () => {} };
let infoFlash = null;   // 수업 정보 칸 안내 문구 { id, text, kind }
let draft = null;       // 저장 전 고치는 중인 설정

function message(node, text, kind) {
  if (!node) return;
  node.textContent = text || '';
  node.className = 'a-msg ' + (kind || 'ok');
  node.hidden = !text;
}

const toMin = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + m; };
const toHHMM = (v) => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
// 15:00 → 3:00 (오후 수업이 대부분이라 시간표처럼 짧게)
const short = (t) => { const v = toMin(t); const h = Math.floor(v / 60) % 12 || 12; return `${h}:${String(v % 60).padStart(2, '0')}`; };
const hourLabel = (h) => (h < 12 ? `오전 ${h}시` : h === 12 ? '낮 12시' : `오후 ${h - 12}시`);
const rooms = () => (state.meta && state.meta.rooms.length ? state.meta.rooms : TT_DEFAULT_ROOMS.map((r) => ({ ...r })));
const teachers = () => (state.meta ? state.meta.teachers : []);
const roomName = (id) => (rooms().find((r) => r.id === id) || {}).name || '(지운 강의실)';
const teacherOf = (id) => teachers().find((t) => t.id === id);
const teacherName = (id) => { const t = teacherOf(id); return t ? t.name : ''; };
const daySlots = (day) => (state.slots || []).filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start));
const overlap = (a, b) => toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);
const newId = (p) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const byDayTime = (a, b) => TT_DAYS.indexOf(a.day) - TT_DAYS.indexOf(b.day) || a.start.localeCompare(b.start);
const lessonLabel = (s) => `${s.day} ${short(s.start)}~${short(s.end)} ${roomName(s.room)}`;
const slotById = (id) => (state.slots || []).find((s) => s.id === id);

/* ── 권한: 아벨학원 계정 · 담당 선생님 ── */
const isEditor = () => String(ctx.me.email || '').toLowerCase() === ACADEMY_EMAIL;
const links = () => (state.meta && state.meta.teacherAdmins) || {};
const teacherAdmin = (tid) => (tid && links()[tid]) || '';
const isMyTeacher = (tid) => Boolean(ctx.me.uid) && Boolean(tid) && teacherAdmin(tid) === ctx.me.uid;
const canEditInfo = (s) => isEditor() || isMyTeacher(s.teacher);
const myTeachers = () => teachers().filter((t) => isMyTeacher(t.id));

/* ── 관리자 · 학생 · 클래스 ── */
const adminById = (uid) => ctx.admins.find((a) => a.uid === uid);
const adminLabel = (uid) => { const a = adminById(uid); return a ? `${a.name || '(이름 없음)'} (${a.email || ''})` : '(해제된 관리자)'; };
const adminName = (uid) => { const a = adminById(uid); return a ? a.name || a.email : '(해제된 관리자)'; };
const studentById = (uid) => ctx.students.find((s) => s.uid === uid);
const normName = (n) => String(n || '').replace(/\s+/g, '').replace(/(선생님|쌤|원장님|원장)$/, '');

// 선생님 색 번호 (0~9). 정하지 않았으면 목록 순서대로
function colorOf(t) {
  if (!t) return null;
  const n = Number(t.color);
  if (Number.isInteger(n) && n >= 0 && n < TT_COLORS.length) return n;
  const i = teachers().indexOf(t);
  return (i < 0 ? 0 : i) % TT_COLORS.length;
}
const colorClass = (t) => (t ? `tt-t${colorOf(t)}` : 'tt-t-none');

// 학생 칸 글자 → 이름 묶음: "승윤 건우 / 의환" → [['승윤','건우'], ['의환']]
const parseGroups = (txt) => String(txt || '').split('/').map((g) => g.trim().split(/[\s,]+/).filter(Boolean)).filter((g) => g.length);
const namesOf = (s) => parseGroups(s.students).flat();
// 학생 칸에서 지운 이름의 계정 연결은 함께 정리
function pruneLinks(map, studentsText) {
  const keep = new Set(parseGroups(studentsText).flat());
  return Object.fromEntries(Object.entries(map || {}).filter(([n, uid]) => keep.has(n) && typeof uid === 'string' && uid));
}
const linkedUids = (s) => [...new Set(namesOf(s).map((n) => (s.studentLinks || {})[n]).filter((uid) => uid && studentById(uid)))];

// 이름이 같은(또는 성을 뺀 이름이 같은) 학생 계정 후보. 같은 학년, 연결된 클래스 학생을 먼저
function candidates(name, s) {
  const n = normName(name);
  if (!n) return [];
  const same = (st) => { const full = normName(st.name); return full === n || (full.length >= 3 && full.slice(1) === n) || (full.length === 4 && full.slice(2) === n); };
  let list = ctx.students.filter(same);
  if (list.length > 1 && s.classId) { const inCls = list.filter((st) => (st.classIds || []).includes(s.classId)); if (inCls.length) list = inCls; }
  if (list.length > 1 && s.grade) { const g = list.filter((st) => st.grade === s.grade); if (g.length) list = g; }
  return list;
}
// 자동 연결: 아직 연결 안 된 이름 중 후보가 딱 한 명인 경우만
function autoStudentLinks(s) {
  const map = s.studentLinks || {};
  const used = new Set(Object.values(map));
  const out = [];
  namesOf(s).forEach((n) => {
    if (map[n] && studentById(map[n])) return;
    const c = candidates(n, s).filter((st) => !used.has(st.uid));
    if (c.length === 1) { out.push([n, c[0].uid]); used.add(c[0].uid); }
  });
  return out;
}
// 이름이 같은 관리자 계정과 선생님 연결: 한 번도 정하지 않은 선생님만 (연결 안 함으로 정했으면 그대로)
function autoTeacherLinks(map) {
  const out = [];
  teachers().forEach((t) => {
    if (Object.prototype.hasOwnProperty.call(map, t.id)) return;
    const hit = ctx.admins.filter((a) => normName(a.name) && normName(a.name) === normName(t.name));
    if (hit.length === 1) out.push([t.id, hit[0].uid]);
  });
  return out;
}

function defaultDay() {
  const d = new Date().getDay(); // 0 일 … 6 토
  return d >= 1 && d <= 6 ? TT_DAYS[d - 1] : '월';
}

// 같은 날 겹치는 수업: 같은 강의실, 같은 선생님
function conflicts(day) {
  const list = daySlots(day);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!overlap(a, b)) continue;
      const room = a.room === b.room, teacher = Boolean(a.teacher) && a.teacher === b.teacher;
      if (room || teacher) out.push({ room, teacher, a, b });
    }
  }
  return out;
}

const metaPayload = (m) => ({ title: m.title, note: m.note, rooms: m.rooms, teachers: m.teachers, teacherAdmins: m.teacherAdmins || {} });

let tidied = false;
export async function loadTimetable(force, context) {
  if (context) ctx = { ...ctx, ...context };
  if (force || !state.loaded) {
    if (force) { draft = null; tidied = false; }
    $('#tt-grid').replaceChildren(el('p', { class: 'empty', text: '불러오는 중…' }));
    await fetchAll();
  }
  if (!state.day) state.day = defaultDay();
  if (!isEditor()) state.editMode = false;
  render();
  if (isEditor() && !tidied) { tidied = true; await tidyMeta(); }
}

async function fetchAll() {
  const [meta, slots] = await Promise.all([be.getTimetableMeta(), be.listTimetableSlots()]);
  state.meta = meta.exists ? meta : null;
  state.slots = slots;
  state.loaded = true;
  if (state.sel && !slotById(state.sel)) state.sel = null;
}

// 클래스 화면에서 쓰는 '이 클래스와 연결된 수업' 목록
export async function classLessons(classId) {
  if (!state.loaded) await fetchAll();
  return (state.slots || []).filter((s) => s.classId === classId).sort(byDayTime).map(lessonLabel);
}

// 아벨학원 계정으로 열면: 이름이 같은 관리자 계정과 선생님 연결, 예전 시간표의 빈 2·3강의실 정리
async function tidyMeta() {
  if (!state.meta) return;
  const notes = [];
  const next = { ...state.meta, rooms: [...state.meta.rooms], teacherAdmins: { ...links() } };
  {
    const drop = next.rooms.filter((r) => OLD_EMPTY_ROOMS[r.id] === String(r.name).trim() && !state.slots.some((s) => s.room === r.id));
    if (drop.length && next.rooms.length > drop.length) {
      next.rooms = next.rooms.filter((r) => !drop.includes(r));
      notes.push(`수업이 없는 ${drop.map((r) => r.name).join('·')}을(를) 시간표에서 뺐어요`);
    }
  }
  const linked = autoTeacherLinks(next.teacherAdmins);
  if (linked.length) {
    linked.forEach(([tid, uid]) => { next.teacherAdmins[tid] = uid; });
    notes.push(`${linked.map(([tid]) => teacherName(tid)).join('·')} 선생님을 이름이 같은 관리자 계정과 연결했어요`);
  }
  if (!notes.length) return;
  try {
    const m = metaPayload(next);
    await be.saveTimetableMeta(m);
    state.meta = { ...state.meta, ...m, updatedAt: new Date() };
    draft = null;
    render();
    flash(notes.join('. ') + '.');
  } catch (e) { console.warn('시간표 정리 저장 실패', e); }
}

function flash(text, kind) { message($('#tt-flash'), text, kind || 'ok'); }

async function ensureMeta() {
  if (state.meta) return;
  const m = { title: '시간표', note: '', rooms: rooms(), teachers: [], teacherAdmins: {} };
  await be.saveTimetableMeta(m);
  state.meta = { exists: true, ...m, updatedAt: new Date() };
}

function render() {
  renderAccess();
  renderHead();
  renderDays();
  renderLegend();
  renderMode();
  renderGrid();
  renderInfo();
  renderSettings();
}

// 아벨학원 계정만 보이는 단추·설정
function renderAccess() {
  const ed = isEditor();
  $('#tt-add').hidden = !ed;
  $('#tt-edit').hidden = !ed;
  $('#tt-settings').hidden = !ed;
  $('#tt-io').hidden = !ed;
  const b = $('#tt-edit');
  b.setAttribute('aria-pressed', String(state.editMode));
  b.textContent = state.editMode ? '편집 끝내기' : '시간표 편집';
  b.classList.toggle('primary', state.editMode);
  $('#tt-head-note').textContent = ed
    ? '강의실별 수업 시간표예요. 수업을 누르면 옆에 수업 정보가 보여요. \'시간표 편집\'을 켜면 수업을 꾹 눌러 끌어서 옮기거나 지우고, 빈 칸을 꾹 눌러 새 수업을 넣을 수 있어요. 관리자만 볼 수 있어요.'
    : '강의실별 수업 시간표예요. 수업을 누르면 옆에 수업 정보와 학생 명단이 보여요. 시간표는 아벨학원 계정만 고칠 수 있고, 수업 정보는 그 수업 담당 선생님도 고칠 수 있어요.';
}

function renderHead() {
  const m = state.meta;
  const title = m ? m.title || '시간표' : '시간표';
  $('#tt-print-title').textContent = `${title} · ${state.day}요일`;
  $('#tt-empty').replaceChildren(!m && !(state.slots || []).length
    ? el('div', { class: 'alert' }, el('span', {}, el('strong', { text: '아직 시간표가 없어요.' }),
        isEditor() ? " 아래 '시간표 파일 불러오기'에서 한글 시간표로 만든 초안을 불러오거나, '+ 수업 추가'로 하나씩 넣어 주세요." : ` 아벨학원 계정(${ACADEMY_EMAIL})으로 로그인하면 시간표를 만들 수 있어요.`))
    : (m && (m.title || m.note) ? el('p', { class: 'tt-title' }, el('strong', { text: m.title || '시간표' }), m.note ? el('span', { text: ` · ${m.note}` }) : null) : ''));
}

function renderDays() {
  const box = $('#tt-days');
  const counts = Object.fromEntries(TT_DAYS.map((d) => [d, daySlots(d).length]));
  const shown = TT_DAYS.filter((d) => d !== '일' || counts['일']);
  box.replaceChildren(...shown.map((d) => {
    const on = d === state.day;
    const warn = conflicts(d).length;
    const b = el('button', { type: 'button', role: 'tab', class: 'tt-day', id: `tt-day-${d}`, 'aria-selected': String(on), tabindex: on ? '0' : '-1', 'aria-controls': 'tt-grid' },
      d, el('span', { class: 'tt-day-n', text: String(counts[d]) }), warn ? el('span', { class: 'tt-day-warn', 'aria-label': `겹치는 수업 ${warn}건`, text: '!' }) : null);
    b.addEventListener('click', () => pickDay(d));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const i = shown.indexOf(d);
      pickDay(shown[(i + (e.key === 'ArrowRight' ? 1 : shown.length - 1)) % shown.length]);
      $(`#tt-day-${state.day}`).focus();
    });
    return b;
  }));
}
function pickDay(d) {
  state.day = d;
  const s = state.sel && slotById(state.sel);
  if (s && s.day !== d) state.sel = null;
  render();
}

// 선생님 색 안내 + 선생님별로 보기 (누르면 그 선생님 수업만 진하게)
function renderLegend() {
  const box = $('#tt-legend');
  const ts = teachers();
  box.hidden = !ts.length;
  const chip = (id, label, t) => {
    const on = state.teacher === id;
    const acc = t ? teacherAdmin(t.id) : '';
    const b = el('button', {
      type: 'button', class: 'tt-chip' + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-t': id,
      title: t ? (acc ? `관리자 계정: ${adminLabel(acc)}` : '관리자 계정과 아직 연결되지 않았어요') : null
    }, t ? el('i', { class: `tt-dot ${colorClass(t)}`, 'aria-hidden': 'true' }) : null, label,
      t && isMyTeacher(t.id) ? el('span', { class: 'tt-me', text: '나' }) : null);
    b.addEventListener('click', () => { state.teacher = id && state.teacher === id ? '' : id; renderLegend(); renderGrid(); });
    return b;
  };
  box.replaceChildren(el('span', { class: 'tt-legend-label', text: '선생님' }), chip('', '모두', null), ...ts.map((t) => chip(t.id, t.name, t)));
}

function renderMode() {
  const box = $('#tt-mode');
  if (isEditor() && state.editMode) {
    const done = el('button', { type: 'button', class: 'a-btn small', text: '편집 끝내기' });
    done.addEventListener('click', () => setEditMode(false));
    box.replaceChildren(el('div', { class: 'tt-modebar edit', role: 'status' },
      el('div', {}, el('strong', { text: '편집 모드' }),
        el('ul', {},
          el('li', { text: '수업을 꾹 누른 채 끌면 다른 강의실·시간으로 옮겨져요.' }),
          el('li', { text: '끌어서 아래 휴지통에 놓으면 수업을 지워요.' }),
          el('li', { text: '빈 칸을 꾹 누른 채 아래로 끌면 그 길이만큼 새 수업을 넣어요.' }))),
      done));
    return;
  }
  if (!isEditor()) {
    const mine = myTeachers();
    box.replaceChildren(el('p', { class: 'tt-modebar view' }, el('strong', { text: '보기 전용' }),
      ` · 시간표 짜기는 아벨학원 계정만 할 수 있어요.` + (mine.length ? ` ${mine.map((t) => t.name).join('·')} 선생님 수업은 수업 정보(학생·계정 연결·클래스 연결·메모)를 고칠 수 있어요.` : '')));
    return;
  }
  box.replaceChildren();
}
function setEditMode(on) {
  state.editMode = Boolean(on) && isEditor();
  render();
  $('#tt-edit').focus();
}
$('#tt-edit').addEventListener('click', () => setEditMode(!state.editMode));

let geo = null; // 지금 그린 격자의 시간 범위·강의실 (끌기에 씀)
function renderGrid() {
  const list = daySlots(state.day);
  const rs = rooms();
  const wk = state.day === '토' || state.day === '일';
  let from = list.length ? Math.floor(Math.min(...list.map((s) => toMin(s.start))) / 60) * 60 : (wk ? 10 * 60 : 14 * 60);
  let to = list.length ? Math.ceil(Math.max(...list.map((s) => toMin(s.end))) / 60) * 60 : (wk ? 14 * 60 : 22 * 60);
  if (state.editMode) { from = Math.max(7 * 60, from - 60); to = Math.min(24 * 60, to + 60); }
  if (to - from < 180) to = Math.min(24 * 60, from + 180);
  const n = (to - from) / STEP;
  geo = { from, to, rooms: rs };
  const grid = $('#tt-grid');
  grid.classList.toggle('editing', state.editMode);
  grid.style.gridTemplateColumns = `64px repeat(${rs.length}, minmax(124px, 1fr))`;
  grid.style.width = `max(100%, ${64 + rs.length * 124}px)`;
  grid.style.gridTemplateRows = `44px repeat(${n}, ${ROW_PX}px)`;
  grid.style.setProperty('--hour', `${(60 / STEP) * ROW_PX}px`);
  const kids = [el('div', { class: 'tt-corner', style: 'grid-column: 1; grid-row: 1;' })];
  rs.forEach((r, i) => kids.push(el('div', { class: 'tt-room', style: `grid-column: ${i + 2}; grid-row: 1;`, text: r.name })));
  for (let h = from / 60; h < to / 60; h++) {
    kids.push(el('div', { class: 'tt-hour', style: `grid-column: 1; grid-row: ${(h * 60 - from) / STEP + 2} / span ${60 / STEP};`, text: hourLabel(h) }));
  }
  rs.forEach((r, i) => {
    const bg = el('div', { class: 'tt-col', 'data-room': r.id, style: `grid-column: ${i + 2}; grid-row: 2 / span ${n};` });
    bg.addEventListener('click', () => { if (dragEnded()) return; if (state.sel) closeInfo(false); });
    kids.push(bg);
  });
  const clash = conflicts(state.day);
  const clashIds = new Set(clash.flatMap((c) => [c.a.id, c.b.id]));
  // 같은 강의실에서 겹치는 수업은 나란히
  rs.forEach((r, i) => {
    const inRoom = list.filter((s) => s.room === r.id);
    const lanes = [];
    const placed = inRoom.map((s) => {
      let lane = lanes.findIndex((end) => end <= toMin(s.start));
      if (lane < 0) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = toMin(s.end);
      return { s, lane };
    });
    placed.forEach(({ s, lane }) => {
      const group = placed.filter((p) => overlap(p.s, s));
      const width = Math.max(1, ...group.map((p) => p.lane + 1));
      const r1 = (toMin(s.start) - from) / STEP + 2, r2 = (toMin(s.end) - from) / STEP + 2;
      const dim = state.teacher && s.teacher !== state.teacher;
      const t = teacherOf(s.teacher);
      const names = namesOf(s);
      const b = el('button', {
        type: 'button', class: `tt-block ${colorClass(t)}` + (clashIds.has(s.id) ? ' clash' : '') + (dim ? ' dim' : '') + (state.sel === s.id ? ' sel' : ''),
        style: `grid-column: ${i + 2}; grid-row: ${Math.round(r1)} / ${Math.round(r2)}; width: calc(${100 / width}% - 4px); margin-left: calc(${(100 / width) * lane}% + 2px);`,
        'aria-label': `${state.day}요일 ${r.name} ${short(s.start)}부터 ${short(s.end)}까지 ${s.grade} ${s.subject}${t ? ', ' + t.name + ' 선생님' : ''}, 학생 ${names.length}명. 눌러서 수업 정보 보기`,
        'aria-pressed': String(state.sel === s.id),
        'data-id': s.id
      },
        el('span', { class: 'tt-time', text: `${short(s.start)}~\u200b${short(s.end)}` }),
        el('span', { class: 'tt-what' }, el('strong', { text: `${s.grade} ${s.subject}`.trim() })),
        t ? el('span', { class: 'tt-who', text: t.name }) : null,
        names.length ? el('span', { class: 'tt-count', text: `학생 ${names.length}명` }) : null,
        s.students ? el('span', { class: 'tt-students', text: s.students }) : null,
        s.memo ? el('span', { class: 'tt-memo', text: s.memo }) : null);
      b.addEventListener('click', (e) => { e.stopPropagation(); if (dragEnded()) return; select(s.id, e.detail === 0); });
      kids.push(b);
    });
  });
  grid.replaceChildren(...kids);
  grid.setAttribute('aria-label', `${state.day}요일 강의실별 시간표`);

  const warn = $('#tt-warn');
  warn.replaceChildren(clash.length
    ? el('div', { class: 'tt-warn' }, el('strong', { text: `${state.day}요일에 시간이 겹치는 수업이 ${clash.length}건 있어요.` }),
        el('ul', {}, clash.map((c) => el('li', { text: `${[c.room ? `같은 강의실(${roomName(c.a.room)})` : '', c.teacher ? `같은 선생님(${teacherName(c.a.teacher)})` : ''].filter(Boolean).join(' · ')}: ${short(c.a.start)}~${short(c.a.end)} ${c.a.grade} ${c.a.subject} ↔ ${short(c.b.start)}~${short(c.b.end)} ${c.b.grade} ${c.b.subject}` }))),
        el('p', { text: isEditor() ? '일부러 함께 하는 수업이면 그대로 두셔도 돼요. 아니라면 수업을 옮기거나 고쳐 주세요.' : '일부러 함께 하는 수업일 수 있어요. 고칠 곳이 있으면 아벨학원 계정에 알려 주세요.' }))
    : '');
}

/* ── 수업 정보 (옆 칸, 좁은 화면에서는 아래에서 올라오는 칸) ── */
function select(id, focusPanel) {
  state.sel = id;
  document.querySelectorAll('#tt-grid .tt-block').forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  if (infoFlash && infoFlash.id !== id) infoFlash = null;
  renderInfo();
  if (focusPanel || window.matchMedia('(max-width: 1199px)').matches) { const h = $('#tt-info-title'); if (h) h.focus({ preventScroll: !focusPanel }); }
}
function closeInfo(focusBack) {
  const id = state.sel;
  state.sel = null;
  infoFlash = null;
  document.querySelectorAll('#tt-grid .tt-block.sel').forEach((b) => { b.classList.remove('sel'); b.setAttribute('aria-pressed', 'false'); });
  renderInfo();
  if (focusBack) { const b = document.querySelector(`#tt-grid [data-id="${id}"]`); if (b) b.focus(); }
}
$('#tt-info').addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.sel) { e.preventDefault(); closeInfo(true); } });

const smallBtn = (text, on, kind) => { const b = el('button', { type: 'button', class: 'a-btn small' + (kind ? ' ' + kind : ''), text }); b.addEventListener('click', on); return b; };
const note = (text) => el('p', { class: 'tt-info-note', text });

function renderInfo() {
  const box = $('#tt-info');
  const s = state.sel && slotById(state.sel);
  box.classList.toggle('open', Boolean(s));
  $('#tt-main').classList.toggle('has-sel', Boolean(s));
  if (!s) {
    box.replaceChildren(el('h2', { class: 'tt-info-cap', text: '수업 정보' }), el('p', { class: 'tt-info-empty', text: '시간표에서 수업을 누르면 여기에 담당 선생님, 학생 명단, 학생 계정·클래스 연결이 보여요.' }));
    return;
  }
  const t = teacherOf(s.teacher);
  const can = canEditInfo(s);
  const acc = t ? teacherAdmin(t.id) : '';
  const close = smallBtn('닫기', () => closeInfo(true));
  close.id = 'tt-info-close';
  const fl = infoFlash && infoFlash.id === s.id ? infoFlash : null;
  box.replaceChildren(...[
    el('div', { class: 'tt-info-head' },
      el('div', {}, el('p', { class: 'tt-info-cap small', text: '수업 정보' }),
        el('h2', { id: 'tt-info-title', tabindex: '-1', text: `${s.grade} ${s.subject}`.trim() || '수업' })),
      close),
    el('p', { class: 'tt-info-when', text: `${s.day}요일 · ${roomName(s.room)} · ${short(s.start)}~${short(s.end)}` }),
    el('div', { class: 'tt-info-who' },
      t ? el('i', { class: `tt-dot ${colorClass(t)}`, 'aria-hidden': 'true' }) : null,
      el('strong', { text: t ? `${t.name} 선생님` : '담당 선생님 없음' }),
      t ? el('span', { class: 'tt-info-sub', text: acc ? `관리자 계정 ${adminLabel(acc)}` + (acc === ctx.me.uid ? ' · 나' : '') : '관리자 계정 연결 안 됨' }) : null),
    fl ? el('p', { class: 'a-msg ' + fl.kind, role: fl.kind === 'err' ? 'alert' : 'status', id: 'tt-info-msg', text: fl.text }) : null,
    studentsSection(s, can),
    s.memo ? el('section', { class: 'tt-info-sec' }, el('h3', { text: '메모' }), el('p', { class: 'tt-info-memo', text: s.memo })) : null,
    classSection(s, can),
    actionsRow(s, can),
    permissionNote(s, can, t, acc)].filter(Boolean));
}

function studentsSection(s, can) {
  const groups = parseGroups(s.students);
  const names = groups.flat();
  const map = s.studentLinks || {};
  const linkedN = names.filter((n) => map[n] && studentById(map[n])).length;
  const sec = el('section', { class: 'tt-info-sec', 'aria-labelledby': 'tt-info-stu' },
    el('h3', { id: 'tt-info-stu' }, `학생 ${names.length}명`, names.length ? el('span', { class: 'tt-info-sub', text: ` · 계정 연결 ${linkedN}/${names.length}` }) : null));
  if (!names.length) { sec.append(note('적힌 학생이 없어요.')); return sec; }
  const ul = el('ul', { class: 'tt-stu-list' });
  groups.forEach((g, gi) => {
    if (groups.length > 1) ul.append(el('li', { class: 'tt-stu-group', 'aria-hidden': 'true', text: `그룹 ${gi + 1}` }));
    g.forEach((n) => ul.append(studentRow(s, n, can)));
  });
  sec.append(ul);
  const auto = autoStudentLinks(s);
  if (can && auto.length) {
    sec.append(smallBtn(`이름이 같은 계정 ${auto.length}명 자동 연결`, () => saveLinks(s, { ...pruneLinks(map, s.students), ...Object.fromEntries(auto) }, `${auto.map(([n]) => n).join('·')} 학생을 계정과 연결했어요.`), 'primary'));
  }
  if (!ctx.students.length) sec.append(note('아직 학생 계정이 없어요. 학생들이 회원가입하면 여기서 이름이 같은 계정과 연결할 수 있어요.'));
  else if (linkedN < names.length && !can) sec.append(note('계정 연결은 담당 선생님과 아벨학원 계정이 할 수 있어요.'));
  return sec;
}

function studentRow(s, n, can) {
  const map = s.studentLinks || {};
  const uid = map[n];
  const st = uid && studentById(uid);
  const unlink = () => { const next = { ...map }; delete next[n]; saveLinks(s, next, `${n} 학생의 계정 연결을 끊었어요.`); };
  if (st) {
    const outside = s.classId && !(st.classIds || []).includes(s.classId);
    return el('li', { class: 'tt-stu linked' },
      el('span', { class: 'tt-stu-name', text: n }),
      el('span', { class: 'tt-stu-acc' }, el('span', { class: 'tt-ok', 'aria-hidden': 'true', text: '✓' }), `${st.name} · ${st.grade || ''} · ${st.loginId || ''}`, outside ? el('span', { class: 'pill wait', text: '클래스 밖' }) : null),
      can ? smallBtn('끊기', unlink) : null);
  }
  if (uid) {
    return el('li', { class: 'tt-stu' }, el('span', { class: 'tt-stu-name', text: n }), el('span', { class: 'tt-stu-acc gone', text: '연결했던 계정이 지워졌어요' }), can ? smallBtn('끊기', unlink) : null);
  }
  if (!can || !ctx.students.length) return el('li', { class: 'tt-stu' }, el('span', { class: 'tt-stu-name', text: n }), el('span', { class: 'tt-stu-acc none', text: '계정 연결 안 됨' }));
  const used = new Set(Object.values(map));
  const cand = candidates(n, s).filter((x) => !used.has(x.uid));
  const others = ctx.students.filter((x) => !used.has(x.uid) && !cand.includes(x))
    .sort((a, b) => String(a.grade || '').localeCompare(String(b.grade || ''), 'ko') || String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  const opt = (x) => el('option', { value: x.uid, text: `${x.name} (${x.grade || '학년 없음'} · ${x.loginId || ''})` });
  const sel = el('select', { class: 'a-input tt-stu-sel', 'aria-label': `${n} 학생과 연결할 계정` },
    el('option', { value: '', text: cand.length ? `계정 연결 (후보 ${cand.length}명)` : '계정 연결…' }),
    cand.length ? el('optgroup', { label: '이름이 같은 계정' }, cand.map(opt)) : null,
    others.length ? el('optgroup', { label: '다른 학생' }, others.map(opt)) : null);
  sel.addEventListener('change', () => { if (sel.value) saveLinks(s, { ...map, [n]: sel.value }, `${n} 학생을 ${studentById(sel.value).name} 계정과 연결했어요.`); });
  return el('li', { class: 'tt-stu' }, el('span', { class: 'tt-stu-name', text: n }), sel);
}

async function saveLinks(s, map, okText) {
  const next = pruneLinks(map, s.students);
  try {
    await be.patchTimetableSlot(s.id, { studentLinks: next });
    s.studentLinks = next;
    infoFlash = { id: s.id, text: okText, kind: 'ok' };
  } catch (e) { infoFlash = { id: s.id, text: friendlyError(e), kind: 'err' }; }
  renderInfo();
}

function classSection(s, can) {
  const sec = el('section', { class: 'tt-info-sec', 'aria-labelledby': 'tt-info-cls' }, el('h3', { id: 'tt-info-cls', text: '클래스 연결' }));
  if (ctx.classesErr) { sec.append(note(ctx.classesErr)); return sec; }
  const c = s.classId && ctx.classes.find((x) => x.id === s.classId);
  if (s.classId && !c) {
    sec.append(note('연결했던 클래스가 지워졌어요.'));
    if (can) sec.append(smallBtn('연결 끊기', () => setClass(s, '')));
    return sec;
  }
  if (c) {
    const role = ctx.roleOfClass(c);
    const members = ctx.students.filter((st) => (st.classIds || []).includes(c.id));
    const linked = linkedUids(s);
    const missing = linked.filter((uid) => !members.some((m) => m.uid === uid));
    sec.append(el('p', { class: 'tt-cls' }, el('span', { class: 'tt-cls-name', text: c.name }), el('span', { class: 'tt-info-sub', text: `대표관리자 ${adminName(c.ownerId)} · 클래스 학생 ${members.length}명` })));
    if (linked.length) sec.append(el('p', { class: 'tt-info-sub', text: `이 수업에서 계정이 연결된 학생 ${linked.length}명 중 ${linked.length - missing.length}명이 클래스에 있어요.` }));
    const row = el('div', { class: 'tt-info-acts' });
    if (missing.length && role === 'owner') row.append(smallBtn(`클래스에 ${missing.length}명 넣기`, () => addToClass(s, c, missing), 'primary'));
    if (role !== 'none') row.append(smallBtn('클래스 열기', () => ctx.goToClass(c.id)));
    if (can) row.append(smallBtn('연결 끊기', () => setClass(s, '')));
    if (row.childNodes.length) sec.append(row);
    if (missing.length && role !== 'owner') sec.append(note(`클래스에 학생을 넣는 건 대표관리자 ${adminName(c.ownerId)}님만 할 수 있어요.`));
    const sibs = (state.slots || []).filter((x) => x.id !== s.id && x.classId === c.id).sort(byDayTime);
    if (sibs.length) sec.append(note(`같은 클래스로 연결된 수업: ${sibs.map(lessonLabel).join(', ')}`));
    return sec;
  }
  if (!can) { sec.append(note('연결된 클래스가 없어요.')); return sec; }
  const sorted = [...ctx.classes].sort((a, b) => (b.subject === s.subject) - (a.subject === s.subject) || String(a.name).localeCompare(String(b.name), 'ko'));
  const sel = el('select', { class: 'a-input', id: 'tt-cls-sel', 'aria-label': '연결할 클래스' },
    el('option', { value: '', text: sorted.length ? '클래스 고르기…' : '아직 만든 클래스가 없어요' }), ...sorted.map((x) => el('option', { value: x.id, text: x.name })));
  const go = smallBtn('연결', () => { if (sel.value) setClass(s, sel.value); else sel.focus(); });
  sec.append(el('div', { class: 'tt-cls-pick' }, sel, go),
    el('div', { class: 'tt-info-acts' }, smallBtn('이 수업으로 새 클래스 만들기', () => createClassFor(s))),
    note('클래스와 연결하면 이 수업 학생들의 숙제 공지·스탬프를 클래스에서 관리할 수 있어요.'));
  return sec;
}

// 요일만 다른 같은 수업(같은 선생님·학년·과목·시간): 클래스를 함께 연결할지 물어봄
const twinsOf = (s) => (state.slots || []).filter((x) => x.id !== s.id && !x.classId && x.teacher === s.teacher && x.grade === s.grade && x.subject === s.subject && x.start === s.start && x.end === s.end && canEditInfo(x)).sort(byDayTime);

async function setClass(s, classId, okText) {
  try {
    await be.patchTimetableSlot(s.id, { classId });
    s.classId = classId;
    let text = okText || (classId ? `'${(ctx.classes.find((x) => x.id === classId) || {}).name}' 클래스와 연결했어요.` : '클래스 연결을 끊었어요.');
    const twins = classId ? twinsOf(s) : [];
    if (twins.length && confirm(`요일만 다른 같은 수업이 있어요.\n${twins.map(lessonLabel).join('\n')}\n\n이 수업들도 같은 클래스와 연결할까요?`)) {
      for (const x of twins) { await be.patchTimetableSlot(x.id, { classId }); x.classId = classId; }
      text += ` (${twins.map((x) => x.day).join('·')}요일 수업도 함께)`;
    }
    infoFlash = { id: s.id, text, kind: 'ok' };
  } catch (e) { infoFlash = { id: s.id, text: friendlyError(e), kind: 'err' }; }
  renderInfo();
}

async function createClassFor(s) {
  const t = teacherOf(s.teacher);
  const acc = t ? teacherAdmin(t.id) : '';
  const owner = acc && adminById(acc) ? acc : ctx.me.uid;
  let name = [s.grade, s.subject].filter(Boolean).join(' ') + (t ? ` (${t.name})` : '');
  if (ctx.classes.some((c) => c.name === name)) name += ` ${s.day} ${short(s.start)}`;
  name = name.slice(0, 40);
  if (!confirm(`'${name}' 클래스를 만들고 이 수업과 연결할까요?\n대표관리자: ${adminLabel(owner)}${owner === ctx.me.uid ? ' (나)' : ''}\n\n클래스 이름과 대표관리자는 나중에 학생 관리 → 클래스에서 바꿀 수 있어요.`)) return;
  try {
    const id = await be.addClass({ name, subject: TT_SUBJECTS.includes(s.subject) ? s.subject : '기타', memo: `시간표: ${lessonLabel(s)}`, stampMax: STAMP_MAX_DEFAULT, ownerId: owner });
    const list = await be.listClasses();
    ctx.classes = list;
    ctx.classesChanged(list);
    await setClass(s, id, `'${name}' 클래스를 만들고 연결했어요.` + (owner !== ctx.me.uid ? ` 대표관리자 ${adminName(owner)}님이 학생·숙제·스탬프를 관리해요.` : ''));
  } catch (e) { infoFlash = { id: s.id, text: friendlyError(e), kind: 'err' }; renderInfo(); }
}

async function addToClass(s, c, uids) {
  try {
    await be.assignStudents(c.id, uids);
    uids.forEach((uid) => { const st = studentById(uid); if (st) st.classIds = [...new Set([...(st.classIds || []), c.id])]; });
    infoFlash = { id: s.id, text: `${uids.length}명을 '${c.name}' 클래스에 넣었어요.`, kind: 'ok' };
  } catch (e) { infoFlash = { id: s.id, text: friendlyError(e), kind: 'err' }; }
  renderInfo();
}

function actionsRow(s, can) {
  const row = el('div', { class: 'tt-info-acts main' });
  if (can) { const b = smallBtn(isEditor() ? '수업 고치기' : '수업 정보 고치기', () => openDialog(s), 'primary'); b.id = 'tt-info-edit'; row.append(b); }
  if (isEditor()) { const d = smallBtn('수업 삭제', () => removeSlot(s), 'danger'); d.id = 'tt-info-delete'; row.append(d); }
  return row.childNodes.length ? row : null;
}

function permissionNote(s, can, t, acc) {
  let text;
  if (isEditor()) text = '아벨학원 계정은 이 수업의 모든 내용을 고칠 수 있어요.';
  else if (can) text = '내가 맡은 수업이라 학년·학생·계정 연결·클래스 연결·메모를 고칠 수 있어요. 요일·시간·강의실·과목·선생님 바꾸기와 수업 추가·삭제는 아벨학원 계정만 할 수 있어요.';
  else if (t && acc) text = `이 수업은 ${t.name} 선생님과 아벨학원 계정만 고칠 수 있어요.`;
  else if (t) text = `${t.name} 선생님의 관리자 계정이 아직 연결되지 않아서, 지금은 아벨학원 계정만 고칠 수 있어요.`;
  else text = '이 수업은 아벨학원 계정만 고칠 수 있어요.';
  return el('p', { class: 'tt-info-perm', text });
}

async function removeSlot(s) {
  if (!isEditor()) return false;
  if (!confirm(`${s.day}요일 ${short(s.start)}~${short(s.end)} ${roomName(s.room)} ${s.grade} ${s.subject} 수업을 삭제할까요?`)) return false;
  try {
    await be.deleteTimetableSlot(s.id);
    state.slots = state.slots.filter((x) => x.id !== s.id);
    if (state.sel === s.id) state.sel = null;
    if (dlg.open) dlg.close();
    render();
    toast(`${s.day}요일 ${short(s.start)} ${s.grade} ${s.subject} 수업을 삭제했어요.`);
    return true;
  } catch (err) { flash(friendlyError(err), 'err'); render(); return false; }
}

/* ── 알림(되돌리기) ── */
let toastTimer = null;
function toast(text, undo) {
  const box = $('#tt-toast');
  const kids = [el('span', { text })];
  if (undo) {
    const b = el('button', { type: 'button', class: 'tt-toast-undo', text: '되돌리기' });
    b.addEventListener('click', async () => { hideToast(); await undo(); });
    kids.push(b);
  }
  box.replaceChildren(...kids);
  box.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 7000);
}
function hideToast() {
  const box = $('#tt-toast');
  box.classList.remove('show');
  box.replaceChildren();
}

/* ── 꾹 눌러서 끌기 (아벨학원 계정 · 편집 모드) ── */
const grid = $('#tt-grid');
let press = null;          // { kind: 'move' | 'new', el, slot, x, y, pid, timer, active, … }
let dragDoneAt = 0;
const dragEnded = () => Date.now() - dragDoneAt < 400; // 끌기를 마친 직후의 '누름'은 무시
const snap = (v, step) => Math.round(v / step) * step;

function pointAt(x, y) {
  const cols = [...grid.querySelectorAll('.tt-col')];
  if (!cols.length || !geo) return null;
  let i = cols.findIndex((c) => { const r = c.getBoundingClientRect(); return x >= r.left && x < r.right; });
  if (i < 0) i = x < cols[0].getBoundingClientRect().left ? 0 : cols.length - 1;
  const top = cols[0].getBoundingClientRect().top;
  return { roomIdx: i, room: geo.rooms[i].id, min: geo.from + ((y - top) / ROW_PX) * STEP };
}

grid.addEventListener('pointerdown', (e) => {
  if (!state.editMode || !isEditor() || press) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const block = e.target.closest('.tt-block');
  const col = !block && e.target.closest('.tt-col');
  if (!block && !col) return;
  press = { kind: block ? 'move' : 'new', el: block || col, slot: block ? slotById(block.dataset.id) : null, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, pid: e.pointerId, active: false };
  if (block && !press.slot) { press = null; return; }
  press.el.classList.add('pressing');
  press.timer = setTimeout(startDrag, LONG_MS);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
});
// 끄는 동안에는 화면이 같이 넘어가지 않도록
grid.addEventListener('touchmove', (e) => { if (press && press.active) e.preventDefault(); }, { passive: false });
grid.addEventListener('contextmenu', (e) => { if (state.editMode) e.preventDefault(); });

function startDrag() {
  if (!press) return;
  press.active = true;
  press.el.classList.remove('pressing');
  try { press.el.setPointerCapture(press.pid); } catch { /* 이미 손을 뗐으면 무시 */ }
  if (navigator.vibrate) { try { navigator.vibrate(15); } catch { /* 진동 없는 기기 */ } }
  document.body.classList.add('tt-dragging');
  const p = pointAt(press.x, press.y);
  if (press.kind === 'move') {
    const s = press.slot;
    press.dur = toMin(s.end) - toMin(s.start);
    press.grab = p ? p.min - toMin(s.start) : 0;
    press.target = { room: s.room, start: s.start, end: s.end };
    press.el.classList.add('dragging');
    press.el.setAttribute('aria-grabbed', 'true');
    $('#tt-trash').hidden = false;
    if (state.sel) closeInfo(false);
  } else {
    const start = Math.min(geo.to - 30, Math.max(geo.from, Math.floor((p ? p.min : geo.from) / 10) * 10));
    press.room = p ? p.room : geo.rooms[0].id;
    press.roomIdx = p ? p.roomIdx : 0;
    press.start = start;
    press.end = Math.min(geo.to, start + 60);
    press.ghost = el('div', { class: 'tt-block tt-ghost', 'aria-hidden': 'true' }, el('span', { class: 'tt-time' }), el('span', { class: 'tt-what', text: '새 수업' }));
    grid.append(press.ghost);
    placeGhost();
  }
  autoScroll();
}

function onMove(e) {
  if (!press || e.pointerId !== press.pid) return;
  press.lastX = e.clientX; press.lastY = e.clientY;
  if (!press.active) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOL) cancelPress(); // 화면 넘기기
    return;
  }
  e.preventDefault();
  follow();
}

function follow() {
  const p = pointAt(press.lastX, press.lastY);
  if (!p) return;
  if (press.kind === 'move') {
    const trash = $('#tt-trash').getBoundingClientRect();
    const overTrash = press.lastX >= trash.left && press.lastX <= trash.right && press.lastY >= trash.top && press.lastY <= trash.bottom;
    $('#tt-trash').classList.toggle('over', overTrash);
    press.el.classList.toggle('to-trash', overTrash);
    press.overTrash = overTrash;
    const start = Math.min(geo.to - press.dur, Math.max(geo.from, snap(p.min - press.grab, STEP)));
    press.target = { room: p.room, start: toHHMM(start), end: toHHMM(start + press.dur) };
    const r1 = (start - geo.from) / STEP + 2;
    press.el.style.gridColumn = String(p.roomIdx + 2);
    press.el.style.gridRow = `${r1} / ${r1 + press.dur / STEP}`;
    press.el.style.width = 'calc(100% - 4px)';
    press.el.style.marginLeft = '2px';
    press.el.querySelector('.tt-time').textContent = `${short(press.target.start)}~${short(press.target.end)} · ${roomName(p.room)}`;
  } else {
    press.end = Math.min(geo.to, Math.max(press.start + 30, snap(p.min, 10)));
    placeGhost();
  }
}

function placeGhost() {
  const r1 = (press.start - geo.from) / STEP + 2, r2 = (press.end - geo.from) / STEP + 2;
  press.ghost.style.gridColumn = String(press.roomIdx + 2);
  press.ghost.style.gridRow = `${r1} / ${r2}`;
  press.ghost.querySelector('.tt-time').textContent = `${short(toHHMM(press.start))}~${short(toHHMM(press.end))}`;
}

// 끄는 손가락·마우스가 가장자리에 가면 시간표를 따라 넘김
function autoScroll() {
  if (!press || !press.active) return;
  const sc = $('.tt-scroll');
  const r = sc.getBoundingClientRect();
  const edge = 40;
  let dx = 0, dy = 0;
  if (press.lastX < r.left + edge) dx = -12; else if (press.lastX > r.right - edge) dx = 12;
  if (!press.overTrash) { if (press.lastY < edge) dy = -12; else if (press.lastY > window.innerHeight - edge) dy = 12; }
  if (dx) sc.scrollLeft += dx;
  if (dy) window.scrollBy(0, dy);
  if (dx || dy) follow();
  requestAnimationFrame(autoScroll);
}

function endPress() {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
  if (press) { clearTimeout(press.timer); press.el.classList.remove('pressing'); if (press.ghost) press.ghost.remove(); }
  document.body.classList.remove('tt-dragging');
  $('#tt-trash').hidden = true;
  $('#tt-trash').classList.remove('over');
  const was = press;
  press = null;
  return was;
}
function cancelPress() { const was = endPress(); if (was && was.active) { dragDoneAt = Date.now(); renderGrid(); } }
function onCancel(e) { if (press && e.pointerId === press.pid) cancelPress(); }

async function onUp(e) {
  if (!press || e.pointerId !== press.pid) return;
  if (!press.active) { endPress(); return; } // 짧게 누름 → 보통 누르기(수업 정보)
  const p = endPress();
  dragDoneAt = Date.now();
  if (p.kind === 'new') {
    renderGrid();
    openDialog(null, { day: state.day, room: p.room, start: toHHMM(p.start), end: toHHMM(p.end) });
    return;
  }
  const s = p.slot;
  if (p.overTrash) { if (!(await removeSlot(s))) renderGrid(); return; }
  const tg = p.target;
  if (!tg || (tg.room === s.room && tg.start === s.start && tg.end === s.end)) { renderGrid(); return; }
  await moveSlot(s, { day: state.day, ...tg }, true);
}

async function moveSlot(s, to, withUndo) {
  const before = { day: s.day, room: s.room, start: s.start, end: s.end };
  try {
    await be.patchTimetableSlot(s.id, to);
    Object.assign(s, to);
    render();
    const again = document.querySelector(`#tt-grid [data-id="${s.id}"]`);
    if (again) again.focus({ preventScroll: true });
    const hit = conflicts(s.day).some((c) => c.a.id === s.id || c.b.id === s.id);
    toast(`${s.grade} ${s.subject} 수업을 ${s.day}요일 ${roomName(s.room)} ${short(s.start)}~${short(s.end)}(으)로 옮겼어요.` + (hit ? ' 시간이 겹치는 수업이 있어요.' : ''),
      withUndo ? () => moveSlot(s, before, false) : null);
  } catch (err) { flash(friendlyError(err), 'err'); render(); }
}

/* ── 수업 추가·수정 창 ── */
const dlg = $('#tt-dialog');
let editing = null;      // 고치는 수업 id (null이면 새 수업)
let infoOnly = false;    // 담당 선생님: 수업 정보만 고침
const STRUCT = ['#tt-day', '#tt-room', '#tt-start', '#tt-end', '#tt-subject', '#tt-teacher-sel'];

function fillSelects(v) {
  $('#tt-day').replaceChildren(...TT_DAYS.map((d) => el('option', { value: d, text: `${d}요일` })));
  const rs = rooms();
  const roomOpts = rs.map((r) => el('option', { value: r.id, text: r.name }));
  if (v.room && !rs.some((r) => r.id === v.room)) roomOpts.push(el('option', { value: v.room, text: '(지운 강의실)' }));
  $('#tt-room').replaceChildren(...roomOpts);
  $('#tt-teacher-sel').replaceChildren(el('option', { value: '', text: '정해지지 않음' }), ...teachers().map((t) => el('option', { value: t.id, text: t.name })));
  $('#tt-day').value = v.day; $('#tt-room').value = v.room;
}

function openDialog(slot, preset) {
  if (slot ? !canEditInfo(slot) : !isEditor()) return;
  dragDoneAt = 0;
  editing = slot ? slot.id : null;
  infoOnly = Boolean(slot) && !isEditor();
  const v = slot || { day: state.day, room: rooms()[0].id, start: '15:00', end: '16:20', grade: '', subject: '수학', teacher: state.teacher || '', students: '', memo: '', ...(preset || {}) };
  fillSelects(v);
  $('#tt-start').value = v.start; $('#tt-end').value = v.end;
  $('#tt-grade').value = v.grade || ''; $('#tt-subject').value = TT_SUBJECTS.includes(v.subject) ? v.subject : '기타';
  $('#tt-teacher-sel').value = teachers().some((t) => t.id === v.teacher) ? v.teacher : '';
  $('#tt-students').value = v.students || ''; $('#tt-memo').value = v.memo || '';
  STRUCT.forEach((sel) => { $(sel).disabled = infoOnly; });
  $('#tt-lock-note').hidden = !infoOnly;
  $('#tt-dlg-title').textContent = slot ? (infoOnly ? '수업 정보 고치기' : '수업 고치기') : '수업 추가';
  $('#tt-delete').hidden = !slot || !isEditor();
  $('#tt-copy').hidden = Boolean(slot);
  $('#tt-copy-days').replaceChildren(...TT_DAYS.map((d) => el('label', { class: 'tt-copy-day' }, el('input', { type: 'checkbox', value: d }), d)));
  syncCopyDays();
  message($('#tt-msg'), '');
  if (!dlg.open) dlg.showModal();
  (slot ? $('#tt-students') : $('#tt-start')).focus();
}
function syncCopyDays() {
  const d = $('#tt-day').value;
  document.querySelectorAll('#tt-copy-days input').forEach((c) => { const same = c.value === d; c.disabled = same; if (same) c.checked = false; c.parentElement.classList.toggle('off', same); });
}
$('#tt-day').addEventListener('change', syncCopyDays);
$('#tt-close').addEventListener('click', () => dlg.close());
$('#tt-add').addEventListener('click', () => openDialog(null));

function readForm() {
  return {
    day: $('#tt-day').value, room: $('#tt-room').value, start: $('#tt-start').value, end: $('#tt-end').value,
    grade: $('#tt-grade').value.trim(), subject: $('#tt-subject').value, teacher: $('#tt-teacher-sel').value,
    students: $('#tt-students').value.trim().replace(/\s+/g, ' '), memo: $('#tt-memo').value.trim()
  };
}

$('#tt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#tt-msg');
  const v = readForm();
  const old = editing && slotById(editing);
  if (!infoOnly) {
    if (!/^\d{2}:\d{2}$/.test(v.start) || !/^\d{2}:\d{2}$/.test(v.end)) return message(msg, '시작과 끝 시간을 정해 주세요.', 'err');
    if (toMin(v.end) <= toMin(v.start)) return message(msg, '끝 시간은 시작 시간보다 늦어야 해요.', 'err');
  }
  if (!v.grade && !v.students) return message(msg, '학년이나 학생 중 하나는 적어 주세요.', 'err');
  const copyDays = editing ? [] : [...document.querySelectorAll('#tt-copy-days input:checked')].map((c) => c.value);
  const targets = [v, ...copyDays.map((d) => ({ ...v, day: d }))];
  const moved = !old || ['day', 'room', 'start', 'end', 'teacher'].some((k) => old[k] !== v[k]);
  if (!infoOnly && moved) {
    // 겹침 미리 알려 주기 (요일·강의실·시간·선생님을 바꿀 때만)
    const others = (state.slots || []).filter((s) => s.id !== editing);
    const hits = [];
    targets.forEach((t) => others.filter((s) => s.day === t.day && overlap(s, t)).forEach((s) => {
      if (s.room === t.room) hits.push(`${t.day}요일 ${roomName(t.room)}: ${short(s.start)}~${short(s.end)} ${s.grade} ${s.subject}`);
      else if (t.teacher && s.teacher === t.teacher) hits.push(`${t.day}요일 ${teacherName(t.teacher)} 선생님: ${short(s.start)}~${short(s.end)} ${roomName(s.room)} ${s.grade} ${s.subject}`);
    }));
    if (hits.length && !confirm(`시간이 겹치는 수업이 있어요.\n${hits.slice(0, 6).join('\n')}${hits.length > 6 ? `\n…외 ${hits.length - 6}건` : ''}\n\n그래도 저장할까요?`)) return;
  }
  const btn = $('#tt-save');
  btn.disabled = true;
  try {
    if (old) {
      const fields = infoOnly
        ? { grade: v.grade, students: v.students, memo: v.memo, studentLinks: pruneLinks(old.studentLinks, v.students) }
        : { ...v, studentLinks: pruneLinks(old.studentLinks, v.students) };
      await be.patchTimetableSlot(old.id, fields);
      Object.assign(old, fields);
      state.sel = old.id;
    } else {
      await ensureMeta();
      const ids = await be.addTimetableSlots(targets);
      targets.forEach((t, i) => state.slots.push({ id: ids[i] || newId('s'), ...t, studentLinks: {}, classId: '' }));
      state.sel = ids[0] || null;
    }
    state.day = v.day;
    dlg.close();
    render();
    const again = document.querySelector(`#tt-grid [data-id="${state.sel || ''}"]`);
    if (again) again.focus(); else if (isEditor()) $('#tt-add').focus();
    if (!old) toast(copyDays.length ? `수업 ${targets.length}개를 추가했어요.` : '수업을 추가했어요.');
  } catch (err) {
    message(msg, friendlyError(err), 'err');
  } finally {
    btn.disabled = false;
  }
});

$('#tt-delete').addEventListener('click', async () => {
  const s = editing && slotById(editing);
  if (!s) return;
  $('#tt-delete').disabled = true;
  await removeSlot(s);
  $('#tt-delete').disabled = false;
});

$('#tt-print').addEventListener('click', () => window.print());

/* ── 설정: 제목·메모·강의실·선생님(색 · 관리자 계정) — 아벨학원 계정만 ── */
function renderSettings() {
  const box = $('#tt-settings-body');
  if (!isEditor()) { box.replaceChildren(); return; }
  const m = state.meta || { title: '시간표', note: '', rooms: rooms(), teachers: [], teacherAdmins: {} };
  const map = m.teacherAdmins || {};
  if (!draft) {
    draft = {
      title: m.title, note: m.note, rooms: m.rooms.map((r) => ({ ...r })),
      teachers: m.teachers.map((t) => ({ ...t, color: colorOf(t), link: Object.prototype.hasOwnProperty.call(map, t.id) ? map[t.id] : '__auto' }))
    };
  }
  const used = (key, id) => (state.slots || []).filter((s) => s[key] === id).length;
  const title = el('input', { class: 'a-input', id: 'tts-title', type: 'text', maxlength: String(TITLE_LEN), value: draft.title });
  title.addEventListener('input', () => { draft.title = title.value; });
  const noteIn = el('input', { class: 'a-input', id: 'tts-note', type: 'text', maxlength: String(NOTE_LEN), value: draft.note, placeholder: '예) 관리 선생님: 신은종 선생님' });
  noteIn.addEventListener('input', () => { draft.note = noteIn.value; });

  const roomRows = draft.rooms.map((r, i) => {
    const name = el('input', { class: 'a-input', type: 'text', maxlength: '20', value: r.name, 'aria-label': `${i + 1}번째 강의실 이름` });
    name.addEventListener('input', () => { r.name = name.value; });
    const n = used('room', r.id);
    const del = el('button', { type: 'button', class: 'a-btn small danger', text: '삭제', disabled: n > 0, title: n ? `수업 ${n}개가 있어서 지울 수 없어요` : null, 'aria-label': `${r.name} 삭제` });
    del.addEventListener('click', () => { draft.rooms.splice(i, 1); renderSettings(); });
    return el('li', {}, name, el('span', { class: 'tt-used', text: n ? `수업 ${n}개` : '수업 없음' }), del);
  });
  const addRoom = el('button', { type: 'button', class: 'a-btn small', text: '+ 강의실 추가' });
  addRoom.addEventListener('click', () => { if (draft.rooms.length >= 20) return; draft.rooms.push({ id: newId('r'), name: '' }); renderSettings(); box.querySelector('.tt-rooms li:last-child input').focus(); });

  const admins = [...ctx.admins].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  const tRows = draft.teachers.map((t, i) => {
    const name = el('input', { class: 'a-input', type: 'text', maxlength: '10', value: t.name, 'aria-label': `${i + 1}번째 선생님 이름` });
    const sw = el('i', { class: `tt-dot big tt-t${t.color}`, 'aria-hidden': 'true' });
    const color = el('select', { class: 'a-input tt-color', 'aria-label': `${t.name || i + 1 + '번째'} 선생님 색` }, TT_COLORS.map((c, ci) => el('option', { value: String(ci), selected: ci === t.color, text: c })));
    color.addEventListener('change', () => { t.color = Number(color.value); sw.className = `tt-dot big tt-t${t.color}`; });
    const matchOf = () => admins.filter((a) => normName(a.name) && normName(a.name) === normName(t.name));
    const autoText = () => { const hit = matchOf(); return hit.length === 1 ? `이름이 같은 계정: ${hit[0].name}` : hit.length > 1 ? '이름이 같은 계정이 여러 개라 직접 골라 주세요' : '이름이 같은 관리자 계정 없음'; };
    const link = el('select', { class: 'a-input tt-link', 'aria-label': `${t.name || i + 1 + '번째'} 선생님과 연결할 관리자 계정` },
      el('option', { value: '__auto', text: `자동 (${autoText()})` }),
      el('option', { value: '', text: '연결 안 함' }),
      admins.map((a) => el('option', { value: a.uid, text: `${a.name || '(이름 없음)'} (${a.email || ''})` })));
    link.value = t.link === '__auto' || t.link === '' || admins.some((a) => a.uid === t.link) ? t.link : '__auto';
    link.addEventListener('change', () => { t.link = link.value; });
    name.addEventListener('input', () => { t.name = name.value; link.options[0].textContent = `자동 (${autoText()})`; });
    const n = used('teacher', t.id);
    const del = el('button', { type: 'button', class: 'a-btn small danger', text: '삭제', disabled: n > 0, title: n ? `수업 ${n}개가 있어서 지울 수 없어요` : null, 'aria-label': `${t.name} 선생님 삭제` });
    del.addEventListener('click', () => { draft.teachers.splice(i, 1); renderSettings(); });
    return el('li', { class: 'tt-trow' },
      el('div', { class: 'tt-trow-top' }, sw, name, color, el('span', { class: 'tt-used', text: n ? `수업 ${n}개` : '수업 없음' }), del),
      el('div', { class: 'tt-trow-link' }, el('span', { class: 'tt-link-label', text: '관리자 계정' }), link));
  });
  const addT = el('button', { type: 'button', class: 'a-btn small', text: '+ 선생님 추가' });
  addT.addEventListener('click', () => {
    if (draft.teachers.length >= 30) return;
    const usedColors = new Set(draft.teachers.map((t) => t.color));
    const free = TT_COLORS.findIndex((c, i) => !usedColors.has(i));
    draft.teachers.push({ id: newId('t'), name: '', short: '', color: free < 0 ? draft.teachers.length % TT_COLORS.length : free, link: '__auto' });
    renderSettings();
    box.querySelector('.tt-teachers li:last-child input[type="text"]').focus();
  });

  const msg = el('p', { class: 'a-msg', role: 'status', hidden: true });
  const save = el('button', { type: 'button', class: 'a-btn primary', id: 'tts-save', text: '설정 저장' });
  const reset = el('button', { type: 'button', class: 'a-btn', text: '되돌리기' });
  reset.addEventListener('click', () => { draft = null; renderSettings(); });
  save.addEventListener('click', async () => {
    const ts = draft.teachers.map((t) => ({ id: t.id, name: t.name.trim(), short: (t.short || '').trim(), color: t.color, link: t.link })).filter((t) => t.name || used('teacher', t.id));
    const next = {
      title: draft.title.trim() || '시간표', note: draft.note.trim(),
      rooms: draft.rooms.map((r) => ({ id: r.id, name: r.name.trim() })),
      teachers: ts.map(({ id, name, short: sh, color }) => ({ id, name, short: sh, color })),
      teacherAdmins: {}
    };
    if (!next.rooms.length) return message(msg, '강의실이 하나는 있어야 해요.', 'err');
    if (next.rooms.some((r) => !r.name)) return message(msg, '강의실 이름을 모두 적어 주세요.', 'err');
    if (new Set(next.rooms.map((r) => r.name)).size !== next.rooms.length) return message(msg, '같은 이름의 강의실이 있어요.', 'err');
    if (next.teachers.some((t) => !t.name)) return message(msg, '선생님 이름을 모두 적어 주세요.', 'err');
    ts.forEach((t) => { if (t.link !== '__auto') next.teacherAdmins[t.id] = t.link; });
    // '자동'인 선생님은 저장하면서 이름이 같은 관리자 계정과 연결
    ts.forEach((t) => {
      if (t.link !== '__auto') return;
      const hit = ctx.admins.filter((a) => normName(a.name) && normName(a.name) === normName(t.name));
      if (hit.length === 1) next.teacherAdmins[t.id] = hit[0].uid;
    });
    save.disabled = true;
    try {
      await be.saveTimetableMeta(next);
      state.meta = { exists: true, ...next, updatedAt: new Date() };
      draft = null;
      render();
      message($('#tt-settings-body .a-msg'), '설정을 저장했어요.', 'ok');
    } catch (err) { message(msg, friendlyError(err), 'err'); save.disabled = false; }
  });

  box.replaceChildren(
    el('div', { class: 'a-form', style: 'margin-top: 14px;' },
      el('div', { class: 'a-fld span-2' }, el('label', { for: 'tts-title', text: '시간표 제목' }), title),
      el('div', { class: 'a-fld span-2' }, el('label', { for: 'tts-note' }, '메모 ', el('span', { class: 'hint', text: '시간표 위에 함께 보여요' })), noteIn)),
    el('div', { class: 'tt-set-grid' },
      el('div', {}, el('h3', { text: '강의실' }), el('p', { class: 'view-note', text: '시간표의 열 순서예요. 수업이 있는 강의실은 지울 수 없어요.' }), el('ul', { class: 'tt-set-list tt-rooms' }, roomRows), addRoom),
      el('div', {}, el('h3', { text: '선생님' }),
        el('p', { class: 'view-note', text: '시간표에 보이는 이름(풀네임)과 색이에요. 관리자 계정과 연결하면 그 선생님이 자기 수업의 정보(학생·계정 연결·클래스 연결·메모)를 고칠 수 있어요. \'자동\'은 이름이 같은 관리자 계정과 연결해요.' }),
        el('ul', { class: 'tt-set-list tt-teachers' }, tRows), addT)),
    el('div', { class: 'a-row', style: 'margin-top: 18px;' }, save, reset),
    msg);
}

/* ── 파일 불러오기 · 내려받기 (아벨학원 계정) ── */
function validDraft(d) {
  if (!d || d.type !== 'abel-timetable' || !Array.isArray(d.slots) || !Array.isArray(d.rooms)) return '아벨학원 시간표 파일이 아니에요.';
  const ids = new Set(d.rooms.map((r) => r.id));
  const tids = new Set((d.teachers || []).map((t) => t.id));
  for (const s of d.slots) {
    if (!TT_DAYS.includes(s.day) || !ids.has(s.room) || !/^\d{2}:\d{2}$/.test(s.start) || !/^\d{2}:\d{2}$/.test(s.end) || s.start >= s.end) return `잘못된 수업이 있어요: ${s.day} ${s.start}~${s.end}`;
    if (s.teacher && !tids.has(s.teacher)) return '선생님 목록에 없는 선생님이 있어요.';
  }
  if (d.rooms.length > 20 || (d.teachers || []).length > 30) return '강의실이나 선생님이 너무 많아요.';
  return '';
}

$('#tt-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  const msg = $('#tt-io-msg');
  if (!f || !isEditor()) return;
  let d;
  try { d = JSON.parse(await f.text()); } catch { return message(msg, '파일을 읽을 수 없어요. 시간표 초안 파일(.json)인지 확인해 주세요.', 'err'); }
  const bad = validDraft(d);
  if (bad) return message(msg, bad, 'err');
  const now = (state.slots || []).length;
  if (!confirm(`'${d.title || '시간표'}' 파일에는 수업이 ${d.slots.length}개 있어요.\n${now ? `지금 시간표의 수업 ${now}개를 모두 지우고(학생 계정 연결·클래스 연결 포함) ` : ''}이 파일로 바꿀까요?`)) return;
  try {
    message(msg, '불러오는 중…', 'ok');
    const meta = {
      title: String(d.title || '시간표').slice(0, TITLE_LEN), note: String(d.note || '').slice(0, NOTE_LEN),
      rooms: d.rooms.map((r) => ({ id: String(r.id), name: String(r.name).slice(0, 20) })),
      teachers: (d.teachers || []).map((t, i) => ({ id: String(t.id), name: String(t.name).slice(0, 10), short: String(t.short || '').slice(0, 2), color: Number.isInteger(t.color) && t.color >= 0 && t.color < TT_COLORS.length ? t.color : i % TT_COLORS.length })),
      teacherAdmins: {}
    };
    const keepLinks = (m) => (m && typeof m === 'object' && !Array.isArray(m) ? Object.fromEntries(Object.entries(m).filter(([k, v]) => typeof v === 'string').slice(0, 40)) : {});
    const slots = d.slots.map((s) => ({
      day: s.day, room: s.room, start: s.start, end: s.end, grade: String(s.grade || '').slice(0, 20), subject: TT_SUBJECTS.includes(s.subject) ? s.subject : '기타',
      teacher: s.teacher || '', students: String(s.students || '').slice(0, 200), memo: String(s.memo || '').slice(0, 200),
      studentLinks: keepLinks(s.studentLinks), classId: typeof s.classId === 'string' ? s.classId.slice(0, 40) : ''
    }));
    await be.replaceTimetable(meta, slots);
    draft = null;
    state.sel = null;
    await loadTimetable(true);
    message(msg, `'${meta.title}'을(를) 불러왔어요. 수업 ${slots.length}개 · 강의실 ${meta.rooms.length}개 · 선생님 ${meta.teachers.length}명`, 'ok');
  } catch (err) { message(msg, friendlyError(err), 'err'); }
});

$('#tt-export').addEventListener('click', () => {
  const m = state.meta || { title: '시간표', note: '', rooms: rooms(), teachers: [] };
  const data = {
    type: 'abel-timetable', version: 2, title: m.title, note: m.note, rooms: m.rooms, teachers: m.teachers,
    slots: (state.slots || []).map(({ day, room, start, end, grade, subject, teacher, students, memo, studentLinks, classId }) => ({ day, room, start, end, grade, subject, teacher, students, memo, studentLinks: studentLinks || {}, classId: classId || '' }))
      .sort(byDayTime)
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  const a = el('a', { href: url, download: `아벨학원-시간표-${todayString()}.json` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  message($('#tt-io-msg'), '지금 시간표를 파일로 내려받았어요.', 'ok');
});
