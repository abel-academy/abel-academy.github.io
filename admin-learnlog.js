// 선생님 화면 → 학습 보조 기록: 학생이 학원 게임에서 끝까지 푼 판(단계)을 학생별·게임별로 보여 주고, 별을 초기화해요.
// 화면(#view-learnlog)이 보일 때 불러와요. (admin.js와 따로 동작)
import * as be from './backend.js';
import { el, friendlyError, formatDateTime } from './common.js';
import { LEARN_BUILTINS } from './learn-games.js';

const $ = (s) => document.querySelector(s);
const view = $('#view-learnlog');
const DAY = 864e5;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const withinDays = (d, n) => d && d >= new Date(startOfDay(new Date()).getTime() - (n - 1) * DAY);
const titleOf = (id) => (LEARN_BUILTINS.find((b) => b.id === id) || {}).title || id;
const timeText = (sec) => { const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m}분 ${String(s).padStart(2, '0')}초` : `${s}초`; };
const pct = (c, t) => (t ? `${Math.round((c / t) * 100)}%` : '—');
let plays = null;
let busy = false;
let students = null;
const GRADES = ['초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const ms = (v) => (v == null ? 0 : typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v) || 0);

function kpi(label, value, unit, sub) {
  return el('div', { class: 'kpi' },
    el('span', { class: 'kpi-label', text: label }),
    el('span', { class: 'kpi-value' }, String(value), el('small', { text: unit })),
    sub ? el('span', { class: 'kpi-delta', text: sub }) : null);
}
function table(headers, bodyRows, opts = {}) {
  return el('div', { class: 'tbl-wrap', style: opts.maxHeight ? `max-height:${opts.maxHeight}px;overflow:auto` : null },
    el('table', { class: 'tbl' },
      el('thead', {}, el('tr', {}, headers.map((h) => el('th', { class: h.num ? 'num' : null, text: h.label || h })))),
      el('tbody', {}, bodyRows.length ? bodyRows : el('tr', {}, el('td', { colspan: String(headers.length), class: 'empty', text: opts.empty || '자료가 없어요.' })))));
}
// '입체 공방 5판 · 명제 탐정 2판'
const countText = (map, fmt) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${fmt(k)} ${n}판`).join(' · ');

async function load(force) {
  if (busy) return;
  if (plays && !force) { render(); return; }
  if (typeof be.listLearnPlays !== 'function') {
    $('#ll-kpis').replaceChildren(el('p', { class: 'a-msg err', text: '화면이 예전 버전이에요. 새로고침(Ctrl+F5) 해 주세요.' }));
    return;
  }
  busy = true;
  $('#ll-by-student').replaceChildren(el('p', { class: 'empty', text: '불러오는 중…' }));
  try {
    plays = await be.listLearnPlays(1000);
    render();
  } catch (e) {
    const rules = e && e.code === 'permission-denied' ? ' — Firebase 보안 규칙을 새 내용으로 게시했는지 확인해 주세요.' : '';
    $('#ll-by-student').replaceChildren(el('p', { class: 'a-msg err', text: friendlyError(e) + rules }));
  } finally { busy = false; }
}

