// 학습 보조 → 정육면체 전개도 연습 (혼자 단련하는 게임, 대결 없음)
// 4단계 × 10문제. 별과 최고 기록은 이 기기의 브라우저에 저장하고, 끝까지 푼 판은 선생님이 볼 수 있게 학원 서버에도 기록해요(learn-log.js).
import * as be from './backend.js';
import { el } from './common.js';
import { loadRecord, saveRecord, totalStars } from './learn-records.js';
import { checkBuiltin } from './learn-access.js';
import { setPlayer, logPlay } from './learn-log.js';
import { CUBE_NETS, fold, makeQuestion } from './cube-net.js';

const $ = (s) => document.querySelector(s);
const GAME = 'cube-net';
const PER_STAGE = 10;
const STAGES = [
  { n: 1, name: '접히는 전개도 찾기', desc: '이 모양을 접으면 정육면체가 될까요? ○ 또는 ✕를 골라요.', tip: '접었을 때 두 면이 같은 자리에 겹치면 정육면체가 안 돼요.' },
  { n: 2, name: '마주 보는 면 찾기', desc: '★ 면과 마주 보는 면을 눌러요.', tip: '한 줄로 이어진 세 칸에서 양 끝 칸은 서로 마주 봐요.' },
  { n: 3, name: '주사위 눈 채우기', desc: '주사위는 마주 보는 두 면의 눈을 더하면 7이에요. ? 면에 알맞은 수를 골라요.', tip: '? 면과 마주 보는 면을 먼저 찾고, 7에서 그 수를 빼요.' },
  { n: 4, name: '전개도 완성하기', desc: '점선 칸 하나를 붙여서 정육면체 전개도를 완성해요.', tip: '붙였을 때 겹치는 면이 없으면 정답이에요. 정답 칸이 여러 개일 수도 있어요.' }
];
const FACE_COLORS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let uid = null;
let rec = { stages: {} };
let run = null; // { stage, i, correct, streak, bestStreak, q, answered, started, choice }

/* ── 작은 도구 ── */
const isVowelEnd = (n) => [2, 4, 5, 9].includes(Number(n) % 10); // 이(2)·사(4)·오(5)·구(9)는 받침 없음
const ieyo = (n) => `${n}${isVowelEnd(n) ? '예요' : '이에요'}`;
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

/* ── 전개도 그리기 (평면) ──
   opts.content(i) → { text, cls, label } / opts.onPick(i) 이면 칸이 단추 / opts.slots + opts.onSlot(j) 이면 점선 칸 */
function netGrid(cells, opts = {}) {
  const all = [...cells, ...(opts.slots || [])];
  const rows = Math.max(...all.map((x) => x[0])) + 1;
  const cols = Math.max(...all.map((x) => x[1])) + 1;
  const pickable = Boolean(opts.onPick || opts.onSlot);
  const grid = el('div', {
    class: 'net' + (opts.small ? ' small' : ''), style: `--rows:${rows};--cols:${cols};`,
    role: pickable ? 'group' : 'img', 'aria-label': opts.label || '정육면체 전개도 그림'
  });
  const where = (r, c) => `위에서 ${r + 1}번째 줄, 왼쪽에서 ${c + 1}번째 칸`;
  cells.forEach(([r, c], i) => {
    const ct = (opts.content && opts.content(i)) || {};
    const attrs = { class: 'nc ' + (ct.cls || ''), style: `grid-row:${r + 1};grid-column:${c + 1};`, 'data-i': String(i) };
    const kid = ct.text ? el('span', { text: ct.text }) : null;
    if (opts.onPick) {
      const b = el('button', { type: 'button', ...attrs, 'aria-label': `${where(r, c)}${ct.label ? ', ' + ct.label : ''}` }, kid);
      b.addEventListener('click', () => opts.onPick(i, b));
      grid.append(b);
    } else {
      grid.append(el('div', { ...attrs, 'aria-hidden': pickable ? 'true' : null }, kid));
    }
  });
  (opts.slots || []).forEach(([r, c], j) => {
    const b = el('button', { type: 'button', class: 'nc slot', style: `grid-row:${r + 1};grid-column:${c + 1};`, 'data-slot': String(j), 'aria-label': `${where(r, c)}에 한 칸 붙이기` }, el('span', { 'aria-hidden': 'true', text: '+' }));
    b.addEventListener('click', () => opts.onSlot(j, b));
    grid.append(b);
  });
  return grid;
}

