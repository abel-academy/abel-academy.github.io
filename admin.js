// 아벨학원 관리자 화면
// 대시보드 · 상담 신청서 · 신청 통계 · 학생 관리(접속 통계) · 시청 내역 · 보충 강의 · 공지 · 관리자(가입 승인)
import * as be from './backend.js';
import {
  GRADES_ALL, SUBJECTS, SUBJECT_CLASS, APPLY_GRADES, APPLY_TIMES, ID_RE,
  youtubeId, thumbUrl, formatDate, formatDateTime, todayString, monthKey, el, friendlyError
} from './common.js';

const $ = (s) => document.querySelector(s);
const cache = { apps: null, students: null, logins: null, videos: null, views: null, notices: null, admins: null, requests: null };
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
  const boxes = { home: '#home-kpis', apps: '#ap-table', stats: '#st-body', students: '#stu-table', views: '#vw-by-video', videos: '#vid-list', notices: '#nt-list', admins: '#ad-list' };
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
    } else if (name === 'stats') {
      loading('#st-body'); await ensure('apps', be.listApplications, force); renderStats();
    } else if (name === 'students') {
      loading('#stu-table');
      await Promise.all([ensure('students', be.listStudents, force), ensure('logins', () => be.listLogins(1000), force)]);
      renderStudents();
    } else if (name === 'views') {
      loading('#vw-by-video'); await ensure('views', () => be.listViews(1000), force); renderViews();
    } else if (name === 'videos') {
      loading('#vid-list'); await ensure('videos', be.listVideos, force); renderVideos();
    } else if (name === 'notices') {
      loading('#nt-list'); await ensure('notices', () => be.listNotices(200), force); renderNotices();
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

$('#btn-logout').addEventListener('click', () => be.signOutUser());
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
['#ap-status', '#ap-type', '#ap-q'].forEach((s) => $(s).addEventListener('input', renderApps));

function appNameButton(a) {
  const b = el('button', { type: 'button', class: 'link-btn', text: a.studentName || '(이름 없음)', 'aria-label': `${a.studentName} 신청서 자세히 보기` });
  b.addEventListener('click', () => openApp(a.id));
  return b;
}

function renderApps() {
  const st = $('#ap-status').value, ty = $('#ap-type').value, q = $('#ap-q').value.trim().toLowerCase().replace(/-/g, '');
  const list = (cache.apps || [])
    .filter((a) => (!st || (st === 'contacted' ? a.status === 'contacted' : a.status !== 'contacted'))
      && (!ty || a.type === ty)
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
      el('td', { text: a.type }),
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

  body.replaceChildren(
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
    )
  );
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
