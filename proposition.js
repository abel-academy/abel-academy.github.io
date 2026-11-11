// 명제 탐정: 문제 만들기 (화면과 상관없는 부분). 숫자를 바꿔 가며 문제를 자동으로 만들어요.
// 1 반례 사냥 · 2 부정 거울 · 3 역·대우 카드 · 4 필요·충분 수직선 · 5 최솟값 찾기 · 6 참말족·거짓말족

/* ── 작은 도구 ── */
const pick = (a, r) => a[Math.floor(r() * a.length)];
const randint = (lo, hi, r) => lo + Math.floor(r() * (hi - lo + 1));
export function shuffle(a, r = Math.random) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
// 음수는 수학 빼기 기호(−)로
export const num = (n) => (n < 0 ? '−' + Math.abs(n) : String(n));
// x − 2 / x + 3 / x
const xm = (c, v = 'x') => (c === 0 ? v : c > 0 ? `${v} − ${c}` : `${v} + ${-c}`);
// 0.5 → 1/2, 1.5 → 3/2
export function frac(v) {
  if (Number.isInteger(v)) return num(v);
  const d = [2, 3, 4].find((q) => Math.abs(v * q - Math.round(v * q)) < 1e-9);
  return d ? `${num(Math.round(v * d))}/${d}` : String(Math.round(v * 100) / 100);
}
// 받침이 있으면 true (조사 고르기)
export function hasBatchim(word) {
  const ch = String(word).replace(/[\s)'"’”.]+$/, '').slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch); // 영·일·삼·육·칠·팔
  return ch === '²' || ch === 'n'; // 제곱·엔은 받침 있음, 엑스·와이는 없음
}
export const josa = (word, withB, without) => word + (hasBatchim(word) ? withB : without);
// "문장"이에요 / "문장"예요
const isQ = (t, q = '“”') => `${q[0]}${t}${q[1]}${hasBatchim(t) ? '이에요' : '예요'}`;

/* ═════ 1단계: 반례 사냥 ═════
   { text, p, q, dom, truth, cards:[{label, v}], counter(v), why } */
const cond = (t, f) => ({ t, f });
function cardsFrom(values, label) { return values.map((v) => ({ label: label(v), v })); }

const S1 = [
  // 실수 x: 제곱
  (r) => { const a = randint(2, 6, r); return { dom: 'x는 실수', p: cond(`x² = ${a * a}`, (x) => x * x === a * a), q: cond(`x = ${a}`, (x) => x === a), truth: false, vals: [-a, a, 0, a + 1, -a - 1, 1] }; },
  (r) => { const a = randint(2, 6, r); return { dom: 'x는 실수', p: cond(`x = ${a}`, (x) => x === a), q: cond(`x² = ${a * a}`, (x) => x * x === a * a), truth: true, why: `x = ${a}이면 x² = ${a}² = ${a * a}이므로 항상 성립해요.` }; },
  (r) => { const a = randint(1, 4, r); return { dom: 'x는 실수', p: cond(`x² > ${a * a}`, (x) => x * x > a * a), q: cond(`x > ${a}`, (x) => x > a), truth: false, vals: [-a - 1, -a - 2, -a, a, a + 1, 0] }; },
  (r) => { const a = randint(0, 4, r); return { dom: 'x는 실수', p: cond(`x > ${a}`, (x) => x > a), q: cond(`x² > ${a * a}`, (x) => x * x > a * a), truth: true, why: `x > ${a} ≥ 0이면 양변이 0 이상이므로 제곱해도 부등호 방향이 그대로예요. 그래서 x² > ${a * a}이에요.` }; },
  (r) => { const a = randint(1, 5, r); return { dom: 'x는 실수', p: cond(`|x| < ${a}`, (x) => Math.abs(x) < a), q: cond(`x < ${a}`, (x) => x < a), truth: true, why: `|x| < ${a}이면 ${num(-a)} < x < ${a}이므로 x < ${a}이에요.` }; },
  (r) => { const a = randint(1, 5, r); return { dom: 'x는 실수', p: cond(`x < ${a}`, (x) => x < a), q: cond(`|x| < ${a}`, (x) => Math.abs(x) < a), truth: false, vals: [-a - 1, -a, 0, a - 1, a, a + 1] }; },
  // 자연수 n: 배수
  (r) => { const [big, sm] = pick([[6, 3], [4, 2], [10, 5], [8, 4], [9, 3], [12, 6], [15, 5], [12, 4]], r); return { dom: 'n은 자연수', v: 'n', p: cond(`n이 ${big}의 배수`, (n) => n % big === 0), q: cond(`n이 ${sm}의 배수`, (n) => n % sm === 0), truth: true, why: `${josa(String(big), '은', '는')} ${sm}의 배수이므로, ${big}의 배수는 모두 ${sm}의 배수예요.` }; },
  (r) => {
    const [big, sm] = pick([[6, 3], [4, 2], [10, 5], [8, 4], [9, 3], [12, 6], [15, 5], [12, 4]], r);
    const counters = []; for (let n = sm; counters.length < 2; n += sm) if (n % big) counters.push(n);
    const okBoth = [big, big * 2];
    const others = []; for (let n = sm + 1; others.length < 2; n++) if (n % sm) others.push(n);
    return { dom: 'n은 자연수', v: 'n', p: cond(`n이 ${sm}의 배수`, (n) => n % sm === 0), q: cond(`n이 ${big}의 배수`, (n) => n % big === 0), truth: false, vals: [...counters, ...okBoth, ...others] };
  },
  // 자연수 n: 짝수·홀수
  () => ({ dom: 'n은 자연수', v: 'n', p: cond('n이 소수', (n) => isPrime(n)), q: cond('n이 홀수', (n) => n % 2 === 1), truth: false, vals: [2, 3, 5, 7, 9, 4] }),
  () => ({ dom: 'n은 자연수', v: 'n', p: cond('n이 3의 배수', (n) => n % 3 === 0), q: cond('n이 홀수', (n) => n % 2 === 1), truth: false, vals: [3, 6, 9, 12, 5, 8] }),
  () => ({ dom: 'n은 자연수', v: 'n', p: cond('n² + n이 짝수', (n) => (n * n + n) % 2 === 0), q: cond('n이 짝수', (n) => n % 2 === 0), truth: false, vals: [1, 2, 3, 4, 5, 6] }),
  () => ({ dom: 'n은 자연수', v: 'n', p: cond('n이 짝수', (n) => n % 2 === 0), q: cond('n²이 짝수', (n) => (n * n) % 2 === 0), truth: true, why: 'n = 2k(k는 자연수)이면 n² = 4k² = 2 × 2k²이므로 짝수예요.' }),
  () => ({ dom: 'n은 자연수', v: 'n', p: cond('n이 홀수', (n) => n % 2 === 1), q: cond('n² + 1이 짝수', (n) => (n * n + 1) % 2 === 0), truth: true, why: '홀수 × 홀수 = 홀수이므로 n²은 홀수이고, 홀수 + 1은 짝수예요.' }),
  () => ({ dom: 'n은 자연수', v: 'n', p: cond('n이 홀수', (n) => n % 2 === 1), q: cond('n + 1이 홀수', (n) => (n + 1) % 2 === 1), truth: false, vals: [1, 3, 5, 2, 4, 6] }),
  // 실수 x, y
  () => ({ dom: 'x, y는 실수', two: true, p: cond('xy = 0', (v) => v.x * v.y === 0), q: cond('x = 0', (v) => v.x === 0), truth: false, vals: [{ x: 2, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 3 }, { x: 1, y: 1 }, { x: 3, y: 2 }] }),
  () => ({ dom: 'x, y는 실수', two: true, p: cond('x + y > 0', (v) => v.x + v.y > 0), q: cond('x > 0이고 y > 0', (v) => v.x > 0 && v.y > 0), truth: false, vals: [{ x: 3, y: -1 }, { x: -1, y: 4 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: -2, y: -1 }, { x: -3, y: 1 }] }),
  () => ({ dom: 'x, y는 실수', two: true, p: cond('xy > 0', (v) => v.x * v.y > 0), q: cond('x > 0', (v) => v.x > 0), truth: false, vals: [{ x: -1, y: -2 }, { x: -3, y: -1 }, { x: 1, y: 2 }, { x: 2, y: -1 }, { x: 0, y: 5 }, { x: 4, y: 1 }] }),
  () => ({ dom: 'x, y는 실수', two: true, p: cond('x² = y²', (v) => v.x * v.x === v.y * v.y), q: cond('x = y', (v) => v.x === v.y), truth: false, vals: [{ x: 2, y: -2 }, { x: -3, y: 3 }, { x: 1, y: 1 }, { x: 2, y: 3 }, { x: 0, y: 0 }, { x: -1, y: -1 }] }),
  () => ({ dom: 'x, y는 실수', two: true, p: cond('x > 0이고 y > 0', (v) => v.x > 0 && v.y > 0), q: cond('xy > 0', (v) => v.x * v.y > 0), truth: true, why: '양수 × 양수 = 양수이므로 xy > 0이에요.' }),
  () => ({ dom: 'x, y는 실수', two: true, p: cond('x² + y² = 0', (v) => v.x * v.x + v.y * v.y === 0), q: cond('x = 0이고 y = 0', (v) => v.x === 0 && v.y === 0), truth: true, why: 'x² ≥ 0, y² ≥ 0이므로 합이 0이 되려면 둘 다 0이어야 해요.' }),
  // 실수 x: 범위
  (r) => {
    const a = randint(-3, 2, r), b = a + randint(3, 5, r);
    const ok = r() < 0.5;
    const c = ok ? a - randint(0, 2, r) : a + randint(1, 2, r);
    const d = ok ? b + randint(0, 2, r) : b + randint(-1, 2, r);
    const vals = shuffle([a - 1, a, a + 1, a + 2, b - 1, b, b + 1], r).slice(0, 6);
    if (!ok && !vals.some((x) => a < x && x < b && !(c < x && x < d))) vals[0] = c; // 반례 하나는 꼭
    return { dom: 'x는 실수', p: cond(`${num(a)} < x < ${num(b)}`, (x) => a < x && x < b), q: cond(`${num(c)} < x < ${num(d)}`, (x) => c < x && x < d), truth: ok, vals: ok ? null : vals,
      why: ok ? `${num(a)} < x < ${num(b)}인 x는 모두 ${num(c)} < x < ${num(d)} 안에 들어가요 (수직선에서 p의 범위가 q의 범위 안에 있어요).` : '' };
  }
];
function isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }

export function makeQ1(r = Math.random) {
  for (let t = 0; t < 50; t++) {
    const T = pick(S1, r)(r);
    const v = T.v || 'x';
    const label = T.two ? (o) => `x = ${num(o.x)}, y = ${num(o.y)}` : (o) => `${v} = ${num(o)}`;
    const counter = (o) => T.p.f(o) && !T.q.f(o);
    let cards = null;
    if (!T.truth) {
      const uniq = [...new Map(T.vals.map((o) => [JSON.stringify(o), o])).values()];
      cards = shuffle(cardsFrom(uniq, label), r).slice(0, 6);
      if (!cards.some((c) => counter(c.v))) continue;
    }
    return { stage: 1, text: `${T.p.t}이면 ${T.q.t}이다`, p: T.p.t, q: T.q.t, dom: T.dom, truth: T.truth, cards, counter, pf: T.p.f, qf: T.q.f, label, why: T.why || '' };
  }
  return makeQ1(r);
}

/* ═════ 2단계: 부정 거울 ═════
   { text(원래), options:[문장 4개], answer: 정답 번호, kind, why } */
const NEG = { '>': '≤', '≥': '<', '<': '≥', '≤': '>', '=': '≠', '≠': '=' };
const WRONG = { '>': '<', '≥': '≤', '<': '>', '≤': '≥', '=': '>', '≠': '<' };
const REL = { '>': (a, b) => a > b, '≥': (a, b) => a >= b, '<': (a, b) => a < b, '≤': (a, b) => a <= b, '=': (a, b) => a === b, '≠': (a, b) => a !== b };

