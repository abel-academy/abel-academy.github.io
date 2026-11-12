// 입체 공방: 문제 만들기 (화면과 상관없는 부분)
// 중1 「입체도형의 성질」 중 원기둥·원뿔·구. 숫자를 바꿔 가며 문제를 자동으로 만들고, 답은 원주율을 계산하지 않고 π 그대로 써요.
// 1 회전체 공장 · 2 단면 자르기 · 3 전개도 펼치기 · 4 겉넓이·부피 · 5 합체 입체 · 6 1:2:3의 비밀 · 7 (보너스) 물통 채우기

const pick = (a, r) => a[Math.floor(r() * a.length)];
const randint = (lo, hi, r) => lo + Math.floor(r() * (hi - lo + 1));
export function shuffle(a, r = Math.random) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/* ── 분수 (π의 계수) ── [분자, 분모] */
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export const F = (n, d = 1) => { const k = gcd(n, d) || 1, s = d < 0 ? -1 : 1; return [(s * n) / k, (s * d) / k]; };
export const fadd = (a, b) => F(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const fmul = (a, b) => F(a[0] * b[0], a[1] * b[1]);
const coef = (c) => (c[1] === 1 ? String(c[0]) : `${c[0]}/${c[1]}`);
// 54π cm³ · 32/3π cm³ · π cm² (계수 1은 안 씀)
export const piStr = (c, unit = '') => `${c[1] === 1 && c[0] === 1 ? '' : coef(c)}π${unit ? ' ' + unit : ''}`;
export const numStr = (c, unit = '') => `${coef(c)}${unit ? ' ' + unit : ''}`;
const P = (n, d = 1) => F(n, d); // 짧게
// 받침이 있으면 '이', 없으면 '가'
const iga = (w) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '이' : '가'; };

/* 보기 만들기: 정답 + 틀린 보기(겹치거나 정답과 같은 것은 빼고) 3개 */
function options(answer, wrongs, r) {
  const seen = new Set([answer]);
  const w = [];
  for (const x of wrongs) if (x && !seen.has(x) && !x.startsWith('0') && !x.startsWith('-')) { seen.add(x); w.push(x); }
  if (w.length < 3) return null;
  return shuffle([answer, ...w.slice(0, 3)], r);
}

/* ═════ 1단계: 회전체 공장 ═════ */
export const SOLIDS = {
  cyl: '원기둥', cone: '원뿔', sph: '구', hemi: '반구', frus: '원뿔대',
  tube: '가운데가 빈 원기둥', dcone: '원뿔 두 개를 붙인 입체', cylcone: '원기둥 위에 원뿔을 얹은 입체'
};
export const FIG_NAMES = {
  rect: '한 변이 회전축 위에 있는 직사각형', tri: '직각을 낀 한 변이 회전축 위에 있는 직각삼각형', semi: '지름이 회전축 위에 있는 반원',
  quarter: '반지름 하나가 회전축 위에 있는 사분원', trap: '직각을 낀 변이 회전축 위에 있는 사다리꼴', gap: '회전축에서 떨어진 직사각형',
  kite: '한 변이 회전축 위에 있고 나머지 꼭짓점이 옆에 있는 삼각형', house: '직사각형 위에 삼각형을 얹은 오각형'
};
const SOLID_FIG = { cyl: 'rect', cone: 'tri', sph: 'semi', hemi: 'quarter', frus: 'trap', tube: 'gap', dcone: 'kite', cylcone: 'house' };
const SPIN_WHY = {
  cyl: '직사각형의 한 변을 축으로 한 바퀴 돌리면 원기둥이 돼요.',
  cone: '직각삼각형의 직각을 낀 한 변을 축으로 돌리면 원뿔이 돼요.',
  sph: '반원의 지름을 축으로 돌리면 구가 돼요.',
  hemi: '사분원의 반지름 하나를 축으로 돌리면 반구가 돼요.',
  frus: '직각을 낀 변을 축으로 사다리꼴을 돌리면 원뿔대가 돼요.',
  tube: '축에서 떨어진 직사각형을 돌리면 가운데에 구멍이 뚫린 원기둥이 돼요.',
  dcone: '삼각형의 한 변을 축으로 돌리면 옆에 있는 꼭짓점이 원을 그리며, 원뿔 두 개를 밑면끼리 붙인 입체가 돼요.',
  cylcone: '직사각형 위에 삼각형을 얹은 도형을 돌리면 원기둥 위에 원뿔을 얹은 입체가 돼요.'
};
// 평면도형 (회전축은 x = 0, 도형은 오른쪽)
export function figFor(key, r = Math.random) {
  const t = SOLID_FIG[key];
  if (t === 'rect') return { t, w: randint(2, 4, r), h: randint(3, 5, r) };
  if (t === 'tri') return { t, w: randint(2, 4, r), h: randint(3, 5, r) };
  if (t === 'semi') return { t, R: randint(2, 3, r) };
  if (t === 'quarter') return { t, R: randint(2, 4, r) };
  if (t === 'trap') { const w1 = randint(3, 4, r); return { t, w1, w2: randint(1, w1 - 1, r), h: randint(3, 4, r) }; }
  if (t === 'gap') return { t, g: randint(1, 2, r), w: randint(1, 2, r), h: randint(3, 4, r) };
  if (t === 'kite') { const h = randint(4, 5, r); return { t, w: randint(2, 3, r), a: randint(1, h - 1, r), h }; }
  return { t, w: randint(2, 3, r), h1: randint(2, 3, r), h2: randint(2, 3, r) };
}
// 입체 그림에 쓸 크기 (그림 비율만 맞으면 돼요)
export function solidFromFig(key, f) {
  if (key === 'cyl') return { k: 'cyl', r: f.w, h: f.h };
  if (key === 'cone') return { k: 'cone', r: f.w, h: f.h };
  if (key === 'sph') return { k: 'sph', r: f.R };
  if (key === 'hemi') return { k: 'hemi', r: f.R };
  if (key === 'frus') return { k: 'frus', r1: f.w1, r2: f.w2, h: f.h };
  if (key === 'tube') return { k: 'tube', R: f.g + f.w, r: f.g, h: f.h };
  if (key === 'dcone') return { k: 'dcone', r: f.w, a: f.a, h: f.h };
  return { k: 'cylcone', r: f.w, h1: f.h1, h2: f.h2 };
}
export function makeQ1(r = Math.random) {
  const keys = Object.keys(SOLIDS);
  const key = pick(keys, r);
  const fig = figFor(key, r);
  const others = shuffle(keys.filter((k) => k !== key), r).slice(0, 3);
  if (r() < 0.5) {
    return { stage: 1, kind: 'fwd', key, show: { fig, spin: true }, after: { solid: solidFromFig(key, fig), fig },
      parts: [{ key: 'solid', label: '이 평면도형을 회전축으로 한 바퀴 돌리면?', type: 'one', options: shuffle([key, ...others], r).map((k) => SOLIDS[k]), answer: SOLIDS[key] }],
      why: SPIN_WHY[key] };
  }
  const figs = shuffle([key, ...others], r).map((k) => figFor(k, r));
  figs[figs.findIndex((f) => f.t === SOLID_FIG[key])] = fig;
  return { stage: 1, kind: 'rev', key, show: { solid: solidFromFig(key, fig), name: SOLIDS[key] }, after: { fig },
    parts: [{ key: 'fig', label: `회전축으로 한 바퀴 돌렸을 때 ${SOLIDS[key]}${iga(SOLIDS[key])} 되는 평면도형은?`, type: 'fig', options: figs, answer: SOLID_FIG[key] }],
    why: SPIN_WHY[key] };
}

