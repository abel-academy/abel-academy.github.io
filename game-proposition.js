// 학습 보조 → 명제 탐정 (고1 공통수학2 '명제'를 혼자 단련하는 게임, 대결 없음)
// 6단계 × 10문제. 문제는 숫자와 조건을 바꿔 가며 자동으로 만들어요. 별과 최고 기록은 이 기기의 브라우저에 저장하고, 끝까지 푼 판은 선생님이 볼 수 있게 학원 서버에도 기록해요(learn-log.js).
import * as be from './backend.js';
import { el } from './common.js';
import { loadRecord, saveRecord, totalStars } from './learn-records.js';
import { checkBuiltin } from './learn-access.js';
import { setPlayer, logPlay } from './learn-log.js';
import { makeQuestion, RELATION, inSet, subset, frac, num, hasBatchim } from './proposition.js';

const $ = (s) => document.querySelector(s);
const GAME = 'proposition';
const PER_STAGE = 10;
const STAGES = [
  { n: 1, name: '반례 사냥', desc: '명제가 참인지 거짓인지 가리고, 거짓이면 반례를 찾아요.', tip: '반례는 가정(p)은 만족하지만 결론(q)은 만족하지 않는 예예요. 반례가 하나라도 있으면 명제는 거짓이에요.' },
  { n: 2, name: '부정 거울', desc: '조건과 명제의 부정을 골라요.', tip: "'모든'과 '어떤', '그리고'와 '또는'을 서로 바꾸고, 부등호는 등호까지 챙겨서 뒤집어요. (>의 부정은 ≤)" },
  { n: 3, name: '역·대우 카드', desc: '카드를 골라 명제의 역과 대우를 만들어요.', tip: "'p이면 q이다'의 역은 'q이면 p이다', 대우는 '~q이면 ~p이다'예요. 대우는 원래 명제와 참·거짓이 항상 같아요." },
  { n: 4, name: '필요·충분 수직선', desc: '두 조건의 진리집합을 비교해 충분조건·필요조건을 가려요.', tip: 'P ⊂ Q이면 p는 q이기 위한 충분조건, q는 p이기 위한 필요조건이에요. 진리집합을 수직선에 그려 보면 잘 보여요.' },
  { n: 5, name: '최솟값 찾기', desc: '산술평균과 기하평균의 관계로 최솟값과 그때의 x의 값을 찾아요.', tip: 'a > 0, b > 0일 때 a + b ≥ 2√(ab)이고, 등호는 a = b일 때 성립해요. 등호가 성립하는 x를 꼭 확인해요.' },
  { n: 6, name: '참말족·거짓말족', bonus: true, desc: '참말만 하는 사람과 거짓말만 하는 사람을 논리로 가려내요.', tip: '한 사람을 참말족이라고 가정하고 말이 서로 어긋나는지 따져 보세요. 어긋나면 그 가정이 틀린 거예요.' }
];
const MARKS = ['①', '②', '③', '④'];
const TEST = (() => { try { return localStorage.getItem('abel-test-hook') === '1'; } catch { return false; } })();

let uid = null;
let rec = { stages: {} };
let run = null; // { stage, i, correct, streak, bestStreak, q, answered, started, phase, slots, pick }

