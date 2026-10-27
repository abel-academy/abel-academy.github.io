// 학생 전용 페이지: 로그인한(사용 중인) 회원에게만 [보충 강의] [클래스] 두 탭을 보여 줌
import * as be from './backend.js';
import { logIn } from './session.js';
import { SUBJECT_CLASS, youtubeId, thumbUrl, formatDate, el, friendlyError } from './common.js';
import { renderClasses } from './student-classes.js';

const $ = (s) => document.querySelector(s);
const status = $('#v-status');
const loginBox = $('#v-login');
const listBox = $('#v-list');
const loginForm = $('#login-form');
const loginErr = $('#lg-error');
let viewer = null; // 지금 보고 있는 학생 (선생님 미리보기일 때는 null)
let shown = null;  // 화면에 띄운 학생 정보 { st, adminPreview }
let classLoaded = false;

function show(which, message) {
  status.hidden = which !== 'status';
  if (message != null) status.textContent = message;
  loginBox.hidden = which !== 'login';
  listBox.hidden = which !== 'list';
}

function setLoginError(msg) {
  loginErr.textContent = msg || '';
  loginErr.hidden = !msg;
}

/* ── 큰 탭: 보충 강의 / 클래스 ── */
const stabs = [...document.querySelectorAll('.stab')];
function selectSection(name, focus) {
  stabs.forEach((t) => {
    const on = t.id === 'stab-' + name;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (on && focus) t.focus();
  });
  const hash = name === 'class' ? '#class' : '';
  if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  if (name === 'class' && shown && !classLoaded) {
    classLoaded = true;
    renderClasses($('#class-box'), shown.st, shown.adminPreview);
  }
}
stabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectSection(tab.id.replace('stab-', '')));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    selectSection(stabs[1 - i].id.replace('stab-', ''), true);
  });
});

/* ── 학년 탭 ── */
const tabs = [...document.querySelectorAll('.tab-grade')];
function selectTab(tab, focus) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectTab(tab, false));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
  });
});

/* ── 영상 카드 ── */
// 영상을 열 때 시청 내역 1건 기록 (유튜브는 새 창으로 열리므로 기다리지 않음)
function logView(v) {
  if (!viewer) return;
  be.recordView(viewer, v).catch((e) => console.warn('시청 기록 실패', e));
}

function videoCard(v, id) {
  const label = `${v.title} – 유튜브에서 보기 (새 창)`;
  const onclick = () => logView(v);
  return el('article', { class: 'vcard' },
    el('a', { class: 'vthumb', href: v.youtube, target: '_blank', rel: 'noopener', 'aria-label': label, onclick },
      el('img', { src: thumbUrl(id), alt: '', loading: 'lazy', width: '480', height: '360', onerror: (e) => { e.target.style.visibility = 'hidden'; } }),
      el('span', { class: 'vplay-icon', 'aria-hidden': 'true' })
    ),
    el('div', { class: 'vbody' },
      el('span', { class: 'subj subj-' + (SUBJECT_CLASS[v.subject] || 'etc'), text: v.subject || '기타' }),
      el('h3', { class: 'vtitle', text: v.title }),
      el('p', { class: 'vmeta' }, el('time', { datetime: v.date || null, text: formatDate(v.date) })),
      el('a', { class: 'vlink', href: v.youtube, target: '_blank', rel: 'noopener', 'aria-label': label, text: '유튜브에서 보기 ↗', onclick })
    )
  );
}

function renderPanels(videos) {
  document.querySelectorAll('.vpanel').forEach((panel) => {
    const grade = panel.dataset.grade;
    const items = videos
      .filter((v) => v.grade === grade)
      .map((v) => ({ v, id: youtubeId(v.youtube) }))
      .filter((x) => x.id)
      .sort((a, b) => String(b.v.date || '').localeCompare(String(a.v.date || '')));
    panel.replaceChildren(
      el('div', { class: 'vhead' },
        el('h2', { text: `${grade} 보충 강의` }),
        items.length ? el('span', { class: 'vcount', text: `영상 ${items.length}개` }) : null
      ),
      items.length
        ? el('div', { class: 'vgrid' }, items.map((x) => videoCard(x.v, x.id)))
        : el('div', { class: 'vempty' },
            el('p', {}, el('strong', { text: `아직 올라온 ${grade} 보충 강의가 없어요.` })),
            el('p', { text: '영상이 올라오면 이곳에 최근 순서로 보여요.' })
          )
    );
  });
}

