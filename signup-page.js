// 회원가입 페이지: 가입하면 바로 로그인되고 보충 강의를 볼 수 있음
import * as be from './backend.js';
import { refreshHeader } from './session.js';
import { GRADES_ALL, UNDER14_GRADES, ID_RE, friendlyError } from './common.js';

const $ = (s) => document.querySelector(s);
const form = $('#signup-form');
const err = $('#su-error');
let busy = false;

// 초4~중2를 고르면 보호자 동의 칸을 보여 줌
const gradeSel = $('#su-grade');
const guardianBox = $('#su-guardian');
function toggleGuardian() {
  const need = UNDER14_GRADES.includes(gradeSel.value);
  guardianBox.hidden = !need;
  $('#su-gname').required = need;
  $('#su-gphone').required = need;
}
gradeSel.addEventListener('change', toggleGuardian);
toggleGuardian();

function setError(msg, focusEl) {
  err.textContent = msg || '';
  err.hidden = !msg;
  if (msg && focusEl) focusEl.focus();
}

if (!be.configured) {
  form.hidden = true;
  $('#su-already').hidden = true;
  setError('회원가입 서비스를 준비하고 있어요. 조금만 기다려 주세요.');
  form.before(err);
} else {
  be.onUser(async (user) => {
    if (busy) return;
    if (!user) { form.hidden = false; $('#su-already').hidden = true; return; }
    const st = await be.getStudent(user.uid).catch(() => null);
    const admin = st ? false : await be.isAdmin(user.uid).catch(() => false);
    const signedIn = Boolean((st && st.active) || admin);
    form.hidden = signedIn;
    $('#su-already').hidden = !signedIn;
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setError('');
  const name = $('#su-name').value.trim();
  const grade = $('#su-grade').value;
  const loginId = be.normalizeLoginId($('#su-id').value);
  const pw = $('#su-pw').value;
  const pw2 = $('#su-pw2').value;
  if (!name || name.length > 20) return setError('이름을 입력해 주세요. (20자 이내)', $('#su-name'));
  if (!GRADES_ALL.includes(grade)) return setError('학년을 골라 주세요.', $('#su-grade'));
  const needsGuardian = UNDER14_GRADES.includes(grade);
  const guardianName = $('#su-gname').value.trim();
  const guardianPhone = $('#su-gphone').value.trim();
  if (needsGuardian && (!guardianName || guardianName.length > 20)) return setError('보호자 이름을 입력해 주세요.', $('#su-gname'));
  if (needsGuardian && !/^[0-9+() -]{8,20}$/.test(guardianPhone)) return setError('보호자 연락처를 숫자와 - 로 입력해 주세요. (예: 010-1234-5678)', $('#su-gphone'));
  if (!ID_RE.test(loginId)) return setError('아이디는 영문 소문자와 숫자로 3~20자로 정해 주세요.', $('#su-id'));
  if (pw.length < 8) return setError('비밀번호는 8자 이상으로 정해 주세요.', $('#su-pw'));
  if (pw !== pw2) return setError('비밀번호와 비밀번호 확인이 서로 달라요.', $('#su-pw2'));
  if (!$('#su-agree').checked) return setError('개인정보 수집·이용에 동의해야 가입할 수 있어요.', $('#su-agree'));

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = '가입하는 중…';
  busy = true;
  try {
    const st = await be.signUp({ loginId, password: pw, name, grade, guardianName: needsGuardian ? guardianName : undefined, guardianPhone: needsGuardian ? guardianPhone : undefined });
    form.hidden = true;
    if (needsGuardian) {
      // 보호자 동의 확인 전에는 쓸 수 없으므로 로그아웃해 둠
      await be.signOutUser();
      $('#su-done-msg').textContent = `${name}님, 가입 신청이 접수되었어요. 학원에서 보호자(${guardianName})께 전화로 동의를 확인한 뒤 아이디 ${loginId}로 로그인할 수 있어요.`;
      $('#su-done a').hidden = true;
      $('#su-done').hidden = false;
      $('#su-done').focus();
    } else {
      await be.recordLogin(st).catch((ex) => console.warn('접속 기록 실패', ex));
      await refreshHeader();
      $('#su-done-msg').textContent = `${name}님, 가입을 환영해요! 아이디 ${loginId}로 로그인되었어요.`;
      $('#su-done').hidden = false;
      $('#su-done a').focus();
    }
  } catch (ex) {
    busy = false;
    setError(friendlyError(ex), ex.code === 'auth/email-already-in-use' ? $('#su-id') : null);
    btn.disabled = false; btn.textContent = '가입하기';
  }
});

$('#su-out').addEventListener('click', () => be.signOutUser());
