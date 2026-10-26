// 아벨학원 관리자 화면
// 대시보드 · 상담 신청서 · 신청 통계 · 학생 관리(학생 목록·접속 통계 / 클래스·숙제·스탬프) · 시청 내역 · 보충 강의 · 공지 · 관리자(가입 승인)
import * as be from './backend.js';
import { loadTimetable, classLessons } from './admin-timetable.js';
import {
  GRADES_ALL, SUBJECTS, SUBJECT_CLASS, APPLY_GRADES, APPLY_TIMES, ID_RE, CLASS_SUBJECTS, SPECIAL_MAX,
  STAMP_MAX_DEFAULT, STAMP_MAX_LIMIT, stampMaxOf, STAMP_RULES_MAX, STAMP_RULE_LEN, PRIZE_LEN, DEFAULT_SUB_EMAIL,
  youtubeId, thumbUrl, formatDate, formatDateTime, todayString, monthKey, dueInfo, el, friendlyError
} from './common.js';

const $ = (s) => document.querySelector(s);
const cache = { apps: null, students: null, logins: null, videos: null, views: null, notices: null, admins: null, requests: null, classes: null, specials: null, staff: null };
let currentView = 'home';
let me = { uid: null, email: '', name: '' };

/* ── 화면 전환 ───────────────────────────────── */
function show(which, msg) {
  $('#adm-status').hidden = which !== 'status';
  if (msg != null) $('#adm-status').textContent = msg;
  $('#adm-gate').hidden = which !== 'gate';
  $('#adm-pending').hidden = which !== 'pending';
  $('#adm-app').hidden = which !== 'app';
  $('#btn-logout').hidden = which !== 'app';
  $('#btn-pw').hidden = which !== 'app';
  $('#who').hidden = which !== 'app';
}

function message(node, text, kind) {
  node.textContent = text || '';
  node.className = 'a-msg ' + (kind || 'ok');
  node.hidden = !text;
}

const navTabs = [...document.querySelectorAll('.adm-nav [role="tab"]')];
function openView(name, focus) {
  currentView = name;
  if (name === 'students') { selClass = null; editingClass = false; }
  navTabs.forEach((t) => {
    const on = t.id === 'nav-' + name;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (on && focus) t.focus();
  });
  loadView(name);
}
navTabs.forEach((t, i) => {
  t.addEventListener('click', () => openView(t.id.replace('nav-', '')));
  t.addEventListener('keydown', (e) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const next = navTabs[(i + keys[e.key] + navTabs.length) % navTabs.length];
    openView(next.id.replace('nav-', ''), true);
  });
});
document.querySelectorAll('[data-refresh]').forEach((b) => b.addEventListener('click', () => loadView(b.dataset.refresh, true)));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => openView(b.dataset.go, true)));

const loading = (box) => $(box).replaceChildren(el('p', { class: 'empty', text: '불러오는 중…' }));
const ensure = async (key, fn, force) => { if (force || !cache[key]) cache[key] = await fn(); return cache[key]; };

async function loadView(name, force) {
  const boxes = { timetable: '#tt-grid', home: '#home-kpis', apps: '#ap-table', stats: '#st-body', students: '#stu-table', views: '#vw-by-video', videos: '#vid-list', notices: '#nt-list', admins: '#ad-list' };
  try {
    if (name === 'home') {
      loading('#home-apps');
      await Promise.all([
        ensure('apps', be.listApplications, force), ensure('students', be.listStudents, force),
        ensure('logins', () => be.listLogins(1000), force), ensure('views', () => be.listViews(1000), force),
        ensure('requests', be.listAdminRequests, force)
      ]);
      renderHome();
    } else if (name === 'apps') {
      loading('#ap-table'); await ensure('apps', be.listApplications, force); renderApps();
      try { await ensure('specials', be.getSpecials, force); renderSpecials(); }
      catch (e) { $('#sp-list').replaceChildren(el('li', { class: 'a-msg err', text: friendlyError(e) + ' — Firebase 보안 규칙을 새 내용으로 게시했는지 확인해 주세요.' })); }
    } else if (name === 'stats') {
      loading('#st-body'); await ensure('apps', be.listApplications, force); renderStats();
    } else if (name === 'students') {
      loading('#stu-table');
      if (force) Object.keys(classData).forEach((k) => delete classData[k]);
      await Promise.all([ensure('students', be.listStudents, force), ensure('logins', () => be.listLogins(1000), force)]);
      renderStudents();
      // 클래스는 따로 불러옴 (보안 규칙을 아직 새로 게시하지 않았어도 학생 목록은 보이도록)
      try { await loadClasses(force); renderClasses(); }
      catch (e) {
        $('#cl-list-view').hidden = false; $('#cl-detail-view').hidden = true;
        $('#cl-list').replaceChildren(el('p', { class: 'a-msg err', text: friendlyError(e) + ' — Firebase 보안 규칙을 새 내용으로 게시했는지 확인해 주세요.' }));
      }
    } else if (name === 'views') {
      loading('#vw-by-video'); await ensure('views', () => be.listViews(1000), force); renderViews();
    } else if (name === 'videos') {
      loading('#vid-list'); await ensure('videos', be.listVideos, force); renderVideos();
    } else if (name === 'notices') {
      loading('#nt-list'); await ensure('notices', () => be.listNotices(200), force); renderNotices();
    } else if (name === 'timetable') {
      // 선생님 ↔ 관리자 계정, 학생 계정, 클래스 연결에 쓰는 목록을 함께 불러옴
      loading('#tt-grid');
      await Promise.all([ensure('admins', be.listAdmins, force), ensure('students', be.listStudents, force)]);
      let classesErr = '';
      try { await loadClasses(force); } catch (e) { classesErr = friendlyError(e) + ' — Firebase 보안 규칙을 새 내용으로 게시했는지 확인해 주세요.'; }
      await loadTimetable(force, {
        me, admins: cache.admins || [], students: cache.students || [], classes: cache.classes || [], classesErr,
        roleOfClass: roleOf, goToClass, classesChanged: (list) => { cache.classes = list; }
      });
    } else if (name === 'admins') {
      loading('#ad-list');
      await Promise.all([ensure('admins', be.listAdmins, force), ensure('requests', be.listAdminRequests, force)]);
      renderAdmins();
    }
    updateBadges();
  } catch (e) {
    $(boxes[name]).replaceChildren(el('p', { class: 'a-msg err', text: friendlyError(e) }));
  }
}

function updateBadges() {
  const newApps = (cache.apps || []).filter((a) => a.status !== 'contacted').length;
  const reqs = (cache.requests || []).length;
  const set = (id, n, label) => { const b = $(id); b.hidden = !n; b.textContent = n ? String(n) : ''; b.setAttribute('aria-label', n ? `${label} ${n}건` : ''); };
  if (cache.apps) set('#badge-apps', newApps, '확인 전 신청');
  if (cache.requests) set('#badge-admins', reqs, '승인 대기');
}

/* ── 로그인 · 관리자 가입 ─────────────────────────── */
const gateTabs = [$('#gt-login'), $('#gt-signup')];
function gateTab(which) {
  gateTabs.forEach((t) => {
    const on = t.id === 'gt-' + which;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
  });
  if (which === 'signup') refreshSlotInfo();
}
gateTabs.forEach((t, i) => {
  t.addEventListener('click', () => gateTab(t.id.replace('gt-', '')));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = gateTabs[1 - i]; gateTab(n.id.replace('gt-', '')); n.focus();
  });
});

async function refreshSlotInfo() {
  const box = $('#slot-info');
  try {
    const left = be.FOUNDER_SLOTS - (await be.adminSlotsUsed());
    box.classList.toggle('open', left > 0);
    box.textContent = left > 0
      ? `처음 관리자 ${be.FOUNDER_SLOTS}명까지는 가입하면 바로 관리자가 돼요. (남은 자리 ${left}명)`
      : `처음 관리자 ${be.FOUNDER_SLOTS}명이 이미 등록되어 있어요. 가입하면 '승인 대기'가 되고, 기존 관리자가 승인하면 관리자로 등록돼요.`;
  } catch (e) {
    box.textContent = friendlyError(e);
  }
}

let gateBusy = false;
async function decide(user) {
  if (!user) { show('gate'); return; }
  try {
    if (await be.isAdmin(user.uid)) {
      const admins = await be.listAdmins().catch(() => []);
      const mine = admins.find((a) => a.uid === user.uid);
      me = { uid: user.uid, email: user.email, name: mine ? mine.name : '' };
      cache.admins = admins;
      $('#who').textContent = me.name ? `${me.name} (${me.email})` : me.email;
      $('#home-hello').textContent = `${me.name || '관리자'}님, 안녕하세요. 오늘 ${formatDate(new Date())} 현황이에요.`;
      show('app');
      openView(currentView);
      return;
    }
    const student = await be.getStudent(user.uid).catch(() => null);
    if (student) {
      await be.signOutUser();
      gateTab('login');
      message($('#ad-err'), '학생(일반) 회원은 관리자 로그인을 할 수 없어요. 홈페이지의 회원 로그인을 이용해 주세요.', 'err');
      return;
    }
    const req = await be.getAdminRequest(user.uid).catch(() => null);
    if (req) {
      $('#pending-text').textContent = `${req.name}(${req.email})님의 관리자 가입 신청이 접수되었어요. 이미 등록된 관리자가 승인하면 관리자 화면을 쓸 수 있어요.`;
      show('pending');
      return;
    }
    await be.signOutUser();
    message($('#ad-err'), '관리자로 등록되지 않은 계정이에요.', 'err');
  } catch (e) {
    show('status', friendlyError(e));
  }
}

if (!be.configured) {
  show('status', 'Firebase 연결 설정이 아직 없어요. 안내서(README.md)의 순서대로 firebase-config.js 를 채워 주세요.');
} else {
  be.onUser((user) => { if (!gateBusy) decide(user); });
}

$('#adm-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  message($('#ad-err'), '');
  const email = $('#ad-email').value.trim(), pw = $('#ad-pw').value;
  if (!email || !pw) return message($('#ad-err'), '이메일과 비밀번호를 입력해 주세요.', 'err');
  if (!email.includes('@') || be.isStudentEmail(email)) {
    return message($('#ad-err'), '학생(일반) 회원은 관리자 로그인을 할 수 없어요. 관리자는 가입한 이메일 주소로 로그인해 주세요.', 'err');
  }
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try { await be.signIn(email, pw); $('#ad-pw').value = ''; }
  catch (err) { message($('#ad-err'), friendlyError(err), 'err'); }
  finally { btn.disabled = false; }
});

$('#adm-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#as-err');
  message(err, '');
  const name = $('#as-name').value.trim();
  const email = $('#as-email').value.trim().toLowerCase();
  const pw = $('#as-pw').value, pw2 = $('#as-pw2').value;
  if (!name || name.length > 20) return message(err, '이름을 입력해 주세요. (20자 이내)', 'err');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return message(err, '이메일 주소를 확인해 주세요.', 'err');
  if (be.isStudentEmail(email)) return message(err, '이 주소로는 관리자 가입을 할 수 없어요.', 'err');
  if (pw.length < 8) return message(err, '비밀번호는 8자 이상으로 정해 주세요.', 'err');
  if (pw !== pw2) return message(err, '비밀번호와 비밀번호 확인이 서로 달라요.', 'err');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  gateBusy = true;
  try {
    await be.registerAdmin({ name, email, password: pw });
    gateBusy = false;
    await decide({ uid: be.currentUid(), email });
  } catch (ex) {
    gateBusy = false;
    message(err, ex.code === 'auth/email-already-in-use' ? '이미 가입된 이메일이에요. 로그인 탭에서 로그인해 주세요.' : friendlyError(ex), 'err');
  } finally {
    btn.disabled = false;
  }
});

$('#btn-logout').addEventListener('click', () => { if ($('#pw-dialog').open) $('#pw-dialog').close(); be.signOutUser(); });

/* ── 비밀번호를 잊었을 때: 이메일로 재설정 링크 ─────────────── */
const RESET_WAIT = 60; // 같은 화면에서 메일을 다시 보내려면 기다릴 시간(초)
let resetTimer = null;
function holdButton(btn, label) {
  let left = RESET_WAIT;
  btn.disabled = true;
  clearInterval(resetTimer);
  const tick = () => { btn.textContent = `${label} (${left}초 뒤 다시 보낼 수 있어요)`; if (left-- <= 0) { clearInterval(resetTimer); btn.disabled = false; btn.textContent = label; } };
  tick();
  resetTimer = setInterval(tick, 1000);
}
function sentText(email) {
  return `입력한 이메일(${email})이 관리자 계정이라면 비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요. 몇 분이 지나도 안 오면 스팸함도 확인해 주세요. 메일의 링크를 눌러 새 비밀번호를 정한 뒤, 새 비밀번호로 로그인하면 돼요.`;
}
function validAdminEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !be.isStudentEmail(email);
}
function showReset(on) {
  $('#adm-reset').hidden = !on;
  $('#adm-login').hidden = on;
  document.querySelector('.gate-tabs').hidden = on;
  if (on) {
    $('#rs-email').value = $('#ad-email').value.trim();
    message($('#rs-msg'), '');
    $('#rs-title').focus();
  } else {
    $('#ad-forgot').focus();
  }
}
$('#ad-forgot').addEventListener('click', () => showReset(true));
$('#rs-back').addEventListener('click', () => showReset(false));
$('#adm-reset').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#rs-msg');
  const email = $('#rs-email').value.trim().toLowerCase();
  if (!email.includes('@') || be.isStudentEmail(email)) return message(msg, '학생(일반 회원)은 이 방법을 쓸 수 없어요. 관리자로 가입한 이메일 주소를 적어 주세요.', 'err');
  if (!validAdminEmail(email)) return message(msg, '이메일 주소를 확인해 주세요.', 'err');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await be.sendAdminPasswordReset(email);
    message(msg, sentText(email), 'ok');
    holdButton(btn, '재설정 메일 보내기');
  } catch (err) {
    message(msg, err.code === 'auth/user-not-found' ? sentText(email) : friendlyError(err), err.code === 'auth/user-not-found' ? 'ok' : 'err');
    btn.disabled = false;
  }
});

