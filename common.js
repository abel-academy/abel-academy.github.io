// 학생 페이지·관리자 페이지가 함께 쓰는 작은 도구들
export const GRADES_HIGH = ['고1', '고2', '고3'];
export const SUBJECTS = ['국어', '영어', '수학'];
export const SUBJECT_CLASS = { '국어': 'ko', '영어': 'en', '수학': 'ma' };
export const APPLY_TYPES = ['입학 상담', '특강 신청'];
export const APPLY_GRADES = ['중학교 1학년', '중학교 2학년', '중학교 3학년', '고등학교 1학년', '고등학교 2학년', '고등학교 3학년'];
export const APPLY_TIMES = ['평일 오후', '평일 저녁', '주말'];
export const NOTICE_CATEGORIES = ['공지', '안내', '설명회', '모집', '행사'];
export const ID_RE = /^[a-z0-9]{3,20}$/;

// 로그인 뒤 돌아갈 페이지: 이 홈페이지 안의 페이지 이름만 허용 (다른 사이트로 보내는 주소 차단)
export function safeNext(v) {
  return /^[a-z]+\.html$/.test(String(v || '')) ? v : null;
}

// 여러 형태의 유튜브 주소에서 영상 ID(11자리)만 꺼냄
export function youtubeId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function thumbUrl(id) {
  return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
}

const pad = (n) => String(n).padStart(2, '0');

export function formatDate(v) {
  if (!v) return '';
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    return m ? `${m[1]}.${pad(m[2])}.${pad(m[3])}` : v;
  }
  const d = v instanceof Date ? v : new Date(v);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

export function formatDateTime(v) {
  if (!v) return '—';
  const d = v instanceof Date ? v : new Date(v);
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// 요소를 만들고 글자는 textContent로만 넣음 (입력값이 화면 코드로 해석되지 않도록)
export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

// Firebase 오류를 알아듣기 쉬운 문장으로
export function friendlyError(err) {
  const code = (err && err.code) || '';
  const map = {
    'app/not-configured': '아직 Firebase 연결 설정을 하지 않았어요. 안내서(README)의 순서대로 설정해 주세요.',
    'auth/invalid-credential': '아이디(또는 이메일)와 비밀번호를 다시 확인해 주세요.',
    'auth/wrong-password': '아이디(또는 이메일)와 비밀번호를 다시 확인해 주세요.',
    'auth/user-not-found': '아이디(또는 이메일)와 비밀번호를 다시 확인해 주세요.',
    'auth/invalid-email': '아이디는 영문 소문자·숫자로 입력해 주세요.',
    'auth/missing-password': '비밀번호를 입력해 주세요.',
    'auth/too-many-requests': '여러 번 틀려서 잠시 막혔어요. 몇 분 뒤에 다시 시도해 주세요.',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
    'auth/email-already-in-use': '이미 사용 중인 아이디예요. 다른 아이디를 정해 주세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
    'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해 주세요.',
    'auth/operation-not-allowed': '회원가입이 아직 켜져 있지 않아요. 학원에 문의해 주세요.',
    'app/no-profile': '회원 정보를 찾을 수 없어요. 학원에 문의해 주세요.',
    'app/inactive': '사용이 중지된 계정이에요. 학원에 문의해 주세요.',
    'permission-denied': '권한이 없어요. 계정 상태나 보안 규칙 설정을 확인해 주세요.',
    'unavailable': '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.'
  };
  return map[code] || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.' + (code ? ` (${code})` : '');
}