/* ═════ 2단계: 단면 자르기 ═════ */
export const SHAPES = ['원', '직사각형', '이등변삼각형', '사다리꼴', '반원', '직사각형 2개', '고리 모양(가운데가 빈 원)'];
const SECT = {
  cyl: { contain: '직사각형', perp: '원' }, cone: { contain: '이등변삼각형', perp: '원' }, sph: { contain: '원', perp: '원' },
  frus: { contain: '사다리꼴', perp: '원' }, tube: { contain: '직사각형 2개', perp: '고리 모양(가운데가 빈 원)' }, hemi: { contain: '반원', perp: '원' }
};
export function makeQ2(r = Math.random) {
  for (let t = 0; t < 50; t++) {
    const key = pick(Object.keys(SECT), r);
    // 축에 수직인 단면은 거의 원이라, 넓이까지 물을 수 있는 원기둥·구·가운데가 빈 원기둥에서만 내요
    const cut = ['cyl', 'sph', 'tube'].includes(key) && r() < 0.45 ? 'perp' : 'contain';
    let solid, area = null, wrong = [], why;
    const U = 'cm²';
    if (key === 'cyl') {
      const rr = randint(2, 6, r), h = randint(3, 10, r);
      if (2 * rr === h) continue;
      solid = { k: 'cyl', r: rr, h };
      if (cut === 'contain') { area = numStr(P(2 * rr * h), U); wrong = [numStr(P(rr * h), U), numStr(P(4 * rr * h), U), piStr(P(rr * rr), U)]; why = `축을 품은 단면은 가로 ${2 * rr} cm(지름), 세로 ${h} cm인 직사각형이라 넓이는 ${2 * rr} × ${h} = ${2 * rr * h} (cm²)예요.`; }
      else { area = piStr(P(rr * rr), U); wrong = [piStr(P(2 * rr * rr), U), numStr(P(2 * rr * h), U), piStr(P(2 * rr), U)]; why = `축에 수직인 단면은 밑면과 같은 반지름 ${rr} cm인 원이라 넓이는 π × ${rr}² = ${piStr(P(rr * rr))} (cm²)예요.`; }
    } else if (key === 'cone') {
      const rr = randint(2, 6, r), h = randint(3, 10, r);
      solid = { k: 'cone', r: rr, h };
      if (cut === 'contain') { area = numStr(P(rr * h), U); wrong = [numStr(P(2 * rr * h), U), numStr(F(rr * h, 2), U), piStr(P(rr * rr), U)]; why = `축을 품은 단면은 밑변 ${2 * rr} cm, 높이 ${h} cm인 이등변삼각형이라 넓이는 ½ × ${2 * rr} × ${h} = ${rr * h} (cm²)예요.`; }
      else why = '원뿔을 축에 수직인 평면으로 자르면 단면은 원이에요. 자르는 위치에 따라 원의 크기만 달라져요.';
    } else if (key === 'sph') {
      const rr = randint(2, 8, r);
      solid = { k: 'sph', r: rr };
      area = piStr(P(rr * rr), U); wrong = [piStr(P(2 * rr * rr), U), piStr(P(4 * rr * rr), U), piStr(F(rr * rr, 2), U)];
      why = `구는 어느 방향으로 잘라도 단면이 원이고, 중심을 지나면 반지름 ${rr} cm인 가장 큰 원이라 넓이는 ${piStr(P(rr * rr))} (cm²)예요.`;
    } else if (key === 'frus') {
      const r1 = randint(4, 7, r), r2 = randint(1, 3, r), h = randint(3, 8, r);
      solid = { k: 'frus', r1, r2, h };
      if (cut === 'contain') { area = numStr(P((r1 + r2) * h), U); wrong = [numStr(F((r1 + r2) * h, 2), U), numStr(P(2 * (r1 + r2) * h), U), numStr(P((r1 - r2) * h), U)]; why = `축을 품은 단면은 윗변 ${2 * r2} cm, 아랫변 ${2 * r1} cm, 높이 ${h} cm인 사다리꼴이라 넓이는 ½ × (${2 * r2} + ${2 * r1}) × ${h} = ${(r1 + r2) * h} (cm²)예요.`; }
      else why = '원뿔대를 축에 수직인 평면으로 자르면 단면은 원이에요.';
    } else if (key === 'tube') {
      const R = randint(4, 7, r), rr = randint(1, R - 2, r), h = randint(3, 8, r);
      solid = { k: 'tube', R, r: rr, h };
      if (cut === 'contain') { area = numStr(P(2 * (R - rr) * h), U); wrong = [numStr(P((R - rr) * h), U), numStr(P(2 * R * h), U), numStr(P(2 * (R + rr) * h), U)]; why = `축을 품은 단면은 가로 ${R - rr} cm, 세로 ${h} cm인 직사각형 2개라 넓이는 2 × ${R - rr} × ${h} = ${2 * (R - rr) * h} (cm²)예요.`; }
      else { area = piStr(P(R * R - rr * rr), U); wrong = [piStr(P((R - rr) ** 2), U), piStr(P(R * R), U), piStr(P(R * R + rr * rr), U)]; why = `축에 수직인 단면은 큰 원(반지름 ${R} cm)에서 작은 원(반지름 ${rr} cm)을 뺀 고리 모양이라 넓이는 π × ${R}² − π × ${rr}² = ${piStr(P(R * R - rr * rr))} (cm²)예요.`; }
    } else {
      const rr = randint(2, 8, r);
      solid = { k: 'hemi', r: rr };
      if (cut === 'contain') { area = piStr(F(rr * rr, 2), U); wrong = [piStr(P(rr * rr), U), piStr(P(2 * rr * rr), U), piStr(F(rr * rr, 4), U)]; why = `축을 품은 단면은 반지름 ${rr} cm인 반원이라 넓이는 ½ × π × ${rr}² = ${piStr(F(rr * rr, 2))} (cm²)예요.`; }
      else why = '반구를 축에 수직인 평면으로 자르면 단면은 원이에요.';
    }
    const shape = SECT[key][cut];
    const shapeOpts = shuffle([shape, ...shuffle(SHAPES.filter((s) => s !== shape), r).slice(0, 3)], r);
    const parts = [{ key: 'shape', label: '단면의 모양', type: 'one', options: shapeOpts, answer: shape }];
    if (area) {
      const o = options(area, wrong, r);
      if (!o) continue;
      parts.push({ key: 'area', label: key === 'sph' && cut === 'perp' ? '구의 중심을 지나도록 잘랐을 때 단면의 넓이' : '단면의 넓이', type: 'one', options: o, answer: area });
    }
    return { stage: 2, key, cut, show: { solid, cut, labels: true }, parts, why };
  }
  return makeQ2(r);
}