async function showStudent(st, adminPreview) {
  viewer = adminPreview ? null : st;
  shown = { st, adminPreview: Boolean(adminPreview) };
  classLoaded = false;
  $('#me-name').textContent = st.name;
  $('#me-grade').textContent = adminPreview ? '미리보기' : st.grade;
  $('#me-name').nextSibling.textContent = adminPreview ? ' ' : ' 학생 ';
  show('status', '불러오는 중…');
  const videos = await be.listVideos();
  renderPanels(videos);
  const mine = tabs.find((t) => t.textContent.trim() === st.grade) || tabs[0];
  selectTab(mine, false);
  show('list');
  selectSection(location.hash === '#class' ? 'class' : 'videos', false);
}

/* ── 로그인 상태에 따라 화면 전환 ── */
if (!be.configured) {
  show('status', '학생 전용 서비스를 준비하고 있어요. 조금만 기다려 주세요.');
  console.info('[아벨학원] firebase-config.js 에 Firebase 설정값을 넣어야 로그인이 작동해요.');
} else {
  be.onUser(async (user) => {
    if (!user) { show('login'); return; }
    try {
      const st = await be.getStudent(user.uid);
      if (!st) {
        // 선생님이 로그인한 상태라면 학생 화면을 미리 볼 수 있음
        if (await be.isAdmin(user.uid).catch(() => false)) { await showStudent({ name: '선생님', grade: '고1' }, true); return; }
        show('login'); // 회원 정보가 막 만들어지는 중이거나 없는 계정
        return;
      }
      if (!st.active) {
        await be.signOutUser();
        setLoginError(st.guardianStatus === 'pending'
          ? '보호자 동의를 확인하는 중이에요. 학원에서 보호자께 확인 연락을 드린 뒤 사용할 수 있어요.'
          : '사용이 중지된 계정이에요. 학원에 문의해 주세요.');
        return;
      }
      await showStudent(st);
    } catch (e) {
      show('status', friendlyError(e));
    }
  });
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoginError('');
  const id = $('#lg-id').value.trim();
  const pw = $('#lg-pw').value;
  if (!id || !pw) { setLoginError('아이디와 비밀번호를 모두 입력해 주세요.'); return; }
  const btn = loginForm.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = '로그인 중…';
  try {
    await logIn(id, pw);
    $('#lg-pw').value = '';
  } catch (err) {
    setLoginError(friendlyError(err));
  } finally {
    btn.disabled = false; btn.textContent = '로그인';
  }
});

$('#btn-logout').addEventListener('click', async () => {
  await be.signOutUser();
  setLoginError('');
  $('#lg-id').focus();
});

/* ── 비밀번호 변경 ── */
const dlg = $('#pw-dialog');
const pwMsg = $('#pw-msg');
function pwMessage(text, ok) {
  pwMsg.textContent = text; pwMsg.hidden = !text;
  pwMsg.classList.toggle('form-ok', Boolean(ok));
}
$('#btn-pw').addEventListener('click', () => { $('#pw-form').reset(); pwMessage(''); dlg.showModal(); });
$('#pw-cancel').addEventListener('click', () => dlg.close());
$('#pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cur = $('#pw-cur').value, nw = $('#pw-new').value, nw2 = $('#pw-new2').value;
  if (!cur || !nw) return pwMessage('모든 칸을 입력해 주세요.');
  if (nw.length < 6) return pwMessage('새 비밀번호는 6자 이상이어야 해요.');
  if (nw !== nw2) return pwMessage('새 비밀번호가 서로 달라요.');
  try {
    await be.changeMyPassword(cur, nw);
    pwMessage('비밀번호를 바꿨어요.', true);
    setTimeout(() => dlg.close(), 1200);
  } catch (err) {
    pwMessage(err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' ? '지금 비밀번호가 맞지 않아요.' : friendlyError(err));
  }
});
