// 학습 보조 → that 연결 기차 (초6 영어: 접속사 that을 혼자 단련하는 게임, 대결 없음)
// 5단계 × 10문제. 문제는 단어를 바꿔 가며 자동으로 만들어요. 별과 최고 기록은 이 기기의 브라우저에 저장하고, 끝까지 푼 판은 선생님이 볼 수 있게 학원 서버에도 기록해요(learn-log.js).
import * as be from './backend.js';
import { el } from './common.js';
import { loadRecord, saveRecord, totalStars } from './learn-records.js';
import { checkBuiltin } from './learn-access.js';
import { setPlayer, logPlay } from './learn-log.js';
import { makeQuestion } from './english-that.js';

const $ = (s) => document.querySelector(s);
const GAME = 'that-train';
const PER_STAGE = 10;
const STAGES = [
  { n: 1, name: '문장 기차', desc: '단어 카드를 차례로 기차 칸에 실어 문장을 완성해요.', tip: '‘누가 + 생각해(알아)’ 다음에 that을 쓰고, 그 뒤에 ‘누가 + 어떠하다’ 문장을 이어요.' },
  { n: 2, name: 'that 자리 찾기', desc: '두 문장을 이어 주는 that이 들어갈 자리를 찾아요.', tip: 'think, know, believe, hope 바로 뒤가 that 자리예요. 이 that은 빼고 말해도 뜻이 같아요.' },
  { n: 3, name: '어떤 that일까?', desc: '‘저것·저’라는 that인지, 두 문장을 이어 주는 that인지 골라요.', tip: 'that 뒤에 ‘누가 + 동사’ 문장이 이어지면 이어 주는 that, 명사 하나만 오면 ‘저 ~’라는 뜻이에요.' },
  { n: 4, name: '생각 말풍선', desc: '우리말 뜻에 맞는 영어 문장을 골라요.', tip: '동사의 뜻(생각해·알아·믿어·바라)과, that 뒤가 ‘누가 + 동사’ 순서인지 꼭 확인해요.' },
  { n: 5, name: '틀린 곳 찾기', desc: '문장에서 틀린 단어 하나를 찾아요.', tip: 'Mina·he처럼 나·너가 아닌 한 사람이 주어이면 동사에 s를 붙이고, can·will 뒤에는 동사원형을 써요.' }
];
const MARKS = ['①', '②', '③', '④'];
const TEST = (() => { try { return localStorage.getItem('abel-test-hook') === '1'; } catch { return false; } })();
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let uid = null;
let rec = { stages: {} };
let run = null;

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
const en = (text, cls = '') => el('span', { class: 'th-en' + (cls ? ' ' + cls : ''), lang: 'en', text });

// 문장을 색으로 나눠 보여 주기: 앞 문장(파랑) · that(노랑) · 뒤 문장(초록)
function colored(s) {
  return el('span', { class: 'th-sent', lang: 'en' },
    s.main.flatMap((w) => [el('span', { class: 'th-w main', text: w }), ' ']),
    el('span', { class: 'th-w that', text: 'that' }), ' ',
    s.clause.flatMap((w, i) => [el('span', { class: 'th-w clause', text: w }), i < s.clause.length - 1 ? ' ' : '']), '.');
}
const legend = () => el('p', { class: 'th-legend' },
  el('span', { class: 'th-key main', text: '앞 문장' }), el('span', { class: 'th-key that', text: 'that' }), el('span', { class: 'th-key clause', text: '뒤 문장 (누가 + 동사)' }));
const koBox = (ko, label = '뜻') => el('div', { class: 'th-ko' }, el('span', { class: 'th-ko-label', text: label }), el('span', { class: 'th-ko-text', text: ko }));

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
        el('h3', {}, `${s.n}단계 · ${s.name}`),
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
  if (TEST) window.__thatQ = run.q;
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
const setQ = (t) => { $('#g-q').textContent = t; };
const board = (...kids) => $('#g-board').replaceChildren(...kids.filter(Boolean));
function extra(...kids) {
  const box = $('#g-extra');
  box.replaceChildren(...kids.filter(Boolean));
  box.hidden = !box.childNodes.length;
}
function mark(btn, right) {
  btn.classList.add(right ? 'is-right' : 'is-wrong');
  btn.setAttribute('aria-label', (btn.getAttribute('aria-label') || btn.textContent) + (right ? ' (고른 답, 정답)' : ' (고른 답, 오답)'));
}
function renderQuestion() {
  renderCounts();
  $('#g-feedback').replaceChildren();
  extra();
  ({ 1: q1, 2: q2, 3: q3, 4: q4, 5: q5 })[run.q.stage](run.q);
}
const sentenceBlock = (s) => el('div', { class: 'th-answer' }, el('p', { class: 'th-answer-cap', text: '바른 문장' }), colored(s), legend());