/* ── 작은 도구 ── */
function timeText(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m}분 ${String(s).padStart(2, '0')}초` : `${s}초`;
}
const starsOf = (correct) => (correct >= 10 ? 3 : correct >= 8 ? 2 : correct >= 5 ? 1 : 0);
function starLine(n, max = 3) {
  return el('span', { class: 'g-stars', role: 'img', 'aria-label': `별 ${max}개 중 ${n}개` },
    ...Array.from({ length: max }, (_, i) => el('span', { class: i < n ? 'on' : 'off', 'aria-hidden': 'true', text: '★' })));
}
function show(which) {
  $('#g-status').hidden = which !== 'status';
  $('#g-gate').hidden = which !== 'gate';
  $('#g-app').hidden = which !== 'app';
}
function screen(which) {
  ['menu', 'play', 'result'].forEach((w) => { $('#g-' + w).hidden = w !== which; });
}
const eun = (t) => (hasBatchim(t) ? '은' : '는');
const iga = (t) => (hasBatchim(t) ? '이' : '가');
const fmt = (v) => String(Math.round(v * 100) / 100).replace('-', '−');

/* ── 수식 글자: x·y·n은 기울이고, 4/x 같은 분수는 위아래로 ── */
// 글자 속 영문자는 모두 수학 문자예요 (x, y, n, p, q, P, Q, a, b)
function vars(text) {
  return String(text).split(/([A-Za-z])/).filter((s) => s !== '').map((s) => (/^[A-Za-z]$/.test(s) ? el('i', { class: 'pz-v', text: s }) : s));
}
const FR = /\(([^()]+)\)\/([xyn])|(\d+)\/\(([^()]+)\)|(\d+)\/([xyn]|\d+)/g;
function fracNode(a, b) {
  return el('span', { class: 'pz-frac' },
    el('span', { class: 'pz-sr', text: `${b}분의 ${a}` }),
    el('span', { class: 'pz-num', 'aria-hidden': 'true' }, vars(a)),
    el('span', { class: 'pz-den', 'aria-hidden': 'true' }, vars(b)));
}
function math(text) {
  const s = String(text), out = [];
  let last = 0, m;
  FR.lastIndex = 0;
  while ((m = FR.exec(s))) {
    if (m.index > last) out.push(...vars(s.slice(last, m.index)));
    const [a, b] = m[1] != null ? [m[1], m[2]] : m[3] != null ? [m[3], m[4]] : [m[5], m[6]];
    out.push(fracNode(a, b));
    last = FR.lastIndex;
  }
  if (last < s.length) out.push(...vars(s.slice(last)));
  return el('span', { class: 'pz-m' }, out);
}
const quote = (t) => ['‘', math(t), '’'];

/* ── SVG ── */
// 좁은 화면(휴대폰)에서는 그림을 좁게 그려 글자가 작아지지 않게
const narrow = () => (document.querySelector('.g-card')?.clientWidth || 800) < 560;
const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, String(v));
  kids.flat().forEach((c) => { if (c != null) e.append(c instanceof Node ? c : document.createTextNode(String(c))); });
  return e;
}

// 수직선: rows = [{ name: 'P', set, cls: 'p' }]  (set은 구간 목록, proposition.js 참고)
function numberLine(rows, label) {
  const ends = rows.flatMap((r) => r.set.flatMap((s) => [s.lo, s.hi])).filter(Number.isFinite);
  let lo = Math.min(...ends) - 2, hi = Math.max(...ends) + 2;
  if (hi - lo < 8) { const mid = (lo + hi) / 2; lo = Math.floor(mid - 4); hi = Math.ceil(mid + 4); }
  const nar = narrow();
  const W = nar ? 400 : 640, L = nar ? 50 : 64, R = W - 40, rowH = 40, top = 14;
  const axisY = top + rows.length * rowH + 10, H = axisY + 34;
  const X = (v) => L + ((v - lo) / (hi - lo)) * (R - L);
  const guides = svg('g'), segs = svg('g'), dots = svg('g');
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pz-line' + (nar ? ' narrow' : ''), role: 'img', 'aria-label': label }, guides, segs, dots);
  g.append(svg('line', { x1: L - 30, y1: axisY, x2: R + 30, y2: axisY, class: 'ax' }), svg('path', { d: `M${R + 32} ${axisY} l-10 -6 v12 z`, class: 'ax-head' }));
  const step = hi - lo > (nar ? 10 : 14) ? 2 : 1;
  for (let v = Math.ceil(lo); v <= hi; v++) {
    g.append(svg('line', { x1: X(v), y1: axisY - 5, x2: X(v), y2: axisY + 5, class: 'tick' }));
    if (v % step === 0) g.append(svg('text', { x: X(v), y: axisY + 24, class: 'tl' }, num(v)));
  }
  rows.forEach((r, ri) => {
    const y = top + ri * rowH + rowH / 2;
    g.append(svg('text', { x: 10, y: y + 6, class: 'lab ' + r.cls }, r.name));
    r.set.forEach((s) => {
      const x1 = s.lo === -Infinity ? L - 26 : X(s.lo), x2 = s.hi === Infinity ? R + 26 : X(s.hi);
      if (s.lo !== s.hi) segs.append(svg('line', { x1, y1: y, x2, y2: y, class: 'seg ' + r.cls }));
      if (s.lo === -Infinity) segs.append(svg('path', { d: `M${x1 - 6} ${y} l11 -8 v16 z`, class: 'head ' + r.cls }));
      if (s.hi === Infinity) segs.append(svg('path', { d: `M${x2 + 6} ${y} l-11 -8 v16 z`, class: 'head ' + r.cls }));
      const pts = s.lo === s.hi ? [[s.lo, true]] : [[s.lo, s.lc], [s.hi, s.hc]];
      pts.forEach(([v, closed]) => {
        if (!Number.isFinite(v)) return;
        guides.append(svg('line', { x1: X(v), y1: y, x2: X(v), y2: axisY, class: 'guide' }));
        dots.append(svg('circle', { cx: X(v), cy: y, r: 7, class: `dot ${r.cls} ${closed ? 'closed' : 'open'}` }));
      });
    });
  });
  return g;
}

// 최솟값 그래프 + 점 움직여 보기
function graphBox(q) {
  const nar = narrow();
  const W = nar ? 400 : 640, H = nar ? 330 : 300, L = nar ? 40 : 52, R = W - 28, T = 18, B = H - 38;
  const bound = q.c, x0 = 0, x1 = Math.ceil(q.hi);
  const ymax = Math.ceil(Math.max(q.m * 2, q.m + 4));
  const X = (v) => L + ((v - x0) / (x1 - x0)) * (R - L);
  const Y = (v) => B - (v / ymax) * (B - T);
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pz-graph' + (nar ? ' narrow' : ''), role: 'img', 'aria-label': `y = ${q.text}의 그래프. x = ${frac(q.xs)}일 때 가장 낮은 점의 높이가 ${frac(q.m)}이에요.` });
  const xs = x1 - x0 > 12 ? 2 : 1;
  const ys = [1, 2, 5, 10, 20].find((s) => ymax / s <= 6) || 20;
  for (let v = x0; v <= x1; v += xs) { g.append(svg('line', { x1: X(v), y1: T, x2: X(v), y2: B, class: 'grid' })); if (v) g.append(svg('text', { x: X(v), y: B + 20, class: 'gl mid' }, num(v))); }
  for (let v = ys; v <= ymax; v += ys) { g.append(svg('line', { x1: L, y1: Y(v), x2: R, y2: Y(v), class: 'grid' })); g.append(svg('text', { x: L - 8, y: Y(v) + 5, class: 'gl end' }, num(v))); }
  g.append(svg('line', { x1: L, y1: B, x2: R + 14, y2: B, class: 'ax' }), svg('line', { x1: L, y1: B, x2: L, y2: T - 8, class: 'ax' }));
  g.append(svg('text', { x: R + 18, y: B + 5, class: 'gl it' }, 'x'), svg('text', { x: L + 8, y: T + 2, class: 'gl it' }, 'y'), svg('text', { x: L - 8, y: B + 20, class: 'gl end' }, 'O'));
  if (bound > 0) g.append(svg('line', { x1: X(bound), y1: T, x2: X(bound), y2: B, class: 'asym' }), svg('text', { x: X(bound) + 6, y: T + 14, class: 'gl it' }, `x = ${bound}`));
  // 곡선 (위로 너무 높이 올라가는 부분은 잘라요)
  let d = '', pen = false;
  for (let i = 0; i <= 300; i++) {
    const x = q.lo + ((q.hi - q.lo) * i) / 300, y = q.f(x);
    if (y > ymax || y < 0) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`;
    pen = true;
  }
  g.append(svg('path', { d, class: 'curve' }));
  g.append(svg('line', { x1: X(q.xs), y1: Y(q.m), x2: X(q.xs), y2: B, class: 'mguide' }), svg('line', { x1: L, y1: Y(q.m), x2: X(q.xs), y2: Y(q.m), class: 'mguide' }));
  g.append(svg('circle', { cx: X(q.xs), cy: Y(q.m), r: 7, class: 'minpt' }));
  g.append(svg('text', { x: X(q.xs) + 10, y: Y(q.m) + 24, class: 'gl ok' }, `최솟값 ${frac(q.m)} (x = ${frac(q.xs)})`));
  const mover = svg('circle', { r: 7, class: 'mover' });
  g.append(mover);
  const range = el('input', { type: 'range', class: 'pz-range', min: String(Math.round(q.lo * 10)), max: String(Math.round(q.hi * 10)), step: '1', 'aria-label': 'x의 값 움직이기' });
  const out = el('p', { class: 'pz-readout', 'aria-live': 'polite' });
  const place = () => {
    const x = Number(range.value) / 10, y = q.f(x);
    mover.setAttribute('cx', X(x).toFixed(1));
    mover.setAttribute('cy', Y(Math.min(y, ymax)).toFixed(1));
    mover.style.display = y > ymax ? 'none' : '';
    out.replaceChildren(math(`x = ${fmt(x)}일 때 식의 값은 ${fmt(y)}`), Math.abs(x - q.xs) < 1e-9 ? el('strong', { class: 'pz-ok', text: ' ← 가장 작아요!' }) : '');
  };
  range.value = String(Math.round((q.lo + (q.hi - q.lo) * 0.8) * 10));
  range.addEventListener('input', place);
  place();
  return el('div', { class: 'pz-graphbox' },
    el('h3', { class: 'pz-xtitle' }, '그래프로 확인하기'), g,
    el('label', { class: 'pz-range-label' }, el('span', { text: '점 움직여 보기' }), range), out);
}