/* ═════ 3단계: 전개도 펼치기 ═════ */
// 원뿔 전개도: 부채꼴의 중심각 = 360° × (밑면 반지름 ÷ 모선 길이)가 자연수인 (r, l)
export const CONE_PAIRS = [];
for (let l = 4; l <= 15; l++) for (let rr = 1; rr < l; rr++) if ((360 * rr) % l === 0) CONE_PAIRS.push([rr, l]);
export function makeQ3(r = Math.random) {
  for (let t = 0; t < 50; t++) {
    const kind = pick(['cylW', 'cylSide', 'coneDeg', 'coneDeg', 'coneArc', 'coneR'], r);
    if (kind === 'cylW' || kind === 'cylSide') {
      const rr = randint(3, 7, r), h = randint(3, 10, r);
      const net = { k: 'cyl', r: rr, h };
      if (kind === 'cylW') {
        const ans = piStr(P(2 * rr), 'cm');
        const o = options(ans, [piStr(P(rr), 'cm'), piStr(P(rr * rr), 'cm'), numStr(P(2 * rr), 'cm')], r);
        if (!o) continue;
        return { stage: 3, kind, show: { net, ask: 'w' }, parts: [{ key: 'v', label: '옆면인 직사각형의 가로의 길이', type: 'one', options: o, answer: ans }],
          why: `옆면을 말면 직사각형의 가로가 밑면의 둘레와 꼭 맞아요. 가로 = 2π × ${rr} = ${piStr(P(2 * rr))} (cm)예요.` };
      }
      const ans = piStr(P(2 * rr * h), 'cm²');
      const o = options(ans, [piStr(P(rr * h), 'cm²'), piStr(P(rr * rr * h), 'cm²'), piStr(P(2 * rr * rr + 2 * rr * h), 'cm²')], r);
      if (!o) continue;
      return { stage: 3, kind, show: { net, ask: 'side' }, parts: [{ key: 'v', label: '옆면(직사각형)의 넓이', type: 'one', options: o, answer: ans }],
        why: `옆면은 가로 ${piStr(P(2 * rr))} cm(밑면의 둘레), 세로 ${h} cm인 직사각형이라 넓이는 ${piStr(P(2 * rr))} × ${h} = ${piStr(P(2 * rr * h))} (cm²)예요.` };
    }
    const [rr, l] = pick(CONE_PAIRS, r);
    const deg = (360 * rr) / l;
    const net = { k: 'cone', r: rr, l, deg };
    if (kind === 'coneDeg') {
      const ans = `${deg}°`;
      const cands = [360 - deg, deg * 2, deg / 2, (360 * (l - rr)) / l + 30, deg + 30, deg - 30].filter((x) => Number.isInteger(x) && x > 0 && x < 360).map((x) => `${x}°`);
      const o = options(ans, cands, r);
      if (!o || deg === 180) continue;
      return { stage: 3, kind, show: { net, ask: 'deg' }, parts: [{ key: 'v', label: '옆면인 부채꼴의 중심각의 크기', type: 'one', options: o, answer: ans }],
        why: `부채꼴의 호의 길이가 밑면의 둘레(2π × ${rr})와 같아요. 반지름 ${l} cm인 원의 둘레 중 ${rr}/${l}만큼이라 중심각은 360° × ${rr}/${l} = ${deg}°예요.` };
    }
    if (kind === 'coneArc') {
      const ans = piStr(P(2 * rr), 'cm');
      const o = options(ans, [piStr(P(2 * l), 'cm'), piStr(P(rr), 'cm'), piStr(P(l), 'cm')], r);
      if (!o) continue;
      return { stage: 3, kind, show: { net, ask: 'arc' }, parts: [{ key: 'v', label: '옆면인 부채꼴의 호의 길이', type: 'one', options: o, answer: ans }],
        why: `부채꼴의 호는 말았을 때 밑면의 둘레와 꼭 맞아요. 호의 길이 = 2π × ${rr} = ${piStr(P(2 * rr))} (cm)예요.` };
    }
    const ans = `${rr} cm`;
    const o = options(ans, [`${rr + 1} cm`, `${l - rr} cm`, `${2 * rr} cm`, `${rr + 2} cm`].filter((x) => x !== `${l} cm`), r);
    if (!o) continue;
    return { stage: 3, kind, show: { net: { ...net, hideR: true }, ask: 'r' }, parts: [{ key: 'v', label: '이 전개도로 만든 원뿔의 밑면의 반지름', type: 'one', options: o, answer: ans }],
      why: `호의 길이는 2π × ${l} × ${deg}/360 = ${piStr(P(2 * rr))} cm이고, 이것이 밑면의 둘레 2π × (반지름)과 같아요. 그래서 밑면의 반지름은 ${rr} cm예요.` };
  }
  return makeQ3(r);
}

