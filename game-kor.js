// 학습 보조 → 문법 실험실 (고1·고2 화법과 언어의 언어 단원을 혼자 단련하는 게임, 대결 없음)
// 7단계 × 10문제. 확인한 문제 묶음에서 한 판에 10문제씩 섞어 내요. 별과 최고 기록은 이 기기의 브라우저에만 저장해요.
import * as be from './backend.js';
import { el } from './common.js';
import { loadRecord, saveRecord, totalStars } from './learn-records.js';
import { checkBuiltin } from './learn-access.js';
import { makeRound, partRight } from './kor-grammar.js';

const $ = (s) => document.querySelector(s);
const GAME = 'kor-grammar';
const PER_STAGE = 10;
const STAGES = [
  { n: 1, name: '발음 해부실', desc: '표준 발음, 일어난 음운 변동, 음운 개수의 변화를 한 번에 맞혀요.', q: '이 단어를 소리 내어 보고, 세 가지를 모두 맞혀 보세요.', tip: '변동을 하나씩 따라가요. 교체는 음운 개수가 그대로, 탈락·축약은 하나 줄고, 첨가는 하나 늘어요.' },
  { n: 2, name: '단어 설계도', desc: '단어를 처음 둘로 나누는 자리를 찾고, 파생어·합성어를 가려요.', q: '단어를 처음 둘로 나누는 자리를 찾고, 짜임을 골라 보세요.', tip: '처음 둘로 나눌 때 접사가 나오면 파생어, 어근끼리면 합성어예요. 안쪽에 숨은 파생·합성에 속지 마세요.' },
  { n: 3, name: '의미 관계 그물', desc: '반의어의 종류와, 다의어·동음이의어를 가려요.', q: '두 말의 의미 관계를 따져 보세요.', tip: '둘 다 부정할 수 있으면 정도 반의어예요. 뜻이 서로 이어지면 다의어, 소리만 같으면 동음이의어예요.' },
  { n: 4, name: '품사 감별사', desc: '모양은 같지만 품사가 다른 말을 짝으로 가려요.', q: 'ㄱ과 ㄴ에서 표시한 말의 품사를 각각 골라 보세요.', tip: '체언에 붙으면 조사, 관형어 뒤에 띄어 쓰면 의존 명사예요. ‘-ㄴ다/-는다’가 붙거나 명령문이 되면 동사예요.' },
  { n: 5, name: '문장 구조 엑스레이', desc: '겹문장에서 안긴문장을 찾고 종류를 가려요.', q: '안긴문장을 찾아 종류를 골라 보세요.', tip: '안긴문장의 서술어를 먼저 찾고 그 어미를 보세요: -음/-기(명사절), -은/-는/-을(관형절), -이/-게/-도록(부사절), -다고/-라고(인용절).' },
  { n: 6, name: '문법 요소 조종실', desc: '높임, 시제, 피동·사동을 분석해요.', q: '문장의 문법 요소를 분석해 보세요.', tip: '주체 높임은 ‘-시-·께서’, 객체 높임은 ‘드리다·모시다·뵙다·께’, 상대 높임은 문장 끝 어미로 확인해요.' },
  { n: 7, name: '중세 국어 해독실', desc: '15세기 국어 자료를 읽고 지금과 다른 점을 찾아요.', q: '15세기 국어 자료를 읽고 물음에 답해 보세요.', tip: '이어 적기, 주격 조사 ‘ㅣ’, 어두 자음군, 지금은 쓰지 않는 글자, 뜻이 달라진 단어를 기억해요.' }
];
const TEST = (() => { try { return localStorage.getItem('abel-test-hook') === '1'; } catch { return false; } })();
const OLD_WORD = /[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF]/; // 옛한글 자모로 쓴 낱말
const OLD_CH = /([\u3164-\u318E]+)/; // 설명 속 ㆍ·ㅸ·ㆁ 같은 옛 글자

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
// 옛한글 자모로 쓴 낱말은 통째로, 설명 속 옛 글자(ㆍ·ㅸ 등)는 그 글자만 옛한글 글꼴로
function yet(text) {
  return String(text).split(/(\s+)/).filter((w) => w !== '').flatMap((w) => {
    if (OLD_WORD.test(w)) return [el('span', { class: 'yet', text: w })];
    return w.split(OLD_CH).filter((x) => x !== '').map((x) => (/^[\u3164-\u318E]+$/.test(x) ? el('span', { class: 'yet', text: x }) : x));
  });
}
// '넘어져서 [다리]를 다쳤다.' → [표시] 부분을 강조
function marked(text) {
  return String(text).split(/(\[[^\]]+\])/).filter(Boolean).map((t) => (t.startsWith('[') ? el('mark', { class: 'kg-mark', text: t.slice(1, -1) }) : t));
}