/* ── 접어 보기 (입체) ── */
const OFF = { E: [1, 0], W: [-1, 0], S: [0, 1], N: [0, -1] };
function foldViewer(cells, contentFor, opts = {}) {
  const S = opts.size || (window.innerWidth < 520 ? 58 : 74);
  const { root, tree, valid, faces } = fold(cells);
  // 정육면체가 안 되는 모양: 같은 자리로 접히는 면에 빨간 줄무늬
  const clash = new Set(faces.filter((f, i) => faces.indexOf(f) !== i));
  const els = cells.map((_, i) => {
    const c = (contentFor && contentFor(i)) || {};
    return el('div', { class: 'fx ' + (c.cls || FACE_COLORS[i % 6]) + (clash.has(faces[i]) ? ' clash' : ''), 'data-dir': tree[i].dir || 'root' }, c.text ? el('span', { text: c.text }) : null);
  });
  // 깊이 순서대로 부모 면 안에 붙이면, 부모가 접힐 때 자식도 함께 따라 접혀요
  cells.map((_, i) => i).sort((a, b) => tree[a].depth - tree[b].depth).forEach((i) => {
    const t = tree[i];
    if (t.parent < 0) return;
    const [dx, dy] = OFF[t.dir];
    els[i].style.left = `${dx * S - 2 * dx}px`;
    els[i].style.top = `${dy * S - 2 * dy}px`;
    els[t.parent].append(els[i]);
  });
  const [rr, rc] = cells[root];
  const rs = cells.map((x) => x[0]), cs = cells.map((x) => x[1]);
  const cx = (Math.min(...cs) + Math.max(...cs)) / 2 - rc;
  const cy = (Math.min(...rs) + Math.max(...rs)) / 2 - rr;
  els[root].style.left = `${-S / 2 - cx * (S - 2)}px`;
  els[root].style.top = `${-S / 2 - cy * (S - 2)}px`;
  let rz = -30;
  const world = el('div', { class: 'fworld', style: `--rz:${rz}deg;` }, els[root]);
  const stage = el('div', { class: 'fstage', style: `--s:${S}px;--k:0;` }, world);
  const range = el('input', { type: 'range', min: '0', max: '100', value: '0', class: 'frange', 'aria-label': '접는 정도 (0은 펼침, 100은 다 접음)' });
  let k = 0, anim = 0;
  const setK = (v) => { k = Math.max(0, Math.min(1, v)); stage.style.setProperty('--k', String(k)); range.value = String(Math.round(k * 100)); playBtn.textContent = k >= 0.99 ? '다시 펼치기' : '접기'; done.hidden = k < 0.99; };
  range.addEventListener('input', () => { cancelAnimationFrame(anim); setK(Number(range.value) / 100); });
  const animateTo = (target) => {
    cancelAnimationFrame(anim);
    if (reduceMotion()) { setK(target); return; }
    const from = k, t0 = performance.now(), dur = 1200 * Math.abs(target - from) + 100;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setK(from + (target - from) * e);
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  const playBtn = el('button', { type: 'button', class: 'btn-primary btn-sm', text: '접기' });
  playBtn.addEventListener('click', () => animateTo(k >= 0.99 ? 0 : 1));
  const turn = el('button', { type: 'button', class: 'btn-line btn-sm', text: '돌려 보기' });
  turn.addEventListener('click', () => { rz += 90; world.style.setProperty('--rz', `${rz}deg`); });
  const done = el('p', { class: 'fnote ' + (valid ? 'ok' : 'bad'), role: 'status', hidden: true,
    text: valid ? '다 접었어요. 6개의 면이 모두 다른 자리로 가서 정육면체가 됐어요.' : '다 접었어요. 빨간 줄무늬 면들이 같은 자리에 겹쳐서 정육면체가 안 돼요. (빈 면도 생겨요)' });
  const node = el('div', { class: 'fviewer' },
    el('div', { class: 'fstage-wrap', role: 'img', 'aria-label': valid ? '전개도를 접어 정육면체를 만드는 그림' : '전개도를 접으면 면이 겹치는 그림' }, stage),
    el('div', { class: 'fctrl' }, playBtn, turn, el('label', { class: 'frange-label' }, el('span', { text: '펼침' }), range, el('span', { text: '접음' }))),
    done);
  return { node, play: () => animateTo(1) };
}

/* ── 단계 고르기 화면 ── */
function renderMenu() {
  const st = rec.stages || {};
  $('#g-sum').replaceChildren(
    el('div', { class: 'g-sum-main' },
      el('span', { class: 'g-sum-label', text: '모은 별' }),
      el('strong', { text: `${totalStars(rec)} / ${STAGES.length * 3}` })),
    el('p', { text: '단계마다 10문제예요. 10문제를 모두 맞히면 별 3개, 8문제 이상 별 2개, 5문제 이상 별 1개를 받아요.' }));
  $('#g-stages').replaceChildren(...STAGES.map((s) => {
    const r = st[s.n];
    const btn = el('button', { type: 'button', class: 'btn-primary btn-sm', 'data-stage': String(s.n), text: r ? '다시 하기' : '시작하기', 'aria-label': `${s.n}단계 ${s.name} ${r ? '다시 하기' : '시작하기'}` });
    btn.addEventListener('click', () => startStage(s.n));
    return el('li', { class: 'g-stage' },
      el('span', { class: 'g-stage-n', 'aria-hidden': 'true', text: String(s.n) }),
      el('div', { class: 'g-stage-body' },
        el('h3', {}, `${s.n}단계 · ${s.name}`),
        el('p', { text: s.desc }),
        el('p', { class: 'g-stage-rec' }, r
          ? [starLine(r.stars || 0), ` 최고 ${r.best}/${PER_STAGE} · ${timeText(r.time)} · ${r.plays}번 연습`]
          : '아직 연습하지 않았어요')),
      btn);
  }));
  $('#g-gal').replaceChildren(...CUBE_NETS.map((cells, i) => {
    const b = el('button', { type: 'button', class: 'g-gal-item', 'aria-label': `${i + 1}번 전개도 접어 보기` },
      netGrid(cells, { small: true, content: (j) => ({ cls: FACE_COLORS[j] }) }), el('span', { text: `${i + 1}번` }));
    b.addEventListener('click', () => openFoldDialog(cells, `${i + 1}번 전개도 접어 보기`, b));
    return b;
  }));
  screen('menu');
}

let dlgReturn = null;
function openFoldDialog(cells, title, from) {
  dlgReturn = from;
  $('#fold-dlg-title').textContent = title;
  const v = foldViewer(cells, (i) => ({ cls: FACE_COLORS[i] }), { size: window.innerWidth < 520 ? 50 : 62 });
  $('#fold-dlg-body').replaceChildren(v.node);
  $('#fold-dlg').showModal();
  v.play();
}
$('#fold-dlg-close').addEventListener('click', () => $('#fold-dlg').close());
$('#fold-dlg').addEventListener('close', () => { if (dlgReturn) dlgReturn.focus(); });

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
  run.choice = null;
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

function renderQuestion() {
  const q = run.q;
  renderCounts();
  $('#g-feedback').replaceChildren();
  $('#g-fold').hidden = true;
  $('#g-fold').replaceChildren();
  const ans = $('#g-answers');
  if (q.stage === 1) {
    $('#g-q').textContent = '이 모양을 접으면 정육면체가 될까요?';
    $('#g-net').replaceChildren(netGrid(q.cells, { label: '칸 6개로 된 모양', content: (i) => ({ cls: 'plain' }) }));
    const yes = el('button', { type: 'button', class: 'g-ox o', 'data-ans': 'yes' }, el('span', { class: 'g-ox-mark', 'aria-hidden': 'true', text: '○' }), '정육면체가 돼요');
    const no = el('button', { type: 'button', class: 'g-ox x', 'data-ans': 'no' }, el('span', { class: 'g-ox-mark', 'aria-hidden': 'true', text: '✕' }), '안 돼요');
    yes.addEventListener('click', () => answer(true, yes));
    no.addEventListener('click', () => answer(false, no));
    ans.replaceChildren(yes, no);
  } else if (q.stage === 2) {
    $('#g-q').textContent = '접었을 때 ★ 면과 마주 보는 면을 눌러 보세요.';
    $('#g-net').replaceChildren(netGrid(q.cells, {
      label: '★ 면과 마주 보는 면 고르기',
      content: (i) => (i === q.star ? { text: '★', cls: 'star', label: '★ 표시된 면' } : { cls: 'plain' }),
      onPick: (i, b) => { if (i !== q.star) answer(i, b); }
    }));
    ans.replaceChildren(el('p', { class: 'g-hint', text: '★ 면이 아닌 다른 면을 하나 눌러요.' }));
  } else if (q.stage === 3) {
    $('#g-q').textContent = '주사위 전개도예요. ? 면에 알맞은 수는 무엇일까요?';
    $('#g-net').replaceChildren(netGrid(q.cells, {
      label: '주사위 전개도',
      content: (i) => (i === q.ask ? { text: '?', cls: 'ask' } : q.shown.includes(i) ? { text: String(q.numbers[i]), cls: 'num' } : { cls: 'plain' })
    }));
    ans.replaceChildren(el('div', { class: 'g-nums', role: 'group', 'aria-label': '? 면의 수 고르기' },
      ...[1, 2, 3, 4, 5, 6].map((n) => { const b = el('button', { type: 'button', class: 'g-num', 'data-n': String(n), text: String(n) }); b.addEventListener('click', () => answer(n, b)); return b; })));
  } else {
    $('#g-q').textContent = '점선 칸 하나를 붙여 정육면체 전개도를 완성해 보세요.';
    $('#g-net').replaceChildren(netGrid(q.cells, {
      label: '전개도 완성하기: 점선 칸 중 하나 고르기',
      content: () => ({ cls: 'plain' }), slots: q.options,
      onSlot: (j, b) => answer(j, b)
    }));
    ans.replaceChildren(el('p', { class: 'g-hint', text: '+ 표시가 있는 점선 칸 중 하나를 눌러요.' }));
  }
}

const PRAISE = ['정답이에요!', '맞았어요!', '잘했어요!', '훌륭해요!'];
function answer(choice, btn) {
  if (run.answered) return;
  const q = run.q;
  run.answered = true;
  run.choice = choice;
  const right = q.stage === 1 ? choice === q.answer : q.stage === 4 ? q.good[choice] : choice === q.answer;
  if (right) { run.correct += 1; run.streak += 1; run.bestStreak = Math.max(run.bestStreak, run.streak); } else run.streak = 0;

  // 답 표시: 고른 것(정답 초록·오답 빨강), 정답 위치(초록 테두리)
  document.querySelectorAll('#g-answers button, #g-net button').forEach((b) => { b.disabled = true; });
  btn.classList.add(right ? 'is-right' : 'is-wrong');
  btn.setAttribute('aria-label', (btn.getAttribute('aria-label') || btn.textContent) + (right ? ' (고른 답, 정답)' : ' (고른 답, 오답)'));
  const net = $('#g-net');
  if (q.stage === 2) { const t = net.querySelector(`[data-i="${q.answer}"]`); t.classList.add('is-answer'); if (!t.textContent) t.replaceChildren(el('span', { text: '●' })); }
  if (q.stage === 3) {
    $('#g-answers').querySelector(`[data-n="${q.answer}"]`).classList.add('is-answer');
    net.querySelector(`[data-i="${q.opp}"]`).classList.add('is-hint');
  }
  if (q.stage === 4) q.good.forEach((g, j) => { if (g) net.querySelector(`[data-slot="${j}"]`).classList.add('is-answer'); });
  if (q.stage === 1) $('#g-answers').querySelector(`[data-ans="${q.answer ? 'yes' : 'no'}"]`).classList.add('is-answer');

  let why;
  if (q.stage === 1) why = q.answer ? '이 모양은 접으면 6개의 면이 모두 다른 자리로 가서 정육면체가 돼요.' : '이 모양은 접으면 두 면이 같은 자리에 겹쳐서 정육면체가 안 돼요.';
  if (q.stage === 2) why = '초록색 ● 면이 ★ 면과 마주 보는 면이에요. 마주 보는 두 면은 접었을 때 서로 닿지 않아요.';
  if (q.stage === 3) { const o = q.numbers[q.opp]; why = `? 면과 마주 보는 면(노란 테두리)의 수가 ${o}이니까, 7 − ${o} = ${ieyo(q.answer)}`; }
  if (q.stage === 4) {
    const n = q.good.filter(Boolean).length;
    why = right ? `이 칸을 붙이면 정육면체 전개도가 돼요.${n > 1 ? ` 초록 점선 칸 ${n - 1}곳도 정답이에요.` : ''}` : '이 칸을 붙이면 접었을 때 면이 겹쳐요. 초록 점선 칸이 정답이에요.';
  }
  const foldBtn = el('button', { type: 'button', class: 'btn-line btn-sm', id: 'g-fold-btn', text: '접어서 확인하기' });
  foldBtn.addEventListener('click', () => openInlineFold());
  const last = run.i >= PER_STAGE;
  const nextBtn = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'g-next', text: last ? '결과 보기' : '다음 문제 →' });
  nextBtn.addEventListener('click', () => (last ? finish() : nextQuestion()));
  $('#g-feedback').replaceChildren(
    el('p', { class: 'g-verdict ' + (right ? 'ok' : 'bad') },
      el('span', { 'aria-hidden': 'true', text: right ? '✔ ' : '✘ ' }),
      right ? PRAISE[run.i % PRAISE.length] : '아쉬워요.',
      right && run.streak >= 3 ? el('span', { class: 'g-streak', text: ` ${run.streak}문제 연속 정답!` }) : null),
    el('p', { class: 'g-why', text: why }),
    el('div', { class: 'g-actions' }, foldBtn, nextBtn));
  renderCounts();
  nextBtn.focus();
}