/* ── 비밀번호 변경 (로그인한 관리자) ─────────────────────── */
const pwDlg = $('#pw-dialog');
$('#btn-pw').addEventListener('click', () => {
  $('#pw-form').reset();
  $('#pw-user').value = me.email || '';
  message($('#pw-msg'), '');
  $('#pw-mail').disabled = false;
  pwDlg.showModal();
  $('#pw-cur').focus();
});
$('#pw-close').addEventListener('click', () => pwDlg.close());
$('#pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#pw-msg');
  const cur = $('#pw-cur').value, nw = $('#pw-new').value, nw2 = $('#pw-new2').value;
  if (!cur || !nw || !nw2) return message(msg, '모든 칸을 입력해 주세요.', 'err');
  if (nw.length < 8) return message(msg, '새 비밀번호는 8자 이상으로 정해 주세요.', 'err');
  if (nw !== nw2) return message(msg, '새 비밀번호와 새 비밀번호 확인이 서로 달라요.', 'err');
  if (nw === cur) return message(msg, '지금 비밀번호와 다른 새 비밀번호를 정해 주세요.', 'err');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await be.changeMyPassword(cur, nw);
    $('#pw-form').reset();
    message(msg, '비밀번호를 바꿨어요. 다음 로그인부터 새 비밀번호를 써 주세요.', 'ok');
    setTimeout(() => { if (pwDlg.open) pwDlg.close(); }, 1800);
  } catch (err) {
    const wrong = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password';
    message(msg, wrong ? '지금 비밀번호가 맞지 않아요. 기억나지 않으면 아래 재설정 메일을 받아 주세요.' : friendlyError(err), 'err');
  } finally {
    btn.disabled = false;
  }
});
$('#pw-mail').addEventListener('click', async () => {
  const msg = $('#pw-msg');
  const btn = $('#pw-mail');
  if (!me.email) return message(msg, '로그인한 이메일을 확인할 수 없어요. 로그아웃한 뒤 로그인 화면의 \'비밀번호를 잊으셨나요?\'를 이용해 주세요.', 'err');
  btn.disabled = true;
  try {
    await be.sendAdminPasswordReset(me.email);
    message(msg, `내 이메일(${me.email})로 비밀번호 재설정 메일을 보냈어요. 메일의 링크를 눌러 새 비밀번호를 정해 주세요. (몇 분이 지나도 안 오면 스팸함도 확인해 주세요)`, 'ok');
  } catch (err) {
    message(msg, friendlyError(err), 'err');
    btn.disabled = false;
  }
});
$('#pending-out').addEventListener('click', () => be.signOutUser());
$('#pending-check').addEventListener('click', () => decide({ uid: be.currentUid(), email: '' }));

/* ── 공통 도구 ─────────────────────────────────── */
const DAY = 864e5;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysBack = (n) => Array.from({ length: n }, (_, i) => new Date(startOfDay(new Date()).getTime() - (n - 1 - i) * DAY));
const withinDays = (d, n) => d && d >= new Date(startOfDay(new Date()).getTime() - (n - 1) * DAY);

function kpi(label, value, unit, sub) {
  return el('div', { class: 'kpi' },
    el('span', { class: 'kpi-label', text: label }),
    el('span', { class: 'kpi-value' }, Number(value).toLocaleString('ko-KR'), el('small', { text: unit })),
    sub ? el('span', { class: 'kpi-delta', text: sub }) : null
  );
}

function table(headers, bodyRows, opts = {}) {
  return el('div', { class: 'tbl-wrap', style: opts.maxHeight ? `max-height:${opts.maxHeight}px;overflow:auto` : null },
    el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, headers.map((h) => el('th', { class: h.num ? 'num' : null, text: h.label || h })))),
      el('tbody', {}, bodyRows.length ? bodyRows : el('tr', {}, el('td', { colspan: String(headers.length), class: 'empty', text: opts.empty || '자료가 없어요.' })))
    ));
}

function barList(title, sub, rows) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return el('div', { class: 'card' },
    el('div', { class: 'card-head' }, el('h2', { text: title }), sub ? el('span', { class: 'card-sub', text: sub }) : null),
    el('ul', { class: 'blist' }, rows.map(([name, n]) =>
      el('li', {},
        el('span', { class: 'name', title: name, text: name }),
        el('span', { class: 'track', 'aria-hidden': 'true' }, el('span', { class: 'fill', style: `width:${(n / max) * 100}%` })),
        el('span', { class: 'cnt', text: `${n}` })
      )))
  );
}

function niceScale(max) {
  if (max <= 4) return { top: 4, ticks: [0, 2, 4] };
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
  const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  return { top, ticks };
}

const statusLabel = (s) => (s === 'contacted' ? '연락 완료' : '확인 전');
const statusPill = (s) => el('span', { class: 'pill ' + (s === 'contacted' ? 'off' : 'new'), text: statusLabel(s) });

/* ── 대시보드 ─────────────────────────────────── */
function renderHome() {
  const apps = cache.apps || [];
  const logins = cache.logins || [];
  const views = cache.views || [];
  const students = cache.students || [];
  const reqs = cache.requests || [];
  const now = new Date();
  const uniq = (list) => new Set(list.map((x) => x.uid)).size;
  const newApps = apps.filter((a) => a.status !== 'contacted');

  const pendingKids = students.filter((s) => s.guardianStatus === 'pending');
  const goBtn = (text, view) => { const b = el('button', { type: 'button', class: 'a-btn small', text }); b.addEventListener('click', () => openView(view, true)); return b; };
  $('#home-alert').replaceChildren(...[
    reqs.length ? el('div', { class: 'alert' },
      el('span', {}, el('strong', { text: `관리자 가입 승인 대기 ${reqs.length}건` }), ' — 아는 사람인지 확인한 뒤 승인해 주세요.'), goBtn('승인하러 가기', 'admins')) : null,
    pendingKids.length ? el('div', { class: 'alert' },
      el('span', {}, el('strong', { text: `보호자 동의 확인 대기 ${pendingKids.length}명` }), ' — 보호자께 전화로 동의를 확인한 뒤 학생 관리에서 \'동의 확인\'을 눌러 주세요.'), goBtn('학생 관리로 가기', 'students')) : null
  ].filter(Boolean));

  $('#home-kpis').replaceChildren(
    kpi('확인 전 상담 신청', newApps.length, '건', `이번 달 신청 ${apps.filter((a) => a.month === monthKey()).length}건`),
    kpi('오늘 접속한 학생', uniq(logins.filter((l) => l.at && startOfDay(l.at).getTime() === startOfDay(now).getTime())), '명'),
    kpi('최근 7일 접속한 학생', uniq(logins.filter((l) => withinDays(l.at, 7))), '명', `전체 회원 ${students.length}명`),
    kpi('최근 7일 영상 시청', views.filter((v) => withinDays(v.at, 7)).length, '회')
  );

  const recentApps = [...newApps].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  $('#home-apps').replaceChildren(recentApps.length
    ? el('ul', { class: 'mini-list' }, recentApps.map((a) => el('li', {},
        el('span', {}, appNameButton(a), ' ', el('span', { class: 'sub', text: `${a.grade} · ${a.type}` })),
        el('span', { class: 'sub', text: formatDateTime(a.createdAt) }))))
    : el('p', { class: 'empty', text: '확인할 새 신청이 없어요.' }));

  const recentLogins = logins.slice(0, 6);
  $('#home-logins').replaceChildren(recentLogins.length
    ? el('ul', { class: 'mini-list' }, recentLogins.map((l) => el('li', {},
        el('span', {}, el('strong', { text: l.name }), ' ', el('span', { class: 'sub', text: `${l.grade} · ${l.loginId}` })),
        el('span', { class: 'sub', text: formatDateTime(l.at) }))))
    : el('p', { class: 'empty', text: '아직 접속 기록이 없어요.' }));

  const top = groupViews(views.filter((v) => withinDays(v.at, 30))).slice(0, 5);
  $('#home-top').replaceChildren(top.length
    ? table([{ label: '영상' }, { label: '학년·과목' }, { label: '시청', num: true }, { label: '본 학생', num: true }],
        top.map((g) => el('tr', {}, el('td', {}, el('strong', { text: g.title })), el('td', { text: `${g.videoGrade} · ${g.subject}` }), el('td', { class: 'num', text: `${g.count}회` }), el('td', { class: 'num', text: `${g.students}명` }))))
    : el('p', { class: 'empty', text: '최근 30일 동안 시청 기록이 없어요.' }));
}

/* ── 상담 신청서 ───────────────────────────────── */
['#ap-status', '#ap-type', '#ap-special', '#ap-q'].forEach((s) => $(s).addEventListener('input', renderApps));
const typeText = (a) => (a.type === '특강 신청' && a.special ? `특강 · ${a.special}` : a.type);

// 특강 구분 필터: 신청서에 들어온 특강 이름으로 만듦 (삭제한 특강도 포함)
function syncSpecialFilter() {
  const sel = $('#ap-special');
  const on = $('#ap-type').value === '특강 신청';
  sel.hidden = !on;
  if (!on) { sel.value = ''; return; }
  const names = [...new Set((cache.apps || []).filter((a) => a.type === '특강 신청' && a.special).map((a) => a.special))].sort((a, b) => a.localeCompare(b, 'ko'));
  const keep = sel.value;
  sel.replaceChildren(el('option', { value: '', text: '모든 특강' }), ...names.map((n) => el('option', { text: n })));
  sel.value = names.includes(keep) ? keep : '';
}

function appNameButton(a) {
  const b = el('button', { type: 'button', class: 'link-btn', text: a.studentName || '(이름 없음)', 'aria-label': `${a.studentName} 신청서 자세히 보기` });
  b.addEventListener('click', () => openApp(a.id));
  return b;
}

function renderApps() {
  syncSpecialFilter();
  const st = $('#ap-status').value, ty = $('#ap-type').value, sp = $('#ap-special').value, q = $('#ap-q').value.trim().toLowerCase().replace(/-/g, '');
  const list = (cache.apps || [])
    .filter((a) => (!st || (st === 'contacted' ? a.status === 'contacted' : a.status !== 'contacted'))
      && (!ty || a.type === ty)
      && (!sp || a.special === sp)
      && (!q || String(a.studentName || '').toLowerCase().includes(q) || String(a.phone || '').replace(/-/g, '').includes(q)))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!(cache.apps || []).length) {
    $('#ap-table').replaceChildren(el('p', { class: 'empty', text: '아직 들어온 상담 신청서가 없어요. 홈페이지 입학 상담 페이지에서 신청하면 여기에 보여요.' }));
    return;
  }
  $('#ap-table').replaceChildren(table(
    ['접수 일시', '구분', '학생 이름', '학년', '학부모 연락처', '희망 과목', '상태'],
    list.map((a) => el('tr', { class: a.status === 'contacted' ? 'off' : null },
      el('td', { text: formatDateTime(a.createdAt) }),
      el('td', {}, a.type === '특강 신청'
        ? [el('span', { class: 'pill sp', text: '특강' }), ' ', el('span', { text: a.special || '구분 없음' })]
        : a.type),
      el('td', {}, appNameButton(a)),
      el('td', { text: a.grade }),
      el('td', {}, el('a', { href: 'tel:' + String(a.phone || '').replace(/[^0-9+]/g, ''), text: a.phone })),
      el('td', { text: (a.subjects || []).join(', ') || '—' }),
      el('td', {}, statusPill(a.status)))),
    { empty: '조건에 맞는 신청서가 없어요.' }
  ));
}