/* ── 단계 고르기 화면 ── */
function renderMenu() {
  const st = rec.stages || {};
  $('#g-sum').replaceChildren(
    el('div', { class: 'g-sum-main' }, el('span', { class: 'g-sum-label', text: '모은 별' }), el('strong', { text: `${totalStars(rec)} / ${STAGES.length * 3}` })),
    el('p', { text: '단계마다 10문제예요. 한 문제 안의 물음을 모두 맞혀야 정답이에요. 10문제를 모두 맞히면 별 3개, 8문제 이상 별 2개, 5문제 이상 별 1개를 받아요.' }));
  $('#g-stages').replaceChildren(...STAGES.map((s) => {
    const r = st[s.n];
    const btn = el('button', { type: 'button', class: 'btn-primary btn-sm', 'data-stage': String(s.n), text: r ? '다시 하기' : '시작하기', 'aria-label': `${s.n}단계 ${s.name} ${r ? '다시 하기' : '시작하기'}` });
    btn.addEventListener('click', () => startStage(s.n));
    return el('li', { class: 'g-stage' },
      el('span', { class: 'g-stage-n', 'aria-hidden': 'true', text: String(s.n) }),
      el('div', { class: 'g-stage-body' },
        el('h3', {}, `${s.n}단계 · ${s.name}`),
        el('p', { text: s.desc }),
        el('p', { class: 'g-stage-rec' }, r ? [starLine(r.stars || 0), ` 최고 ${r.best}/${PER_STAGE} · ${timeText(r.time)} · ${r.plays}번 연습`] : '아직 연습하지 않았어요')),
      btn);
  }));
  screen('menu');
}

/* ── 문제 풀기 ── */
function startStage(n) {
  run = { stage: n, i: 0, correct: 0, streak: 0, bestStreak: 0, list: makeRound(n), q: null, answered: false, started: Date.now() };
  screen('play');
  nextQuestion();
}
function nextQuestion() {
  run.q = run.list[run.i];
  run.i += 1;
  run.answered = false;
  run.sel = {};
  if (TEST) window.__korQ = run.q;
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
function extra(...kids) {
  const box = $('#g-extra');
  box.replaceChildren(...kids.filter(Boolean));
  box.hidden = !box.childNodes.length;
}

// 문제 위쪽: 단계마다 보여 주는 것
function boardFor(q) {
  const sh = q.show;
  if (sh.word) return el('div', { class: 'kg-word' }, el('span', { class: 'kg-word-cap', text: '단어' }), el('strong', { text: sh.word }));
  if (sh.ant) return el('div', { class: 'kg-word' }, el('span', { class: 'kg-word-cap', text: '두 단어' }), el('strong', {}, sh.ant[0], el('span', { class: 'kg-arrow', 'aria-label': '와', text: ' ↔ ' }), sh.ant[1]));
  if (sh.poly || sh.pair) {
    const ss = sh.poly ? sh.poly.s : sh.pair;
    return el('div', { class: 'kg-sents' }, sh.cap ? el('p', { class: 'kg-cap', text: sh.cap }) : null,
      ss.map((s, i) => el('p', { class: 'kg-sent' }, el('span', { class: 'kg-sent-n', text: i ? 'ㄴ' : 'ㄱ' }), el('span', {}, marked(s)))));
  }
  if (sh.sent) return el('div', { class: 'kg-sents' }, el('p', { class: 'kg-cap', text: sh.cap }), el('p', { class: 'kg-sent one' }, el('span', {}, marked(sh.sent))));
  if (sh.old) {
    const t = sh.old.text, at = t.indexOf(sh.hl);
    return el('figure', { class: 'kg-old' },
      el('blockquote', { class: 'yet kg-old-text', lang: 'okm' }, t.slice(0, at), el('u', { class: 'kg-hl', text: sh.hl }), t.slice(at + sh.hl.length)),
      el('figcaption', {}, sh.old.src, el('span', { class: 'kg-old-note', text: ' · 방점은 빼고 적었어요' })));
  }
  return null;
}

function renderQuestion() {
  const q = run.q;
  renderCounts();
  $('#g-q').textContent = STAGES[q.stage - 1].q;
  $('#g-feedback').replaceChildren();
  extra();
  const b = boardFor(q);
  $('#g-board').replaceChildren(...(b ? [b] : []));
  const check = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'kg-check', text: '확인하기', disabled: true });
  check.addEventListener('click', grade);
  $('#g-answers').replaceChildren(el('div', { class: 'kg-parts' }, q.parts.map((p, i) => partBlock(p, i, q.parts.length))), check);
}

