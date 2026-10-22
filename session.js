// 모든 페이지 공통: 머리글의 '로그인 · 회원가입' ↔ '내 이름 · 로그아웃' 전환, 로그인 처리
import * as be from './backend.js';
import { el } from './common.js';

const box = document.getElementById('auth-links');
const here = location.pathname.split('/').pop() || 'index.html';
let currentUser = null;

function signedOutLinks() {
  if (!box) return;
  box.replaceChildren(
    el('a', { href: 'login.html', 'aria-current': here === 'login.html' ? 'page' : null, text: '로그인' }),
    el('span', { class: 'util-sep', 'aria-hidden': 'true' }),
    el('a', { href: 'signup.html', 'aria-current': here === 'signup.html' ? 'page' : null, text: '회원가입' })
  );
}

function signedInLinks(label, href) {
  if (!box) return;
  const out = el('button', { type: 'button', class: 'util-btn', text: '로그아웃' });
  out.addEventListener('click', () => be.signOutUser());
  box.replaceChildren(
    el('a', { href, text: label }),
    el('span', { class: 'util-sep', 'aria-hidden': 'true' }),
    out
  );
}

async function update(user) {
  if (!user) { signedOutLinks(); return; }
  try {
    const st = await be.getStudent(user.uid);
    if (st && st.active) { signedInLinks(`${st.name}님`, 'videos.html'); return; }
    if (!st && (await be.isAdmin(user.uid))) { signedInLinks('관리자 화면', 'admin.html'); return; }
  } catch (e) {
    console.warn('로그인 상태 확인 실패', e);
  }
  signedOutLinks(); // 회원 정보가 없거나 사용 중지된 계정
}

// 회원가입 직후처럼 회원 정보가 막 생겼을 때 머리글을 다시 그림
export function refreshHeader() {
  return update(currentUser);
}

if (be.configured) {
  be.onUser((user) => { currentUser = user; update(user); });
}

// 학생 로그인: 아이디·비밀번호 확인 → 회원 정보·사용 상태 확인 → 접속 기록 1건 남김
// 관리자 이메일로 로그인하면 { admin: true }를 돌려줌
export async function logIn(id, password) {
  const u = await be.signIn(id, password);
  const st = await be.getStudent(u.uid);
  if (!st) {
    if (await be.isAdmin(u.uid).catch(() => false)) return { admin: true };
    await be.signOutUser();
    throw Object.assign(new Error('no profile'), { code: 'app/no-profile' });
  }
  if (!st.active) {
    await be.signOutUser();
    throw Object.assign(new Error('inactive'), { code: 'app/inactive' });
  }
  await be.recordLogin(st).catch((e) => console.warn('접속 기록 실패', e));
  return { student: st };
}
