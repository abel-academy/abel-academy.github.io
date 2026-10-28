// 학생 페이지·선생님 페이지가 함께 쓰는 작은 도구들
export const GRADES_HIGH = ['고1', '고2', '고3'];
// 회원·보충 강의 학년 (초4 ~ 고3)
export const GRADES_ALL = ['초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
export const GRADE_GROUPS = [['초등부', ['초4', '초5', '초6']], ['중등부', ['중1', '중2', '중3']], ['고등부', ['고1', '고2', '고3']]];
// 만 14세 미만일 수 있는 학년: 가입할 때 보호자(법정대리인) 동의 확인이 필요
export const UNDER14_GRADES = ['초4', '초5', '초6', '중1', '중2'];
export const SUBJECTS = ['국어', '영어', '수학'];
// 학생 수강 과목: 학생 계정마다 선생님이 정하고, 학생은 수강 과목의 보충 강의만 볼 수 있음
export const subjectsOf = (st) => SUBJECTS.filter((s) => Array.isArray(st && st.subjects) && st.subjects.includes(s));
export const SUBJECT_CLASS = { '국어': 'ko', '영어': 'en', '수학': 'ma' };
export const APPLY_TYPES = ['입학 상담', '특강 신청'];
export const APPLY_GRADES = ['초등학교 4학년', '초등학교 5학년', '초등학교 6학년', '중학교 1학년', '중학교 2학년', '중학교 3학년', '고등학교 1학년', '고등학교 2학년', '고등학교 3학년'];
export const APPLY_TIMES = ['평일 오후', '평일 저녁', '주말'];
// 특강 구분: 선생님 화면에서 추가·삭제 (아직 한 번도 저장하지 않았을 때 쓰는 기본값)
export const DEFAULT_SPECIALS = ['겨울방학 특강', '여름방학 특강', '시험 대비 특강'];
export const SPECIAL_MAX = 20;
export const NOTICE_CATEGORIES = ['공지', '안내', '설명회', '모집', '행사'];
export const CLASS_SUBJECTS = ['국어', '영어', '수학', '기타'];
// 클래스 스탬프판 칸 수 (클래스마다 선생님이 정함)
export const STAMP_MAX_DEFAULT = 10;
export const STAMP_MAX_LIMIT = 100;
// 스탬프 규칙(클래스마다 최대 15개, 한 줄 40자)과 다 모았을 때 상품(100자)
export const STAMP_RULES_MAX = 15;
export const STAMP_RULE_LEN = 40;
export const PRIZE_LEN = 100;
// 강의실별 시간표
export const TT_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
export const TT_SUBJECTS = ['국어', '영어', '수학', '기타'];
// 처음 강의실 목록 (2·3강의실은 쓰지 않아 뺐어요. 시간표 설정에서 언제든 추가할 수 있어요)
export const TT_DEFAULT_ROOMS = [{ id: 'r1', name: '1강의실' }, { id: 'r4', name: '4강의실' }, { id: 'r5', name: '5강의실' }, { id: 'r6', name: '6강의실' }, { id: 'r7', name: '7강의실' }];
// 선생님 색 (시간표 칸 배경). 순서대로 선생님에게 하나씩, 시간표 설정에서 바꿀 수 있어요
export const TT_COLORS = ['주황', '노랑', '초록', '파랑', '보라', '분홍', '청록', '갈색', '회색', '연두'];
// 아벨학원 계정: 시간표를 짜고 고치는 계정 + 모든 클래스의 서브선생님(보기 전용) 기본 계정
export const ACADEMY_EMAIL = 'abelelara7098@gmail.com';
export const DEFAULT_SUB_EMAIL = ACADEMY_EMAIL;
export function stampMaxOf(c) {
  const n = Number(c && c.stampMax);
  return Number.isInteger(n) && n >= 1 && n <= STAMP_MAX_LIMIT ? n : STAMP_MAX_DEFAULT;
}
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

// 숙제 마감일 표시: { text: 'D-3', kind: 'soon' | 'today' | 'later' | 'past', date: '10.30(목)' }
export function dueInfo(due) {
  const m = String(due || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const left = Math.round((d - today) / 864e5);
  const date = `${Number(m[2])}.${Number(m[3])}(${'일월화수목금토'[d.getDay()]})`;
  if (left < 0) return { text: '마감 지남', kind: 'past', date };
  if (left === 0) return { text: '오늘 마감', kind: 'today', date };
  return { text: `D-${left}`, kind: left <= 3 ? 'soon' : 'later', date };
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
    'auth/missing-email': '이메일 주소를 입력해 주세요.',
    'auth/unauthorized-continue-uri': 'Firebase 승인된 도메인 설정을 확인해 주세요.',
    'auth/operation-not-allowed': '회원가입이 아직 켜져 있지 않아요. 학원에 문의해 주세요.',
    'app/no-profile': '회원 정보를 찾을 수 없어요. 학원에 문의해 주세요.',
    'app/inactive': '사용이 중지된 계정이에요. 학원에 문의해 주세요.',
    'app/pending': '보호자 동의를 확인하는 중이에요. 학원에서 보호자께 확인 연락을 드린 뒤 사용할 수 있어요.',
    'permission-denied': '권한이 없어요. 계정 상태나 보안 규칙 설정을 확인해 주세요.',
    'unavailable': '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.'
  };
  return map[code] || '문제가 생겼어요. 잠시 후 다시 시도해 주세요.' + (code ? ` (${code})` : '');
}