const dlg = $('#ap-dialog');
let openAppId = null;
function openApp(id) {
  const a = (cache.apps || []).find((x) => x.id === id);
  if (!a) return;
  openAppId = id;
  $('#ap-dlg-title').textContent = `${a.studentName} · ${a.grade}`;
  const row = (k, v, cls) => [el('dt', { text: k }), el('dd', { class: cls || null }, v)];
  $('#ap-dlg-body').replaceChildren(
    ...row('접수 일시', formatDateTime(a.createdAt)),
    ...row('신청 구분', a.type),
    ...(a.type === '특강 신청' ? row('특강 구분', a.special || '(구분 없이 들어온 예전 신청)') : []),
    ...row('학생 이름', a.studentName),
    ...row('학년', a.grade),
    ...row('학부모 연락처', el('a', { href: 'tel:' + String(a.phone || '').replace(/[^0-9+]/g, ''), text: a.phone })),
    ...row('희망 과목', (a.subjects || []).join(', ') || '선택 안 함'),
    ...row('희망 상담 시간', a.preferredTime || '선택 안 함'),
    ...row('문의 내용', a.message || '없음', a.message ? 'msg' : null),
    ...row('처리 상태', statusPill(a.status))
  );
  $('#ap-toggle').textContent = a.status === 'contacted' ? '확인 전으로 되돌리기' : '연락 완료로 표시';
  if (!dlg.open) dlg.showModal();
}
$('#ap-close').addEventListener('click', () => dlg.close());
$('#ap-toggle').addEventListener('click', async () => {
  const a = (cache.apps || []).find((x) => x.id === openAppId);
  if (!a) return;
  const next = a.status === 'contacted' ? 'new' : 'contacted';
  $('#ap-toggle').disabled = true;
  try { await be.setApplicationStatus(a.id, next); a.status = next; openApp(a.id); renderApps(); updateBadges(); if (currentView === 'home') renderHome(); }
  catch (err) { alert(friendlyError(err)); }
  finally { $('#ap-toggle').disabled = false; }
});
$('#ap-delete').addEventListener('click', async () => {
  const a = (cache.apps || []).find((x) => x.id === openAppId);
  if (!a || !confirm(`${a.studentName} 학생의 신청서를 삭제할까요? 삭제하면 되돌릴 수 없고, 신청 통계에서도 빠져요.`)) return;
  try { await be.deleteApplication(a.id); cache.apps = cache.apps.filter((x) => x.id !== a.id); dlg.close(); renderApps(); updateBadges(); if (currentView === 'home') renderHome(); }
  catch (err) { alert(friendlyError(err)); }
});

/* ── 신청 통계 ─────────────────────────────────── */
$('#st-range').addEventListener('change', renderStats);

function monthsBack(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)));
}
function monthsFrom(first) {
  const [y, m] = first.split('-').map(Number);
  const now = new Date();
  const n = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) + 1;
  return monthsBack(Math.min(Math.max(n, 1), 24));
}
function monthLabel(key, i) {
  const [y, m] = key.split('-');
  return (i === 0 || m === '01') ? `${y.slice(2)}년 ${Number(m)}월` : `${Number(m)}월`;
}

function monthlyChart(months, byMonth) {
  const max = Math.max(0, ...months.map((m) => byMonth[m][0]), ...months.map((m) => byMonth[m][1]));
  const { top, ticks } = niceScale(max);
  const tip = el('div', { class: 'tip', 'aria-hidden': 'true', hidden: true });
  const plot = el('div', { class: 'chart-plot' });
  ticks.forEach((t) => plot.append(el('div', { class: 'chart-grid', style: `bottom:${(t / top) * 100}%` })));
  const cols = el('div', { class: 'chart-cols' });
  const chart = el('div', { class: 'chart', role: 'img', 'aria-label': '월별 신청 건수 막대그래프. 정확한 숫자는 아래 표로 보기에 있어요.' },
    el('div', { class: 'chart-y', 'aria-hidden': 'true' }, ticks.map((t) => el('span', { style: `bottom:${(t / top) * 100}%`, text: String(t) }))),
    plot,
    el('div', { class: 'chart-x', 'aria-hidden': 'true' }, months.map((m, i) => el('span', { text: monthLabel(m, i) }))),
    tip
  );
  months.forEach((m) => {
    const [a, b] = byMonth[m];
    const [y, mo] = m.split('-');
    const g = el('div', { class: 'cg', tabindex: '0', 'aria-label': `${y}년 ${Number(mo)}월: 입학 상담 ${a}건, 특강 신청 ${b}건` },
      el('span', { class: 'bar c-a', style: `height:${(a / top) * 100}%` }),
      el('span', { class: 'bar c-b', style: `height:${(b / top) * 100}%` })
    );
    attachTip(g, tip, chart, () => [
      el('div', { class: 'muted', text: `${y}년 ${Number(mo)}월` }),
      el('div', {}, el('span', { class: 'k c-a' }), el('b', { text: `${a}건` }), ' 입학 상담'),
      el('div', {}, el('span', { class: 'k c-b' }), el('b', { text: `${b}건` }), ' 특강 신청')
    ]);
    cols.append(g);
  });
  plot.append(cols);

  const tableView = el('details', { class: 'tbl-view' },
    el('summary', { text: '표로 보기' }),
    table([{ label: '월' }, { label: '입학 상담', num: true }, { label: '특강 신청', num: true }, { label: '합계', num: true }],
      months.map((m) => {
        const [a, b] = byMonth[m];
        const [y, mo] = m.split('-');
        return el('tr', {}, el('td', { text: `${y}년 ${Number(mo)}월` }), el('td', { class: 'num', text: a }), el('td', { class: 'num', text: b }), el('td', { class: 'num', text: a + b }));
      }))
  );

  return el('div', { class: 'card' },
    el('div', { class: 'card-head' }, el('h2', { text: '월별 신청 건수' }),
      el('div', { class: 'legend' }, el('span', {}, el('i', { class: 'c-a' }), '입학 상담'), el('span', {}, el('i', { class: 'c-b' }), '특강 신청'))),
    chart, tableView
  );
}

function attachTip(g, tip, chart, content) {
  const showTip = () => {
    tip.replaceChildren(...content());
    tip.hidden = false;
    const cx = 44 + g.offsetLeft + g.offsetWidth / 2;
    const w = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(cx - w / 2, 0), chart.clientWidth - w) + 'px';
    tip.style.top = '4px';
  };
  g.addEventListener('pointerenter', showTip);
  g.addEventListener('focus', showTip);
  g.addEventListener('pointerleave', () => { tip.hidden = true; });
  g.addEventListener('blur', () => { tip.hidden = true; });
}

function renderStats() {
  const body = $('#st-body');
  const all = cache.apps || [];
  if (!all.length) {
    body.replaceChildren(el('div', { class: 'card' }, el('p', { class: 'empty', text: '아직 쌓인 신청이 없어요. 홈페이지에서 신청이 들어오면 여기에 통계가 보여요.' })));
    return;
  }
  const range = $('#st-range').value;
  const months = range === 'all'
    ? monthsFrom(all.map((a) => a.month).filter(Boolean).sort()[0] || monthKey())
    : monthsBack(Number(range));
  const inRange = all.filter((a) => months.includes(a.month));

  const byMonth = Object.fromEntries(months.map((m) => [m, [0, 0]]));
  inRange.forEach((a) => { byMonth[a.month][a.type === '특강 신청' ? 1 : 0] += 1; });

  const thisM = monthKey();
  const lastM = monthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const cThis = all.filter((a) => a.month === thisM).length;
  const cLast = all.filter((a) => a.month === lastM).length;
  const diff = cThis - cLast;
  const delta = diff === 0 ? '지난달과 같아요' : `지난달보다 ${Math.abs(diff)}건 ${diff > 0 ? '많아요' : '적어요'}`;

  const count = (fn) => inRange.filter(fn).length;
  const rangeLabel = { '6': '최근 6개월', '12': '최근 12개월', all: '전체 기간' }[range];

  body.replaceChildren(...[
    el('div', { class: 'kpis' },
      kpi(`${rangeLabel} 전체 신청`, inRange.length, '건'),
      kpi('입학 상담', count((a) => a.type === '입학 상담'), '건'),
      kpi('특강 신청', count((a) => a.type === '특강 신청'), '건'),
      kpi('이번 달 신청', cThis, '건', delta)
    ),
    monthlyChart(months, byMonth),
    el('div', { class: 'grid-3' },
      barList('학년별', rangeLabel, APPLY_GRADES.map((g) => [g, count((a) => a.grade === g)])),
      barList('희망 과목', '여러 과목 선택 포함', SUBJECTS.map((s) => [s, count((a) => (a.subjects || []).includes(s))])),
      barList('희망 상담 시간', rangeLabel, [...APPLY_TIMES.map((t) => [t, count((a) => a.preferredTime === t)]), ['선택 안 함', count((a) => !a.preferredTime)]])
    ),
    specialStats(inRange, rangeLabel)
  ].filter(Boolean));
}

// 특강별 신청 수 (특강 신청이 있을 때만)
function specialStats(inRange, rangeLabel) {
  const sp = inRange.filter((a) => a.type === '특강 신청');
  if (!sp.length) return null;
  const map = new Map();
  sp.forEach((a) => { const k = a.special || '구분 없음'; map.set(k, (map.get(k) || 0) + 1); });
  return barList('특강별 신청', rangeLabel, [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')));
}

/* ── 학생 관리 · 접속 통계 ───────────────────────── */
$('#sf-gen').addEventListener('click', () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(8));
  $('#sf-pw').value = Array.from(r, (n) => chars[n % chars.length]).join('');
});

$('#stu-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#stu-msg');
  const name = $('#sf-name').value.trim();
  const grade = $('#sf-grade').value;
  const loginId = be.normalizeLoginId($('#sf-id').value);
  const pw = $('#sf-pw').value;
  if (!name) return message(msg, '학생 이름을 입력해 주세요.', 'err');
  if (!ID_RE.test(loginId)) return message(msg, '아이디는 영문 소문자와 숫자로 3~20자로 정해 주세요.', 'err');
  if (pw.length < 6) return message(msg, '처음 비밀번호는 6자 이상이어야 해요.', 'err');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await be.createStudent({ loginId, password: pw, name, grade });
    message(msg, `${name}(${grade}) 학생 계정을 만들었어요. 아이디 ${loginId} · 처음 비밀번호 ${pw} — 학생에게 알려 주시고, 로그인 후 비밀번호를 바꾸도록 안내해 주세요.`, 'ok');
    $('#sf-name').value = ''; $('#sf-id').value = ''; $('#sf-pw').value = '';
    await loadView('students', true);
  } catch (err) {
    message(msg, friendlyError(err), 'err');
  } finally {
    btn.disabled = false;
  }
});

['#sl-q', '#sl-grade', '#sl-state'].forEach((s) => $(s).addEventListener('input', renderStudents));
$('#lg-range').addEventListener('change', renderLoginStats);

function kpiPeople(label, n) { return kpi(label, n, '명'); }