/* ── 단계 고르기 화면 ── */
function renderMenu() {
  const st = rec.stages || {};
  $('#g-sum').replaceChildren(
    el('div', { class: 'g-sum-main' },
      el('span', { class: 'g-sum-label', text: '모은 별' }),
      el('strong', { text: `${totalStars(rec)} / ${STAGES.length * 3}` })),
    el('p', { text: '단계마다 10문제예요. 문제는 풀 때마다 새로 만들어져요. 10문제를 모두 맞히면 별 3개, 8문제 이상 별 2개, 5문제 이상 별 1개를 받아요.' }));
  $('#g-stages').replaceChildren(...STAGES.map((s) => {
    const r = st[s.n];
    const btn = el('button', { type: 'button', class: 'btn-primary btn-sm', 'data-stage': String(s.n), text: r ? '다시 하기' : '시작하기', 'aria-label': `${s.n}단계 ${s.name} ${r ? '다시 하기' : '시작하기'}` });
    btn.addEventListener('click', () => startStage(s.n));
    return el('li', { class: 'g-stage' },
      el('span', { class: 'g-stage-n', 'aria-hidden': 'true', text: String(s.n) }),
      el('div', { class: 'g-stage-body' },
        el('h3', {}, `${s.n}단계 · ${s.name}`, s.bonus ? el('span', { class: 'pz-badge', text: '보너스' }) : null),
        el('p', { text: s.desc }),
        el('p', { class: 'g-stage-rec' }, r
          ? [starLine(r.stars || 0), ` 최고 ${r.best}/${PER_STAGE} · ${timeText(r.time)} · ${r.plays}번 연습`]
          : '아직 연습하지 않았어요')),
      btn);
  }));
  screen('menu');
}

/* ── 문제 풀기 ── */
function startStage(n) {
  run = { stage: n, i: 0, correct: 0, streak: 0, bestStreak: 0, q: null, answered: false, started: Date.now() };
  screen('play');
  nextQuestion();
}

function nextQuestion() {
  run.i += 1;
  run.q = makeQuestion(run.stage, run.q);
  run.answered = false;
  run.phase = 0;
  if (TEST) window.__propQ = run.q;
  renderQuestion();
  $('#g-q').focus();
}

