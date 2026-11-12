// 학습 보조 → 입체 공방 (중1 원기둥·원뿔·구를 혼자 단련하는 게임, 대결 없음)
// 7단계 × 10문제. 숫자를 바꿔 가며 문제를 새로 만들고, 답은 π를 그대로 써요. 별과 최고 기록은 이 기기의 브라우저에 저장하고, 끝까지 푼 판은 선생님이 볼 수 있게 학원 서버에도 기록해요(learn-log.js).
import * as be from './backend.js';
import { el } from './common.js';
import { loadRecord, saveRecord, totalStars } from './learn-records.js';
import { checkBuiltin } from './learn-access.js';
import { setPlayer, logPlay } from './learn-log.js';
import { makeQuestion, partRight, SOLIDS, FIG_NAMES } from './solid.js';
import { S, solidSVG, figSVG, spinView, sectionSVG, netSVG } from './solid-draw.js';

const $ = (s) => document.querySelector(s);
const GAME = 'solid-lab';
const PER_STAGE = 10;
const STAGES = [
  { n: 1, name: '회전체 공장', desc: '평면도형을 돌리면 어떤 입체가 될지, 입체는 어떤 도형을 돌린 것인지 찾아요.', tip: '회전축에 붙은 변은 입체의 가운데 축이 되고, 축에서 떨어진 부분은 원을 그리며 돌아요.' },
  { n: 2, name: '단면 자르기', desc: '회전체를 자른 단면의 모양과 넓이를 구해요.', tip: '회전축을 품은 평면으로 자르면 처음 평면도형을 좌우로 붙인 모양, 축에 수직인 평면으로 자르면 원이 나와요.' },
  { n: 3, name: '전개도 펼치기', desc: '원기둥·원뿔의 전개도에서 길이와 중심각을 구해요.', tip: '옆면을 말면 밑면의 둘레와 꼭 맞아요. 원뿔은 (부채꼴의 호) = (밑면의 둘레)라서 중심각 = 360° × (밑면의 반지름) ÷ (모선의 길이)예요.' },
  { n: 4, name: '겉넓이·부피', desc: '원기둥·원뿔·구·반구의 겉넓이와 부피를 구해요.', tip: '원뿔의 부피는 원기둥의 ⅓, 원뿔의 옆넓이에는 모선을 써요. 반구의 겉넓이에는 잘린 면(원)을 꼭 더해요.' },
  { n: 5, name: '합체 입체', desc: '붙이거나 파낸 입체의 겉넓이와 부피를 구해요.', tip: '부피는 더하거나 빼면 되지만, 겉넓이는 맞붙어 가려진 면을 빼고 새로 드러난 면을 더해요.' },
  { n: 6, name: '1 : 2 : 3의 비밀', desc: '구가 꼭 맞게 들어가는 원기둥과 원뿔의 부피 관계를 익혀요.', tip: '원기둥에 꼭 맞는 원뿔 : 구 : 원기둥의 부피의 비는 1 : 2 : 3이에요.' },
  { n: 7, name: '물통 채우기', bonus: true, desc: '그릇의 물을 옮겨 담는 이야기 문제를 부피로 풀어요.', tip: '옮겨 담아도 물의 부피는 그대로예요. 부피끼리 나누면 π는 약분돼서 사라져요.' }
];
const STAGE_Q = {
  1: (q) => (q.kind === 'fwd' ? '평면도형을 회전축으로 한 바퀴 돌려 보세요.' : '어떤 평면도형을 돌려서 만든 입체일까요?'),
  2: (q) => (q.cut === 'contain' ? '회전축을 품은 평면으로 잘라 보세요.' : '회전축에 수직인 평면으로 잘라 보세요.'),
  3: () => '전개도를 보고 답해 보세요.', 4: () => '답은 π를 그대로 써요.', 5: () => '붙이거나 파낸 입체예요. 답은 π를 그대로 써요.',
  6: () => '구가 꼭 맞게 들어가는 원기둥, 그리고 같은 밑면·높이의 원뿔이에요.', 7: () => '물을 옮겨 담아 보세요.'
};
const TEST = (() => { try { return localStorage.getItem('abel-test-hook') === '1'; } catch { return false; } })();
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let uid = null;
let rec = { stages: {} };
let run = null;

