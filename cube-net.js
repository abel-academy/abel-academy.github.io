// 정육면체 전개도 계산 (화면과 상관없는 부분)
// · 칸 6개로 된 모양(헥소미노) 35가지를 모두 만들고, 접어 보아 정육면체 전개도(11가지)인지 가려요
// · 접기는 '정육면체를 굴리기'로 계산: 기준 칸에 정육면체를 놓고 옆 칸으로 굴리면, 그 칸에 닿는 면이 그 칸의 면이에요
// 칸은 [줄, 칸] 순서의 [r, c] 숫자 쌍으로 나타내요.

export const DIRS = [[-1, 0, 'N'], [1, 0, 'S'], [0, 1, 'E'], [0, -1, 'W']];
const OPP = { D: 'U', U: 'D', N: 'S', S: 'N', E: 'W', W: 'E' };
const k = (r, c) => r + ',' + c;

export function normalize(cells) {
  const minR = Math.min(...cells.map((x) => x[0]));
  const minC = Math.min(...cells.map((x) => x[1]));
  return cells.map(([r, c]) => [r - minR, c - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
const sig = (cells) => normalize(cells).map(([r, c]) => k(r, c)).join(';');
const rot = (cells) => cells.map(([r, c]) => [c, -r]);
const flip = (cells) => cells.map(([r, c]) => [r, -c]);

// 돌리고 뒤집은 모양 (같은 모양은 한 번만)
export function variants(cells) {
  const out = new Map();
  let cur = cells;
  for (let i = 0; i < 4; i++) {
    for (const v of [cur, flip(cur)]) { const n = normalize(v); out.set(sig(n), n); }
    cur = rot(cur);
  }
  return [...out.values()];
}
const canonical = (cells) => variants(cells).map(sig).sort()[0];

// 칸 6개로 된 모든 모양 (돌리거나 뒤집어 같은 모양은 하나로) → 35가지
function allHexominoes() {
  let level = new Map([[sig([[0, 0]]), [[0, 0]]]]);
  for (let n = 1; n < 6; n++) {
    const next = new Map();
    for (const cells of level.values()) {
      const has = new Set(cells.map(([r, c]) => k(r, c)));
      for (const [r, c] of cells) {
        for (const [dr, dc] of DIRS) {
          if (has.has(k(r + dr, c + dc))) continue;
          const nx = normalize([...cells, [r + dr, c + dc]]);
          next.set(sig(nx), nx);
        }
      }
    }
    level = next;
  }
  const free = new Map();
  for (const cells of level.values()) { const cs = canonical(cells); if (!free.has(cs)) free.set(cs, normalize(cells)); }
  return [...free.values()];
}

// 굴리기: 정육면체가 dir 쪽으로 넘어가면 어느 면이 바닥에 닿는지
function roll(s, dir) {
  const t = { ...s };
  if (dir === 'E') { t.D = s.E; t.E = s.U; t.U = s.W; t.W = s.D; }
  if (dir === 'W') { t.D = s.W; t.W = s.U; t.U = s.E; t.E = s.D; }
  if (dir === 'S') { t.D = s.S; t.S = s.U; t.U = s.N; t.N = s.D; }
  if (dir === 'N') { t.D = s.N; t.N = s.U; t.U = s.S; t.S = s.D; }
  return t;
}

// 접을 때 기준이 되는 칸: 이웃이 가장 많고 가운데에 가까운 칸
export function rootIndex(cells) {
  const has = new Set(cells.map(([r, c]) => k(r, c)));
  const cr = cells.reduce((a, x) => a + x[0], 0) / cells.length;
  const cc = cells.reduce((a, x) => a + x[1], 0) / cells.length;
  let best = 0, bestScore = -Infinity;
  cells.forEach(([r, c], i) => {
    const n = DIRS.filter(([dr, dc]) => has.has(k(r + dr, c + dc))).length;
    const score = n * 10 - Math.hypot(r - cr, c - cc);
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}

// 접어 보기: 칸마다 정육면체의 어느 면이 되는지, 접는 순서(나무 모양)
// faces[i]: 'D'(바닥)·'U'(뚜껑)·'N'·'S'·'E'·'W' / tree[i] = { parent, dir } / valid: 6면이 모두 다르면 정육면체
export function fold(cells) {
  const idx = new Map(cells.map(([r, c], i) => [k(r, c), i]));
  const root = rootIndex(cells);
  const faces = new Array(cells.length).fill(null);
  const tree = new Array(cells.length).fill(null);
  const states = new Array(cells.length).fill(null);
  states[root] = { D: 'D', U: 'U', N: 'N', S: 'S', E: 'E', W: 'W' };
  faces[root] = 'D';
  tree[root] = { parent: -1, dir: null, depth: 0 };
  const queue = [root];
  while (queue.length) {
    const i = queue.shift();
    const [r, c] = cells[i];
    for (const [dr, dc, dir] of DIRS) {
      const j = idx.get(k(r + dr, c + dc));
      if (j == null || states[j]) continue;
      states[j] = roll(states[i], dir);
      faces[j] = states[j].D;
      tree[j] = { parent: i, dir, depth: tree[i].depth + 1 };
      queue.push(j);
    }
  }
  const valid = cells.length === 6 && new Set(faces).size === 6;
  return { root, faces, tree, valid };
}

export const isCubeNet = (cells) => fold(cells).valid;

// 마주 보는 칸 (정육면체 전개도일 때)
export function oppositeIndex(cells, i) {
  const { faces } = fold(cells);
  return faces.indexOf(OPP[faces[i]]);
}

// 2×2로 뭉친 곳이 있거나 한 줄로 5칸 이상이면 '한눈에 안 되는 모양'
function obviouslyBad(cells) {
  const has = new Set(cells.map(([r, c]) => k(r, c)));
  if (cells.some(([r, c]) => has.has(k(r, c + 1)) && has.has(k(r + 1, c)) && has.has(k(r + 1, c + 1)))) return true;
  const rows = {}, cols = {};
  cells.forEach(([r, c]) => { rows[r] = (rows[r] || 0) + 1; cols[c] = (cols[c] || 0) + 1; });
  return Math.max(...Object.values(rows), ...Object.values(cols)) >= 5;
}

const HEX = allHexominoes();
export const CUBE_NETS = HEX.filter(isCubeNet);          // 11가지
export const NOT_NETS = HEX.filter((h) => !isCubeNet(h)); // 24가지
const TRICKY = NOT_NETS.filter((h) => !obviouslyBad(h));

/* ── 문제 만들기 ── */
const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
const randomVariant = (cells, rnd) => pick(variants(cells), rnd);
function shuffle(a, rnd) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// 1단계: 정육면체가 되는 전개도일까?
export function makeQ1(rnd = Math.random) {
  const ok = rnd() < 0.5;
  const base = ok ? pick(CUBE_NETS, rnd) : pick(rnd() < 0.75 && TRICKY.length ? TRICKY : NOT_NETS, rnd);
  const cells = randomVariant(base, rnd);
  return { stage: 1, cells, answer: ok };
}

// 2단계: ★ 면과 마주 보는 면
export function makeQ2(rnd = Math.random) {
  const cells = randomVariant(pick(CUBE_NETS, rnd), rnd);
  const star = Math.floor(rnd() * 6);
  return { stage: 2, cells, star, answer: oppositeIndex(cells, star) };
}

// 3단계: 주사위 (마주 보는 두 면의 눈의 합은 7)
export function makeQ3(rnd = Math.random) {
  const cells = randomVariant(pick(CUBE_NETS, rnd), rnd);
  const { faces } = fold(cells);
  const pairs = shuffle([[1, 6], [2, 5], [3, 4]], rnd).map((p) => (rnd() < 0.5 ? p : [p[1], p[0]]));
  const val = {};
  [['D', 'U'], ['N', 'S'], ['E', 'W']].forEach(([a, b], i) => { val[a] = pairs[i][0]; val[b] = pairs[i][1]; });
  const numbers = faces.map((f) => val[f]);
  const ask = Math.floor(rnd() * 6);
  const opp = faces.indexOf(OPP[faces[ask]]);
  // 마주 보는 면은 꼭 보여 주고, 나머지는 1~2개만 보여 줌 (다 보여 주면 빠진 수만 찾게 되므로)
  const others = shuffle([0, 1, 2, 3, 4, 5].filter((i) => i !== ask && i !== opp), rnd).slice(0, 1 + Math.floor(rnd() * 2));
  const shown = [opp, ...others];
  return { stage: 3, cells, numbers, ask, opp, shown, answer: numbers[ask] };
}

// 4단계: 한 칸을 더 붙여 전개도 완성
export function makeQ4(rnd = Math.random) {
  for (let tries = 0; tries < 50; tries++) {
    const full = randomVariant(pick(CUBE_NETS, rnd), rnd);
    const removeAt = Math.floor(rnd() * 6);
    const rest = full.filter((_, i) => i !== removeAt);
    if (!connected(rest)) continue;
    // 보기 칸: 남은 5칸 옆의 빈칸 모두 (한 칸씩 여유를 두고 그림)
    const shifted = rest.map(([r, c]) => [r + 1, c + 1]);
    const has = new Set(shifted.map(([r, c]) => k(r, c)));
    const slots = new Map();
    shifted.forEach(([r, c]) => DIRS.forEach(([dr, dc]) => { const key = k(r + dr, c + dc); if (!has.has(key)) slots.set(key, [r + dr, c + dc]); }));
    const options = [...slots.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const good = options.map((o) => isCubeNet([...shifted, o]));
    if (!good.some(Boolean) || good.every(Boolean)) continue;
    return { stage: 4, cells: shifted, options, good };
  }
  return makeQ4(rnd);
}

export function connected(cells) {
  const idx = new Map(cells.map(([r, c], i) => [k(r, c), i]));
  const seen = new Set([0]);
  const q = [0];
  while (q.length) {
    const [r, c] = cells[q.shift()];
    DIRS.forEach(([dr, dc]) => { const j = idx.get(k(r + dr, c + dc)); if (j != null && !seen.has(j)) { seen.add(j); q.push(j); } });
  }
  return seen.size === cells.length;
}

export const MAKERS = { 1: makeQ1, 2: makeQ2, 3: makeQ3, 4: makeQ4 };
// 같은 모양이 바로 이어 나오지 않게
export function makeQuestion(stage, prev, rnd = Math.random) {
  for (let i = 0; i < 8; i++) {
    const q = MAKERS[stage](rnd);
    if (!prev || sig(q.cells) !== sig(prev.cells)) return q;
  }
  return MAKERS[stage](rnd);
}