function render() {
  const range = $('#ll-range').value, grade = $('#ll-grade').value, game = $('#ll-game').value;
  const q = $('#ll-q').value.trim().toLowerCase();
  const list = (plays || []).filter((p) => (range === 'all' || withinDays(p.at, Number(range)))
    && (!grade || p.grade === grade) && (!game || p.game === game)
    && (!q || String(p.name || '').toLowerCase().includes(q) || String(p.loginId || '').includes(q)));
  const rangeLabel = { '7': '최근 7일', '30': '최근 30일', all: '전체 기간' }[range];
  const none = (plays || []).length ? '조건에 맞는 기록이 없어요.' : '아직 기록이 없어요. 학생이 학원 게임에서 한 단계를 끝까지 풀면 여기에 쌓여요.';

  const byStudent = new Map(), byGame = new Map();
  let correct = 0, total = 0;
  list.forEach((p) => {
    correct += p.correct; total += p.total;
    const s = byStudent.get(p.uid) || { name: p.name, grade: p.grade, loginId: p.loginId, n: 0, c: 0, t: 0, games: new Map(), last: null };
    s.n += 1; s.c += p.correct; s.t += p.total; s.games.set(p.game, (s.games.get(p.game) || 0) + 1);
    if (!s.last || (p.at && p.at > s.last)) s.last = p.at;
    byStudent.set(p.uid, s);
    const g = byGame.get(p.game) || { game: p.game, n: 0, c: 0, t: 0, uids: new Set(), stages: new Map(), last: null };
    g.n += 1; g.c += p.correct; g.t += p.total; g.uids.add(p.uid); g.stages.set(p.stage, (g.stages.get(p.stage) || 0) + 1);
    if (!g.last || (p.at && p.at > g.last)) g.last = p.at;
    byGame.set(p.game, g);
  });
  const students = [...byStudent.values()].sort((a, b) => b.n - a.n);
  const games = [...byGame.values()].sort((a, b) => b.n - a.n);

  $('#ll-kpis').replaceChildren(
    kpi(`${rangeLabel} 연습`, list.length.toLocaleString('ko-KR'), '판'),
    kpi('연습한 학생', students.length, '명'),
    kpi('평균 정답률', total ? Math.round((correct / total) * 100) : 0, '%', total ? `${total.toLocaleString('ko-KR')}문제 중 ${correct.toLocaleString('ko-KR')}문제` : null));

  // 이름을 누르면 그 학생 기록만 보기
  const pickStudent = (s) => { $('#ll-q').value = s.loginId || s.name; render(); $('#ll-log').scrollIntoView({ block: 'start' }); };
  $('#ll-by-student').replaceChildren(table(
    [{ label: '이름' }, { label: '학년' }, { label: '아이디' }, { label: '연습', num: true }, { label: '한 게임' }, { label: '정답률', num: true }, { label: '마지막 연습' }],
    students.map((s) => {
      const b = el('button', { type: 'button', class: 'll-name', text: s.name, title: `${s.name} 학생 기록만 보기` });
      b.addEventListener('click', () => pickStudent(s));
      return el('tr', {}, el('td', {}, b), el('td', { text: s.grade }), el('td', { text: s.loginId }), el('td', { class: 'num', text: `${s.n}판` }),
        el('td', { text: countText(s.games, titleOf) }), el('td', { class: 'num', text: pct(s.c, s.t) }), el('td', { text: formatDateTime(s.last) }));
    }),
    { empty: none, maxHeight: 420 }));
  $('#ll-by-game').replaceChildren(table(
    [{ label: '게임' }, { label: '연습', num: true }, { label: '학생', num: true }, { label: '정답률', num: true }, { label: '단계별' }, { label: '마지막 연습' }],
    games.map((g) => el('tr', {}, el('td', {}, el('strong', { text: titleOf(g.game) })), el('td', { class: 'num', text: `${g.n}판` }), el('td', { class: 'num', text: `${g.uids.size}명` }),
      el('td', { class: 'num', text: pct(g.c, g.t) }), el('td', { text: countText(new Map([...g.stages.entries()].sort((a, b) => a[0] - b[0])), (k) => `${k}단계`) }), el('td', { text: formatDateTime(g.last) }))),
    { empty: none }));
  $('#ll-log').replaceChildren(table(
    ['시각', '이름', '학년', '게임', '단계', { label: '맞힌 문제', num: true }, { label: '걸린 시간', num: true }],
    list.slice(0, 300).map((p) => el('tr', {}, el('td', { text: formatDateTime(p.at) }), el('td', { text: p.name }), el('td', { text: p.grade }), el('td', { text: titleOf(p.game) }),
      el('td', { text: `${p.stage}단계` }), el('td', { class: 'num', text: `${p.correct}/${p.total}` }), el('td', { class: 'num', text: timeText(p.sec) }))),
    { empty: none, maxHeight: 520 }));
}