function renderStudents() {
  const list = cache.students || [];
  const now = new Date();
  const active = list.filter((s) => s.active);
  $('#stu-kpis').replaceChildren(
    kpiPeople('전체 회원', list.length),
    kpiPeople('사용 중인 계정', active.length),
    kpiPeople('오늘 접속한 학생', list.filter((s) => s.lastLoginAt && startOfDay(s.lastLoginAt).getTime() === startOfDay(now).getTime()).length),
    kpiPeople('최근 7일 접속한 학생', list.filter((s) => withinDays(s.lastLoginAt, 7)).length),
    kpiPeople('보호자 확인 대기', list.filter((s) => s.guardianStatus === 'pending').length)
  );
  renderLoginStats();

  const q = $('#sl-q').value.trim().toLowerCase();
  const g = $('#sl-grade').value;
  const st = $('#sl-state').value;
  const rows = list
    .filter((s) => (!q || String(s.name || '').toLowerCase().includes(q) || String(s.loginId || '').includes(q))
      && (!g || s.grade === g)
      && (!st || (st === 'on' ? s.active : st === 'pending' ? s.guardianStatus === 'pending' : (!s.active && s.guardianStatus !== 'pending'))))
    .sort((a, b) => GRADES_ALL.indexOf(a.grade) - GRADES_ALL.indexOf(b.grade) || String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
  $('#stu-count').textContent = `${rows.length}명`;

  $('#stu-table').replaceChildren(list.length
    ? table([{ label: '이름' }, { label: '학년' }, { label: '아이디' }, { label: '가입' }, { label: '보호자' }, { label: '최근 접속' }, { label: '접속 횟수', num: true }, { label: '상태' }, { label: '관리' }],
        rows.map(studentRow), { empty: '조건에 맞는 학생이 없어요.' })
    : el('p', { class: 'empty', text: '아직 가입한 학생이 없어요. 학생이 홈페이지에서 회원가입하면 여기에 보여요.' }));

  const logins = cache.logins || [];
  $('#login-table').replaceChildren(logins.length
    ? table(['접속 시각', '이름', '학년', '아이디'], logins.slice(0, 300).map((l) => el('tr', {}, el('td', { text: formatDateTime(l.at) }), el('td', { text: l.name }), el('td', { text: l.grade }), el('td', { text: l.loginId }))), { maxHeight: 420 })
    : el('p', { class: 'empty', text: '아직 접속 기록이 없어요.' }));
}

function renderLoginStats() {
  const n = Number($('#lg-range').value);
  const days = daysBack(n);
  const logins = (cache.logins || []).filter((l) => withinDays(l.at, n));
  const byDay = Object.fromEntries(days.map((d) => [dayKey(d), new Set()]));
  logins.forEach((l) => { const k = dayKey(l.at); if (byDay[k]) byDay[k].add(l.uid); });
  const values = days.map((d) => byDay[dayKey(d)].size);
  const uniqueStudents = new Map();
  logins.forEach((l) => uniqueStudents.set(l.uid, l.grade));
  const gradeRows = GRADES_ALL.map((g) => [g, [...uniqueStudents.values()].filter((x) => x === g).length]);

  const { top, ticks } = niceScale(Math.max(0, ...values));
  const tip = el('div', { class: 'tip', 'aria-hidden': 'true', hidden: true });
  const plot = el('div', { class: 'chart-plot' });
  ticks.forEach((t) => plot.append(el('div', { class: 'chart-grid', style: `bottom:${(t / top) * 100}%` })));
  const cols = el('div', { class: 'chart-cols' });
  const chart = el('div', { class: 'chart', role: 'img', 'aria-label': `최근 ${n}일 날짜별 접속한 학생 수 막대그래프. 정확한 숫자는 표로 보기에 있어요.` },
    el('div', { class: 'chart-y', 'aria-hidden': 'true' }, ticks.map((t) => el('span', { style: `bottom:${(t / top) * 100}%`, text: String(t) }))),
    plot,
    el('div', { class: 'chart-x' + (n > 14 ? ' sparse' : ''), 'aria-hidden': 'true' }, days.map((d) => el('span', { text: `${d.getMonth() + 1}/${d.getDate()}` }))),
    tip
  );
  days.forEach((d, i) => {
    const v = values[i];
    const g = el('div', { class: 'dg', tabindex: '0', 'aria-label': `${d.getMonth() + 1}월 ${d.getDate()}일: ${v}명 접속` },
      el('span', { class: 'bar c-b', style: `height:${(v / top) * 100}%` }));
    attachTip(g, tip, chart, () => [el('div', { class: 'muted', text: `${d.getMonth() + 1}월 ${d.getDate()}일` }), el('div', {}, el('b', { text: `${v}명` }), ' 접속')]);
    cols.append(g);
  });
  plot.append(cols);

  $('#login-stats').replaceChildren(
    el('div', { class: 'kpis', style: 'margin-bottom:18px' },
      kpi(`최근 ${n}일 접속한 학생`, uniqueStudents.size, '명'),
      kpi(`최근 ${n}일 로그인`, logins.length, '회'),
      kpi('하루 평균 접속 학생', Math.round((values.reduce((a, b) => a + b, 0) / n) * 10) / 10, '명')
    ),
    chart,
    el('details', { class: 'tbl-view' }, el('summary', { text: '표로 보기' }),
      table([{ label: '날짜' }, { label: '접속한 학생', num: true }], days.map((d, i) => el('tr', {}, el('td', { text: formatDate(d) }), el('td', { class: 'num', text: `${values[i]}명` }))).reverse(), { maxHeight: 300 })),
    el('div', { style: 'margin-top:18px' }, barList('학년별 접속 학생', `최근 ${n}일`, gradeRows))
  );
}

function studentRow(s) {
  const gradeSel = el('select', { 'aria-label': `${s.name} 학년 변경` }, GRADES_ALL.map((g) => el('option', { selected: g === s.grade, text: g })));
  gradeSel.addEventListener('change', async () => {
    try { await be.updateStudent(s.uid, { grade: gradeSel.value }); s.grade = gradeSel.value; }
    catch (err) { alert(friendlyError(err)); gradeSel.value = s.grade; }
  });
  const pending = s.guardianStatus === 'pending';
  let actions;
  if (pending) {
    const ok = el('button', { type: 'button', class: 'a-btn small primary', text: '동의 확인' });
    ok.addEventListener('click', async () => {
      if (!confirm(`${s.name} 학생의 보호자(${s.guardianName || ''}, ${s.guardianPhone || ''})께 전화로 동의를 확인하셨나요? 확인하면 바로 보충 강의를 볼 수 있어요.`)) return;
      ok.disabled = true;
      try { await be.approveGuardian(s.uid); s.active = true; s.guardianStatus = 'confirmed'; renderStudents(); }
      catch (err) { alert(friendlyError(err)); ok.disabled = false; }
    });
    const del = el('button', { type: 'button', class: 'a-btn small danger', text: '삭제' });
    del.addEventListener('click', async () => {
      if (!confirm(`${s.name} 학생의 가입 신청을 삭제할까요? 보호자 동의가 확인되지 않으면 5일 안에 삭제해야 해요.`)) return;
      del.disabled = true;
      try { await be.deleteStudent(s.uid); cache.students = cache.students.filter((x) => x.uid !== s.uid); renderStudents(); }
      catch (err) { alert(friendlyError(err)); del.disabled = false; }
    });
    actions = el('div', { class: 'a-row' }, ok, del);
  } else {
    actions = el('button', { type: 'button', class: 'a-btn small' + (s.active ? ' danger' : ''), text: s.active ? '사용 중지' : '다시 사용' });
    actions.addEventListener('click', async () => {
      if (s.active && !confirm(`${s.name} 학생 계정을 사용 중지할까요? 중지하면 보충 강의를 볼 수 없어요.`)) return;
      actions.disabled = true;
      try { await be.updateStudent(s.uid, { active: !s.active }); s.active = !s.active; renderStudents(); }
      catch (err) { alert(friendlyError(err)); actions.disabled = false; }
    });
  }
  const state = pending ? el('span', { class: 'pill wait', text: '보호자 확인 대기' }) : el('span', { class: 'pill ' + (s.active ? 'on' : 'off'), text: s.active ? '사용 중' : '사용 중지' });
  return el('tr', { class: s.active || pending ? null : 'off' },
    el('td', {}, el('strong', { text: s.name })),
    el('td', {}, gradeSel),
    el('td', { text: s.loginId }),
    el('td', { text: s.selfSignup ? '직접 가입' : '학원 생성' }),
    el('td', {}, s.guardianName ? [el('div', { text: s.guardianName }), el('a', { href: 'tel:' + String(s.guardianPhone || '').replace(/[^0-9+]/g, ''), text: s.guardianPhone })] : '—'),
    el('td', { text: formatDateTime(s.lastLoginAt) }),
    el('td', { class: 'num', text: String(s.loginCount || 0) }),
    el('td', {}, state),
    el('td', {}, actions)
  );
}

/* ── 시청 내역 ─────────────────────────────────── */
['#vw-range', '#vw-grade', '#vw-q'].forEach((s) => $(s).addEventListener('input', renderViews));

function groupViews(list) {
  const map = new Map();
  list.forEach((v) => {
    const g = map.get(v.videoId) || { videoId: v.videoId, title: v.title, subject: v.subject, videoGrade: v.videoGrade, count: 0, uids: new Set(), last: null };
    g.count += 1; g.uids.add(v.uid);
    if (!g.last || (v.at && v.at > g.last)) g.last = v.at;
    map.set(v.videoId, g);
  });
  return [...map.values()].map((g) => ({ ...g, students: g.uids.size })).sort((a, b) => b.count - a.count);
}

function renderViews() {
  const range = $('#vw-range').value;
  const grade = $('#vw-grade').value;
  const q = $('#vw-q').value.trim().toLowerCase();
  const list = (cache.views || []).filter((v) => (range === 'all' || withinDays(v.at, Number(range)))
    && (!grade || v.grade === grade)
    && (!q || String(v.name || '').toLowerCase().includes(q) || String(v.loginId || '').includes(q)));
  const rangeLabel = { '7': '최근 7일', '30': '최근 30일', all: '전체 기간' }[range];

  const byVideo = groupViews(list);
  const byStudent = new Map();
  list.forEach((v) => {
    const s = byStudent.get(v.uid) || { name: v.name, grade: v.grade, loginId: v.loginId, count: 0, vids: new Set(), last: null };
    s.count += 1; s.vids.add(v.videoId);
    if (!s.last || (v.at && v.at > s.last)) s.last = v.at;
    byStudent.set(v.uid, s);
  });
  const students = [...byStudent.values()].sort((a, b) => b.count - a.count);

  $('#vw-kpis').replaceChildren(
    kpi(`${rangeLabel} 시청`, list.length, '회'),
    kpi('본 학생', students.length, '명'),
    kpi('본 영상', byVideo.length, '개')
  );
  const none = (cache.views || []).length ? '조건에 맞는 시청 기록이 없어요.' : '아직 시청 기록이 없어요. 학생이 보충 강의를 열면 여기에 쌓여요.';
  $('#vw-by-video').replaceChildren(table(
    [{ label: '영상' }, { label: '학년·과목' }, { label: '시청', num: true }, { label: '본 학생', num: true }, { label: '마지막 시청' }],
    byVideo.map((g) => el('tr', {}, el('td', {}, el('strong', { text: g.title })), el('td', { text: `${g.videoGrade} · ${g.subject}` }), el('td', { class: 'num', text: `${g.count}회` }), el('td', { class: 'num', text: `${g.students}명` }), el('td', { text: formatDateTime(g.last) }))),
    { empty: none }));
  $('#vw-by-student').replaceChildren(table(
    [{ label: '이름' }, { label: '학년' }, { label: '아이디' }, { label: '시청', num: true }, { label: '본 영상', num: true }, { label: '마지막 시청' }],
    students.map((s) => el('tr', {}, el('td', {}, el('strong', { text: s.name })), el('td', { text: s.grade }), el('td', { text: s.loginId }), el('td', { class: 'num', text: `${s.count}회` }), el('td', { class: 'num', text: `${s.vids.size}개` }), el('td', { text: formatDateTime(s.last) }))),
    { empty: none, maxHeight: 420 }));
  $('#vw-log').replaceChildren(table(
    ['시청 시각', '이름', '학년', '영상', '영상 학년·과목'],
    list.slice(0, 300).map((v) => el('tr', {}, el('td', { text: formatDateTime(v.at) }), el('td', { text: v.name }), el('td', { text: v.grade }), el('td', { text: v.title }), el('td', { text: `${v.videoGrade} · ${v.subject}` }))),
    { empty: none, maxHeight: 420 }));
}

/* ── 보충 강의 관리 ─────────────────────────────── */
$('#vf-date').value = todayString();

$('#vf-url').addEventListener('input', () => {
  const v = $('#vf-url').value.trim();
  const id = youtubeId(v);
  const box = $('#vf-preview');
  if (!v) { box.hidden = true; return; }
  box.hidden = false;
  box.replaceChildren(id
    ? el('span', {}, el('img', { src: thumbUrl(id), alt: '', width: '128', height: '72' }))
    : el('span', {}),
    el('span', { text: id ? '유튜브 주소를 확인했어요.' : '유튜브 영상 주소가 아닌 것 같아요. 유튜브에서 [공유] → [복사]한 주소를 붙여 넣어 주세요.' }));
});

$('#vid-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#vid-msg');
  const title = $('#vf-title').value.trim();
  const url = $('#vf-url').value.trim();
  const date = $('#vf-date').value;
  if (!title) return message(msg, '강의 제목을 입력해 주세요.', 'err');
  if (!youtubeId(url)) return message(msg, '유튜브 영상 주소를 확인해 주세요.', 'err');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return message(msg, '올린 날짜를 골라 주세요.', 'err');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await be.addVideo({ grade: $('#vf-grade').value, subject: $('#vf-subject').value, title, youtube: url, date });
    message(msg, `'${title}' 영상을 ${$('#vf-grade').value} 보충 강의에 등록했어요.`, 'ok');
    $('#vf-title').value = ''; $('#vf-url').value = ''; $('#vf-preview').hidden = true;
    await loadView('videos', true);
  } catch (err) {
    message(msg, friendlyError(err), 'err');
  } finally {
    btn.disabled = false;
  }
});

$('#vl-grade').addEventListener('change', renderVideos);

function renderVideos() {
  const g = $('#vl-grade').value;
  const list = (cache.videos || [])
    .filter((v) => !g || v.grade === g)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  $('#vid-count').textContent = `${list.length}개`;
  if (!list.length) {
    $('#vid-list').replaceChildren(el('p', { class: 'empty', text: (cache.videos || []).length ? '이 학년에 등록된 영상이 없어요.' : '아직 등록한 보충 강의가 없어요.' }));
    return;
  }
  $('#vid-list').replaceChildren(...list.map((v) => {
    const id = youtubeId(v.youtube);
    const del = el('button', { type: 'button', class: 'a-btn small danger', text: '삭제' });
    del.addEventListener('click', async () => {
      if (!confirm(`'${v.title}' 영상을 목록에서 삭제할까요? (유튜브 영상 자체는 지워지지 않아요)`)) return;
      del.disabled = true;
      try { await be.deleteVideo(v.id); cache.videos = cache.videos.filter((x) => x.id !== v.id); renderVideos(); }
      catch (err) { alert(friendlyError(err)); del.disabled = false; }
    });
    return el('div', { class: 'vrow' },
      id ? el('img', { src: thumbUrl(id), alt: '', width: '112', height: '63', loading: 'lazy' }) : el('span'),
      el('div', { class: 'meta' },
        el('div', {}, el('span', { class: 'subj subj-' + (SUBJECT_CLASS[v.subject] || 'ko'), text: v.subject })),
        el('strong', { text: v.title }),
        el('span', { text: `${v.grade} · ${formatDate(v.date)}` })
      ),
      el('div', { class: 'acts' },
        el('a', { class: 'a-btn small', href: v.youtube, target: '_blank', rel: 'noopener', text: '유튜브 열기' }),
        del)
    );
  }));
}