function renderCounts() {
  const s = STAGES[run.stage - 1];
  $('#g-stage-name').textContent = `${s.n}단계 · ${s.name}`;
  const done = run.i - (run.answered ? 0 : 1);
  $('#g-progress').setAttribute('aria-valuenow', String(done));
  $('#g-progress').setAttribute('aria-valuetext', `${PER_STAGE}문제 중 ${done}문제 풀었어요`);
  $('#g-progress-fill').style.width = `${(done / PER_STAGE) * 100}%`;
  $('#g-counts').replaceChildren(
    el('span', {}, el('strong', { text: `${run.i}` }), ` / ${PER_STAGE}번째 문제`),
    el('span', {}, '맞힌 문제 ', el('strong', { text: String(run.correct) })),
    el('span', {}, '연속 정답 ', el('strong', { text: String(run.streak) })));
}

const setQ = (t) => { $('#g-q').replaceChildren(math(t)); };
const board = (...kids) => $('#g-board').replaceChildren(...kids.filter(Boolean));
function propBox(dom, ...kids) {
  return el('div', { class: 'pz-prop' }, dom ? el('p', { class: 'pz-dom' }, '(단, ', math(dom), ')') : null, ...kids);
}
function extra(...kids) {
  const box = $('#g-extra');
  box.replaceChildren(...kids.filter(Boolean));
  box.hidden = !box.childNodes.length;
}
function mark(btn, right) {
  btn.classList.add(right ? 'is-right' : 'is-wrong');
  btn.setAttribute('aria-label', (btn.getAttribute('aria-label') || btn.textContent) + (right ? ' (고른 답, 정답)' : ' (고른 답, 오답)'));
}
function choiceList(items, onPick, label, keys) {
  return el('div', { class: 'pz-choices', role: 'group', 'aria-label': label },
    items.map((node, k) => {
      const key = keys ? keys[k] : String(k);
      const b = el('button', { type: 'button', class: 'pz-opt', 'data-k': key }, el('span', { class: 'pz-opt-n', 'aria-hidden': 'true', text: MARKS[k] }), el('span', { class: 'pz-opt-t' }, node));
      b.addEventListener('click', () => onPick(key, b));
      return b;
    }));
}
function hintButton(text, onShow) {
  const b = el('button', { type: 'button', class: 'btn-line btn-sm pz-hintbtn', id: 'pz-hint', text });
  b.addEventListener('click', () => { onShow(); b.hidden = true; });
  return b;
}

function renderQuestion() {
  const q = run.q;
  renderCounts();
  $('#g-feedback').replaceChildren();
  extra();
  ({ 1: q1, 2: q2, 3: q3, 4: q4, 5: q5, 6: q6 })[q.stage](q);
}

/* 1단계: 반례 사냥 */
function oxBtn(val, markText, label) {
  return el('button', { type: 'button', class: 'g-ox ' + (val === 'true' ? 'o' : 'x'), 'data-ans': val },
    el('span', { class: 'g-ox-mark', 'aria-hidden': 'true', text: markText }), label);
}
const counterWhy = (q, c) => [math(c.label), '일 때 ', ...quote(q.p), eun(q.p), ' 성립하지만 ', ...quote(q.q), eun(q.q), ' 성립하지 않아요.'];
function q1(q) {
  setQ('이 명제는 참일까요, 거짓일까요?');
  board(propBox(q.dom, el('p', { class: 'pz-stmt' }, math(q.text))));
  const t = oxBtn('true', '○', '참이에요'), f = oxBtn('false', '✕', '거짓이에요');
  t.addEventListener('click', () => s1Truth(true, t));
  f.addEventListener('click', () => s1Truth(false, f));
  $('#g-answers').replaceChildren(t, f);
}
function s1Truth(choice, btn) {
  const q = run.q;
  if (run.answered || run.phase) return;
  if (!choice && !q.truth) {
    // 거짓은 맞음 → 반례 고르기
    run.phase = 1;
    document.querySelectorAll('#g-answers .g-ox').forEach((b) => { b.disabled = true; });
    btn.classList.add('is-right');
    btn.setAttribute('aria-label', '거짓이에요 (고른 답, 맞음)');
    setQ('맞아요, 거짓이에요! 반례를 하나 골라 보세요.');
    const cards = q.cards.map((c, k) => {
      const b = el('button', { type: 'button', class: 'pz-card', 'data-k': String(k) }, math(c.label));
      b.addEventListener('click', () => s1Card(k, b));
      return b;
    });
    $('#g-answers').append(el('div', { class: 'pz-cards-wrap' },
      el('p', { class: 'g-hint', text: '반례: 가정은 만족하지만 결론은 만족하지 않는 예' }),
      el('div', { class: 'pz-cards', role: 'group', 'aria-label': '반례 고르기' }, cards)));
    $('#g-q').focus();
    return;
  }
  const right = choice === q.truth;
  mark(btn, right);
  $(`#g-answers [data-ans="${q.truth}"]`).classList.add('is-answer');
  let why;
  if (q.truth) why = [right ? '' : '이 명제는 참이에요. ', math(q.why)];
  else {
    const c = q.cards.find((x) => q.counter(x.v));
    why = ['이 명제는 거짓이에요. 반례가 있어요: ', ...counterWhy(q, c)];
  }
  score(right, [why]);
}
function s1Card(k, btn) {
  const q = run.q;
  if (run.answered) return;
  const c = q.cards[k];
  const right = q.counter(c.v);
  mark(btn, right);
  const goods = [];
  q.cards.forEach((x, j) => { if (q.counter(x.v)) { goods.push(x); $(`#g-answers .pz-card[data-k="${j}"]`).classList.add('is-answer'); } });
  let why;
  if (right) why = [[...counterWhy(q, c), ' 그래서 이 명제는 거짓이에요.'], goods.length > 1 ? `초록 카드 ${goods.length - 1}장도 반례예요.` : null];
  else {
    const reason = !q.pf(c.v)
      ? [math(c.label), '일 때는 가정 ', ...quote(q.p), iga(q.p), ' 성립하지 않아서 반례가 될 수 없어요.']
      : [math(c.label), '일 때는 결론 ', ...quote(q.q), '도 성립해서 반례가 아니에요.'];
    why = [reason, ['초록 카드가 반례예요. 예를 들어 ', ...counterWhy(q, goods[0])]];
  }
  score(right, why, right ? null : '아쉬워요. 거짓인 건 맞았지만, 고른 카드는 반례가 아니에요.');
}