/* 1단계: 문장 기차 */
function engine() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 64 48'); svg.setAttribute('class', 'th-engine'); svg.setAttribute('aria-hidden', 'true');
  const p = (d, cls) => { const e = document.createElementNS(ns, 'path'); e.setAttribute('d', d); e.setAttribute('class', cls); svg.append(e); };
  p('M6 14h22v-6h8v6h10a10 10 0 0110 10v12H6z', 'body');      // 몸통과 굴뚝
  p('M10 18h12v10H10z', 'win');                                 // 창문
  p('M2 38h60', 'rail');
  [14, 30, 46].forEach((x) => p(`M${x - 5} 38a5 5 0 1010 0a5 5 0 10-10 0`, 'wheel'));
  return svg;
}
const cardWord = (id) => run.q.cards.find((c) => c.id === id).w;
function q1(q) {
  setQ('우리말 뜻에 맞게 단어 카드를 기차에 차례로 실어 보세요.');
  board(koBox(q.s.ko));
  run.slots = new Array(q.s.words.length).fill(null);
  const cards = q.cards.map((c) => {
    const b = el('button', { type: 'button', class: 'th-card' + (c.w === 'that' ? ' that' : ''), 'data-id': String(c.id), lang: 'en', text: c.w });
    b.addEventListener('click', () => placeCard(c.id));
    return b;
  });
  const check = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'th-check', text: '확인하기', disabled: true });
  check.addEventListener('click', s1Check);
  $('#g-answers').replaceChildren(el('div', { class: 'th-s1' },
    el('div', { class: 'th-train', id: 'th-train', role: 'group', 'aria-label': '기차 칸 (문장 순서)' }),
    el('p', { class: 'g-hint', text: '카드를 누르면 앞 칸부터 차례로 실려요. 실은 카드를 누르면 다시 내려요.' }),
    el('div', { class: 'th-cards', role: 'group', 'aria-label': '단어 카드' }, cards),
    check));
  drawTrain();
}
function drawTrain(focusAt) {
  const cars = run.slots.map((id, i) => {
    const w = id == null ? null : cardWord(id);
    const b = w
      ? el('button', { type: 'button', class: 'th-car filled' + (w === 'that' ? ' that' : ''), 'data-at': String(i), lang: 'en', 'aria-label': `${i + 1}번째 칸: ${w} (누르면 내리기)` }, w)
      : el('button', { type: 'button', class: 'th-car', 'data-at': String(i), 'aria-label': `${i + 1}번째 칸 (비어 있음)` }, el('span', { class: 'th-car-n', 'aria-hidden': 'true', text: String(i + 1) }));
    b.addEventListener('click', () => {
      if (run.answered) return;
      if (run.slots[i] != null) { run.slots[i] = null; drawTrain(i); }
      else document.querySelector('#g-answers .th-card:not(:disabled)')?.focus();
    });
    return b;
  });
  $('#th-train').replaceChildren(engine(), ...cars, el('span', { class: 'th-dot', 'aria-hidden': 'true', text: '.' }));
  document.querySelectorAll('#g-answers .th-card').forEach((b) => {
    const used = run.slots.includes(Number(b.dataset.id));
    b.disabled = used || run.answered;
    b.classList.toggle('used', used);
  });
  $('#th-check').disabled = run.slots.includes(null) || run.answered;
  if (focusAt != null) $(`#th-train [data-at="${focusAt}"]`).focus();
}
function placeCard(id) {
  if (run.answered) return;
  const i = run.slots.indexOf(null);
  if (i < 0) return;
  run.slots[i] = id;
  drawTrain();
  const nextCard = document.querySelector('#g-answers .th-card:not(:disabled)');
  (run.slots.includes(null) && nextCard ? nextCard : $('#th-check')).focus();
}
function s1Check() {
  const q = run.q;
  if (run.answered || run.slots.includes(null)) return;
  const got = run.slots.map(cardWord);
  const right = got.join(' ') === q.s.words.join(' ');
  document.querySelectorAll('#th-train .th-car').forEach((b, i) => b.classList.add(got[i] === q.s.words[i] ? 'ok' : 'bad'));
  const train = $('#th-train');
  if (right && !reduceMotion()) train.classList.add('go');
  const why = right
    ? ['기차가 출발해요! ‘', en(q.s.main.join(' ')), '’ 다음에 that, 그 뒤에 ‘', en(q.s.clause.join(' ')), '’ 문장을 이었어요.']
    : ['빨간 칸의 순서가 달라요. ‘', en(q.s.main.join(' ')), '’ 다음에 that을 쓰고, 그 뒤에 ‘누가 + 동사’ 순서로 ‘', en(q.s.clause.join(' ')), '’ 문장을 이어요.'];
  extra(sentenceBlock(q.s));
  score(right, [why]);
}