// 지금 문제를 접어 보기 (4단계는 고른 칸을 붙인 모양으로)
function openInlineFold() {
  const q = run.q;
  let cells = q.cells, content;
  if (q.stage === 2) content = (i) => (i === q.star ? { text: '★', cls: 'star' } : i === q.answer ? { text: '●', cls: 'mark' } : { cls: FACE_COLORS[i] });
  else if (q.stage === 3) content = (i) => ({ text: String(q.numbers[i]), cls: i === q.ask ? 'ask' : FACE_COLORS[i] });
  else if (q.stage === 4) { cells = [...q.cells, q.options[run.choice]]; content = (i) => (i === 5 ? { text: '+', cls: 'mark' } : { cls: FACE_COLORS[i] }); }
  else content = (i) => ({ cls: FACE_COLORS[i] });
  const v = foldViewer(cells, content);
  const box = $('#g-fold');
  box.replaceChildren(el('h3', { class: 'g-fold-title', text: q.stage === 4 ? '고른 칸을 붙여서 접어 보기' : '접어 보기' }), v.node);
  box.hidden = false;
  const b = $('#g-fold-btn');
  if (b) b.hidden = true;
  box.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
  v.play();
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
  const msg = run.correct === PER_STAGE ? '모두 맞혔어요! 정말 대단해요.' : run.correct >= 8 ? '아주 잘했어요! 조금만 더 하면 별 3개예요.' : run.correct >= 5 ? '좋아요! 틀린 문제는 접어 보면서 다시 연습해 봐요.' : '괜찮아요. 아래 팁을 보고 한 번 더 해 봐요.';
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