function negQuant(r) {
  const real = r() < 0.6;
  const dom = real ? '실수 x' : '자연수 n';
  // [글자, 함수, 실수일 때 값의 범위 최솟값]
  const exprs = real
    ? [['x²', (x) => x * x, 0], ['x² + 1', (x) => x * x + 1, 1], ['2x − 1', (x) => 2 * x - 1, -Infinity], ['|x|', Math.abs, 0], ['x + 3', (x) => x + 3, -Infinity], ['x² − 2x', (x) => x * x - 2 * x, -1]]
    : [['n²', (n) => n * n], ['2n + 1', (n) => 2 * n + 1], ['n − 1', (n) => n - 1], ['n² − n', (n) => n * n - n], ['3n', (n) => 3 * n]];
  const [e, ef, min] = pick(exprs, r);
  const op = pick(['>', '≥', '<', '≤', '=', '≠'], r);
  const k = randint(-2, 5, r);
  // '틀린 부등호' 보기가 정답과 뜻이 같아지면 안 돼요 (x² + 1 < −1 과 x² + 1 ≤ −1 은 둘 다 늘 거짓).
  // 식의 값이 될 수 있는 수(범위)에서 두 조건을 비교해, 늘 같으면 다시 만들어요.
  const values = real
    ? Array.from({ length: 161 }, (_, i) => -10 + i / 2).filter((y) => y >= min)
    : Array.from({ length: 60 }, (_, i) => ef(i + 1));
  if (values.every((y) => REL[NEG[op]](y, k) === REL[WRONG[op]](y, k))) return null;
  const Q = r() < 0.5 ? '모든' : '어떤';
  const Q2 = Q === '모든' ? '어떤' : '모든';
  const s = (q, o) => `${q} ${dom}에 대하여 ${e} ${o} ${num(k)}이다`;
  const opts = [s(Q2, NEG[op]), s(Q, NEG[op]), s(Q2, op), s(Q2, WRONG[op])];
  return { kind: 'quant', text: s(Q, op), opts,
    why: `‘${Q}’의 부정은 ‘${Q2}’이고, ‘${op}’의 부정은 ‘${NEG[op]}’예요. 그래서 부정은 ${isQ(s(Q2, NEG[op]))}.` };
}
function negAndOr(r) {
  const two = r() < 0.6;
  const a = randint(-3, 4, r), b = two ? randint(-3, 4, r) : a + randint(2, 4, r);
  const v2 = two ? 'y' : 'x';
  const [o1, o2] = two ? [pick(Object.keys(NEG), r), pick(['>', '≥', '<', '≤'], r)] : pick([['<', '>'], ['≤', '≥'], ['<', '≥'], ['≤', '>']], r);
  const and = two ? r() < 0.5 : false; // 한 변수일 때는 'x < a 또는 x > b' 꼴
  const C = and ? '그리고' : '또는', C2 = and ? '또는' : '그리고';
  const s = (p1, c, p2) => `x ${p1} ${num(a)} ${c} ${v2} ${p2} ${num(b)}`;
  const sem = (p1, c, p2) => (v) => { const A = REL[p1](v.x, a), B = REL[p2](v[v2], b); return c === '그리고' ? A && B : A || B; };
  const mk = (p1, c, p2) => ({ t: s(p1, c, p2), f: sem(p1, c, p2) });
  const orig = mk(o1, C, o2);
  const opts = [mk(NEG[o1], C2, NEG[o2]), mk(NEG[o1], C, NEG[o2]), mk(NEG[o1], C2, o2), mk(WRONG[o1], C2, NEG[o2])];
  return { kind: 'andor', text: orig.t, origF: orig.f, opts: opts.map((o) => o.t), optF: opts.map((o) => o.f), vars: two ? ['x', 'y'] : ['x'],
    why: `‘${C}’의 부정은 ‘${C2}’예요. 각 조건도 부정해요: ${o1} → ${NEG[o1]}, ${o2} → ${NEG[o2]}. 그래서 부정은 ${isQ(opts[0].t)}.` };
}
function negRange(r) {
  const a = randint(-3, 3, r), b = a + randint(2, 5, r);
  const lo = pick(['<', '≤'], r), hi = pick(['<', '≤'], r);
  const gtA = lo === '<' ? '>' : '≥', ltB = hi; // a < x ≤ b 는 'x > a 그리고 x ≤ b'
  const text = `${num(a)} ${lo} x ${hi} ${num(b)}`;
  const origF = (v) => REL[gtA](v.x, a) && REL[ltB](v.x, b);
  const negLo = NEG[gtA], negHi = NEG[ltB];
  const mk = (o1, c, o2) => ({ t: `x ${o1} ${num(a)} ${c} x ${o2} ${num(b)}`, f: (v) => (c === '그리고' ? REL[o1](v.x, a) && REL[o2](v.x, b) : REL[o1](v.x, a) || REL[o2](v.x, b)) });
  const opts = [mk(negLo, '또는', negHi), mk(negLo, '그리고', negHi), mk(WRONG[gtA], '또는', WRONG[ltB]), mk(negLo === '≤' ? '<' : '≤', '또는', negHi)];
  return { kind: 'range', text, origF, opts: opts.map((o) => o.t), optF: opts.map((o) => o.f), vars: ['x'],
    why: `${josa(text, '은', '는')} ${isQ(`x ${gtA} ${num(a)} 그리고 x ${ltB} ${num(b)}`, '‘’')}. ‘그리고’는 ‘또는’으로, 각 부등호는 반대로 바꾸면 ${isQ(opts[0].t)}.` };
}
export function makeQ2(r = Math.random) {
  for (let t = 0; t < 50; t++) {
    const g = pick([negQuant, negQuant, negAndOr, negAndOr, negRange], r)(r);
    if (!g || new Set(g.opts).size !== 4) continue;
    const order = shuffle([0, 1, 2, 3], r);
    return { stage: 2, kind: g.kind, text: g.text, options: order.map((i) => g.opts[i]), answer: order.indexOf(0), optF: g.optF ? order.map((i) => g.optF[i]) : null, origF: g.origF || null, vars: g.vars || null, why: g.why };
  }
  return makeQ2(r);
}