/* 2단계: that 자리 찾기 */
function q2(q) {
  setQ('두 문장을 이어 주는 that은 어디에 들어갈까요?');
  board(koBox(q.s.ko));
  const parts = [];
  q.words.forEach((w, i) => {
    parts.push(el('span', { class: 'th-gw', lang: 'en', text: w }));
    if (i < q.words.length - 1) {
      const g = el('button', { type: 'button', class: 'th-gap', 'data-g': String(i), 'aria-label': `${w}와 ${q.words[i + 1]} 사이에 넣기` }, el('span', { 'aria-hidden': 'true', text: '+' }));
      g.addEventListener('click', () => s2(i, g));
      parts.push(g);
    }
  });
  parts.push(el('span', { class: 'th-gw', text: '.' }));
  $('#g-answers').replaceChildren(el('div', { class: 'th-gaps', role: 'group', 'aria-label': 'that 넣을 자리 고르기' }, parts),
    el('p', { class: 'g-hint', text: '단어 사이의 + 를 눌러 that을 넣어 보세요.' }));
}
function s2(i, btn) {
  const q = run.q;
  if (run.answered) return;
  const right = i === q.answer;
  mark(btn, right);
  const t = $(`#g-answers .th-gap[data-g="${q.answer}"]`);
  t.classList.add('is-answer');
  t.replaceChildren(el('span', { lang: 'en', text: 'that' }));
  const v = q.s.verb;
  score(right, [['that은 ', en(q.s.vf), `(${v.mean}) 바로 뒤, 뒤 문장 ‘`, en(q.s.clause.join(' ')), '’ 앞에 들어가요.'], '이렇게 생각·앎을 나타내는 동사 뒤의 that은 빼고 말해도 뜻이 같아요.']);
  extra(sentenceBlock(q.s));
}

/* 3단계: 어떤 that일까? */
function q3(q) {
  setQ('이 문장의 that은 어떤 that일까요?');
  board(el('p', { class: 'th-big', lang: 'en' }, q.words.flatMap((w, i) => [i ? ' ' : '', i === q.at ? el('mark', { class: 'th-hl', text: w }) : w]), q.end));
  const basket = (k, title, sub) => {
    const b = el('button', { type: 'button', class: 'th-basket ' + k, 'data-k': k }, el('strong', { text: title }), el('span', { text: sub }));
    b.addEventListener('click', () => s3(k, b));
    return b;
  };
  $('#g-answers').replaceChildren(basket('demo', '가리키는 that', '저것 · 저 ~'), basket('conj', '이어 주는 that', '~라고 · ~라는 것을'));
}
function s3(k, btn) {
  const q = run.q;
  if (run.answered) return;
  const right = k === q.kind;
  mark(btn, right);
  $(`#g-answers .th-basket[data-k="${q.kind}"]`).classList.add('is-answer');
  score(right, [q.why]);
  extra(koBox(q.ko), q.kind === 'conj' ? sentenceBlock(q.s) : null);
}