// 물음 하나 (보기 고르기 · 여러 개 고르기 · 나누는 자리 · 어절 고르기)
function partBlock(p, i, n) {
  const head = el('p', { class: 'kg-part-label', id: `kg-l-${p.key}` }, n > 1 ? el('span', { class: 'kg-part-n', 'aria-hidden': 'true', text: String(i + 1) }) : null, el('span', { text: p.label }));
  let body;
  if (p.type === 'one' || p.type === 'many') {
    body = el('div', { class: 'kg-chips' + (p.options.length > 6 ? ' dense' : ''), role: 'group', 'aria-labelledby': `kg-l-${p.key}` },
      p.options.map((o) => {
        const c = el('button', { type: 'button', class: 'kg-chip', 'data-v': o, 'aria-pressed': 'false' }, yet(o));
        c.addEventListener('click', () => pick(p, o));
        return c;
      }));
  } else if (p.type === 'cut') {
    const syl = [...p.word], last = syl.length - p.tail - 1;
    const row = [];
    syl.forEach((s, k) => {
      row.push(el('span', { class: 'kg-syl' + (k > last ? ' tail' : ''), 'aria-hidden': 'true', text: s }));
      if (k < last) {
        const c = el('button', { type: 'button', class: 'kg-cut', 'data-v': String(k + 1), 'aria-pressed': 'false', 'aria-label': `${syl.slice(0, k + 1).join('')} | ${syl.slice(k + 1).join('')} (여기서 자르기)` }, el('span', { 'aria-hidden': 'true', text: '✂' }));
        c.addEventListener('click', () => pick(p, k + 1));
        row.push(c);
      }
    });
    const none = el('button', { type: 'button', class: 'kg-chip kg-nocut', 'data-v': '0', 'aria-pressed': 'false', text: '나누지 않음 (단일어)' });
    none.addEventListener('click', () => pick(p, 0));
    body = el('div', { class: 'kg-cutbox', role: 'group', 'aria-labelledby': `kg-l-${p.key}` }, el('div', { class: 'kg-cutrow' }, row), none,
      p.tail ? el('p', { class: 'kg-hint', text: '흐린 ‘다’는 어미라서 나누지 않아요.' }) : null);
  } else {
    body = el('div', { class: 'kg-words', role: 'group', 'aria-labelledby': `kg-l-${p.key}` },
      p.words.map((w, k) => {
        const c = el('button', { type: 'button', class: 'kg-word-btn', 'data-v': String(k), 'aria-pressed': 'false', text: w });
        c.addEventListener('click', () => pick(p, k));
        return c;
      }));
  }
  return el('div', { class: 'kg-part', 'data-part': p.key }, head, body);
}
function pick(p, v) {
  if (run.answered) return;
  if (p.type === 'many' || p.type === 'span') {
    const cur = new Set(run.sel[p.key] || []);
    if (cur.has(v)) cur.delete(v); else cur.add(v);
    run.sel[p.key] = [...cur];
  } else run.sel[p.key] = v;
  const box = $(`#g-answers .kg-part[data-part="${p.key}"]`);
  box.querySelectorAll('[data-v]').forEach((b) => {
    const val = p.type === 'one' || p.type === 'many' ? b.dataset.v : Number(b.dataset.v);
    const on = p.type === 'many' || p.type === 'span' ? run.sel[p.key].includes(val) : run.sel[p.key] === val;
    b.setAttribute('aria-pressed', String(on));
  });
  $('#kg-check').disabled = !run.q.parts.every((x) => (x.type === 'many' || x.type === 'span' ? (run.sel[x.key] || []).length : run.sel[x.key] != null));
}
const answerText = (p) => (p.type === 'cut' ? (p.answer ? `${[...p.word].slice(0, p.answer).join('')} | ${[...p.word].slice(p.answer).join('')}` : '나누지 않음 (단일어)')
  : p.type === 'span' ? p.answer.map((k) => p.words[k]).join(' ')
    : p.type === 'many' ? p.answer.join(', ') : p.answer);