/* 2단계: 부정 거울 */
function q2(q) {
  setQ(q.kind === 'quant' ? '다음 명제의 부정을 골라 보세요.' : '다음 조건의 부정을 골라 보세요.');
  board(propBox(q.kind === 'quant' ? null : q.vars.length === 2 ? 'x, y는 실수' : 'x는 실수', el('p', { class: 'pz-stmt' }, math(q.text))));
  $('#g-answers').replaceChildren(choiceList(q.options.map((o) => math(o)), (k, b) => s2(Number(k), b), '부정 고르기'));
}
function s2(k, btn) {
  const q = run.q;
  if (run.answered) return;
  const right = k === q.answer;
  mark(btn, right);
  $(`#g-answers .pz-opt[data-k="${q.answer}"]`).classList.add('is-answer');
  score(right, [math(q.why)]);
}

/* 3단계: 역·대우 카드 */
function q3(q) {
  setQ(`다음 명제의 ${q.ask}${q.ask === '역' ? '을' : '를'} 카드로 만들어 보세요.`);
  board(propBox(q.dom, el('p', { class: 'pz-stmt' },
    el('span', { class: 'pz-tag p', 'aria-hidden': 'true', text: 'p' }), math(q.p), '이면 ',
    el('span', { class: 'pz-tag q', 'aria-hidden': 'true', text: 'q' }), math(q.q), '이다')));
  run.slots = [null, null];
  const tiles = el('div', { class: 'pz-tiles', role: 'group', 'aria-label': '카드' },
    q.tiles.map((t) => {
      const b = el('button', { type: 'button', class: 'pz-tile', 'data-id': t.id, 'aria-label': `카드 ${t.t}` }, math(t.t));
      b.addEventListener('click', () => placeTile(t.id));
      return b;
    }));
  const check = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'pz-check', text: '확인하기', disabled: true });
  check.addEventListener('click', s3Check);
  $('#g-answers').replaceChildren(el('div', { class: 'pz-s3' },
    el('div', { class: 'pz-build', id: 'pz-build', role: 'group', 'aria-label': `${q.ask} 만들기` }),
    el('p', { class: 'g-hint', text: '카드를 누르면 빈칸에 차례로 들어가요. 넣은 카드를 누르면 다시 빠져요.' }),
    tiles, check));
  drawBuild();
}
const tileText = (id) => run.q.tiles.find((t) => t.id === id).t;
function drawBuild(focusSlot) {
  const slot = (i) => {
    const id = run.slots[i], side = i === 0 ? '앞' : '뒤';
    const b = id
      ? el('button', { type: 'button', class: 'pz-slot filled', 'data-slot': String(i), 'aria-label': `${side} 칸: ${tileText(id)} (누르면 빼기)` }, math(tileText(id)))
      : el('button', { type: 'button', class: 'pz-slot', 'data-slot': String(i), 'aria-label': `${side} 칸 (비어 있음)` }, el('span', { 'aria-hidden': 'true', text: '빈칸' }));
    b.addEventListener('click', () => {
      if (run.answered) return;
      if (run.slots[i]) { run.slots[i] = null; drawBuild(i); }
      else document.querySelector('#g-answers .pz-tile:not(:disabled)')?.focus();
    });
    return b;
  };
  $('#pz-build').replaceChildren(slot(0), el('span', { class: 'pz-join', text: '이면' }), slot(1), el('span', { class: 'pz-join', text: '이다' }));
  document.querySelectorAll('#g-answers .pz-tile').forEach((b) => {
    const used = run.slots.includes(b.dataset.id);
    b.disabled = used || run.answered;
    b.classList.toggle('used', used);
  });
  $('#pz-check').disabled = run.slots.includes(null) || run.answered;
  if (focusSlot != null) $(`#pz-build [data-slot="${focusSlot}"]`).focus();
}
function placeTile(id) {
  if (run.answered) return;
  const i = run.slots.indexOf(null);
  if (i < 0) return;
  run.slots[i] = id;
  drawBuild();
  // 빈칸이 남았으면 다음 카드로, 다 채웠으면 '확인하기'로
  const nextTile = document.querySelector('#g-answers .pz-tile:not(:disabled)');
  (run.slots.includes(null) && nextTile ? nextTile : $('#pz-check')).focus();
}
function s3Check() {
  const q = run.q;
  if (run.answered || run.slots.includes(null)) return;
  const got = run.slots.join(','), right = got === q.answer.join(',');
  const sentence = (a, b) => [...quote(`${a}이면 ${b}이다`)];
  const correct = q.ask === '역' ? [q.q, q.p] : [q.nq, q.np];
  $('#pz-build').classList.add(right ? 'is-right' : 'is-wrong');
  const what = {
    'p,q': '원래 명제와 똑같아요.',
    'q,p': '이건 역이에요. 대우는 가정과 결론의 자리를 바꾸고, 둘 다 부정해야 해요.',
    'nq,np': '이건 대우예요. 역은 가정과 결론의 자리만 바꾸고 부정하지 않아요.',
    'np,nq': '가정과 결론을 부정만 하고 자리는 바꾸지 않았어요.'
  }[got] || '가정과 결론에 같은 규칙을 써야 해요. 둘 다 그대로 쓰거나, 둘 다 부정해요.';
  const rule = math(q.ask === '역' ? '역은 ‘p이면 q이다’에서 가정과 결론의 자리를 바꾼 ‘q이면 p이다’예요.' : '대우는 가정과 결론의 자리를 바꾸고 둘 다 부정한 ‘~q이면 ~p이다’예요.');
  const why = right
    ? [[`${q.ask}${q.ask === '역' ? '을' : '를'} 바르게 만들었어요: `, ...sentence(...correct)], rule]
    : [what, [`${q.ask}${q.ask === '역' ? '은' : '는'} `, ...sentence(...correct), '이에요.'], rule];
  const tf = (ok, cx) => el('td', {}, el('span', { class: 'pz-tf ' + (ok ? 't' : 'f'), text: ok ? '참' : '거짓' }), !ok && cx ? [' (반례: ', math(cx), ')'] : null);
  const row = (name, a, b, ok, cx) => el('tr', { class: name === q.ask ? 'on' : '' }, el('th', { scope: 'row', text: name }), el('td', {}, math(`${a}이면 ${b}이다`)), tf(ok, cx));
  extra(el('h3', { class: 'pz-xtitle', text: '참·거짓 비교' }),
    el('div', { class: 'pz-tablewrap' }, el('table', { class: 'pz-table' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: '' }), el('th', { scope: 'col', text: '명제' }), el('th', { scope: 'col', text: '참·거짓' }))),
      el('tbody', {},
        row('원래 명제', q.p, q.q, q.truth, q.origCx),
        row('역', q.q, q.p, q.conv, q.convCx),
        row('대우', q.nq, q.np, q.truth, q.origCx)))),
    el('p', { class: 'pz-note', text: '대우는 원래 명제와 참·거짓이 항상 같아요. 역은 같을 수도, 다를 수도 있어요.' }));
  score(right, why);
}