/* ═════ 3단계: 역·대우 카드 ═════
   { ask: '역'|'대우', p, q, np, nq, tiles, truth, conv, convWhy, origWhy } */
const S3 = [
  (r) => { const a = randint(2, 6, r); return { p: `x = ${a}`, np: `x ≠ ${a}`, q: `x² = ${a * a}`, nq: `x² ≠ ${a * a}`, T: true, C: false, cx: `x = ${num(-a)}` }; },
  (r) => { const a = randint(0, 4, r); return { p: `x > ${a}`, np: `x ≤ ${a}`, q: `x² > ${a * a}`, nq: `x² ≤ ${a * a}`, T: true, C: false, cx: `x = ${num(-a - 1)}` }; },
  (r) => { const b = randint(-2, 3, r), a = b + randint(1, 3, r); return { p: `x > ${num(a)}`, np: `x ≤ ${num(a)}`, q: `x > ${num(b)}`, nq: `x ≤ ${num(b)}`, T: true, C: false, cx: `x = ${num(a)}` }; },
  (r) => { const a = randint(1, 5, r); return { p: `|x| < ${a}`, np: `|x| ≥ ${a}`, q: `x < ${a}`, nq: `x ≥ ${a}`, T: true, C: false, cx: `x = ${num(-a)}` }; },
  (r) => { const a = randint(1, 4, r), b = randint(1, 4, r); return { p: `x = ${a} 그리고 y = ${b}`, np: `x ≠ ${a} 또는 y ≠ ${b}`, q: `x + y = ${a + b}`, nq: `x + y ≠ ${a + b}`, T: true, C: false, cx: `x = ${a + 1}, y = ${num(b - 1)}` }; },
  () => ({ p: 'xy = 0', np: 'xy ≠ 0', q: 'x = 0 또는 y = 0', nq: 'x ≠ 0 그리고 y ≠ 0', T: true, C: true }),
  () => ({ p: 'x² + y² = 0', np: 'x² + y² ≠ 0', q: 'x = 0 그리고 y = 0', nq: 'x ≠ 0 또는 y ≠ 0', T: true, C: true }),
  () => ({ p: 'x > 0 그리고 y > 0', np: 'x ≤ 0 또는 y ≤ 0', q: 'xy > 0', nq: 'xy ≤ 0', T: true, C: false, cx: 'x = −1, y = −2' }),
  (r) => { const a = randint(2, 6, r); return { p: `x² = ${a * a}`, np: `x² ≠ ${a * a}`, q: `x = ${a}`, nq: `x ≠ ${a}`, T: false, C: true, ocx: `x = ${num(-a)}` }; },
  (r) => { const a = randint(1, 5, r); return { p: `x < ${a}`, np: `x ≥ ${a}`, q: `|x| < ${a}`, nq: `|x| ≥ ${a}`, T: false, C: true, ocx: `x = ${num(-a)}` }; }
];
export function makeQ3(r = Math.random) {
  const s = pick(S3, r)(r);
  const ask = r() < 0.5 ? '역' : '대우';
  const tiles = shuffle([{ id: 'p', t: s.p }, { id: 'q', t: s.q }, { id: 'np', t: s.np }, { id: 'nq', t: s.nq }], r);
  const answer = ask === '역' ? ['q', 'p'] : ['nq', 'np'];
  const dom = /y/.test(s.p + s.q) ? 'x, y는 실수' : 'x는 실수';
  return { stage: 3, ask, dom, p: s.p, q: s.q, np: s.np, nq: s.nq, tiles, answer,
    truth: s.T, conv: s.C, convCx: s.cx || '', origCx: s.ocx || '' };
}