/* ── 작은 도구 ── */
function timeText(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m}분 ${String(s).padStart(2, '0')}초` : `${s}초`; }
const starsOf = (c) => (c >= 10 ? 3 : c >= 8 ? 2 : c >= 5 ? 1 : 0);
function starLine(n, max = 3) {
  return el('span', { class: 'g-stars', role: 'img', 'aria-label': `별 ${max}개 중 ${n}개` }, ...Array.from({ length: max }, (_, i) => el('span', { class: i < n ? 'on' : 'off', 'aria-hidden': 'true', text: '★' })));
}
function show(which) { $('#g-status').hidden = which !== 'status'; $('#g-gate').hidden = which !== 'gate'; $('#g-app').hidden = which !== 'app'; }
function screen(which) { ['menu', 'play', 'result'].forEach((w) => { $('#g-' + w).hidden = w !== which; }); }
// '32/3π cm³' → 분수는 위아래로. 읽는 사람을 위해 '3분의 32'도 숨겨 둬요
function mathText(text) {
  return String(text).split(/(\d+\/\d+)/).filter((x) => x !== '').map((x) => {
    const m = x.match(/^(\d+)\/(\d+)$/);
    if (!m) return x;
    return el('span', { class: 'sd-frac' }, el('span', { class: 'pz-sr', text: `${m[2]}분의 ${m[1]} ` }), el('span', { class: 'sd-num', 'aria-hidden': 'true', text: m[1] }), el('span', { class: 'sd-den', 'aria-hidden': 'true', text: m[2] }));
  });
}
function extra(...kids) { const box = $('#g-extra'); box.replaceChildren(...kids.filter(Boolean)); box.hidden = !box.childNodes.length; }

/* ── 단계 고르기 ── */
function renderMenu() {
  const st = rec.stages || {};
  $('#g-sum').replaceChildren(
    el('div', { class: 'g-sum-main' }, el('span', { class: 'g-sum-label', text: '모은 별' }), el('strong', { text: `${totalStars(rec)} / ${STAGES.length * 3}` })),
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
        el('p', { class: 'g-stage-rec' }, r ? [starLine(r.stars || 0), ` 최고 ${r.best}/${PER_STAGE} · ${timeText(r.time)} · ${r.plays}번 연습`] : '아직 연습하지 않았어요')),
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
  run.sel = {};
  if (TEST) window.__solidQ = run.q;
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

// 문제 위쪽 그림
function boardFor(q) {
  const sh = q.show;
  const box = (...kids) => el('div', { class: 'sd-board' }, kids);
  if (q.stage === 1) {
    if (q.kind === 'fwd') return box(figSVG(sh.fig, { label: FIG_NAMES[sh.fig.t] }));
    return box(solidSVG(sh.solid, { label: sh.name }), el('p', { class: 'sd-cap', text: sh.name }));
  }
  if (q.stage === 2) return box(solidSVG(sh.solid, { labels: true, cut: sh.cut, label: `${SOLIDS[q.key]}과 자르는 평면` }),
    el('p', { class: 'sd-cap', text: `${SOLIDS[q.key]} · ${sh.cut === 'contain' ? '회전축을 품은 평면' : '회전축에 수직인 평면'}(파란 면)으로 자르기` }));
  if (q.stage === 3) return box(netSVG({ ...sh.net, ask: sh.ask }), el('div', { class: 'sd-mini' }, solidSVG(sh.net.k === 'cyl' ? { k: 'cyl', r: sh.net.r, h: sh.net.h } : { k: 'cone', r: sh.net.r, h: Math.sqrt(sh.net.l ** 2 - sh.net.r ** 2) }, { w: 140, h: 130, label: sh.net.k === 'cyl' ? '원기둥' : '원뿔' })));
  if (q.stage === 4 || q.stage === 5) return box(solidSVG(sh.solid, { labels: true, label: sh.name || SOLIDS[sh.solid.k] || '입체' }), sh.name ? el('p', { class: 'sd-cap', text: sh.name }) : null);
  if (q.stage === 6) return box(solidSVG({ k: 'trio', r: sh.trio.r }, { labels: true, trioR: q.kind === 'fromR', label: '원기둥 안에 꼭 맞는 구와 원뿔' }),
    el('p', { class: 'sd-cap' }, el('span', { class: 'sd-key ball', text: '구' }), ' ', el('span', { class: 'sd-key cone', text: '원뿔' }), ' 원기둥 안에 꼭 맞게 들어 있어요'));
  if (q.stage === 7) return box(el('div', { class: 'sd-pour' }, solidSVG(sh.pour[0], { labels: true, w: 200, h: 170, label: '옮겨 담을 그릇' }), el('span', { class: 'sd-arrow', 'aria-hidden': 'true', text: '→' }), solidSVG(sh.pour[1], { labels: true, w: 200, h: 170, label: '받을 그릇' })));
  return null;
}

function renderQuestion() {
  const q = run.q;
  renderCounts();
  $('#g-q').textContent = STAGE_Q[q.stage](q);
  $('#g-feedback').replaceChildren();
  extra();
  $('#g-board').replaceChildren(boardFor(q));
  const check = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'sd-check', text: '확인하기', disabled: true });
  check.addEventListener('click', grade);
  $('#g-answers').replaceChildren(el('div', { class: 'kg-parts' }, q.parts.map((p, i) => partBlock(p, i, q.parts.length))), check);
}
function partBlock(p, i, n) {
  const head = el('p', { class: 'kg-part-label', id: `sd-l-${p.key}` }, n > 1 ? el('span', { class: 'kg-part-n', 'aria-hidden': 'true', text: String(i + 1) }) : null, el('span', { text: p.label }));
  let body;
  if (p.type === 'fig') {
    body = el('div', { class: 'sd-figs', role: 'group', 'aria-labelledby': `sd-l-${p.key}` }, p.options.map((f) => {
      const b = el('button', { type: 'button', class: 'sd-figbtn', 'data-v': f.t, 'aria-pressed': 'false', 'aria-label': FIG_NAMES[f.t] }, figSVG(f, { small: true }));
      b.addEventListener('click', () => pick(p, f.t));
      return b;
    }));
  } else {
    body = el('div', { class: 'kg-chips', role: 'group', 'aria-labelledby': `sd-l-${p.key}` }, p.options.map((o) => {
      const c = el('button', { type: 'button', class: 'kg-chip sd-chip', 'data-v': o, 'aria-pressed': 'false' }, mathText(o));
      c.addEventListener('click', () => pick(p, o));
      return c;
    }));
  }
  return el('div', { class: 'kg-part', 'data-part': p.key }, head, body);
}
function pick(p, v) {
  if (run.answered) return;
  run.sel[p.key] = v;
  $(`#g-answers .kg-part[data-part="${p.key}"]`).querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  $('#sd-check').disabled = !run.q.parts.every((x) => run.sel[x.key] != null);
}