function grade() {
  const q = run.q;
  if (run.answered) return;
  const results = q.parts.map((p) => partRight(p, run.sel[p.key]));
  const right = results.every(Boolean);
  q.parts.forEach((p, i) => {
    const box = $(`#g-answers .kg-part[data-part="${p.key}"]`);
    const sel = run.sel[p.key];
    box.querySelectorAll('[data-v]').forEach((b) => {
      const val = p.type === 'one' || p.type === 'many' ? b.dataset.v : Number(b.dataset.v);
      const isAns = p.type === 'many' || p.type === 'span' ? p.answer.includes(val) : p.answer === val;
      const chosen = p.type === 'many' || p.type === 'span' ? sel.includes(val) : sel === val;
      if (chosen) b.classList.add(isAns ? 'is-right' : 'is-wrong');
      else if (isAns) b.classList.add('is-answer');
    });
    box.classList.add(results[i] ? 'ok' : 'bad');
    box.querySelector('.kg-part-label').append(el('span', { class: 'kg-res ' + (results[i] ? 'ok' : 'bad'), text: results[i] ? ' ✔ 맞았어요' : ' ✘ 틀렸어요' }));
    if (!results[i]) box.append(el('p', { class: 'kg-ans' }, '정답: ', el('strong', {}, yet(answerText(p)))));
  });
  if (q.stage === 7) extra(el('div', { class: 'kg-modern' }, el('p', { class: 'kg-cap', text: '현대어 풀이' }), el('p', { text: q.show.old.mod })));
  score(right, q);
}

/* ── 채점 ── */
const PRAISE = ['정답이에요!', '맞았어요!', '잘했어요!', '훌륭해요!'];
function score(right, q) {
  run.answered = true;
  if (right) { run.correct += 1; run.streak += 1; run.bestStreak = Math.max(run.bestStreak, run.streak); } else run.streak = 0;
  document.querySelectorAll('#g-answers button').forEach((b) => { b.disabled = true; });
  $('#kg-check').hidden = true;
  const last = run.i >= PER_STAGE;
  const nextBtn = el('button', { type: 'button', class: 'btn-primary btn-sm', id: 'g-next', text: last ? '결과 보기' : '다음 문제 →' });
  nextBtn.addEventListener('click', () => (last ? finish() : nextQuestion()));
  const wrongN = q.parts.filter((p) => !partRight(p, run.sel[p.key])).length;
  $('#g-feedback').replaceChildren(
    el('p', { class: 'g-verdict ' + (right ? 'ok' : 'bad') },
      el('span', { 'aria-hidden': 'true', text: right ? '✔ ' : '✘ ' }),
      right ? PRAISE[run.i % PRAISE.length] : (q.parts.length > 1 ? `아쉬워요. 물음 ${q.parts.length}개 중 ${wrongN}개가 틀렸어요.` : '아쉬워요.'),
      right && run.streak >= 3 ? el('span', { class: 'g-streak', text: ` ${run.streak}문제 연속 정답!` }) : null),
    el('p', { class: 'g-why' }, yet(q.why)),
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
  const msg = run.correct === PER_STAGE ? '모두 맞혔어요! 문법 박사예요.' : run.correct >= 8 ? '아주 잘했어요! 조금만 더 하면 별 3개예요.' : run.correct >= 5 ? '좋아요! 틀린 문제의 설명을 다시 읽어 보고 한 번 더 해 봐요.' : '괜찮아요. 아래 팁과 알아 두기를 보고 한 번 더 해 봐요.';
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