/* 4단계: 필요·충분 수직선 */
function q4(q) {
  setQ('p는 q이기 위한 어떤 조건일까요?');
  board(propBox('x는 실수',
    el('p', { class: 'pz-pq' }, el('span', { class: 'pz-tag p', text: 'p' }), math(q.p)),
    el('p', { class: 'pz-pq' }, el('span', { class: 'pz-tag q', text: 'q' }), math(q.q))));
  const keys = ['suf', 'nec', 'iff', 'none'];
  $('#g-answers').replaceChildren(
    choiceList(keys.map((k) => RELATION[k]), (k, b) => s4(k, b), '조건 고르기', keys),
    hintButton('수직선에 그려 보기 (힌트)', () => showLine(q)));
}
function showLine(q) {
  extra(el('h3', { class: 'pz-xtitle', text: '진리집합을 수직선에 나타내면' }),
    numberLine([{ name: 'P', set: q.P, cls: 'p' }, { name: 'Q', set: q.Q, cls: 'q' }], `수직선: P는 ${q.p}의 진리집합, Q는 ${q.q}의 진리집합`),
    el('p', { class: 'pz-note' }, el('span', { class: 'pz-key p', text: 'P' }), ' p의 진리집합 · ', el('span', { class: 'pz-key q', text: 'Q' }), ' q의 진리집합 · ● 포함 · ○ 포함하지 않음'));
}
function witness(A, B) { // A에는 있고 B에는 없는 수 (정수를 먼저 찾고, 없으면 0.5 단위)
  for (const d of [1, 2]) for (let i = 0; i <= 40 * d; i++) for (const s of [1, -1]) { const x = (s * i) / d; if (inSet(x, A) && !inSet(x, B)) return x; }
  return null;
}
function s4(k, btn) {
  const q = run.q;
  if (run.answered) return;
  const right = k === q.answer;
  mark(btn, right);
  $(`#g-answers .pz-opt[data-k="${q.answer}"]`).classList.add('is-answer');
  $('#pz-hint')?.remove();
  showLine(q);
  const pq = subset(q.P, q.Q), qp = subset(q.Q, q.P);
  const line = (a, b, A, B, holds, sym) => holds
    ? [...quote(`${a}이면 ${b}이다`), '는 참이에요 (', math(sym), ').']
    : [...quote(`${a}이면 ${b}이다`), '는 거짓이에요. ', math(`x = ${frac(witness(A, B))}${eun(frac(witness(A, B)))} ${a === q.p ? 'p' : 'q'}를 만족하지만 ${a === q.p ? 'q' : 'p'}는 만족하지 않아요.`)];
  const end = q.answer === 'none' ? '그래서 p는 q이기 위한 필요조건도 충분조건도 아니에요.' : `그래서 p는 q이기 위한 ${RELATION[q.answer]}이에요.`;
  score(right, [line(q.p, q.q, q.P, q.Q, pq, 'P ⊂ Q'), line(q.q, q.p, q.Q, q.P, qp, 'Q ⊂ P'), el('strong', {}, math(end))]);
}