/* ── 공지 관리 ─────────────────────────────────── */
$('#nt-date').value = todayString();

// 사진은 브라우저에서 줄인 뒤(긴 쪽 최대 1600px, JPG) 올림 — 한 장당 약 0.9MB 이하
let ntImages = [];
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        for (const [maxSide, q] of [[1600, 0.82], [1400, 0.75], [1200, 0.7], [1000, 0.65], [800, 0.6]]) {
          const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
          const data = c.toDataURL('image/jpeg', q);
          if (data.length <= 900000) { resolve({ data, w, h, name: file.name }); return; }
        }
        reject(Object.assign(new Error('too big'), { code: 'app/image-too-big' }));
      } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(Object.assign(new Error('read'), { code: 'app/image-read' })); };
    img.src = url;
  });
}
function renderNtPreview() {
  const box = $('#nt-preview');
  box.hidden = !ntImages.length;
  box.replaceChildren(...ntImages.map((im, i) => {
    const rm = el('button', { type: 'button', class: 'a-btn small', text: '빼기', 'aria-label': `${i + 1}번째 사진 빼기` });
    rm.addEventListener('click', () => { ntImages.splice(i, 1); renderNtPreview(); });
    return el('div', { class: 'nt-thumb' }, el('img', { src: im.data, alt: `올릴 사진 ${i + 1}` }), el('span', { text: `${im.w}×${im.h} · ${Math.round(im.data.length * 0.75 / 1024)}KB` }), rm);
  }));
}
$('#nt-images').addEventListener('change', async (e) => {
  const msg = $('#nt-msg');
  const files = [...e.target.files];
  e.target.value = '';
  if (ntImages.length + files.length > 3) message(msg, '사진은 공지 하나에 3장까지 올릴 수 있어요. 앞의 사진부터 3장만 넣었어요.', 'err');
  else message(msg, '');
  for (const f of files.slice(0, 3 - ntImages.length)) {
    try { ntImages.push(await shrinkImage(f)); }
    catch (err) { message(msg, err.code === 'app/image-read' ? `'${f.name}' 사진을 열 수 없어요. JPG나 PNG 사진으로 올려 주세요.` : `'${f.name}' 사진이 너무 커요. 더 작은 사진으로 올려 주세요.`, 'err'); }
  }
  renderNtPreview();
});

$('#nt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#nt-msg');
  const title = $('#nt-title').value.trim();
  const body = $('#nt-body').value.trim();
  const date = $('#nt-date').value;
  if (!title) return message(msg, '공지 제목을 입력해 주세요.', 'err');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return message(msg, '게시일을 골라 주세요.', 'err');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    await be.addNotice({ category: $('#nt-cat').value, title, body, date, images: ntImages });
    message(msg, `'${title}' 공지를 올렸어요. 홈페이지 '공지사항'과 첫 화면 '학원 소식'에 보여요.`, 'ok');
    $('#nt-title').value = ''; $('#nt-body').value = ''; ntImages = []; renderNtPreview();
    await loadView('notices', true);
  } catch (err) {
    message(msg, friendlyError(err), 'err');
  } finally {
    btn.disabled = false;
  }
});

function renderNotices() {
  const list = [...(cache.notices || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('#nt-count').textContent = `${list.length}개`;
  if (!list.length) {
    $('#nt-list').replaceChildren(el('p', { class: 'empty', text: '올린 공지가 없어요. 지금은 홈페이지에 \'아직 올라온 소식이 없어요\'로 보여요.' }));
    return;
  }
  $('#nt-list').replaceChildren(table(['게시일', '분류', '제목', '사진', '첫 화면', ''], list.map((n, i) => {
    const del = el('button', { type: 'button', class: 'a-btn small danger', text: '삭제' });
    del.addEventListener('click', async () => {
      if (!confirm(`'${n.title}' 공지를 삭제할까요?`)) return;
      del.disabled = true;
      try { await be.deleteNotice(n.id); cache.notices = cache.notices.filter((x) => x.id !== n.id); renderNotices(); }
      catch (err) { alert(friendlyError(err)); del.disabled = false; }
    });
    return el('tr', {}, el('td', { text: formatDate(n.date) }), el('td', { text: n.category }), el('td', {}, el('strong', { text: n.title })),
      el('td', { text: n.imageCount ? `${n.imageCount}장` : '—' }),
      el('td', {}, el('span', { class: 'pill ' + (i < 5 ? 'on' : 'off'), text: i < 5 ? '보이는 중' : '공지사항에만' })), el('td', {}, del));
  })));
}

/* ── 관리자 · 가입 승인 ─────────────────────────── */
function renderAdmins() {
  const reqs = cache.requests || [];
  $('#ad-requests').replaceChildren(reqs.length
    ? table(['신청 일시', '이름', '이메일', ''], reqs.map((r) => {
        const ok = el('button', { type: 'button', class: 'a-btn small primary', text: '승인' });
        const no = el('button', { type: 'button', class: 'a-btn small danger', text: '거절' });
        ok.addEventListener('click', async () => {
          if (!confirm(`${r.name}(${r.email})님을 관리자로 승인할까요? 승인하면 상담 신청서·학생 정보를 모두 볼 수 있어요.`)) return;
          ok.disabled = true;
          try { await be.approveAdminRequest(r); cache.requests = null; cache.admins = null; await loadView('admins', true); }
          catch (err) { alert(friendlyError(err)); ok.disabled = false; }
        });
        no.addEventListener('click', async () => {
          if (!confirm(`${r.name}님의 관리자 가입 신청을 거절할까요?`)) return;
          no.disabled = true;
          try { await be.rejectAdminRequest(r.uid); cache.requests = cache.requests.filter((x) => x.uid !== r.uid); renderAdmins(); updateBadges(); }
          catch (err) { alert(friendlyError(err)); no.disabled = false; }
        });
        return el('tr', {}, el('td', { text: formatDateTime(r.createdAt) }), el('td', {}, el('strong', { text: r.name })), el('td', { text: r.email }), el('td', {}, el('div', { class: 'a-row' }, ok, no)));
      }))
    : el('p', { class: 'empty', text: '승인을 기다리는 관리자 가입 신청이 없어요.' }));

  const admins = [...(cache.admins || [])].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  $('#ad-list').replaceChildren(table(['이름', '이메일', '등록 방법', '등록 일시', ''], admins.map((a) => {
    const self = a.uid === me.uid;
    let act = el('span', { class: 'card-sub', text: self ? '나' : '' });
    if (!self) {
      act = el('button', { type: 'button', class: 'a-btn small danger', text: '관리자 해제' });
      act.addEventListener('click', async () => {
        if (!confirm(`${a.name}(${a.email})님을 관리자에서 해제할까요? 해제하면 관리자 화면을 쓸 수 없어요.`)) return;
        act.disabled = true;
        try { await be.removeAdmin(a.uid); cache.admins = cache.admins.filter((x) => x.uid !== a.uid); renderAdmins(); }
        catch (err) { alert(friendlyError(err)); act.disabled = false; }
      });
    }
    return el('tr', {}, el('td', {}, el('strong', { text: a.name || '—' })), el('td', { text: a.email || '—' }),
      el('td', { text: a.via === 'approved' ? '승인으로 등록' : a.via === 'founder' ? '처음 가입' : '콘솔에서 등록' }),
      el('td', { text: formatDateTime(a.createdAt) }), el('td', {}, act));
  })));
}

/* ── 학생 관리 · 클래스 (숙제 공지 · 스탬프) ─────────────── */
const subTabs = [$('#sub-list-tab'), $('#sub-class-tab')];
function openSub(which, focus) {
  subTabs.forEach((t) => {
    const on = t.id === `sub-${which}-tab`;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    if (on && focus) t.focus();
  });
}
subTabs.forEach((t, i) => {
  t.addEventListener('click', () => openSub(i ? 'class' : 'list'));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    openSub(i ? 'list' : 'class', true);
  });
});

let selClass = null;            // 열어 본 클래스 id (null이면 클래스 목록)
const classData = {};           // 클래스 id → { homework, stamps }
let stampReason = '';           // 스탬프 이유 (다시 그려도 유지)
let stampFlash = '', hwFlash = '', rulesFlash = '';
let editingClass = false;
let addQuery = '', addGrade = '';
const addPicked = new Set();
let stampLogOpen = false;
let staffEditing = false;

// 스탬프 최대 개수 입력값 확인 (1~100 정수)
function readMax(input) {
  const raw = String(input.value).trim();
  const n = Number(raw);
  return /^\d+$/.test(raw) && n >= 1 && n <= STAMP_MAX_LIMIT ? n : null;
}
const subjBadge = (s) => el('span', { class: 'subj subj-' + (SUBJECT_CLASS[s] || 'etc'), text: s || '기타' });
const membersOf = (cid) => (cache.students || []).filter((s) => Array.isArray(s.classIds) && s.classIds.includes(cid));
const studentName = (uid) => { const s = (cache.students || []).find((x) => x.uid === uid); return s ? s.name : '(탈퇴한 학생)'; };
const byGradeName = (a, b) => GRADES_ALL.indexOf(a.grade) - GRADES_ALL.indexOf(b.grade) || String(a.name || '').localeCompare(String(b.name || ''), 'ko');
const newest = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
const adminName = (uid) => { const a = (cache.admins || []).find((x) => x.uid === uid); return a ? (a.name || a.email) : '(해제된 관리자)'; };
const subIds = () => (cache.staff && cache.staff.subIds) || [];

// 이 클래스에서 내 역할: owner(대표관리자) · sub(서브관리자, 보기 전용) · none(열람 불가)
function roleOf(c) {
  if (!c.ownerId || c.ownerId === me.uid) return 'owner';
  if (subIds().includes(me.uid)) return 'sub';
  return 'none';
}

// 처음 한 번: 서브관리자 목록이 아직 없으면 아벨학원 계정을 모든 클래스의 서브관리자로 저장
async function initStaff() {
  if (!cache.staff || cache.staff.exists) return;
  const def = (cache.admins || []).find((a) => String(a.email || '').toLowerCase() === DEFAULT_SUB_EMAIL);
  if (!def) return;
  await be.saveClassStaff([def.uid]);
  cache.staff = { exists: true, subIds: [def.uid] };
}

async function loadClasses(force) {
  await Promise.all([
    ensure('classes', be.listClasses, force),
    ensure('admins', be.listAdmins, force),
    ensure('staff', be.getClassStaff, force)
  ]);
  try { await initStaff(); } catch (e) { console.warn('서브관리자 기본값 저장 실패', e); }
}

function fillOwnerSelect() {
  const sel = $('#cl-owner');
  const keep = sel.value || me.uid;
  const admins = [...(cache.admins || [])].sort((a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : String(a.name || '').localeCompare(String(b.name || ''), 'ko')));
  sel.replaceChildren(...admins.map((a) => el('option', { value: a.uid, text: `${a.name || '(이름 없음)'} (${a.email || ''})${a.uid === me.uid ? ' · 나' : ''}` })));
  if (admins.some((a) => a.uid === keep)) sel.value = keep;
}

$('#cl-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#cl-msg');
  const name = $('#cl-name').value.trim();
  const subject = $('#cl-subject').value;
  const memo = $('#cl-memo').value.trim();
  const ownerId = $('#cl-owner').value;
  const stampMax = readMax($('#cl-max'));
  if (!name) return message(msg, '클래스 이름을 입력해 주세요.', 'err');
  if (!ownerId) return message(msg, '대표관리자를 골라 주세요.', 'err');
  if (!stampMax) return message(msg, `스탬프 최대 개수는 1부터 ${STAMP_MAX_LIMIT}까지의 숫자로 적어 주세요.`, 'err');
  if ((cache.classes || []).some((c) => c.name === name)) return message(msg, '같은 이름의 클래스가 이미 있어요. 다른 이름으로 정해 주세요.', 'err');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const id = await be.addClass({ name, subject, memo, stampMax, ownerId });
    $('#cl-name').value = ''; $('#cl-memo').value = ''; $('#cl-max').value = String(STAMP_MAX_DEFAULT); $('#cl-owner').value = me.uid;
    cache.classes = await be.listClasses();
    if (ownerId === me.uid) {
      message(msg, '');
      classData[id] = { homework: [], stamps: [] };
      rulesFlash = `'${name}' 클래스를 만들었어요. 학생을 넣고 스탬프 규칙과 상품도 적어 보세요.`;
      openClass(id);
    } else {
      message(msg, `'${name}' 클래스를 만들었어요. 대표관리자 ${adminName(ownerId)}님만 이 클래스를 열어 학생·숙제·스탬프를 관리할 수 있어요.`, 'ok');
      renderClasses();
    }
  } catch (err) {
    message(msg, friendlyError(err), 'err');
  } finally {
    btn.disabled = false;
  }
});

$('#cl-back').addEventListener('click', () => backToList());

function openClass(id) {
  if (selClass !== id) { editingClass = false; addPicked.clear(); addQuery = ''; addGrade = ''; stampFlash = ''; hwFlash = ''; }
  selClass = id;
  renderClasses();
  $('#cl-back').focus();
}