/* 4단계: 생각 말풍선 */
function q4(q) {
  setQ('우리말 뜻에 맞는 영어 문장을 골라 보세요.');
  board(el('div', { class: 'th-bubble' }, el('span', { class: 'th-ko-label', text: '생각' }), el('span', { class: 'th-ko-text', text: q.s.ko })));
  $('#g-answers').replaceChildren(el('div', { class: 'pz-choices th-choices', role: 'group', 'aria-label': '영어 문장 고르기' },
    q.options.map((o, k) => {
      const b = el('button', { type: 'button', class: 'pz-opt', 'data-k': String(k) }, el('span', { class: 'pz-opt-n', 'aria-hidden': 'true', text: MARKS[k] }), en(o.en));
      b.addEventListener('click', () => s4(k, b));
      return b;
    })));
}
function s4(k, btn) {
  const q = run.q;
  if (run.answered) return;
  const right = k === q.answer;
  mark(btn, right);
  $(`#g-answers .pz-opt[data-k="${q.answer}"]`).classList.add('is-answer');
  const chosen = q.options[k];
  score(right, [right ? '우리말 뜻과 꼭 맞는 문장이에요.' : chosen.note]);
  extra(sentenceBlock(q.s),
    el('div', { class: 'th-notes' }, el('p', { class: 'th-answer-cap', text: '다른 문장이 틀린 까닭' }),
      el('ul', {}, q.options.filter((o, j) => j !== q.answer).map((o) => el('li', {}, en(o.en, 'bad'), el('span', { text: o.note }))))));
}

/* 5단계: 틀린 곳 찾기 */
function q5(q) {
  setQ('문장에서 틀린 단어 하나를 찾아 눌러 보세요.');
  board(koBox(q.s.ko));
  $('#g-answers').replaceChildren(el('div', { class: 'th-words', role: 'group', 'aria-label': '틀린 단어 고르기' },
    q.words.map((w, i) => {
      const b = el('button', { type: 'button', class: 'th-word', 'data-i': String(i), lang: 'en', text: w });
      b.addEventListener('click', () => s5(i, b));
      return b;
    }), el('span', { class: 'th-gw', text: '.' })),
  el('p', { class: 'g-hint', text: '틀린 단어는 딱 하나예요.' }));
}
function s5(i, btn) {
  const q = run.q;
  if (run.answered) return;
  const right = i === q.at;
  mark(btn, right);
  const t = $(`#g-answers .th-word[data-i="${q.at}"]`);
  t.classList.add('is-answer');
  t.replaceChildren(el('s', { text: q.words[q.at] }), el('span', { 'aria-hidden': 'true', text: ' → ' }), el('strong', { text: q.fix }));
  t.setAttribute('aria-label', `틀린 단어 ${q.words[q.at]}, 바르게 고치면 ${q.fix}`);
  score(right, [['바르게 고치면 ', en(q.words[q.at], 'bad'), ' → ', en(q.fix)], q.why]);
  extra(sentenceBlock(q.s));
}

/* ── 채점 ── */
const PRAISE = ['정답이에요!', '맞았어요!', '잘했어요!', '훌륭해요!'];
function score(right, whys) {
  run.answered = true;
  if (right) { run.correct += 1; run.streak += 1; run.bestStreak = Math.max(run.bestStreak, run.streak); } else run.streak = 0;
  document.querySelectorAll('#g-answers button, #g-board button').forEach((b) => { b.disabled = true; });
  document.querySelectorAll('#th-check, #g-answers .g-hint').forEach((x) => { x.hidden = true; });
  const last = run.i >= PER_STAGE;
  const nextBtn = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'g-next', text: last ? '결과 보기' : '다음 문제 →' });
  nextBtn.addEventListener('click', () => (last ? finish() : nextQuestion()));
  $('#g-feedback').replaceChildren(
    el('p', { class: 'g-verdict ' + (right ? 'ok' : 'bad') },
      el('span', { 'aria-hidden': 'true', text: right ? '✔ ' : '✘ ' }),
      right ? PRAISE[run.i % PRAISE.length] : '아쉬워요.',
      right && run.streak >= 3 ? el('span', { class: 'g-streak', text: ` ${run.streak}문제 연속 정답!` }) : null),
    ...whys.filter(Boolean).map((w) => el('p', { class: 'g-why' }, w)),
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
  const msg = run.correct === PER_STAGE ? '모두 맞혔어요! 정말 대단해요.' : run.correct >= 8 ? '아주 잘했어요! 조금만 더 하면 별 3개예요.' : run.correct >= 5 ? '좋아요! 틀린 문제의 설명을 다시 보고 한 번 더 해 봐요.' : '괜찮아요. 아래 팁을 보고 한 번 더 해 봐요.';
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