/* ── 별 초기화 ── */
async function loadStudents(force) {
  if (students && !force) { renderReset(); return; }
  try {
    students = (await be.listStudents()).filter((x) => x.active)
      .sort((a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) || String(a.name).localeCompare(String(b.name), 'ko'));
    renderReset();
  } catch (e) {
    $('#sr-history').replaceChildren(el('p', { class: 'a-msg err', text: friendlyError(e) }));
  }
}
function targetsOf(v) {
  if (!students || !v) return [];
  if (v === 'all') return students;
  if (v.startsWith('g:')) return students.filter((x) => x.grade === v.slice(2));
  return students.filter((x) => x.uid === v.slice(2));
}
function whoText(v, list) {
  if (v === 'all') return `모든 학생(${list.length}명)`;
  if (v.startsWith('g:')) return `${v.slice(2)} 학생 ${list.length}명`;
  return list[0] ? `${list[0].name} 학생` : '';
}
function renderReset() {
  const sel = $('#sr-who'), keep = sel.value;
  const byGrade = GRADES.map((g) => [g, students.filter((x) => x.grade === g).length]).filter(([, n]) => n);
  sel.replaceChildren(
    el('option', { value: '', text: '누구의 별을 초기화할까요?' }),
    el('option', { value: 'all', text: `모든 학생 (${students.length}명)` }),
    byGrade.length ? el('optgroup', { label: '학년 전체' }, byGrade.map(([g, n]) => el('option', { value: `g:${g}`, text: `${g} 전체 (${n}명)` }))) : null,
    students.length ? el('optgroup', { label: '학생 한 명' }, students.map((x) => el('option', { value: `u:${x.uid}`, text: `${x.name} · ${x.grade} · ${x.loginId}` }))) : null);
  if ([...sel.options].some((o) => o.value === keep)) sel.value = keep;
  // 초기화 내역: 한 번에 초기화한 학생끼리 묶어서
  const groups = new Map();
  students.forEach((x) => Object.entries(x.starReset || {}).forEach(([k, t]) => {
    const at = ms(t); if (!at) return;
    const id = `${at}|${k}`;
    const g = groups.get(id) || { at, game: k, names: [] };
    g.names.push(`${x.name}(${x.grade})`);
    groups.set(id, g);
  }));
  const hist = [...groups.values()].sort((a, b) => b.at - a.at).slice(0, 50);
  $('#sr-history').replaceChildren(table(['초기화한 때', '게임', '학생'],
    hist.map((h) => el('tr', {}, el('td', { text: formatDateTime(new Date(h.at)) }), el('td', { text: h.game === 'all' ? '모든 게임' : titleOf(h.game) }),
      el('td', { text: h.names.length > 3 ? `${h.names.slice(0, 3).join(', ')} 외 ${h.names.length - 3}명` : h.names.join(', ') }))),
    { empty: '아직 초기화한 적이 없어요.', maxHeight: 320 }));
}
function srMsg(text, bad) { const m = $('#sr-msg'); m.textContent = text; m.className = 'a-msg ' + (bad ? 'err' : 'ok'); m.hidden = false; }
async function doReset() {
  const v = $('#sr-who').value, game = $('#sr-game').value;
  if (!v) { srMsg('누구의 별을 초기화할지 골라 주세요.', true); $('#sr-who').focus(); return; }
  if (typeof be.resetStars !== 'function') { srMsg('화면이 예전 버전이에요. 새로고침(Ctrl+F5) 해 주세요.', true); return; }
  const list = targetsOf(v);
  if (!list.length) { srMsg('초기화할 학생이 없어요.', true); return; }
  const who = whoText(v, list), what = game ? `'${titleOf(game)}'` : '모든 게임';
  if (!confirm(`${who}의 ${what} 별과 최고 기록을 초기화할까요?\n\n이미 푼 문제 목록과 연습 기록(점수·날짜)은 남아요. 지운 별은 되돌릴 수 없어요.`)) return;
  const btn = $('#sr-go');
  btn.disabled = true; btn.textContent = '초기화하는 중…';
  try {
    await be.resetStars(list.map((x) => x.uid), game);
    srMsg(`${who}의 ${what} 별을 초기화했어요. 학생이 다음에 학습 보조나 게임을 열 때 0부터 시작해요.`);
    await loadStudents(true);
  } catch (e) {
    srMsg(friendlyError(e), true);
  } finally { btn.disabled = false; btn.textContent = '별 초기화'; }
}

if (view) {
  $('#sr-game').append(...LEARN_BUILTINS.map((b) => el('option', { value: b.id, text: b.title })));
  $('#sr-go').addEventListener('click', doReset);
  $('#ll-game').append(...LEARN_BUILTINS.map((b) => el('option', { value: b.id, text: b.title })));
  ['#ll-range', '#ll-grade', '#ll-game', '#ll-q'].forEach((s) => $(s).addEventListener('input', () => { if (plays) render(); }));
  $('#ll-refresh').addEventListener('click', () => { load(true); loadStudents(true); });
  // 화면이 보일 때마다(메뉴를 누르거나 화살표 키로 옮겨 와도) 불러와요
  new MutationObserver(() => { if (!view.hidden) { load(false); loadStudents(false); } }).observe(view, { attributes: true, attributeFilter: ['hidden'] });
  if (!view.hidden) { load(false); loadStudents(false); }
}