/* ═════ 4단계: 겉넓이·부피 ═════ */
// 원뿔은 (반지름, 높이, 모선) 세 길이가 함께 맞는 것만 써요
export const CONES = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [9, 12, 15], [12, 9, 15], [8, 15, 17], [15, 8, 17]];
export function makeQ4(r = Math.random) {
  for (let t = 0; t < 50; t++) {
    const key = pick(['cyl', 'cone', 'sph', 'hemi'], r);
    const ask = r() < 0.5 ? 'S' : 'V';
    const U = ask === 'S' ? 'cm²' : 'cm³';
    let solid, ans, wrong, why;
    if (key === 'cyl') {
      const rr = randint(2, 6, r), h = randint(3, 10, r);
      solid = { k: 'cyl', r: rr, h };
      if (ask === 'S') { ans = P(2 * rr * rr + 2 * rr * h); wrong = [P(rr * rr + 2 * rr * h), P(2 * rr * h), P(2 * rr * rr + rr * h)]; why = `겉넓이 = (밑넓이) × 2 + (옆넓이) = π × ${rr}² × 2 + 2π × ${rr} × ${h} = ${piStr(P(2 * rr * rr))} + ${piStr(P(2 * rr * h))} = ${piStr(ans)} (cm²)`; }
      else { ans = P(rr * rr * h); wrong = [P(2 * rr * h), F(rr * rr * h, 3), P(4 * rr * rr * h)]; why = `부피 = (밑넓이) × (높이) = π × ${rr}² × ${h} = ${piStr(ans)} (cm³)`; }
    } else if (key === 'cone') {
      const [rr, h, l] = pick(CONES, r);
      solid = { k: 'cone', r: rr, h, l };
      if (ask === 'S') { ans = P(rr * rr + rr * l); wrong = [P(rr * l), P(rr * rr + rr * h), P(rr * rr + 2 * rr * l)]; why = `겉넓이 = (밑넓이) + (옆넓이) = π × ${rr}² + π × ${rr} × ${l} = ${piStr(P(rr * rr))} + ${piStr(P(rr * l))} = ${piStr(ans)} (cm²). 옆넓이에는 높이가 아니라 모선의 길이를 써요.`; }
      else { ans = F(rr * rr * h, 3); wrong = [P(rr * rr * h), F(rr * rr * l, 3), F(rr * h, 3)]; why = `부피 = ⅓ × (밑넓이) × (높이) = ⅓ × π × ${rr}² × ${h} = ${piStr(ans)} (cm³). 부피에는 모선이 아니라 높이를 써요.`; }
    } else if (key === 'sph') {
      const rr = randint(1, 6, r);
      solid = { k: 'sph', r: rr };
      if (ask === 'S') { ans = P(4 * rr * rr); wrong = [P(rr * rr), P(2 * rr * rr), F(4 * rr ** 3, 3)]; why = `겉넓이 = 4πr² = 4 × π × ${rr}² = ${piStr(ans)} (cm²)`; }
      else { ans = F(4 * rr ** 3, 3); wrong = [P(4 * rr ** 3), P(4 * rr * rr), F(4 * rr * rr, 3)]; why = `부피 = ⁴⁄₃πr³ = ⁴⁄₃ × π × ${rr}³ = ${piStr(ans)} (cm³)`; }
    } else {
      const rr = randint(1, 6, r);
      solid = { k: 'hemi', r: rr };
      if (ask === 'S') { ans = P(3 * rr * rr); wrong = [P(2 * rr * rr), P(4 * rr * rr), P(rr * rr)]; why = `반구의 겉넓이 = (구의 겉넓이의 반) + (밑면인 원) = 2π × ${rr}² + π × ${rr}² = ${piStr(ans)} (cm²). 잘린 면(원)을 꼭 더해요.`; }
      else { ans = F(2 * rr ** 3, 3); wrong = [F(4 * rr ** 3, 3), F(rr ** 3, 3), P(2 * rr ** 3)]; why = `반구의 부피 = ½ × ⁴⁄₃πr³ = ⅔ × π × ${rr}³ = ${piStr(ans)} (cm³)`; }
    }
    const o = options(piStr(ans, U), wrong.map((w) => piStr(w, U)), r);
    if (!o) continue;
    return { stage: 4, key, ask, show: { solid, labels: true }, parts: [{ key: 'v', label: `이 ${SOLIDS[key]}의 ${ask === 'S' ? '겉넓이' : '부피'}`, type: 'one', options: o, answer: piStr(ans, U) }], why };
  }
  return makeQ4(r);
}