// 시간표의 '클래스 열기': 학생 관리 → 클래스에서 그 클래스를 엶
function goToClass(id) {
  openView('students');
  openSub('class');
  selClass = id; editingClass = false; addPicked.clear(); addQuery = ''; addGrade = ''; stampFlash = ''; hwFlash = '';
  $('#nav-students').focus();
}

function backToList(focusId) {
  selClass = null; editingClass = false;
  renderClasses();
  const t = focusId && document.querySelector(`#cl-list [data-cid="${focusId}"]`);
  (t || $('#cl-list button') || $('#sub-class-tab')).focus();
}

function renderClasses() {
  const c = selClass && (cache.classes || []).find((x) => x.id === selClass);
  const open = c && roleOf(c) !== 'none';
  if (selClass && !open) selClass = null;
  $('#cl-list-view').hidden = Boolean(open);
  $('#cl-detail-view').hidden = !open;
  if (open) { renderClassDetail(); return; }
  renderClassList();
  renderStaff();
  fillOwnerSelect();
}

function renderClassList() {
  const list = [...(cache.classes || [])].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  const mine = list.filter((c) => roleOf(c) === 'owner').length;
  const sub = list.filter((c) => roleOf(c) === 'sub').length;
  $('#cl-count').textContent = `${list.length}개`;
  $('#cl-mine').textContent = list.length ? `내가 대표관리자 ${mine}개` + (sub ? ` · 서브관리자로 볼 수 있음 ${sub}개` : '') : '';
  message($('#cl-list-msg'), '');
  if (!list.length) {
    $('#cl-new').open = true;
    $('#cl-list').replaceChildren(el('p', { class: 'empty', text: "아직 만든 클래스가 없어요. 위의 '새 클래스 만들기'에서 만들어 주세요." }));
    return;
  }
  $('#cl-list').replaceChildren(el('ul', { class: 'cls-grid-list' }, list.map((c) => {
    const role = roleOf(c);
    const pill = role === 'owner' ? el('span', { class: 'pill on', text: '대표관리자' })
      : role === 'sub' ? el('span', { class: 'pill off', text: '서브관리자 · 보기 전용' })
      : el('span', { class: 'pill lock', text: '열람 권한 없음' });
    const body = [
      el('span', { class: 'cls-item-top' }, subjBadge(c.subject), el('strong', { text: c.name })),
      el('span', { class: 'cls-item-sub', text: `대표관리자 ${c.ownerId ? adminName(c.ownerId) : '(정해지지 않음)'} · 학생 ${membersOf(c.id).length}명` }),
      pill
    ];
    if (role === 'none') {
      const b = el('button', { type: 'button', class: 'cls-tile locked', 'data-cid': c.id, 'aria-label': `${c.name}: 대표관리자만 열 수 있어요` },
        ...body, el('span', { class: 'lock-ico', 'aria-hidden': 'true', text: '🔒' }));
      b.addEventListener('click', () => message($('#cl-list-msg'), `'${c.name}'은(는) 대표관리자 ${adminName(c.ownerId)}님과 서브관리자만 열 수 있어요.`, 'err'));
      return el('li', {}, b);
    }
    const b = el('button', { type: 'button', class: 'cls-tile', 'data-cid': c.id }, ...body, el('span', { class: 'go', 'aria-hidden': 'true', text: '열기 →' }));
    b.addEventListener('click', () => openClass(c.id));
    return el('li', {}, b);
  })));
}

function renderStaff() {
  const box = $('#cl-staff-body');
  const subs = subIds();
  const iCanEdit = !cache.staff || !cache.staff.exists || subs.includes(me.uid);
  const names = subs.length
    ? el('ul', { class: 'staff-list' }, subs.map((uid) => {
        const a = (cache.admins || []).find((x) => x.uid === uid);
        return el('li', {}, el('strong', { text: a ? a.name || '(이름 없음)' : '(해제된 관리자)' }), a ? el('span', { class: 'sub', text: a.email }) : null, uid === me.uid ? el('span', { class: 'pill on', text: '나' }) : null);
      }))
    : el('p', { class: 'empty', style: 'padding: 12px 0; text-align: left;', text: cache.staff && cache.staff.exists ? '지정된 서브관리자가 없어요.' : `아벨학원 계정(${DEFAULT_SUB_EMAIL})이 관리자로 가입하면 자동으로 모든 클래스의 서브관리자가 돼요.` });
  const note = el('p', { class: 'view-note', text: '서브관리자는 모든 클래스의 학생 목록, 스탬프 현황·기록, 숙제, 스탬프 규칙을 볼 수 있지만 스탬프를 주거나 빼는 등 바꾸지는 못해요.' });
  if (!staffEditing) {
    const edit = iCanEdit ? el('button', { type: 'button', class: 'a-btn small', id: 'staff-edit', text: '서브관리자 바꾸기' }) : null;
    if (edit) edit.addEventListener('click', () => { staffEditing = true; renderStaff(); $('#staff-form input').focus(); });
    box.replaceChildren(...[note, names,
      edit ? el('div', { style: 'margin-top: 12px;' }, edit) : el('p', { class: 'view-note', style: 'margin-top: 10px;', text: '서브관리자 설정은 지금 서브관리자인 계정에서만 바꿀 수 있어요.' })].filter(Boolean));
    return;
  }
  const checks = (cache.admins || []).map((a) => el('label', { class: 'pick' },
    el('input', { type: 'checkbox', value: a.uid, checked: subs.includes(a.uid) }),
    el('strong', { text: a.name || '(이름 없음)' }), el('span', { class: 'sub', text: a.email })));
  const msg = el('p', { class: 'a-msg', role: 'status', hidden: true });
  const save = el('button', { type: 'submit', class: 'a-btn primary', text: '저장' });
  const cancel = el('button', { type: 'button', class: 'a-btn', text: '취소' });
  cancel.addEventListener('click', () => { staffEditing = false; renderStaff(); $('#staff-edit').focus(); });
  const form = el('form', { id: 'staff-form', novalidate: true }, el('div', { class: 'pick-list' }, checks), el('div', { class: 'a-row', style: 'margin-top: 12px;' }, save, cancel), msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const next = [...form.querySelectorAll('input:checked')].map((x) => x.value);
    if (next.length > 10) return message(msg, '서브관리자는 10명까지 정할 수 있어요.', 'err');
    if (subs.includes(me.uid) && !next.includes(me.uid) && !confirm('나를 서브관리자에서 빼면, 내가 대표가 아닌 클래스는 더 이상 볼 수 없고 이 설정도 바꿀 수 없어요. 계속할까요?')) return;
    save.disabled = true;
    try {
      await be.saveClassStaff(next);
      cache.staff = { exists: true, subIds: next };
      staffEditing = false;
      renderClasses();
      message($('#cl-list-msg'), '서브관리자를 저장했어요.', 'ok');
    } catch (err) { message(msg, friendlyError(err), 'err'); save.disabled = false; }
  });
  box.replaceChildren(note, form);
}

async function loadClassData(cid) {
  const [homework, stamps] = await Promise.all([be.listHomework(cid), be.listStamps(cid)]);
  classData[cid] = { homework, stamps };
  return classData[cid];
}

function renderClassDetail(focusSel) {
  const box = $('#cl-detail');
  const c = (cache.classes || []).find((x) => x.id === selClass);
  if (!c) { backToList(); return; }
  const role = roleOf(c);
  const data = classData[c.id];
  if (!data) {
    box.replaceChildren(el('div', { class: 'card' }, el('p', { class: 'empty', text: '불러오는 중…' })));
    loadClassData(c.id)
      .then(() => { if (selClass === c.id) renderClassDetail(focusSel); })
      .catch((e) => box.replaceChildren(el('div', { class: 'card' }, el('p', { class: 'a-msg err', text: friendlyError(e) }))));
    return;
  }
  const own = role === 'owner';
  box.replaceChildren(classHeadCard(c, data, own), rulesCard(c, own), membersCard(c, data, own), homeworkAdminCard(c, data, own), stampLogCard(c, data, own));
  if (focusSel) { const t = box.querySelector(focusSel); if (t && !t.disabled) t.focus(); }
  fillLessons(c.id);
}

// 이 클래스와 연결된 시간표 수업 (시간표 탭에서 수업을 눌러 연결)
async function fillLessons(cid) {
  const p = $('#cl-lessons');
  if (!p) return;
  let list = [];
  try { list = await classLessons(cid); } catch { return; }
  if (selClass !== cid || !p.isConnected) return;
  p.textContent = list.length ? `시간표 수업: ${list.join(' · ')}` : '시간표 수업과 아직 연결되지 않았어요. 시간표 탭에서 수업을 누르고 이 클래스를 연결할 수 있어요.';
  p.hidden = false;
}

function classHeadCard(c, data, own) {
  const members = membersOf(c.id);
  const card = el('div', { class: 'card' });
  if (own && editingClass) {
    const name = el('input', { class: 'a-input', id: 'ce-name', type: 'text', value: c.name, maxlength: '40', required: true });
    const subj = el('select', { class: 'a-input', id: 'ce-subject' }, CLASS_SUBJECTS.map((x) => el('option', { selected: x === c.subject, text: x })));
    const owner = el('select', { class: 'a-input', id: 'ce-owner' }, (cache.admins || []).map((a) => el('option', { value: a.uid, selected: a.uid === (c.ownerId || me.uid), text: `${a.name || '(이름 없음)'} (${a.email || ''})${a.uid === me.uid ? ' · 나' : ''}` })));
    const memo = el('input', { class: 'a-input', id: 'ce-memo', type: 'text', value: c.memo || '', maxlength: '200' });
    const max = el('input', { class: 'a-input', id: 'ce-max', type: 'number', inputmode: 'numeric', min: '1', max: String(STAMP_MAX_LIMIT), step: '1', value: String(stampMaxOf(c)) });
    const msg = el('p', { class: 'a-msg', role: 'status', hidden: true });
    const save = el('button', { type: 'submit', class: 'a-btn primary', text: '저장' });
    const cancel = el('button', { type: 'button', class: 'a-btn', text: '취소' });
    cancel.addEventListener('click', () => { editingClass = false; renderClassDetail('#cl-edit'); });
    const form = el('form', { class: 'a-form', novalidate: true },
      el('div', { class: 'a-fld span-2' }, el('label', { for: 'ce-name', text: '클래스 이름' }), name),
      el('div', { class: 'a-fld' }, el('label', { for: 'ce-subject', text: '과목' }), subj),
      el('div', { class: 'a-fld span-2' }, el('label', { for: 'ce-owner' }, '대표관리자 ', el('span', { class: 'hint', text: '다른 관리자에게 넘길 수 있어요' })), owner),
      el('div', { class: 'a-fld span-2' }, el('label', { for: 'ce-memo' }, '메모 ', el('span', { class: 'hint', text: '학생에게도 보여요' })), memo),
      el('div', { class: 'a-fld' }, el('label', { for: 'ce-max' }, '스탬프 최대 개수 ', el('span', { class: 'hint', text: `1~${STAMP_MAX_LIMIT}` })), max),
      el('div', { class: 'a-row' }, save, cancel));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = { name: name.value.trim(), subject: subj.value, memo: memo.value.trim(), stampMax: readMax(max), ownerId: owner.value };
      if (!v.name) return message(msg, '클래스 이름을 입력해 주세요.', 'err');
      if (!v.stampMax) return message(msg, `스탬프 최대 개수는 1부터 ${STAMP_MAX_LIMIT}까지의 숫자로 적어 주세요.`, 'err');
      if ((cache.classes || []).some((x) => x.id !== c.id && x.name === v.name)) return message(msg, '같은 이름의 클래스가 이미 있어요.', 'err');
      const over = members.filter((s) => data.stamps.filter((x) => x.studentId === s.uid).length > v.stampMax).length;
      if (over && !confirm(`스탬프를 이미 ${v.stampMax}개보다 많이 받은 학생이 ${over}명 있어요. 그 학생들의 스탬프는 지워지지 않고, 스탬프판은 '다 채움'으로 보여요. 이대로 바꿀까요?`)) return;
      const handOver = v.ownerId !== me.uid;
      if (handOver && !confirm(`대표관리자를 ${adminName(v.ownerId)}님으로 바꿀까요?\n바꾸면 나는 이 클래스를 관리할 수 없어요` + (subIds().includes(me.uid) ? ' (서브관리자로 보기만 할 수 있어요).' : '. 다시 열 수도 없어요.'))) return;
      save.disabled = true;
      try {
        await be.updateClass(c.id, v);
        Object.assign(c, v); editingClass = false;
        if (handOver && roleOf(c) === 'none') { backToList(c.id); message($('#cl-list-msg'), `'${c.name}'의 대표관리자를 ${adminName(v.ownerId)}님으로 바꿨어요.`, 'ok'); }
        else renderClassDetail('#cl-edit');
      } catch (err) { message(msg, friendlyError(err), 'err'); save.disabled = false; }
    });
    card.append(el('div', { class: 'card-head' }, el('h2', { text: '클래스 정보 고치기' })), form, msg);
    setTimeout(() => name.focus(), 0);
    return card;
  }
  let actions = el('span', { class: 'pill off', text: '서브관리자 · 보기 전용' });
  if (own) {
    const edit = el('button', { type: 'button', class: 'a-btn small', id: 'cl-edit', text: '정보·대표관리자 고치기' });
    edit.addEventListener('click', () => { editingClass = true; renderClassDetail(); });
    const del = el('button', { type: 'button', class: 'a-btn small danger', text: '클래스 삭제' });
    del.addEventListener('click', async () => {
      if (!confirm(`'${c.name}' 클래스를 삭제할까요?\n숙제 공지와 스탬프 기록도 모두 지워지고 되돌릴 수 없어요. (학생 계정은 그대로예요)`)) return;
      del.disabled = true;
      try {
        await be.deleteClass(c.id, members.map((s) => s.uid));
        members.forEach((s) => { s.classIds = s.classIds.filter((x) => x !== c.id); });
        cache.classes = cache.classes.filter((x) => x.id !== c.id);
        delete classData[c.id];
        backToList();
        message($('#cl-list-msg'), `'${c.name}' 클래스를 삭제했어요.`, 'ok');
      } catch (err) { alert(friendlyError(err)); del.disabled = false; }
    });
    actions = el('div', { class: 'a-row' }, el('span', { class: 'pill on', style: 'align-self: center;', text: '대표관리자' }), edit, del);
  }
  card.append(...[
    el('div', { class: 'cls-head' },
      el('div', { class: 'cls-head-main' }, subjBadge(c.subject), el('h2', { text: c.name })),
      actions),
    el('p', { class: 'view-note', style: 'margin-top: 8px;', text: `대표관리자 ${c.ownerId ? adminName(c.ownerId) : '(정해지지 않음)'}` + (c.memo ? ` · ${c.memo}` : '') }),
    el('p', { class: 'view-note cls-lessons', id: 'cl-lessons', hidden: true }),
    el('div', { class: 'kpis', style: 'margin-top: 18px;' },
      kpi('학생', members.length, '명'),
      kpi('스탬프판', stampMaxOf(c), '칸', '학생 한 명이 모을 수 있는 최대 개수'),
      kpi('스탬프판 다 채운 학생', members.filter((s) => data.stamps.filter((x) => x.studentId === s.uid).length >= stampMaxOf(c)).length, '명'),
      kpi('숙제 공지', data.homework.length, '개'))
  ]);
  return card;
}

