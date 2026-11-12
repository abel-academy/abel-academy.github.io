// 선생님 화면 → 학습 보조 기록: 학생이 학원 게임에서 끝까지 푼 판(단계)을 학생별·게임별로 보여 줘요.
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

if (view) {
  $('#ll-game').append(...LEARN_BUILTINS.map((b) => el('option', { value: b.id, text: b.title })));
  ['#ll-range', '#ll-grade', '#ll-game', '#ll-q'].forEach((s) => $(s).addEventListener('input', () => { if (plays) render(); }));
  $('#ll-refresh').addEventListener('click', () => load(true));
  // 화면이 보일 때마다(메뉴를 누르거나 화살표 키로 옮겨 와도) 불러와요
  new MutationObserver(() => { if (!view.hidden) load(false); }).observe(view, { attributes: true, attributeFilter: ['hidden'] });
  if (!view.hidden) load(false);
}