/* ═════ 5단계: 합체 입체 ═════ */
export const COMBOS = { cylhemi: '원기둥 위에 반구를 얹은 입체', cylcone2: '원기둥 위에 원뿔을 얹은 입체', carve: '원기둥에서 원뿔 모양을 파낸 입체', tube: '가운데가 빈 원기둥' };
export function makeQ5(r = Math.random) {
  for (let t = 0; t < 50; t++) {
    const key = pick(Object.keys(COMBOS), r);
    const ask = r() < 0.5 ? 'S' : 'V';
    const U = ask === 'S' ? 'cm²' : 'cm³';
    let solid, ans, wrong, why;
    if (key === 'cylhemi') {
      const rr = randint(2, 6, r), h = randint(3, 9, r);
      solid = { k: 'cylhemi', r: rr, h };
      if (ask === 'S') {
        ans = P(rr * rr + 2 * rr * h + 2 * rr * rr);
        wrong = [P(2 * rr * rr + 2 * rr * h + 2 * rr * rr), P(2 * rr * h + 2 * rr * rr), P(rr * rr + 2 * rr * h + 4 * rr * rr)];
        why = `밑면 π × ${rr}² + 원기둥 옆면 2π × ${rr} × ${h} + 반구 곡면 2π × ${rr}² = ${piStr(ans)} (cm²). 원기둥과 반구가 맞붙은 면은 겉에 드러나지 않아 빼요.`;
      } else {
        ans = fadd(P(rr * rr * h), F(2 * rr ** 3, 3));
        wrong = [fadd(P(rr * rr * h), F(4 * rr ** 3, 3)), P(rr * rr * h), fadd(P(rr * rr * h), F(rr ** 3, 3))];
        why = `원기둥 π × ${rr}² × ${h} = ${piStr(P(rr * rr * h))}에 반구 ⅔ × π × ${rr}³ = ${piStr(F(2 * rr ** 3, 3))}를 더해 ${piStr(ans)} (cm³)예요.`;
      }
    } else if (key === 'cylcone2') {
      const [rr, h2, l] = pick(CONES.filter((c) => c[0] <= 9), r), h1 = randint(3, 9, r);
      solid = { k: 'cylcone', r: rr, h1, h2, l };
      if (ask === 'S') {
        ans = P(rr * rr + 2 * rr * h1 + rr * l);
        wrong = [P(2 * rr * rr + 2 * rr * h1 + rr * l), P(rr * rr + 2 * rr * h1 + rr * h2), P(rr * rr + 2 * rr * h1)];
        why = `밑면 π × ${rr}² + 원기둥 옆면 2π × ${rr} × ${h1} + 원뿔 옆면 π × ${rr} × ${l} = ${piStr(ans)} (cm²). 맞붙은 면은 빼고, 원뿔 옆면에는 모선을 써요.`;
      } else {
        ans = fadd(P(rr * rr * h1), F(rr * rr * h2, 3));
        wrong = [P(rr * rr * (h1 + h2)), F(rr * rr * (h1 + h2), 3), fadd(P(rr * rr * h1), F(rr * rr * l, 3))];
        why = `원기둥 π × ${rr}² × ${h1} = ${piStr(P(rr * rr * h1))}에 원뿔 ⅓ × π × ${rr}² × ${h2} = ${piStr(F(rr * rr * h2, 3))}를 더해 ${piStr(ans)} (cm³)예요.`;
      }
    } else if (key === 'carve') {
      const [rr, h, l] = pick(CONES, r);
      solid = { k: 'carve', r: rr, h, l };
      if (ask === 'S') {
        ans = P(rr * rr + 2 * rr * h + rr * l);
        wrong = [P(2 * rr * rr + 2 * rr * h + rr * l), P(rr * rr + 2 * rr * h), P(rr * rr + 2 * rr * h + rr * h)];
        why = `윗면 π × ${rr}² + 원기둥 옆면 2π × ${rr} × ${h} + 파낸 원뿔의 옆면 π × ${rr} × ${l} = ${piStr(ans)} (cm²). 아랫면은 원뿔로 파내서 없어요.`;
      } else {
        ans = F(2 * rr * rr * h, 3);
        wrong = [F(4 * rr * rr * h, 3), F(rr * rr * h, 3), P(rr * rr * h)];
        why = `원기둥 π × ${rr}² × ${h}에서 원뿔 ⅓ × π × ${rr}² × ${h}를 빼면 ⅔ × π × ${rr}² × ${h} = ${piStr(ans)} (cm³)예요.`;
      }
    } else {
      const R = randint(4, 7, r), rr = randint(1, R - 2, r), h = randint(3, 9, r);
      solid = { k: 'tube', R, r: rr, h };
      if (ask === 'S') {
        ans = P(2 * (R * R - rr * rr) + 2 * R * h + 2 * rr * h);
        wrong = [P(2 * (R * R - rr * rr) + 2 * R * h), P(2 * R * R + 2 * R * h + 2 * rr * h), P((R * R - rr * rr) + 2 * R * h + 2 * rr * h)];
        why = `위아래 고리 2 × (π × ${R}² − π × ${rr}²) + 바깥 옆면 2π × ${R} × ${h} + 안쪽 옆면 2π × ${rr} × ${h} = ${piStr(ans)} (cm²). 구멍 안쪽 옆면도 겉넓이에 들어가요.`;
      } else {
        ans = P((R * R - rr * rr) * h);
        wrong = [P((R - rr) ** 2 * h), P(R * R * h), P((R * R + rr * rr) * h)];
        why = `큰 원기둥 π × ${R}² × ${h}에서 작은 원기둥 π × ${rr}² × ${h}를 빼면 ${piStr(ans)} (cm³)예요.`;
      }
    }
    const o = options(piStr(ans, U), wrong.map((w) => piStr(w, U)), r);
    if (!o) continue;
    return { stage: 5, key, ask, show: { solid, labels: true, name: COMBOS[key] }, parts: [{ key: 'v', label: `이 입체의 ${ask === 'S' ? '겉넓이' : '부피'}`, type: 'one', options: o, answer: piStr(ans, U) }], why };
  }
  return makeQ5(r);
}