// 스탬프 규칙 · 다 모았을 때 상품 (그 반 학생과 관리자 모두에게 보임)
function rulesCard(c, own) {
  const rules = Array.isArray(c.stampRules) ? c.stampRules : [];
  const msg = el('p', { class: 'a-msg', role: 'status', hidden: true });
  if (rulesFlash) { message(msg, rulesFlash, 'ok'); rulesFlash = ''; }
  const save = async (fields, okText, focusSel) => {
    try {
      await be.updateClass(c.id, fields);
      Object.assign(c, fields);
      rulesFlash = okText;
      renderClassDetail(focusSel);
    } catch (err) { message(msg, friendlyError(err), 'err'); }
  };
  const list = rules.length
    ? el('ol', { class: 'rule-list' }, rules.map((r, i) => {
        const li = el('li', {}, el('span', { class: 'rule-text', text: r }));
        if (own) {
          const del = el('button', { type: 'button', class: 'a-btn small danger', 'aria-label': `규칙 '${r}' 삭제`, text: '삭제' });
          del.addEventListener('click', () => { if (confirm(`'${r}' 규칙을 삭제할까요?`)) save({ stampRules: rules.filter((_, j) => j !== i) }, '규칙을 삭제했어요.', '#rule-text'); });
          li.append(del);
        }
        return li;
      }))
    : el('p', { class: 'empty', style: 'padding: 14px 0; text-align: left;', text: own ? '아직 스탬프 규칙이 없어요. 어떤 때 스탬프를 주는지 적어 두면 학생들도 볼 수 있어요.' : '아직 스탬프 규칙이 없어요.' });
  const prizeView = el('div', { class: 'prize-box' }, el('span', { class: 'prize-label', text: `🎁 스탬프 ${stampMaxOf(c)}개를 다 모으면` }), el('strong', { text: c.prize || (own ? '아직 상품을 적지 않았어요' : '상품이 정해지지 않았어요') }));
  const parts = [
    el('div', { class: 'card-head' }, el('h2', { text: '스탬프 규칙 · 상품' }), el('span', { class: 'card-sub', text: '이 반 학생들도 학생 전용 → 클래스에서 볼 수 있어요' })),
    list
  ];
  if (own) {
    const input = el('input', { class: 'a-input', id: 'rule-text', type: 'text', maxlength: String(STAMP_RULE_LEN), placeholder: '예) 숙제를 빠짐없이 해 오면 1개' });
    const add = el('button', { type: 'submit', class: 'a-btn primary', text: '규칙 추가' });
    const form = el('form', { class: 'a-row rule-form', novalidate: true }, el('label', { for: 'rule-text', class: 'sr-only', text: '새 스탬프 규칙' }), input, add);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = input.value.trim().replace(/\s+/g, ' ');
      if (!t) return message(msg, '규칙을 적어 주세요.', 'err');
      if (rules.includes(t)) return message(msg, '이미 있는 규칙이에요.', 'err');
      if (rules.length >= STAMP_RULES_MAX) return message(msg, `규칙은 ${STAMP_RULES_MAX}개까지 적을 수 있어요.`, 'err');
      save({ stampRules: [...rules, t] }, '규칙을 추가했어요.', '#rule-text');
    });
    const prize = el('input', { class: 'a-input', id: 'prize-text', type: 'text', maxlength: String(PRIZE_LEN), value: c.prize || '', placeholder: '예) 문화상품권 5천 원 또는 간식 쿠폰' });
    const pSave = el('button', { type: 'submit', class: 'a-btn primary', text: '상품 저장' });
    const pForm = el('form', { class: 'a-row rule-form', novalidate: true }, prize, pSave);
    pForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = prize.value.trim();
      save({ prize: t }, t ? '상품을 저장했어요.' : '상품을 지웠어요.', '#prize-text');
    });
    parts.push(form,
      el('div', { class: 'a-fld', style: 'margin-top: 18px;' }, el('label', { for: 'prize-text' }, `스탬프 ${stampMaxOf(c)}개를 다 모았을 때 상품 `, el('span', { class: 'hint', text: '선택 · 비우고 저장하면 지워져요' })), pForm));
  } else {
    parts.push(prizeView);
  }
  if (own && c.prize) parts.push(prizeView);
  parts.push(msg);
  return el('div', { class: 'card cls-rules' }, ...parts);
}

async function giveStamps(c, uids, btn, focusSel, skipped = 0) {
  if (!uids.length) return;
  if (uids.length > 1 && !confirm(`'${c.name}' 학생 ${uids.length}명에게 스탬프를 1개씩 줄까요?` + (skipped ? `\n(스탬프판을 다 채운 ${skipped}명은 빼고 줘요)` : ''))) return;
  btn.disabled = true;
  try {
    const reason = stampReason.trim();
    await be.addStamps(c.id, uids, reason);
    classData[c.id].stamps = await be.listStamps(c.id);
    stampFlash = (uids.length > 1 ? `학생 ${uids.length}명에게` : `${studentName(uids[0])} 학생에게`) + ' 스탬프를 1개씩 줬어요' + (reason ? ` (이유: ${reason})` : '') + '.';
    renderClassDetail(focusSel);
  } catch (err) { alert(friendlyError(err)); btn.disabled = false; }
}

function membersCard(c, data, own) {
  const members = membersOf(c.id).sort(byGradeName);
  const count = (uid) => data.stamps.filter((x) => x.studentId === uid).length;
  const max = stampMaxOf(c);
  const room = members.filter((s) => count(s.uid) < max);
  const live = el('p', { class: 'a-msg', role: 'status', hidden: true });
  if (stampFlash) { message(live, stampFlash, 'ok'); stampFlash = ''; }

  const rowsEl = members.map((s) => {
    const n = count(s.uid);
    const full = n >= max;
    const cells = [
      el('td', {}, el('strong', { text: s.name }), s.active ? null : el('span', { class: 'pill off', style: 'margin-left: 6px;', text: '사용 중지' })),
      el('td', { text: s.grade }),
      el('td', { text: s.loginId }),
      el('td', { class: 'num' }, el('span', { class: 'stamp-n' + (n ? '' : ' zero') + (full ? ' full' : ''), text: `★ ${n} / ${max}` }), full ? el('span', { class: 'pill full', text: '다 채움' }) : null)
    ];
    if (own) {
      const plus = el('button', { type: 'button', class: 'a-btn small primary', 'data-k': `plus-${s.uid}`, 'aria-label': full ? `${s.name} 스탬프판을 다 채웠어요` : `${s.name} 스탬프 1개 주기`, text: '+1', disabled: full });
      plus.addEventListener('click', () => giveStamps(c, [s.uid], plus, `[data-k="plus-${s.uid}"]`));
      const minus = el('button', { type: 'button', class: 'a-btn small', 'data-k': `minus-${s.uid}`, 'aria-label': `${s.name} 스탬프 1개 빼기`, text: '−1', disabled: !n });
      minus.addEventListener('click', async () => {
        const last = data.stamps.filter((x) => x.studentId === s.uid).sort(newest)[0];
        if (!last || !confirm(`${s.name} 학생의 가장 최근 스탬프 1개를 뺄까요?` + (last.reason ? `\n(이유: ${last.reason})` : ''))) return;
        minus.disabled = true;
        try {
          await be.deleteStamp(c.id, last.id);
          data.stamps = data.stamps.filter((x) => x.id !== last.id);
          stampFlash = `${s.name} 학생의 스탬프 1개를 뺐어요.`;
          renderClassDetail(`[data-k="minus-${s.uid}"]`);
        } catch (err) { alert(friendlyError(err)); minus.disabled = false; }
      });
      const reset = el('button', { type: 'button', class: 'a-btn small', 'data-k': `reset-${s.uid}`, 'aria-label': `${s.name} 스탬프 초기화`, text: '초기화', disabled: !n });
      reset.addEventListener('click', async () => {
        if (!confirm(`${s.name} 학생의 스탬프 ${n}개를 초기화할까요?\n0개부터 다시 모으고, 받은 기록도 지워져요.`)) return;
        reset.disabled = true;
        try {
          await be.resetStamps(c.id, s.uid);
          data.stamps = data.stamps.filter((x) => x.studentId !== s.uid);
          stampFlash = `${s.name} 학생의 스탬프를 초기화했어요.`;
          renderClassDetail(`[data-k="plus-${s.uid}"]`);
        } catch (err) { alert(friendlyError(err)); reset.disabled = false; }
      });
      const out = el('button', { type: 'button', class: 'a-btn small danger', 'aria-label': `${s.name} 학생을 클래스에서 빼기`, text: '빼기' });
      out.addEventListener('click', async () => {
        if (!confirm(`${s.name} 학생을 '${c.name}'에서 뺄까요?\n받은 스탬프 기록은 남아 있어서, 다시 넣으면 그대로 보여요.`)) return;
        out.disabled = true;
        try { await be.unassignStudent(c.id, s.uid); s.classIds = s.classIds.filter((x) => x !== c.id); renderClassDetail(); }
        catch (err) { alert(friendlyError(err)); out.disabled = false; }
      });
      cells.push(el('td', {}, el('div', { class: 'a-row' }, plus, minus, reset)), el('td', {}, out));
    } else {
      const last = data.stamps.filter((x) => x.studentId === s.uid).sort(newest)[0];
      cells.push(el('td', { text: last ? formatDateTime(last.createdAt) : '—' }));
    }
    return el('tr', { class: s.active ? null : 'off' }, ...cells);
  });

  const head = el('div', { class: 'card-head' }, el('h2', {}, '학생 · 스탬프 현황 ', el('span', { class: 'card-sub', text: `${members.length}명` })),
    el('span', { class: 'card-sub', text: own ? `스탬프판 ${max}칸 · 다 채우면 더 줄 수 없어요. 초기화하면 0개부터 다시 모아요` : `스탬프판 ${max}칸 · 서브관리자는 볼 수만 있어요` }));
  const tableEl = el('div', { style: 'margin-top: 16px;' }, members.length
    ? table(own ? ['이름', '학년', '아이디', { label: '스탬프', num: true }, '스탬프 주기 · 초기화', ''] : ['이름', '학년', '아이디', { label: '스탬프', num: true }, '마지막으로 받은 때'], rowsEl)
    : el('p', { class: 'empty', text: own ? '아직 넣은 학생이 없어요. 아래에서 학생을 골라 넣어 주세요.' : '아직 이 클래스에 학생이 없어요.' }));
  if (!own) return el('div', { class: 'card cls-members' }, head, tableEl);

  const rules = Array.isArray(c.stampRules) ? c.stampRules : [];
  const reason = el('input', { class: 'a-input', id: 'st-reason', type: 'text', maxlength: '40', placeholder: rules.length ? '규칙에서 고르거나 직접 적어요' : '예) 숙제 완벽, 발표 최고', value: stampReason, list: rules.length ? 'st-reasons' : null });
  reason.addEventListener('input', () => { stampReason = reason.value; });
  const dl = rules.length ? el('datalist', { id: 'st-reasons' }, rules.map((r) => el('option', { value: r.slice(0, 40) }))) : null;
  const all = el('button', { type: 'button', class: 'a-btn primary', id: 'st-all', text: '모두에게 +1', disabled: !room.length });
  all.addEventListener('click', () => giveStamps(c, room.map((s) => s.uid), all, '#st-all', members.length - room.length));
  const resetAll = el('button', { type: 'button', class: 'a-btn danger', id: 'st-reset-all', text: '전체 초기화', disabled: !data.stamps.length });
  resetAll.addEventListener('click', async () => {
    if (!confirm(`'${c.name}'의 스탬프를 모두 초기화할까요?\n학생 ${members.length}명의 스탬프 ${data.stamps.length}개와 기록이 지워지고 되돌릴 수 없어요.`)) return;
    resetAll.disabled = true;
    try {
      await be.resetStamps(c.id);
      data.stamps = [];
      stampFlash = `'${c.name}'의 스탬프를 모두 초기화했어요. 모든 학생이 0개부터 다시 모아요.`;
      renderClassDetail('#st-all');
    } catch (err) { alert(friendlyError(err)); resetAll.disabled = false; }
  });
  return el('div', { class: 'card cls-members' },
    head,
    el('div', { class: 'stamp-bar' },
      el('div', { class: 'a-fld' }, el('label', { for: 'st-reason' }, '스탬프 이유 ', el('span', { class: 'hint', text: '선택 · 학생에게 보여요' })), reason, dl),
      all, resetAll),
    live,
    tableEl,
    addStudentsBlock(c));
}