/* ═════ 4단계: 필요·충분 수직선 ═════
   진리집합: 구간 [{lo, hi, lc, hc}] (lo·hi는 ±Infinity 가능, 점은 lo = hi) */
const I = (lo, hi, lc, hc) => ({ lo, hi, lc: lo === -Infinity ? false : lc, hc: hi === Infinity ? false : hc });
const ray = (op, a) => (op === '>' ? [I(a, Infinity, false)] : op === '≥' ? [I(a, Infinity, true)] : op === '<' ? [I(-Infinity, a, false, false)] : [I(-Infinity, a, false, true)]);
function outside(a, b, closed) { return [I(-Infinity, a, false, closed), I(b, Infinity, closed, false)]; }
function quadTerm(s, p) { // x² − sx + p 꼴 글자 (s = a + b, p = ab)
  let t = 'x²';
  if (s !== 0) t += s > 0 ? ` − ${s === 1 ? '' : s}x` : ` + ${-s === 1 ? '' : -s}x`;
  if (p !== 0) t += p > 0 ? ` + ${p}` : ` − ${-p}`;
  return t;
}
// (x − a)(x − b) 글자. 0인 쪽은 x 하나로: x(x − 2)
function facText(a, b) {
  const f = [a, b].map((v) => (v === 0 ? 'x' : `(${xm(v)})`));
  return f[0] === 'x' ? `x${f[1]}` : f[1] === 'x' ? `x${f[0]}` : f.join('');
}
// 조건 하나를 무작위로: { t, set }
function randomCond(r) {
  const kind = pick(['ray', 'ray', 'int', 'abs', 'sq', 'fac', 'exp', 'pt'], r);
  if (kind === 'ray') { const op = pick(['>', '≥', '<', '≤'], r), a = randint(-3, 4, r); return { t: `x ${op} ${num(a)}`, set: ray(op, a) }; }
  if (kind === 'int') { const a = randint(-4, 2, r), b = a + randint(2, 5, r), lo = pick(['<', '≤'], r), hi = pick(['<', '≤'], r); return { t: `${num(a)} ${lo} x ${hi} ${num(b)}`, set: [I(a, b, lo === '≤', hi === '≤')] }; }
  if (kind === 'abs') {
    const c = randint(-2, 2, r), k = randint(1, 3, r), op = pick(['<', '≤', '>', '≥'], r);
    const lhs = c === 0 ? '|x|' : `|${xm(c)}|`;
    const set = op === '<' || op === '≤' ? [I(c - k, c + k, op === '≤', op === '≤')] : outside(c - k, c + k, op === '≥');
    return { t: `${lhs} ${op} ${k}`, set };
  }
  if (kind === 'sq') { const k = randint(1, 3, r), op = pick(['<', '≤', '>', '≥'], r); return { t: `x² ${op} ${k * k}`, set: op === '<' || op === '≤' ? [I(-k, k, op === '≤', op === '≤')] : outside(-k, k, op === '≥') }; }
  if (kind === 'fac' || kind === 'exp') {
    const a = randint(-3, 2, r), b = a + randint(1, 4, r), op = pick(['<', '≤', '>', '≥'], r);
    const t = kind === 'fac' ? `${facText(a, b)} ${op} 0` : `${quadTerm(a + b, a * b)} ${op} 0`;
    return { t, set: op === '<' || op === '≤' ? [I(a, b, op === '≤', op === '≤')] : outside(a, b, op === '≥') };
  }
  const a = randint(-3, 4, r);
  if (r() < 0.5 && a > 0) return { t: `x² = ${a * a}`, set: [I(-a, -a, true, true), I(a, a, true, true)] };
  return { t: `x = ${num(a)}`, set: [I(a, a, true, true)] };
}
// 같은 진리집합을 다른 모양으로 (필요충분조건 문제)
function twinCond(r) {
  const a = randint(-3, 2, r), b = a + 2 * randint(1, 2, r), c = (a + b) / 2, k = (b - a) / 2;
  const closed = r() < 0.5;
  const op = closed ? '≤' : '<';
  const forms = [
    `${num(a)} ${op} x ${op} ${num(b)}`,
    `${facText(a, b)} ${op} 0`,
    `${c === 0 ? '|x|' : `|${xm(c)}|`} ${op} ${k}`,
    `${quadTerm(a + b, a * b)} ${op} 0`
  ];
  const [f1, f2] = shuffle(forms, r);
  const set = [I(a, b, closed, closed)];
  return [{ t: f1, set }, { t: f2, set }];
}
function inInt(x, s) { return (s.lo < x || (s.lc && s.lo === x)) && (x < s.hi || (s.hc && s.hi === x)); }
export const inSet = (x, set) => set.some((s) => inInt(x, s));
function intInside(a, b) { // 구간 a가 구간 b 안에
  const loOk = b.lo < a.lo || (b.lo === a.lo && (b.lc || !a.lc));
  const hiOk = a.hi < b.hi || (a.hi === b.hi && (b.hc || !a.hc));
  return loOk && hiOk;
}
export const subset = (A, B) => A.every((a) => B.some((b) => intInside(a, b)));
export const RELATION = { suf: '충분조건', nec: '필요조건', iff: '필요충분조건', none: '필요조건도 충분조건도 아니다' };
export function relation(P, Q) {
  const pq = subset(P, Q), qp = subset(Q, P);
  return pq && qp ? 'iff' : pq ? 'suf' : qp ? 'nec' : 'none';
}
export function makeQ4(r = Math.random, want) {
  const target = want || pick(['suf', 'nec', 'iff', 'none'], r);
  if (target === 'iff') { const [p, q] = twinCond(r); return { stage: 4, p: p.t, q: q.t, P: p.set, Q: q.set, answer: 'iff' }; }
  for (let t = 0; t < 400; t++) {
    const p = randomCond(r), q = randomCond(r);
    if (p.t === q.t) continue;
    if (relation(p.set, q.set) === target) return { stage: 4, p: p.t, q: q.t, P: p.set, Q: q.set, answer: target };
  }
  return makeQ4(r, target === 'none' ? 'suf' : 'none');
}

