// that 연결 기차: 문제 만들기 (화면과 상관없는 부분)
// 초6 수준 단어로 'I think that she is smart.' 같은 문장과 우리말 뜻을 함께 만들어요.
// 1 문장 기차 · 2 that 자리 찾기 · 3 어떤 that일까? · 4 생각 말풍선 · 5 틀린 곳 찾기

const pick = (a, r) => a[Math.floor(r() * a.length)];
export function shuffle(a, r = Math.random) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
// 받침이 있으면 true (조사 고르기)
export function hasBatchim(word) {
  const ch = String(word).trim().slice(-1);
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

/* ── 앞 문장: 누가 + 생각해/알아/믿어/바라 ── */
export const SUBJECTS = [
  { id: 'i', en: ['I'], ko: '나는', three: false },
  { id: 'we', en: ['We'], ko: '우리는', three: false },
  { id: 'you', en: ['You'], ko: '너는', three: false },
  { id: 'mina', en: ['Mina'], ko: '미나는', three: true },
  { id: 'tom', en: ['Tom'], ko: '톰은', three: true },
  { id: 'mom', en: ['My', 'mom'], ko: '엄마는', three: true },
  { id: 'dad', en: ['My', 'dad'], ko: '아빠는', three: true },
  { id: 'he', en: ['He'], ko: '그는', three: true },
  { id: 'she', en: ['She'], ko: '그녀는', three: true }
];
export const VERBS = [
  { base: 'think', s: 'thinks', mean: '생각하다', ko: (c) => `${c.kq}고 생각해` },
  { base: 'know', s: 'knows', mean: '알다', ko: (c) => `${c.kq}는 것을 알아` },
  { base: 'believe', s: 'believes', mean: '믿다', ko: (c) => `${c.kq}고 믿어` },
  { base: 'hope', s: 'hopes', mean: '바라다', ko: (c) => `${c.kg} 바라`, needKg: true }
];

/* ── 뒤 문장(that 다음): 누가 + 어떠하다/무엇을 하다 ──
   be: 주어 + is/are + 말 / modal: 주어 + can·will + 동사원형 / pres: 주어 + 동사
   kq: '~고 생각해'·'~는 것을 알아' 앞에 오는 우리말, kg: '~ 바라' 앞에 오는 우리말
   time: 때를 나타내는 말(today·tomorrow)이 있어 순서가 여러 가지일 수 있는 문장 */
export const CLAUSES = [
  { id: 'he', s: ['he'], type: 'be', be: 'is', rest: ['kind'], kq: '그가 친절하다' },
  { id: 'she', s: ['she'], type: 'be', be: 'is', rest: ['smart'], kq: '그녀가 똑똑하다' },
  { id: 'you', s: ['you'], type: 'be', be: 'are', rest: ['right'], kq: '네가 옳다' },
  { id: 'you', s: ['you'], type: 'be', be: 'are', rest: ['happy'], kq: '네가 행복하다', kg: '네가 행복하기를' },
  { id: 'they', s: ['they'], type: 'be', be: 'are', rest: ['tired'], kq: '그들이 피곤하다' },
  { id: 'it', s: ['it'], type: 'be', be: 'is', rest: ['cold', 'today'], kq: '오늘 날씨가 춥다', time: true },
  { id: 'movie', s: ['the', 'movie'], type: 'be', be: 'is', rest: ['fun'], kq: '그 영화가 재미있다' },
  { id: 'test', s: ['the', 'test'], type: 'be', be: 'is', rest: ['easy'], kq: '그 시험이 쉽다', kg: '그 시험이 쉽기를' },
  { id: 'dog', s: ['my', 'dog'], type: 'be', be: 'is', rest: ['cute'], kq: '내 강아지가 귀엽다' },
  { id: 'he', s: ['he'], type: 'modal', m: 'can', v: 'swim', vs: 'swims', rest: [], kq: '그가 수영할 수 있다' },
  { id: 'she', s: ['she'], type: 'modal', m: 'can', v: 'dance', vs: 'dances', rest: ['well'], kq: '그녀가 춤을 잘 출 수 있다' },
  { id: 'you', s: ['you'], type: 'modal', m: 'can', v: 'do', vs: 'does', rest: ['it'], kq: '네가 해낼 수 있다', kg: '네가 해낼 수 있기를' },
  { id: 'tom', s: ['Tom'], type: 'modal', m: 'can', v: 'speak', vs: 'speaks', rest: ['Korean'], kq: '톰이 한국어를 할 수 있다' },
  { id: 'it', s: ['it'], type: 'modal', m: 'will', v: 'rain', vs: 'rains', rest: ['tomorrow'], kq: '내일 비가 올 거라', kg: '내일 비가 오기를', time: true },
  { id: 'you', s: ['you'], type: 'modal', m: 'will', v: 'win', vs: 'wins', rest: [], kq: '네가 이길 거라', kg: '네가 이기기를' },
  { id: 'we', s: ['we'], type: 'modal', m: 'will', v: 'be', vs: null, rest: ['friends'], kq: '우리가 친구가 될 거라', kg: '우리가 친구가 되기를' },
  { id: 'she', s: ['she'], type: 'pres', v: 'likes', bad: 'like', rest: ['cats'], kq: '그녀가 고양이를 좋아한다' },
  { id: 'he', s: ['he'], type: 'pres', v: 'plays', bad: 'play', rest: ['soccer'], kq: '그가 축구를 한다' },
  { id: 'they', s: ['they'], type: 'pres', v: 'live', bad: 'lives', rest: ['in', 'Seoul'], kq: '그들이 서울에 산다' },
  { id: 'dad', s: ['my', 'dad'], type: 'pres', v: 'cooks', bad: 'cook', rest: ['well'], kq: '아빠가 요리를 잘한다' },
  { id: 'mina', s: ['Mina'], type: 'pres', v: 'has', bad: 'have', rest: ['a', 'cat'], kq: '미나에게 고양이가 있다' }
];
const core = (c) => (c.type === 'be' ? [c.be, ...c.rest] : c.type === 'modal' ? [c.m, c.v, ...c.rest] : [c.v, ...c.rest]);

// 문장 하나: { words, main, clause, en, ko, subj, verb, c }
export function makeSentence(r = Math.random, opt = {}) {
  for (let t = 0; t < 200; t++) {
    const subj = pick(SUBJECTS, r);
    const verb = opt.verb || pick(VERBS, r);
    const c = pick(CLAUSES, r);
    if (c.id === subj.id) continue;                 // 'He thinks that he ~'처럼 같은 사람이 겹치지 않게
    if (verb.needKg && !c.kg) continue;             // hope는 바랄 만한 문장만
    if (opt.noTime && c.time) continue;
    const vf = subj.three ? verb.s : verb.base;
    const main = [...subj.en, vf];
    const clause = [...c.s, ...core(c)];
    const words = [...main, 'that', ...clause];
    return { words, main, clause, en: words.join(' ') + '.', ko: `${subj.ko} ${verb.ko(c)}.`, subj, verb, vf, c };
  }
  return makeSentence(r, opt);
}

/* ═════ 1단계: 문장 기차 (단어 순서 맞추기) ═════ */
export function makeQ1(r = Math.random) {
  const s = makeSentence(r, { noTime: true });
  let cards;
  do { cards = shuffle(s.words.map((w, i) => ({ id: i, w })), r); } while (cards.map((x) => x.w).join(' ') === s.words.join(' '));
  return { stage: 1, s, cards };
}

/* ═════ 2단계: that 자리 찾기 ═════ */
export function makeQ2(r = Math.random) {
  const s = makeSentence(r);
  const words = [...s.main, ...s.clause];      // that을 뺀 문장
  return { stage: 2, s, words, answer: s.main.length - 1 }; // answer번째 단어 바로 뒤
}

/* ═════ 3단계: 어떤 that일까? ═════
   demo: '저것·저'라는 that / conj: 두 문장을 이어 주는 that */
export const DEMOS = [
  { en: 'That is my bag.', ko: '저것은 내 가방이야.' },
  { en: 'That is a big dog.', ko: '저것은 큰 개야.' },
  { en: 'Is that your pencil?', ko: '저것은 네 연필이니?' },
  { en: 'That is my brother.', ko: '저 사람은 내 남동생이야.' },
  { en: 'That girl is my sister.', ko: '저 소녀는 내 여동생이야.', noun: 'girl', nko: '소녀' },
  { en: 'I like that song.', ko: '나는 저 노래를 좋아해.', noun: 'song', nko: '노래' },
  { en: 'I know that boy.', ko: '나는 저 소년을 알아.', noun: 'boy', nko: '소년' },
  { en: 'Look at that bird.', ko: '저 새를 봐.', noun: 'bird', nko: '새' },
  { en: 'Who is that man?', ko: '저 남자는 누구야?', noun: 'man', nko: '남자' },
  { en: 'That cake looks good.', ko: '저 케이크는 맛있어 보여.', noun: 'cake', nko: '케이크' },
  { en: 'I want that red hat.', ko: '나는 저 빨간 모자를 원해.', noun: 'red hat', nko: '빨간 모자' },
  { en: 'Do you see that tree?', ko: '저 나무가 보이니?', noun: 'tree', nko: '나무' }
];
export function makeQ3(r = Math.random) {
  if (r() < 0.5) {
    const d = pick(DEMOS, r);
    const words = d.en.replace(/[.?]$/, '').split(' ');
    const why = d.noun
      ? `that 바로 뒤에 ${d.noun}(${d.nko})${hasBatchim(d.nko) ? '이' : '가'} 와서 ‘저 ${d.nko}’${hasBatchim(d.nko) ? '이라는' : '라는'} 뜻이에요. 문장을 이어 주지 않아요.`
      : 'That이 ‘저것(저 사람)’이라는 뜻으로, 혼자서 무언가를 가리켜요. 뒤에 다른 문장을 이어 주지 않아요.';
    return { stage: 3, kind: 'demo', words, end: d.en.slice(-1), at: words.findIndex((w) => /^that$/i.test(w)), ko: d.ko, why };
  }
  const s = makeSentence(r);
  const cl = s.clause.join(' ');
  return { stage: 3, kind: 'conj', s, words: s.words, end: '.', at: s.main.length, ko: s.ko,
    why: `that 뒤에 ‘${cl}’처럼 ‘누가 + 어떠하다(하다)’ 문장이 이어져요. 앞 문장과 뒤 문장을 이어 주는 that이에요.` };
}

/* ═════ 4단계: 생각 말풍선 (우리말 뜻에 맞는 문장 고르기) ═════ */
const sentenceOf = (words) => words.join(' ') + '.';
export function makeQ4(r = Math.random) {
  for (let t = 0; t < 100; t++) {
    const s = makeSentence(r);
    const c = s.c;
    const cand = [];
    // 동사 뜻이 다름
    const ov = pick(VERBS.filter((v) => v !== s.verb), r);
    cand.push({ type: 'verb', words: [...s.subj.en, s.subj.three ? ov.s : ov.base, 'that', ...s.clause], note: `${ov.base}는 ‘${ov.mean}’라는 뜻이라 우리말 뜻과 달라요.` });
    // that 뒤 순서가 틀림
    const bad = c.type === 'be' ? [c.be, ...c.s, ...c.rest] : c.type === 'modal' ? [c.m, ...c.s, c.v, ...c.rest] : [c.v, ...c.s, ...c.rest];
    cand.push({ type: 'order', words: [...s.main, 'that', ...bad], note: 'that 뒤에는 ‘누가(주어) + 동사’ 순서로 써요.' });
    // 앞 문장 동사에 s
    cand.push({ type: 'agree', words: [...s.subj.en, s.subj.three ? s.verb.base : s.verb.s, 'that', ...s.clause],
      note: s.subj.three ? `${s.subj.en.join(' ')}처럼 한 사람이 주어이면 동사에 s를 붙여 ${s.verb.s}라고 써요.` : `${s.subj.en.join(' ')}가 주어이면 동사에 s를 붙이지 않아요.` });
    // 뒤 문장의 동사가 틀림
    if (c.type === 'be') cand.push({ type: 'clause', words: [...s.main, 'that', ...c.s, ...c.rest], note: 'that 뒤 문장에도 동사(is·are)가 꼭 있어야 해요.' });
    else if (c.type === 'modal' && c.vs) cand.push({ type: 'clause', words: [...s.main, 'that', ...c.s, c.m, c.vs, ...c.rest], note: `${c.m} 뒤에는 s를 붙이지 않은 동사원형(${c.v})을 써요.` });
    else if (c.type === 'pres') cand.push({ type: 'clause', words: [...s.main, 'that', ...c.s, c.bad, ...c.rest], note: `${c.s.join(' ')} 뒤에는 ${c.v}를 써요.` });
    const wrong = shuffle(cand, r).slice(0, 3);
    const opts = [{ type: 'right', words: s.words }, ...wrong].map((o) => ({ ...o, en: sentenceOf(o.words) }));
    if (new Set(opts.map((o) => o.en)).size !== 4) continue;
    const order = shuffle([0, 1, 2, 3], r);
    return { stage: 4, s, options: order.map((i) => opts[i]), answer: order.indexOf(0) };
  }
  return makeQ4(r);
}

/* ═════ 5단계: 틀린 곳 찾기 ═════
   한 단어만 틀리게 바꾼 문장. { words(틀린 문장), at(틀린 단어 자리), fix(바른 단어), type, why } */
export function makeQ5(r = Math.random) {
  for (let t = 0; t < 100; t++) {
    const s = makeSentence(r);
    const c = s.c;
    const kinds = ['main', 'conj', 'clause', 'clause'];
    const kind = pick(kinds, r);
    const words = [...s.words];
    const thatAt = s.main.length;
    let at, why;
    if (kind === 'main') {
      at = s.main.length - 1;
      words[at] = s.subj.three ? s.verb.base : s.verb.s;
      why = s.subj.three ? `${s.subj.en.join(' ')}처럼 나·너가 아닌 한 사람이 주어이면 동사에 s를 붙여요.` : `${s.subj.en.join(' ')}가 주어이면 동사에 s를 붙이지 않아요.`;
    } else if (kind === 'conj') {
      at = thatAt;
      words[at] = 'this';
      why = '두 문장을 이어 주는 말은 that이에요. this로는 문장을 이을 수 없어요.';
    } else if (c.type === 'be') {
      at = thatAt + c.s.length + 1;
      words[at] = c.be === 'is' ? 'are' : 'is';
      why = c.be === 'is' ? `${c.s.join(' ')}처럼 한 사람(하나)을 말할 때는 is를 써요.` : `${c.s.join(' ')} 뒤에는 are를 써요.`;
    } else if (c.type === 'modal') {
      if (!c.vs) continue;
      at = thatAt + c.s.length + 2;
      words[at] = c.vs;
      why = `${c.m} 뒤에는 s를 붙이지 않은 동사원형(${c.v})을 써요.`;
    } else {
      at = thatAt + c.s.length + 1;
      words[at] = c.bad;
      why = c.id === 'they' ? 'they(여러 사람)가 주어이면 동사에 s를 붙이지 않아요.' : `${c.s.join(' ')}처럼 한 사람이 주어이면 ${c.v}처럼 s를 붙여요${c.v === 'has' ? ' (have는 has로 바뀌어요)' : ''}.`;
    }
    if (words.join(' ') === s.words.join(' ')) continue;
    return { stage: 5, s, words, at, fix: s.words[at], kind: kind === 'clause' ? c.type : kind, why };
  }
  return makeQ5(r);
}

export const MAKERS = { 1: makeQ1, 2: makeQ2, 3: makeQ3, 4: makeQ4, 5: makeQ5 };
// 같은 문제가 바로 이어 나오지 않게
export function makeQuestion(stage, prev, r = Math.random) {
  const key = (q) => (q.words || q.s.words).join(' ');
  for (let i = 0; i < 10; i++) {
    const q = MAKERS[stage](r);
    if (!prev || key(q) !== key(prev)) return q;
  }
  return MAKERS[stage](r);
}