function addStudentsBlock(c) {
  const inClass = new Set(membersOf(c.id).map((s) => s.uid));
  const pool = (cache.students || []).filter((s) => s.active && !inClass.has(s.uid));
  const q = el('input', { class: 'a-input', type: 'search', placeholder: '이름·아이디 검색', 'aria-label': '넣을 학생 검색', value: addQuery });
  const g = el('select', { class: 'a-input', 'aria-label': '넣을 학생 학년' }, el('option', { value: '', text: '전체 학년' }), GRADES_ALL.map((x) => el('option', { selected: x === addGrade, text: x })));
  const listBox = el('div', { class: 'pick-list' });
  const addBtn = el('button', { type: 'button', class: 'a-btn primary', id: 'cl-add-btn' });
  const picked = () => [...addPicked].filter((uid) => pool.some((s) => s.uid === uid));
  const syncBtn = () => { const n = picked().length; addBtn.textContent = n ? `고른 학생 ${n}명 넣기` : '넣을 학생을 골라 주세요'; addBtn.disabled = !n; };
  const draw = () => {
    const ql = addQuery.trim().toLowerCase();
    const shown = pool.filter((s) => (!ql || String(s.name || '').toLowerCase().includes(ql) || String(s.loginId || '').includes(ql)) && (!addGrade || s.grade === addGrade)).sort(byGradeName);
    listBox.replaceChildren(shown.length
      ? el('ul', {}, shown.map((s) => {
          const cb = el('input', { type: 'checkbox', checked: addPicked.has(s.uid) });
          cb.addEventListener('change', () => { if (cb.checked) addPicked.add(s.uid); else addPicked.delete(s.uid); syncBtn(); });
          return el('li', {}, el('label', { class: 'pick' }, cb, el('strong', { text: s.name }), el('span', { class: 'sub', text: `${s.grade} · ${s.loginId}` })));
        }))
      : el('p', { class: 'empty', text: pool.length ? '조건에 맞는 학생이 없어요.' : '넣을 수 있는 학생이 없어요. (사용 중인 학생이 모두 이 클래스에 있어요)' }));
  };
  q.addEventListener('input', () => { addQuery = q.value; draw(); });
  g.addEventListener('change', () => { addGrade = g.value; draw(); });
  addBtn.addEventListener('click', async () => {
    const uids = picked();
    if (!uids.length) return;
    addBtn.disabled = true;
    try {
      await be.assignStudents(c.id, uids);
      uids.forEach((uid) => { const s = cache.students.find((x) => x.uid === uid); if (s) s.classIds = [...(Array.isArray(s.classIds) ? s.classIds : []), c.id]; });
      addPicked.clear();
      stampFlash = `학생 ${uids.length}명을 '${c.name}'에 넣었어요.`;
      renderClassDetail();
    } catch (err) { alert(friendlyError(err)); addBtn.disabled = false; }
  });
  draw(); syncBtn();
  return el('div', { class: 'pick-wrap' },
    el('h3', { text: '학생 넣기' }),
    el('p', { class: 'view-note', text: '사용 중인 학생만 보여요. 여러 명을 골라 한 번에 넣을 수 있고, 다른 클래스에 있는 학생도 넣을 수 있어요.' }),
    el('div', { class: 'a-filters' }, q, g),
    listBox,
    el('div', {}, addBtn));
}

function homeworkAdminCard(c, data, own) {
  const msg = el('p', { class: 'a-msg', role: 'status', hidden: true });
  let form = null;
  if (own) {
    const title = el('input', { class: 'a-input', id: 'hw-title', type: 'text', maxlength: '100', required: true, placeholder: '예) 교재 24~27쪽 풀어 오기' });
    const due = el('input', { class: 'a-input', id: 'hw-due', type: 'date' });
    const body = el('textarea', { class: 'a-input a-textarea', id: 'hw-body', rows: '3', maxlength: '3000' });
    const btn = el('button', { type: 'submit', class: 'a-btn primary', style: 'min-height: 42px;', text: '숙제 올리기' });
    form = el('form', { class: 'a-form', novalidate: true },
      el('div', { class: 'a-fld span-2' }, el('label', { for: 'hw-title', text: '숙제 제목' }), title),
      el('div', { class: 'a-fld' }, el('label', { for: 'hw-due' }, '마감일 ', el('span', { class: 'hint', text: '선택' })), due),
      el('div', { class: 'a-fld span-all' }, el('label', { for: 'hw-body' }, '내용 ', el('span', { class: 'hint', text: '선택 · 범위, 준비물 등' })), body),
      btn);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = title.value.trim();
      if (!t) return message(msg, '숙제 제목을 입력해 주세요.', 'err');
      btn.disabled = true;
      try {
        await be.addHomework(c.id, { title: t, body: body.value.trim(), due: due.value || '', date: todayString() });
        data.homework = await be.listHomework(c.id);
        hwFlash = `'${t}' 숙제를 올렸어요. '${c.name}' 학생들이 학생 전용 → 클래스에서 볼 수 있어요.`;
        renderClassDetail('#hw-title');
      } catch (err) { message(msg, friendlyError(err), 'err'); btn.disabled = false; }
    });
    if (hwFlash) { message(msg, hwFlash, 'ok'); hwFlash = ''; }
  }
  const head = ['올린 날', '숙제', '마감'];
  if (own) head.push('');
  const list = data.homework.length
    ? table(head, data.homework.map((h) => {
        const di = dueInfo(h.due);
        const cells = [
          el('td', { text: formatDate(h.date) }),
          el('td', {}, el('strong', { text: h.title }), h.body ? el('div', { class: 'hw-prev', text: h.body }) : null),
          el('td', {}, di ? el('span', { class: 'due-cell' }, di.date, ' ', el('span', { class: 'due due-' + di.kind, text: di.text })) : '—')
        ];
        if (own) {
          const del = el('button', { type: 'button', class: 'a-btn small danger', text: '삭제' });
          del.addEventListener('click', async () => {
            if (!confirm(`'${h.title}' 숙제 공지를 삭제할까요?`)) return;
            del.disabled = true;
            try { await be.deleteHomework(c.id, h.id); data.homework = data.homework.filter((x) => x.id !== h.id); renderClassDetail(); }
            catch (err) { alert(friendlyError(err)); del.disabled = false; }
          });
          cells.push(el('td', {}, del));
        }
        return el('tr', {}, ...cells);
      }))
    : el('p', { class: 'empty', text: '올린 숙제가 없어요.' });
  return el('div', { class: 'card cls-hw' }, ...[
    el('div', { class: 'card-head' }, el('h2', { text: '숙제 공지' }), el('span', { class: 'card-sub', text: '이 클래스 학생에게만 보여요' })),
    form, own ? msg : null,
    el('div', { style: own ? 'margin-top: 18px;' : null }, list)
  ].filter(Boolean));
}

function stampLogCard(c, data, own) {
  const list = [...data.stamps].sort(newest);
  const shown = list.slice(0, 50);
  const head = ['준 날짜', '학생', '이유', '준 관리자'];
  if (own) head.push('');
  const d = el('details', { class: 'card fold cls-log', open: stampLogOpen || !own },
    el('summary', {}, '스탬프 기록 ', el('span', { class: 'card-sub', text: `${list.length}개` })),
    el('div', { style: 'margin-top: 14px;' }, ...[
      shown.length
        ? table(head, shown.map((s) => {
            const cells = [el('td', { text: formatDateTime(s.createdAt) }), el('td', { text: studentName(s.studentId) }), el('td', { text: s.reason || '—' }), el('td', { text: s.by ? adminName(s.by) : '—' })];
            if (own) {
              const del = el('button', { type: 'button', class: 'a-btn small danger', text: '취소' });
              del.addEventListener('click', async () => {
                if (!confirm(`${studentName(s.studentId)} 학생의 스탬프 1개를 취소할까요?`)) return;
                del.disabled = true;
                try { await be.deleteStamp(c.id, s.id); data.stamps = data.stamps.filter((x) => x.id !== s.id); renderClassDetail(); }
                catch (err) { alert(friendlyError(err)); del.disabled = false; }
              });
              cells.push(el('td', {}, del));
            }
            return el('tr', {}, ...cells);
          }), { maxHeight: 420 })
        : el('p', { class: 'empty', text: '아직 준 스탬프가 없어요.' }),
      list.length > 50 ? el('p', { class: 'view-note', style: 'margin-top: 8px;', text: '최근 50개까지 보여요.' }) : null
    ].filter(Boolean)));
  if (own) d.addEventListener('toggle', () => { stampLogOpen = d.open; });
  return d;
}

/* ── 특강 구분 관리 (홈페이지 '특강 신청'에서 고르는 목록) ─────────── */
function renderSpecials(focusSel) {
  const list = cache.specials || [];
  $('#sp-count').textContent = `${list.length}개`;
  $('#sp-list').replaceChildren(...(list.length
    ? list.map((name, i) => {
        const up = el('button', { type: 'button', class: 'a-btn small', 'data-k': `up-${i}`, 'aria-label': `${name} 위로`, text: '↑', disabled: i === 0 });
        const down = el('button', { type: 'button', class: 'a-btn small', 'data-k': `down-${i}`, 'aria-label': `${name} 아래로`, text: '↓', disabled: i === list.length - 1 });
        const del = el('button', { type: 'button', class: 'a-btn small danger', 'aria-label': `${name} 삭제`, text: '삭제' });
        const move = (d) => saveSpecialList(list.map((x, j) => (j === i ? list[i + d] : j === i + d ? list[i] : x)), null, `[data-k="${d < 0 ? 'up' : 'down'}-${i + d}"]`);
        up.addEventListener('click', () => move(-1));
        down.addEventListener('click', () => move(1));
        del.addEventListener('click', () => {
          if (!confirm(`'${name}' 특강을 목록에서 삭제할까요?\n홈페이지에서 더 이상 고를 수 없게 돼요. 이미 들어온 신청서는 그대로 남아요.`)) return;
          saveSpecialList(list.filter((_, j) => j !== i), `'${name}' 특강을 삭제했어요.`, '#sp-name');
        });
        return el('li', {}, el('span', { class: 'sp-name', text: name }), el('span', { class: 'a-row' }, up, down, del));
      })
    : [el('li', { class: 'sp-empty', text: "특강이 하나도 없어요. 지금은 홈페이지에서 '특강 신청'을 고르면 '모집 중인 특강이 없어요'로 보여요." })]));
  if (focusSel) { const t = document.querySelector(focusSel); if (t && !t.disabled) t.focus(); }
}

async function saveSpecialList(next, okText, focusSel) {
  const msg = $('#sp-msg');
  const buttons = [...document.querySelectorAll('#sp-card button')];
  buttons.forEach((b) => { b.disabled = true; });
  try {
    await be.saveSpecials(next);
    cache.specials = next;
    message(msg, okText || '', 'ok');
    renderSpecials(focusSel);
  } catch (err) {
    message(msg, friendlyError(err), 'err');
    renderSpecials();
  } finally {
    $('#sp-form button').disabled = false;
  }
}

$('#sp-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('#sp-msg');
  const name = $('#sp-name').value.trim().replace(/\s+/g, ' ');
  const list = cache.specials || [];
  if (!name) return message(msg, '특강 이름을 입력해 주세요.', 'err');
  if (name.length > 40) return message(msg, '특강 이름은 40자 이내로 적어 주세요.', 'err');
  if (list.includes(name)) return message(msg, '이미 있는 특강이에요.', 'err');
  if (list.length >= SPECIAL_MAX) return message(msg, `특강은 ${SPECIAL_MAX}개까지 둘 수 있어요. 모집을 마친 특강을 먼저 삭제해 주세요.`, 'err');
  $('#sp-name').value = '';
  saveSpecialList([...list, name], `'${name}' 특강을 추가했어요. 이제 홈페이지에서 고를 수 있어요.`, '#sp-name');
});