function afterVisual(q) {
  if (q.stage === 1) {
    const f = q.after.fig;
    return el('div', { class: 'sd-after' }, el('p', { class: 'kg-cap', text: '돌려서 확인하기' }),
      el('div', { class: 'sd-after-row' }, spinView(f, reduceMotion()), solidSVG(q.after.solid || q.show.solid, { w: 200, h: 180, label: SOLIDS[q.key] })),
      el('p', { class: 'sd-cap', text: `${FIG_NAMES[f.t]} → ${SOLIDS[q.key]}` }));
  }
  if (q.stage === 2) return el('div', { class: 'sd-after' }, el('p', { class: 'kg-cap', text: '단면' }), sectionSVG(q.show.solid, q.show.cut));
  if (q.stage === 6) return pourDemo();
  return null;
}
// 원뿔 한 번(⅓), 구 한 번(⅔)을 부으면 원기둥이 가득 차요
function pourDemo() {
  const W = 220, H = 200, x0 = 60, x1 = 160, yb = 175, yt = 25;
  const water = S('rect', { x: x0, y: yb, width: x1 - x0, height: 0, class: 'water' });
  const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sd-svg pour-svg', role: 'img', 'aria-label': '원기둥 물통' },
    water, S('rect', { x: x0, y: yt, width: x1 - x0, height: yb - yt, class: 'jar' }),
    S('line', { x1: x0 - 6, y1: yb - (yb - yt) / 3, x2: x0, y2: yb - (yb - yt) / 3, class: 'lh' }), S('text', { x: x0 - 9, y: yb - (yb - yt) / 3 + 4, class: 'lt end' }, '⅓'),
    S('line', { x1: x0 - 6, y1: yb - ((yb - yt) * 2) / 3, x2: x0, y2: yb - ((yb - yt) * 2) / 3, class: 'lh' }), S('text', { x: x0 - 9, y: yb - ((yb - yt) * 2) / 3 + 4, class: 'lt end' }, '⅔'));
  let level = 0;
  const out = el('p', { class: 'pz-readout', 'aria-live': 'polite', text: '원기둥 물통이 비어 있어요.' });
  const set = (v, msg) => { level = Math.min(1, v); const h = (yb - yt) * level; water.setAttribute('y', String(yb - h)); water.setAttribute('height', String(h)); out.textContent = msg; };
  const b1 = el('button', { type: 'button', class: 'btn-line btn-sm', text: '원뿔 하나만큼 붓기' });
  const b2 = el('button', { type: 'button', class: 'btn-line btn-sm', text: '구 하나만큼 붓기' });
  const b0 = el('button', { type: 'button', class: 'btn-line btn-sm', text: '비우기' });
  b1.addEventListener('click', () => set(level + 1 / 3, level + 1 / 3 >= 0.999 ? '가득 찼어요!' : `원뿔 하나는 원기둥의 ⅓이에요.`));
  b2.addEventListener('click', () => set(level + 2 / 3, level + 2 / 3 >= 0.999 ? '가득 찼어요! 원뿔 + 구 = 원기둥' : '구 하나는 원기둥의 ⅔예요.'));
  b0.addEventListener('click', () => set(0, '원기둥 물통이 비어 있어요.'));
  return el('div', { class: 'sd-after' }, el('p', { class: 'kg-cap', text: '물 부어 보기' }), svg, el('div', { class: 'g-actions' }, b1, b2, b0), out);
}