/* ═════ 6단계: 1 : 2 : 3의 비밀 ═════
   구가 꼭 맞게 들어가는 원기둥(반지름 r, 높이 2r)과, 그 원기둥과 밑면·높이가 같은 원뿔 */
const TRIO = { cone: ['원뿔', F(2, 3)], sph: ['구', F(4, 3)], cyl: ['원기둥', F(2, 1)] }; // 부피 = (계수) × πr³
const PART_OF = { cone: 1, sph: 2, cyl: 3 };
export function makeQ6(r = Math.random) {
  for (let t = 0; t < 50; t++) {
    const kind = pick(['fromR', 'fromV', 'fromV', 'ratio'], r);
    const rr = kind === 'fromR' ? randint(1, 6, r) : 3 * randint(1, 2, r);
    const r3 = rr ** 3;
    const vol = (k) => fmul(TRIO[k][1], P(r3));
    if (kind === 'ratio') {
      const ans = '1 : 2 : 3';
      return { stage: 6, kind, show: { trio: { r: 3 }, ask: 'ratio' }, parts: [{ key: 'v', label: '원뿔 : 구 : 원기둥의 부피의 비', type: 'one', options: shuffle([ans, '1 : 3 : 2', '2 : 3 : 4', '1 : 2 : 4'], r), answer: ans }],
        why: '반지름이 r일 때 원뿔은 ⅔πr³, 구는 ⁴⁄₃πr³, 원기둥은 2πr³이라 부피의 비는 1 : 2 : 3이에요. 원뿔과 구를 합치면 원기둥과 같아요.' };
    }
    const keys = shuffle(['cone', 'sph', 'cyl'], r);
    const [given, askK] = keys;
    const ans = piStr(vol(askK), 'cm³');
    const wrongs = ['cone', 'sph', 'cyl'].filter((k) => k !== askK).map((k) => piStr(vol(k), 'cm³'));
    wrongs.push(piStr(fmul(vol(askK), F(3, 2)), 'cm³'), piStr(fmul(vol(askK), F(1, 2)), 'cm³'), piStr(P(r3), 'cm³'));
    const o = options(ans, wrongs, r);
    if (!o) continue;
    if (kind === 'fromR') {
      return { stage: 6, kind, show: { trio: { r: rr }, ask: askK }, parts: [{ key: 'v', label: `반지름이 ${rr} cm인 구가 꼭 맞게 들어가는 원기둥이 있어요. 이때 ${TRIO[askK][0]}의 부피는?`, type: 'one', options: o, answer: ans }],
        why: `원기둥은 반지름 ${rr} cm, 높이 ${2 * rr} cm예요. ${TRIO[askK][0]}의 부피는 ${coef(TRIO[askK][1])}πr³ = ${piStr(vol(askK))} (cm³)예요. (원뿔 : 구 : 원기둥 = 1 : 2 : 3)` };
    }
    return { stage: 6, kind, show: { trio: { r: rr }, ask: askK, given }, parts: [{ key: 'v', label: `${TRIO[given][0]}의 부피가 ${piStr(vol(given), 'cm³')}일 때 ${TRIO[askK][0]}의 부피는?`, type: 'one', options: o, answer: ans }],
      why: `원뿔 : 구 : 원기둥 = 1 : 2 : 3이에요. ${TRIO[given][0]}의 부피 ${piStr(vol(given))}는 비율 ${PART_OF[given]}에 해당하니 비율 1은 ${piStr(fmul(vol(given), F(1, PART_OF[given])))}이에요. ${TRIO[askK][0]}는 비율 ${PART_OF[askK]}라서 ${piStr(vol(askK))} (cm³)예요.` };
  }
  return makeQ6(r);
}