/* 5단계: 최솟값 찾기 */
function q5(q) {
  setQ(`${q.dom}일 때, 다음 식의 최솟값과 그때의 x의 값을 골라 보세요.`);
  board(propBox(q.dom, el('p', { class: 'pz-stmt big' }, math(q.text))));
  $('#g-answers').replaceChildren(
    choiceList(q.options.map((o) => math(o)), (k, b) => s5(Number(k), b), '최솟값 고르기'),
    hintButton('힌트 보기', () => extra(el('p', { class: 'pz-hintbox' }, el('strong', { text: '힌트 ' }), math(`a > 0, b > 0일 때 a + b ≥ 2√(ab)이고, 등호는 a = b일 때 성립해요. ${q.hint}`)))));
}
function s5(k, btn) {
  const q = run.q;
  if (run.answered) return;
  const right = k === q.answer;
  mark(btn, right);
  $(`#g-answers .pz-opt[data-k="${q.answer}"]`).classList.add('is-answer');
  $('#pz-hint')?.remove();
  extra(graphBox(q));
  score(right, [math(q.why)]);
}

/* 6단계(보너스): 참말족·거짓말족 */
function q6(q) {
  setQ('세 사람은 각각 참말족이거나 거짓말족이에요. 누가 어느 족일까요?');
  run.pick = [null, null, null];
  const people = q.names.map((name, i) => {
    const tog = (val, label) => {
      const b = el('button', { type: 'button', class: 'pz-tog-btn ' + (val ? 't' : 'f'), 'data-p': String(i), 'data-v': val ? 't' : 'f', 'aria-pressed': 'false', text: label });
      b.addEventListener('click', () => {
        if (run.answered) return;
        run.pick[i] = val;
        document.querySelectorAll(`#g-board .pz-tog-btn[data-p="${i}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === (val ? 't' : 'f'))));
        $('#pz-check').disabled = run.pick.includes(null);
      });
      return b;
    };
    return el('div', { class: 'pz-person', 'data-p': String(i) },
      el('div', { class: 'pz-who' }, el('span', { class: 'pz-ava a' + i, 'aria-hidden': 'true', text: name[0] }), el('strong', { text: name })),
      el('p', { class: 'pz-say' }, `“${q.says[i]}”`),
      el('div', { class: 'pz-tog', role: 'group', 'aria-label': `${name}${eun(name)} 어느 족일까요?` }, tog(true, '참말족'), tog(false, '거짓말족')));
  });
  board(el('div', { class: 'pz-s6' },
    el('p', { class: 'pz-rule' }, el('strong', { text: '규칙 ' }), '참말족은 항상 참인 말만, 거짓말족은 항상 거짓인 말만 해요.'),
    el('div', { class: 'pz-people' }, people)));
  const check = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'pz-check', text: '확인하기', disabled: true });
  check.addEventListener('click', s6Check);
  $('#g-answers').replaceChildren(el('p', { class: 'g-hint', text: '세 사람 모두 고른 뒤 확인해요.' }), check);
}
const tribe = (t) => (t ? '참말족' : '거짓말족');
function s6Check() {
  const q = run.q;
  if (run.answered || run.pick.includes(null)) return;
  const right = run.pick.every((v, i) => v === q.answer[i]);
  q.names.forEach((name, i) => {
    const card = $(`#g-board .pz-person[data-p="${i}"]`);
    card.classList.add(run.pick[i] === q.answer[i] ? 'is-right' : 'is-wrong');
    card.querySelector(`.pz-tog-btn[data-v="${q.answer[i] ? 't' : 'f'}"]`).classList.add('is-answer');
  });
  const why = [];
  if (!right) {
    const T = run.pick, i = q.sayF.findIndex((f, j) => f(T) !== T[j]);
    const name = q.names[i];
    why.push(`고른 대로라면 ${name}${eun(name)} ${tribe(T[i])}인데, ${name}의 말이 ${T[i] ? '거짓' : '참'}이 되어 어긋나요.`);
  }
  q.names.forEach((name, i) => {
    why.push(`${name}${eun(name)} ${tribe(q.answer[i])}: “${q.says[i]}”는 ${q.answer[i] ? '참' : '거짓'}인 말이에요.`);
  });
  why.push('모든 사람의 말이 어긋나지 않는 경우는 이것 하나뿐이에요.');
  score(right, why);
}

/* ── 채점 ── */
const PRAISE = ['정답이에요!', '맞았어요!', '잘했어요!', '훌륭해요!'];
function score(right, whys, badText) {
  run.answered = true;
  if (right) { run.correct += 1; run.streak += 1; run.bestStreak = Math.max(run.bestStreak, run.streak); } else run.streak = 0;
  document.querySelectorAll('#g-answers button, #g-board button').forEach((b) => { b.disabled = true; });
  document.querySelectorAll('#pz-check, #g-answers .g-hint').forEach((x) => { x.hidden = true; });
  const last = run.i >= PER_STAGE;
  const nextBtn = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'g-next', text: last ? '결과 보기' : '다음 문제 →' });
  nextBtn.addEventListener('click', () => (last ? finish() : nextQuestion()));
  $('#g-feedback').replaceChildren(
    el('p', { class: 'g-verdict ' + (right ? 'ok' : 'bad') },
      el('span', { 'aria-hidden': 'true', text: right ? '✔ ' : '✘ ' }),
      right ? PRAISE[run.i % PRAISE.length] : badText || '아쉬워요.',
      right && run.streak >= 3 ? el('span', { class: 'g-streak', text: ` ${run.streak}문제 연속 정답!` }) : null),
    ...whys.filter((w) => w && (!Array.isArray(w) || w.length)).map((w) => el('p', { class: 'g-why' }, w)),
    el('div', { class: 'g-actions' }, nextBtn));
  renderCounts();
  nextBtn.focus();
}

$('#g-quit').addEventListener('click', () => {
  if (run && run.i > 1 && !confirm('그만할까요? 이번 연습은 기록되지 않아요.')) return;
  run = null;
  renderMenu();
  $('#g-stages').querySelector('button').focus();
});

/* ── 결과 ── */
function finish() {
  const sec = Math.max(1, Math.round((Date.now() - run.started) / 1000));
  logPlay(GAME, run.stage, run.correct, PER_STAGE, sec); // 선생님이 볼 수 있도록 끝까지 푼 판을 기록
  const stars = starsOf(run.correct);
  const prev = (rec.stages || {})[run.stage];
  const better = !prev || run.correct > prev.best || (run.correct === prev.best && sec < prev.time);
  rec.stages = rec.stages || {};
  rec.stages[run.stage] = better
    ? { best: run.correct, time: sec, stars: Math.max(stars, prev ? prev.stars : 0), plays: (prev ? prev.plays : 0) + 1 }
    : { ...prev, stars: Math.max(stars, prev.stars || 0), plays: (prev.plays || 0) + 1 };
  rec.updatedAt = new Date().toISOString();
  saveRecord(GAME, uid, rec);
  const s = STAGES[run.stage - 1];
  const nextStage = STAGES[run.stage];
  const again = el('button', { type: 'button', class: 'btn-primary btn-sm', text: '다시 하기' });
  again.addEventListener('click', () => startStage(s.n));
  const menu = el('button', { type: 'button', class: 'btn-line btn-sm', text: '단계 고르기' });
  menu.addEventListener('click', () => { renderMenu(); $('#g-stages').querySelector('button').focus(); });
  const kids = [again];
  if (nextStage) { const nx = el('button', { type: 'button', class: 'btn-line btn-sm', text: `${nextStage.n}단계 하기` }); nx.addEventListener('click', () => startStage(nextStage.n)); kids.push(nx); }
  kids.push(menu);
  const msg = run.correct === PER_STAGE ? '모두 맞혔어요! 명탐정이에요.' : run.correct >= 8 ? '아주 잘했어요! 조금만 더 하면 별 3개예요.' : run.correct >= 5 ? '좋아요! 틀린 문제의 설명을 다시 읽어 보고 한 번 더 해 봐요.' : '괜찮아요. 아래 팁과 용어 정리를 보고 한 번 더 해 봐요.';
  $('#g-result-card').replaceChildren(...[
    el('p', { class: 'g-result-cap', text: `${s.n}단계 · ${s.name}` }),
    el('h2', { class: 'g-result-title', tabindex: '-1', text: `${PER_STAGE}문제 중 ${run.correct}문제 맞혔어요` }),
    starLine(stars),
    better && prev ? el('p', { class: 'g-newbest', text: '내 최고 기록을 새로 세웠어요!' }) : null,
    el('dl', { class: 'g-result-dl' },
      el('div', {}, el('dt', { text: '걸린 시간' }), el('dd', { text: timeText(sec) })),
      el('div', {}, el('dt', { text: '가장 긴 연속 정답' }), el('dd', { text: `${run.bestStreak}문제` })),
      el('div', {}, el('dt', { text: '내 최고 기록' }), el('dd', { text: `${rec.stages[s.n].best}/${PER_STAGE} · ${timeText(rec.stages[s.n].time)}` }))),
    el('p', { class: 'g-result-msg', text: msg }),
    el('p', { class: 'g-tip' }, el('strong', { text: '팁 ' }), s.tip),
    el('div', { class: 'g-actions' }, kids)].filter(Boolean));
  run = null;
  screen('result');
  $('#g-result-card .g-result-title').focus();
}

/* ── 로그인 확인 ── */
// locked: 로그인은 했지만 내 학년·수강 과목에 맞지 않는 게임
function gate(text, locked) {
  $('#g-gate-text').textContent = text;
  const h = $('#g-gate h2'), a = $('#g-gate a');
  if (h) h.textContent = locked ? '이 게임은 할 수 없어요' : '로그인이 필요해요';
  if (a) a.textContent = locked ? '학습 보조에서 내 게임 고르기' : '학생 전용에서 로그인하기';
  show('gate');
}
function startApp(id, who) {
  uid = id;
  rec = loadRecord(GAME, uid);
  rec.stages = rec.stages || {};
  $('#g-who').textContent = who;
  show('app');
  renderMenu();
}

if (!be.configured) {
  $('#g-status').textContent = '학생 전용 서비스를 준비하고 있어요. 조금만 기다려 주세요.';
} else {
  be.onUser(async (user) => {
    if (!user) { gate('학습 보조 게임은 로그인한 회원만 할 수 있어요.'); return; }
    try {
      const st = await be.getStudent(user.uid);
      if (st && st.active) {
        // 선생님이 정한 학년이면서 그 과목을 수강하는 학생만 할 수 있어요 (learn-access.js)
        const res = checkBuiltin(await be.listLearnGames(), GAME, st);
        if (!res.ok) { gate(res.text, true); return; }
        setPlayer(st);
        startApp(user.uid, `${st.name} 학생의 연습`);
        return;
      }
      if (!st && (await be.isAdmin(user.uid).catch(() => false))) { startApp('teacher-' + user.uid, '선생님 미리보기'); return; }
      gate(st && st.guardianStatus === 'pending' ? '보호자 동의를 확인하는 중이에요. 확인이 끝나면 할 수 있어요.' : '사용할 수 없는 계정이에요. 학원에 문의해 주세요.');
    } catch (e) {
      $('#g-status').textContent = '게임을 불러오지 못했어요. 새로고침해 주세요.';
      show('status');
    }
  });
}