function grade() {
  const q = run.q;
  if (run.answered) return;
  const results = q.parts.map((p) => partRight(p, run.sel[p.key]));
  const right = results.every(Boolean);
  q.parts.forEach((p, i) => {
    const box = $(`#g-answers .kg-part[data-part="${p.key}"]`);
    box.querySelectorAll('[data-v]').forEach((b) => {
      const isAns = b.dataset.v === p.answer, chosen = b.dataset.v === run.sel[p.key];
      if (chosen) b.classList.add(isAns ? 'is-right' : 'is-wrong');
      else if (isAns) b.classList.add('is-answer');
    });
    box.classList.add(results[i] ? 'ok' : 'bad');
    box.querySelector('.kg-part-label').append(el('span', { class: 'kg-res ' + (results[i] ? 'ok' : 'bad'), text: results[i] ? ' ✔ 맞았어요' : ' ✘ 틀렸어요' }));
    if (!results[i]) box.append(el('p', { class: 'kg-ans' }, '정답: ', el('strong', {}, p.type === 'fig' ? FIG_NAMES[p.answer] : mathText(p.answer))));
  });
  extra(afterVisual(q));
  score(right, q);
}

/* ── 채점 ── */
const PRAISE = ['정답이에요!', '맞았어요!', '잘했어요!', '훌륭해요!'];
function score(right, q) {
  run.answered = true;
  if (right) { run.correct += 1; run.streak += 1; run.bestStreak = Math.max(run.bestStreak, run.streak); } else run.streak = 0;
  document.querySelectorAll('#g-answers button').forEach((b) => { b.disabled = true; });
  $('#sd-check').hidden = true;
  const last = run.i >= PER_STAGE;
  const nextBtn = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'g-next', text: last ? '결과 보기' : '다음 문제 →' });
  nextBtn.addEventListener('click', () => (last ? finish() : nextQuestion()));
  const wrongN = q.parts.filter((p) => !partRight(p, run.sel[p.key])).length;
  $('#g-feedback').replaceChildren(
    el('p', { class: 'g-verdict ' + (right ? 'ok' : 'bad') }, el('span', { 'aria-hidden': 'true', text: right ? '✔ ' : '✘ ' }),
      right ? PRAISE[run.i % PRAISE.length] : (q.parts.length > 1 ? `아쉬워요. 물음 ${q.parts.length}개 중 ${wrongN}개가 틀렸어요.` : '아쉬워요.'),
      right && run.streak >= 3 ? el('span', { class: 'g-streak', text: ` ${run.streak}문제 연속 정답!` }) : null),
    el('p', { class: 'g-why' }, mathText(q.why)),
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
  const msg = run.correct === PER_STAGE ? '모두 맞혔어요! 입체 박사예요.' : run.correct >= 8 ? '아주 잘했어요! 조금만 더 하면 별 3개예요.' : run.correct >= 5 ? '좋아요! 틀린 문제의 설명을 다시 보고 한 번 더 해 봐요.' : '괜찮아요. 아래 팁과 공식 정리를 보고 한 번 더 해 봐요.';
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
