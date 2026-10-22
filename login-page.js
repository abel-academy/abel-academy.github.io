// 로그인 페이지
import * as be from './backend.js';
import { logIn } from './session.js';
import { friendlyError, safeNext } from './common.js';

const $ = (s) => document.querySelector(s);
const form = $('#login-form');
const err = $('#lg-error');
const next = safeNext(new URLSearchParams(location.search).get('next')) || 'videos.html';
let busy = false;

function setError(msg) { err.textContent = msg || ''; err.hidden = !msg; }
function showForm(on) { form.hidden = !on; $('#lg-already').hidden = on; }

if (!be.configured) {
  const s = $('#lg-status');
  s.textContent = '로그인 서비스를 준비하고 있어요. 조금만 기다려 주세요.';
  s.hidden = false;
  form.hidden = true;
} else {
  be.onUser(async (user) => {
    if (busy) return;
    if (!user) { showForm(true); return; }
    const st = await be.getStudent(user.uid).catch(() => null);
    showForm(!(st && st.active));
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');
  const id = $('#lg-id').value.trim();
  const pw = $('#lg-pw').value;
  if (!id || !pw) { setError('아이디와 비밀번호를 모두 입력해 주세요.'); return; }
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = '로그인 중…';
  busy = true;
  try {
    const r = await logIn(id, pw);
    location.href = r.admin ? 'admin.html' : next;
  } catch (ex) {
    busy = false;
    setError(friendlyError(ex));
    btn.disabled = false; btn.textContent = '로그인';
  }
});

$('#lg-out').addEventListener('click', () => be.signOutUser());