/* ═════ 7단계(보너스): 물통 채우기 ═════ */
export function makeQ7(r = Math.random) {
  for (let t = 0; t < 400; t++) {
    const kind = pick(['coneToCyl', 'hemiToCyl', 'coneLevel', 'sphLevel'], r);
    if (kind === 'coneToCyl') {
      const cr = randint(1, 4, r), ch = randint(2, 9, r), R = randint(2, 8, r), H = randint(4, 20, r);
      const n = (3 * R * R * H) / (cr * cr * ch);
      if (!Number.isInteger(n) || n < 3 || n > 40 || R === cr && H === ch) continue;
      const o = options(`${n}번`, [n % 3 === 0 ? `${n / 3}번` : null, `${n * 3}번`, Number.isInteger((3 * R * H) / (cr * ch)) ? `${(3 * R * H) / (cr * ch)}번` : null, `${n + 1}번`, `${n * 2}번`], r);
      if (!o) continue;
      return { stage: 7, kind, show: { pour: [{ k: 'cone', r: cr, h: ch }, { k: 'cyl', r: R, h: H }] },
        parts: [{ key: 'v', label: `밑면의 반지름 ${cr} cm, 높이 ${ch} cm인 원뿔 모양 컵으로 물을 떠서, 밑면의 반지름 ${R} cm, 높이 ${H} cm인 원기둥 모양 물통을 가득 채우려면 몇 번 부어야 할까요?`, type: 'one', options: o, answer: `${n}번` }],
        why: `물통 π × ${R}² × ${H} = ${piStr(P(R * R * H))}, 컵 ⅓ × π × ${cr}² × ${ch} = ${piStr(F(cr * cr * ch, 3))}이에요. ${piStr(P(R * R * H))} ÷ ${piStr(F(cr * cr * ch, 3))} = ${n}(번). π는 나눌 때 약분돼요.` };
    }
    if (kind === 'hemiToCyl') {
      const hr = randint(1, 6, r), R = hr, H = randint(2, 30, r);
      const n = (3 * H) / (2 * hr);
      if (!Number.isInteger(n) || n < 2 || n > 30) continue;
      const o = options(`${n}번`, [`${n * 2}번`, Number.isInteger(n / 2) ? `${n / 2}번` : null, `${n + 1}번`, `${n * 3}번`], r);
      if (!o) continue;
      return { stage: 7, kind, show: { pour: [{ k: 'hemi', r: hr }, { k: 'cyl', r: R, h: H }] },
        parts: [{ key: 'v', label: `반지름 ${hr} cm인 반구 모양 그릇으로 물을 떠서, 밑면의 반지름 ${R} cm, 높이 ${H} cm인 원기둥 모양 통을 가득 채우려면 몇 번 부어야 할까요?`, type: 'one', options: o, answer: `${n}번` }],
        why: `통 π × ${R}² × ${H} = ${piStr(P(R * R * H))}, 그릇 ⅔ × π × ${hr}³ = ${piStr(F(2 * hr ** 3, 3))}이에요. 나누면 ${n}(번)이에요.` };
    }
    if (kind === 'coneLevel') {
      const cr = randint(2, 8, r), ch = randint(3, 18, r), R = randint(2, 8, r);
      const lv = (cr * cr * ch) / (3 * R * R);
      // 그릇이 너무 가늘고 길지 않게 (물 높이 ≤ 반지름의 6배)
      if (!Number.isInteger(lv) || lv < 1 || lv > 6 * R || R === cr) continue;
      const o = options(`${lv} cm`, [`${lv * 3} cm`, Number.isInteger(lv / 3) && lv / 3 > 0 ? `${lv / 3} cm` : null, `${ch} cm`, `${lv + 1} cm`, `${lv * 2} cm`], r);
      if (!o) continue;
      return { stage: 7, kind, show: { pour: [{ k: 'cone', r: cr, h: ch }, { k: 'cyl', r: R, h: lv + 2, noH: true }] },
        parts: [{ key: 'v', label: `밑면의 반지름 ${cr} cm, 높이 ${ch} cm인 원뿔 모양 그릇에 가득 담긴 물을 밑면의 반지름 ${R} cm인 원기둥 모양 그릇에 모두 부었어요. 물의 높이는 몇 cm일까요?`, type: 'one', options: o, answer: `${lv} cm` }],
        why: `물의 부피는 ⅓ × π × ${cr}² × ${ch} = ${piStr(F(cr * cr * ch, 3))} (cm³)예요. 원기둥의 밑넓이 π × ${R}² = ${piStr(P(R * R))}로 나누면 높이는 ${lv} cm예요.` };
    }
    // 구 모양 얼음이 녹거나, 반구 모양 그릇의 물을 옮겨 담기
    const ball = r() < 0.55, sr = randint(1, 9, r), R = randint(2, 9, r);
    const c = ball ? F(4 * sr ** 3, 3) : F(2 * sr ** 3, 3);
    const lv = c[0] / c[1] / (R * R);
    if (!Number.isInteger(lv) || lv < 1 || lv > 6 * R) continue;
    const noThird = (ball ? 4 : 2) * sr ** 3 / (R * R);
    const o = options(`${lv} cm`, [`${lv * 3} cm`, Number.isInteger(noThird) ? `${noThird} cm` : null, `${lv + 1} cm`, `${lv * 2} cm`, `${ball ? 2 * sr : sr} cm`], r);
    if (!o) continue;
    const label = ball
      ? `반지름 ${sr} cm인 구 모양 얼음이 모두 녹아 밑면의 반지름 ${R} cm인 원기둥 모양 컵에 담겼어요. 물의 높이는 몇 cm일까요? (얼음이 녹아도 부피는 같다고 해요)`
      : `반지름 ${sr} cm인 반구 모양 그릇에 가득 담긴 물을 밑면의 반지름 ${R} cm인 원기둥 모양 그릇에 모두 부었어요. 물의 높이는 몇 cm일까요?`;
    return { stage: 7, kind: 'sphLevel', show: { pour: [{ k: ball ? 'sph' : 'hemi', r: sr }, { k: 'cyl', r: R, h: lv + 2, noH: true }] },
      parts: [{ key: 'v', label, type: 'one', options: o, answer: `${lv} cm` }],
      why: `${ball ? '구' : '반구'}의 부피는 ${ball ? '⁴⁄₃' : '⅔'} × π × ${sr}³ = ${piStr(c)} (cm³)예요. 원기둥의 밑넓이 π × ${R}² = ${piStr(P(R * R))}로 나누면 높이는 ${lv} cm예요.` };
  }
  return makeQ7(r);
}

export const MAKERS = { 1: makeQ1, 2: makeQ2, 3: makeQ3, 4: makeQ4, 5: makeQ5, 6: makeQ6, 7: makeQ7 };
// 같은 문제가 바로 이어 나오지 않게
export function makeQuestion(stage, prev, r = Math.random) {
  const key = (q) => JSON.stringify([q.show, q.parts.map((p) => p.label + p.answer)]);
  for (let i = 0; i < 10; i++) {
    const q = MAKERS[stage](r);
    if (!prev || key(q) !== key(prev)) return q;
  }
  return MAKERS[stage](r);
}
export const partRight = (part, sel) => sel === part.answer;