/* ═════ 5단계: 최솟값 찾기 (절대부등식) ═════
   { text, dom, f(x), lo, hi, step, xs(정답 x), m(최솟값), options, answer, why } */
export function makeQ5(r = Math.random) {
  const kind = pick(['axb', 'axb', 'shift', 'frac'], r);
  let text, dom, f, xs, m, lo, hi, why, c = 0, slips, hint;
  if (kind === 'axb') {
    const [a, t] = pick([[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [3, 1], [4, 0.5], [4, 1.5], [2, 3], [8, 0.5]], r);
    const b = Math.round(a * t * t);
    const ax = a === 1 ? 'x' : `${a}x`;
    text = `${ax} + ${b}/x`; dom = 'x > 0'; f = (x) => a * x + b / x; xs = t; m = 2 * a * t; lo = 0.1; hi = Math.max(3 * t, t + 3);
    slips = [m / 2]; // 2를 빠뜨리고 √(ab)만 쓴 경우
    hint = `${ax}와 ${b}/x는 둘 다 양수예요. 두 수의 합과 곱을 생각해 보세요.`;
    why = `x > 0이므로 산술평균과 기하평균의 관계에서 ${text} ≥ 2√(${ax} × ${b}/x) = 2√${a * b} = ${frac(m)}이에요. 등호는 ${ax} = ${b}/x, 즉 x = ${frac(t)}일 때 성립해요.`;
  } else if (kind === 'shift') {
    c = randint(1, 3, r); const k = randint(1, 3, r);
    text = `x + ${k * k}/(x − ${c})`; dom = `x > ${c}`; f = (x) => x + (k * k) / (x - c); xs = c + k; m = c + 2 * k; lo = c + 0.1; hi = c + 3 * k + 1;
    slips = [2 * k, k + c]; // c를 더하지 않음 / 2를 빠뜨림
    hint = `식을 (x − ${c}) + ${k * k}/(x − ${c}) + ${c}${c === 3 ? '으로' : '로'} 바꿔 보세요. x − ${c} > 0이에요.`;
    why = `x − ${c} > 0이므로 ${text} = (x − ${c}) + ${k * k}/(x − ${c}) + ${c} ≥ 2√${k * k} + ${c} = ${m}이에요. 등호는 x − ${c} = ${k * k}/(x − ${c}), 즉 x − ${c} = ${k}이고 x = ${xs}일 때 성립해요.`;
  } else {
    const k = randint(1, 4, r);
    text = `(x² + ${k * k})/x`; dom = 'x > 0'; f = (x) => x + (k * k) / x; xs = k; m = 2 * k; lo = 0.1; hi = 3 * k + 1;
    slips = [k];
    hint = `분수를 나누면 x + ${k * k}/x가 돼요.`;
    why = `(x² + ${k * k})/x = x + ${k * k}/x이고, x > 0이므로 x + ${k * k}/x ≥ 2√${k * k} = ${m}이에요. 등호는 x = ${k * k}/x, 즉 x = ${k}일 때 성립해요.`;
  }
  const nice = (v) => [1, 2, 3, 4].some((d) => Math.abs(v * d - Math.round(v * d)) < 1e-9);
  const inDom = (x) => x > c + 1e-9;
  const label = (x, v) => `x = ${frac(x)}일 때 최솟값 ${frac(v)}`;
  const opts = [label(xs, m)];
  const add = (x, v) => {
    if (opts.length >= 4 || !inDom(x) || !nice(x) || !nice(v) || v <= 0) return false;
    const o = label(x, v);
    if (opts.includes(o)) return false;
    opts.push(o); return true;
  };
  // 다른 x 후보: 정수를 먼저, 그다음 0.5 단위
  const cand = [xs + 1, xs * 2, xs + 2, xs - 1, xs + 0.5, xs - 0.5].filter((x) => Math.abs(x - xs) > 1e-9);
  const near = [...shuffle(cand.filter(Number.isInteger), r), ...shuffle(cand.filter((x) => !Number.isInteger(x)), r)];
  slips.some((v) => add(xs, v));                    // 등호 x는 맞고 값이 틀림 (흔한 실수)
  near.some((x) => add(x, m));                      // 값은 맞고 등호 x가 틀림
  near.some((x) => add(x, f(x)));                   // 함숫값이지만 최솟값은 아님
  [m + 1, m + 2, m - 1, m * 2].forEach((v) => add(xs, v));
  const order = shuffle(opts.map((_, i) => i), r);
  return { stage: 5, kind, text, dom, f, xs, m, lo, hi, c, hint, options: order.map((i) => opts[i]), answer: order.indexOf(0), why };
}

/* ═════ 6단계(보너스): 참말족·거짓말족 ═════
   세 사람이 한 마디씩. 참말족은 항상 참, 거짓말족은 항상 거짓만 말해요. 답이 하나뿐인 문제만 내요. */
export const NAMES = ['가람', '나리', '다온'];
function statements(s) {
  const o = [0, 1, 2].filter((i) => i !== s);
  const N = NAMES;
  const L = [];
  o.forEach((x) => {
    L.push({ t: `${josa(N[x], '은', '는')} 참말족이야.`, f: (T) => T[x] });
    L.push({ t: `${josa(N[x], '은', '는')} 거짓말족이야.`, f: (T) => !T[x] });
    L.push({ t: `나와 ${josa(N[x], '은', '는')} 같은 족이야.`, f: (T) => T[s] === T[x] });
    L.push({ t: `나와 ${josa(N[x], '은', '는')} 다른 족이야.`, f: (T) => T[s] !== T[x] });
  });
  L.push({ t: `${josa(N[o[0]], '과', '와')} ${josa(N[o[1]], '은', '는')} 같은 족이야.`, f: (T) => T[o[0]] === T[o[1]] });
  L.push({ t: `${josa(N[o[0]], '과', '와')} ${N[o[1]]} 중 적어도 한 명은 거짓말족이야.`, f: (T) => !T[o[0]] || !T[o[1]] });
  L.push({ t: `${josa(N[o[0]], '이', '가')} 참말족이면 ${N[o[1]]}도 참말족이야.`, f: (T) => !T[o[0]] || T[o[1]] });
  L.push({ t: `${josa(N[o[1]], '이', '가')} 참말족이면 ${N[o[0]]}도 참말족이야.`, f: (T) => !T[o[1]] || T[o[0]] });
  [1, 2].forEach((k) => L.push({ t: `우리 셋 중 참말족은 정확히 ${k}명이야.`, f: (T) => T.filter(Boolean).length === k }));
  return L;
}
const ALL = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => [0, 1, 2].map((i) => Boolean(m & (1 << i))));
export function solveLiars(says) {
  return ALL.filter((T) => says.every((st, i) => st.f(T) === T[i]));
}
export function makeQ6(r = Math.random) {
  for (let t = 0; t < 500; t++) {
    const T = [0, 1, 2].map(() => r() < 0.5);
    const says = [0, 1, 2].map((s) => pick(statements(s).filter((st) => st.f(T) === T[s]), r));
    const sol = solveLiars(says);
    if (sol.length === 1) return { stage: 6, names: NAMES, says: says.map((st) => st.t), sayF: says.map((st) => st.f), answer: T };
  }
  return makeQ6(r);
}

export const MAKERS = { 1: makeQ1, 2: makeQ2, 3: makeQ3, 4: makeQ4, 5: makeQ5, 6: makeQ6 };
// 같은 문제가 바로 이어 나오지 않게
export function makeQuestion(stage, prev, r = Math.random) {
  const key = (q) => JSON.stringify([q.text, q.p, q.q, q.says, q.options]);
  for (let i = 0; i < 10; i++) {
    const q = MAKERS[stage](r);
    if (!prev || key(q) !== key(prev)) return q;
  }
  return MAKERS[stage](r);
}
