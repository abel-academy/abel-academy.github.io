// 상담·특강 신청서
// 1) Firebase에 신청서를 저장 → 관리자 화면 '상담 신청서'에서 바로 확인
// 2) Netlify로 배포한 경우에는 Netlify Forms에도 보내 알림 메일을 받음 (GitHub Pages에서는 자동으로 건너뜀)
import * as be from './backend.js';
import { APPLY_TYPES, APPLY_GRADES, APPLY_TIMES, monthKey } from './common.js';

const form = document.getElementById('apply-form');

if (form) {
  const btn = form.querySelector('button[type="submit"]');
  const btnText = btn ? btn.textContent : '';
  const errBox = document.getElementById('apply-error');

  // 홈 화면의 '특강 신청하기'(contact.html?type=special)로 들어오면 특강 신청을 미리 선택
  if (new URLSearchParams(location.search).get('type') === 'special') {
    const r = form.querySelector('input[name="apply_type"][value="특강 신청"]');
    if (r) r.checked = true;
  }

  const showError = (msg) => { if (errBox) { errBox.textContent = msg; errBox.hidden = !msg; } };
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);

  // Netlify Forms로 보내기 (Netlify가 아닌 곳에서는 실패하므로 결과만 돌려줌)
  async function sendToNetlify(fd) {
    try {
      const res = await withTimeout(fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fd).toString()
      }), 5000);
      return res.ok;
    } catch {
      return false;
    }
  }

  let sending = false;

  form.addEventListener('submit', async (e) => {
    if (!be.configured) return; // Firebase 설정 전: 원래 방식(Netlify Forms)으로 제출
    e.preventDefault();
    if (sending) return;
    sending = true;
    showError('');
    if (btn) { btn.disabled = true; btn.textContent = '보내는 중…'; }

    const fd = new FormData(form);
    const isBot = String(fd.get('bot-field') || '').trim() !== '';
    if (isBot) { location.href = 'thanks.html'; return; }

    const type = String(fd.get('apply_type') || '');
    const time = String(fd.get('preferred_time') || '');
    const grade = String(fd.get('grade') || '');
    const application = {
      type: APPLY_TYPES.includes(type) ? type : '입학 상담',
      studentName: String(fd.get('student_name') || '').trim().slice(0, 20),
      grade: APPLY_GRADES.includes(grade) ? grade : '',
      phone: String(fd.get('parent_phone') || '').trim(),
      subjects: [['국어', 'subject_korean'], ['영어', 'subject_english'], ['수학', 'subject_math']]
        .filter(([, field]) => fd.get(field)).map(([name]) => name),
      preferredTime: APPLY_TIMES.includes(time) ? time : '',
      message: String(fd.get('message') || '').trim().slice(0, 2000),
      month: monthKey()
    };
    if (!/^[0-9+() -]{8,20}$/.test(application.phone)) {
      sending = false;
      if (btn) { btn.disabled = false; btn.textContent = btnText; }
      showError('학부모 연락처를 숫자와 - 로 입력해 주세요. (예: 010-1234-5678)');
      form.querySelector('[name="parent_phone"]').focus();
      return;
    }

    let saved = false;
    try {
      await withTimeout(be.addApplication(application), 8000);
      saved = true;
    } catch (err) {
      console.warn('신청서 저장 실패', err);
    }
    const mailed = await sendToNetlify(fd);

    if (saved || mailed) {
      location.href = 'thanks.html';
      return;
    }
    sending = false;
    if (btn) { btn.disabled = false; btn.textContent = btnText; }
    showError('신청서를 보내지 못했어요. 인터넷 연결을 확인하고 다시 시도하시거나, 전화(010-2078-7098)로 상담을 신청해 주세요.');
  });

  // 뒤로 가기로 돌아왔을 때 버튼을 다시 쓸 수 있게
  window.addEventListener('pageshow', () => {
    sending = false;
    if (btn) { btn.disabled = false; btn.textContent = btnText; }
  });
}
