// 입체 공방: 그림 그리기 (원기둥·원뿔·구 같은 회전체, 평면도형, 전개도, 단면)
// 살짝 위에서 내려다본 모습으로 그려요. 보이지 않는 선은 점선이에요.

const NS = 'http://www.w3.org/2000/svg';
export function S(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, String(v));
  kids.flat().forEach((c) => { if (c != null) e.append(c instanceof Node ? c : document.createTextNode(String(c))); });
  return e;
}
const f1 = (v) => Math.round(v * 10) / 10;
const ell = 0.3; // 타원 납작한 정도

/* ── 회전체 ──
   spec.k: cyl · cone · sph · hemi · frus · tube · dcone · cylcone · cylhemi · carve · trio
   opts: { labels: 길이 표시, cut: 'contain'|'perp' 자르는 평면, w, h: 그림 크기, label: 접근성 이름 } */
export function solidSVG(sp, o = {}) {
  const W = o.w || 300, H = o.h || 250, pad = 18, room = o.labels ? 64 : 10;
  let segs = [], dome = null, sphere = null, maxR, top;
  const k = sp.k;
  if (k === 'cyl') segs = [[0, sp.h, sp.r, sp.r]];
  else if (k === 'cone') segs = [[0, sp.h, sp.r, 0]];
  else if (k === 'frus') segs = [[0, sp.h, sp.r1, sp.r2]];
  else if (k === 'tube') segs = [[0, sp.h, sp.R, sp.R]];
  else if (k === 'dcone') segs = [[0, sp.a, 0, sp.r], [sp.a, sp.h, sp.r, 0]];
  else if (k === 'cylcone') segs = [[0, sp.h1, sp.r, sp.r], [sp.h1, sp.h1 + sp.h2, sp.r, 0]];
  else if (k === 'cylhemi') { segs = [[0, sp.h, sp.r, sp.r]]; dome = { y: sp.h, r: sp.r }; }
  else if (k === 'carve') segs = [[0, sp.h, sp.r, sp.r]];
  else if (k === 'trio') segs = [[0, 2 * sp.r, sp.r, sp.r]];
  else if (k === 'hemi') dome = { y: 0, r: sp.r };
  else if (k === 'sph') sphere = { y: sp.r, r: sp.r };
  maxR = Math.max(...segs.flatMap((s) => [s[2], s[3]]), dome ? dome.r : 0, sphere ? sphere.r : 0);
  top = Math.max(...segs.map((s) => s[1]), dome ? dome.y + dome.r : 0, sphere ? 2 * sphere.r : 0);
  const roomL = o.labels && sp.l && k !== 'carve' ? 40 : 0; // 왼쪽에 모선 길이를 쓸 자리
  const sc = Math.min((H - 2 * pad) / (top + 2 * ell * maxR), (W - 2 * pad - room - roomL) / (2 * maxR));
  const cx = pad + roomL + maxR * sc + (W - 2 * pad - room - roomL - 2 * maxR * sc) / 2;
  const base = H - pad - ell * maxR * sc;
  const X = (x) => f1(cx + x * sc), Y = (y) => f1(base - y * sc), R = (r) => f1(r * sc), RY = (r) => f1(r * sc * ell);
  const fill = [], hid = [], vis = [], lab = [];
  const front = (y, r) => `M${X(-r)} ${Y(y)}A${R(r)} ${RY(r)} 0 0 0 ${X(r)} ${Y(y)}`;
  const back = (y, r) => `M${X(-r)} ${Y(y)}A${R(r)} ${RY(r)} 0 0 1 ${X(r)} ${Y(y)}`;
  // 옆면의 윤곽선: 원뿔처럼 기울어진 면은 밑면 타원에 닿는(접하는) 선이 윤곽이에요.
  // 각 부분의 접점 위치 sinφ = s (위로 좁아지면 +, 뒤쪽). 원기둥은 s = 0 (양 끝점)
  const sil = segs.map(([y0, y1, r0, r1]) => { const s = y1 !== y0 ? Math.max(-0.95, Math.min(0.95, (-ell * (r1 - r0)) / (y1 - y0))) : 0; return { s, c: Math.sqrt(1 - s * s) }; });
  const PX = (x) => f1(cx + x * sc), PY = (y, r, s) => f1(base - y * sc - r * sc * ell * s);
  // 높이 y, 반지름 r인 테두리: 접점 사이의 앞쪽(보임)과 뒤쪽(점선)
  const rimVis = (y, r, s, c) => `M${PX(-r * c)} ${PY(y, r, s)}A${R(r)} ${RY(r)} 0 ${s > 0 ? 1 : 0} 0 ${PX(r * c)} ${PY(y, r, s)}`;
  const rimHid = (y, r, s, c) => `M${PX(-r * c)} ${PY(y, r, s)}A${R(r)} ${RY(r)} 0 ${s < 0 ? 1 : 0} 1 ${PX(r * c)} ${PY(y, r, s)}`;
  // 면 칠하기
  segs.forEach(([y0, y1, r0, r1], i) => {
    const { s, c } = sil[i];
    fill.push(S('polygon', { points: `${PX(-r0 * c)},${PY(y0, r0, s)} ${PX(r0 * c)},${PY(y0, r0, s)} ${PX(r1 * c)},${PY(y1, r1, s)} ${PX(-r1 * c)},${PY(y1, r1, s)}`, class: 'sf' }));
    if (r0 > 0) fill.push(S('ellipse', { cx: X(0), cy: Y(y0), rx: R(r0), ry: RY(r0), class: 'sf' }));
  });
  const last = segs[segs.length - 1];
  if (last && last[3] > 0 && !dome) fill.push(S('ellipse', { cx: X(0), cy: Y(last[1]), rx: R(last[3]), ry: RY(last[3]), class: 'sf top' }));
  if (dome) fill.push(S('path', { d: `M${X(-dome.r)} ${Y(dome.y)}A${R(dome.r)} ${R(dome.r)} 0 0 1 ${X(dome.r)} ${Y(dome.y)}A${R(dome.r)} ${RY(dome.r)} 0 0 1 ${X(-dome.r)} ${Y(dome.y)}Z`, class: 'sf' }));
  if (k === 'hemi') fill.push(S('ellipse', { cx: X(0), cy: Y(0), rx: R(sp.r), ry: RY(sp.r), class: 'sf' }));
  if (sphere) fill.push(S('circle', { cx: X(0), cy: Y(sphere.y), r: R(sphere.r), class: 'sf ball' }));
  // 테두리
  segs.forEach(([y0, y1, r0, r1], i) => {
    const { s, c } = sil[i];
    vis.push(S('line', { x1: PX(-r0 * c), y1: PY(y0, r0, s), x2: PX(-r1 * c), y2: PY(y1, r1, s), class: 'se' }), S('line', { x1: PX(r0 * c), y1: PY(y0, r0, s), x2: PX(r1 * c), y2: PY(y1, r1, s), class: 'se' }));
    if (r0 > 0) { vis.push(S('path', { d: rimVis(y0, r0, s, c), class: 'se' })); hid.push(S('path', { d: rimHid(y0, r0, s, c), class: 'sh' })); }
    if (i === segs.length - 1 && r1 > 0 && !dome) vis.push(S('ellipse', { cx: X(0), cy: Y(y1), rx: R(r1), ry: RY(r1), class: 'se' }));
  });
  if (dome) {
    vis.push(S('path', { d: `M${X(-dome.r)} ${Y(dome.y)}A${R(dome.r)} ${R(dome.r)} 0 0 1 ${X(dome.r)} ${Y(dome.y)}`, class: 'se' }));
    vis.push(S('path', { d: front(dome.y, dome.r), class: 'se' }));
    hid.push(S('path', { d: back(dome.y, dome.r), class: 'sh' }));
  }
  if (sphere) {
    vis.push(S('circle', { cx: X(0), cy: Y(sphere.y), r: R(sphere.r), class: 'se' }), S('path', { d: front(sphere.y, sphere.r), class: 'se thin' }));
    hid.push(S('path', { d: back(sphere.y, sphere.r), class: 'sh' }));
  }
  if (k === 'tube') { // 구멍: 윗면에 작은 타원, 안쪽 벽은 점선
    fill.push(S('ellipse', { cx: X(0), cy: Y(sp.h), rx: R(sp.r), ry: RY(sp.r), class: 'sf hole' }));
    vis.push(S('ellipse', { cx: X(0), cy: Y(sp.h), rx: R(sp.r), ry: RY(sp.r), class: 'se' }));
    hid.push(S('line', { x1: X(-sp.r), y1: Y(0), x2: X(-sp.r), y2: Y(sp.h), class: 'sh' }), S('line', { x1: X(sp.r), y1: Y(0), x2: X(sp.r), y2: Y(sp.h), class: 'sh' }), S('path', { d: front(0, sp.r), class: 'sh' }));
  }
  if (k === 'carve') hid.push(S('line', { x1: X(-sp.r), y1: Y(0), x2: X(0), y2: Y(sp.h), class: 'sh in' }), S('line', { x1: X(sp.r), y1: Y(0), x2: X(0), y2: Y(sp.h), class: 'sh in' }));
  if (k === 'trio') {
    hid.push(S('circle', { cx: X(0), cy: Y(sp.r), r: R(sp.r), class: 'sh in ball' }), S('line', { x1: X(-sp.r), y1: Y(0), x2: X(0), y2: Y(2 * sp.r), class: 'sh in cone' }), S('line', { x1: X(sp.r), y1: Y(0), x2: X(0), y2: Y(2 * sp.r), class: 'sh in cone' }));
  }
  // 자르는 평면
  const over = [];
  // 축을 품은 평면: 비스듬히 보이게(앞 왼쪽 → 뒤 오른쪽) 그리고, 회전축도 함께 그려요
  if (o.cut === 'contain') {
    const dx = maxR * 1.3 * Math.cos(0.62) * sc, dy = maxR * 1.3 * Math.sin(0.62) * sc * ell * 1.6;
    const yb = Y(-0.12 * maxR), yt = Y(top + 0.12 * maxR);
    over.push(S('polygon', { points: `${f1(cx - dx)},${f1(yb + dy)} ${f1(cx + dx)},${f1(yb - dy)} ${f1(cx + dx)},${f1(yt - dy)} ${f1(cx - dx)},${f1(yt + dy)}`, class: 'cutp' }));
  }
  if (o.cut) over.push(S('line', { x1: X(0), y1: Y(-0.3 * maxR), x2: X(0), y2: Y(top + 0.3 * maxR), class: 'ax' }));
  if (o.cut === 'perp') {
    const m = top / 2, a = maxR * 1.55, b = maxR * 1.15, dy = RY(maxR) * 1.25;
    over.push(S('polygon', { points: `${X(-a)},${f1(Y(m) + dy)} ${X(b)},${f1(Y(m) + dy)} ${X(a)},${f1(Y(m) - dy)} ${X(-b)},${f1(Y(m) - dy)}`, class: 'cutp' }));
  }
  // 길이 표시
  if (o.labels) {
    const rLine = (y, r, text, up = true) => {
      lab.push(S('line', { x1: X(0), y1: Y(y), x2: X(r), y2: Y(y), class: 'lr' }), S('circle', { cx: X(0), cy: Y(y), r: 2.5, class: 'ld' }));
      lab.push(S('text', { x: f1((X(0) + X(r)) / 2), y: f1(Y(y) + (up ? -6 : 15)), class: 'lt mid' }, text));
    };
    const hLine = (y0, y1, text, dx = 0) => {
      const x = f1(X(maxR) + 14 + dx);
      lab.push(S('line', { x1: x, y1: Y(y0), x2: x, y2: Y(y1), class: 'lh' }), S('line', { x1: x - 4, y1: Y(y0), x2: x + 4, y2: Y(y0), class: 'lh' }), S('line', { x1: x - 4, y1: Y(y1), x2: x + 4, y2: Y(y1), class: 'lh' }));
      lab.push(S('text', { x: x + 6, y: f1((Y(y0) + Y(y1)) / 2 + 5), class: 'lt' }, text));
    };
    // 모선은 왼쪽 빗변 옆에 (오른쪽에는 높이 표시가 있어요)
    const slant = (i, text) => {
      const [y0, y1, r0] = segs[i], { s, c } = sil[i];
      const x0 = PX(-r0 * c), yy0 = PY(y0, r0, s), x1 = X(0), yy1 = Y(y1);
      lab.push(S('line', { x1: x0, y1: yy0, x2: x1, y2: yy1, class: 'lsl' }));
      lab.push(S('text', { x: f1((x0 + x1) / 2 - 8), y: f1((yy0 + yy1) / 2), class: 'lt end sl' }, text));
    };
    const cm = (v) => `${v} cm`;
    if (k === 'cyl') { rLine(sp.h, sp.r, cm(sp.r)); hLine(0, sp.h, cm(sp.h)); }
    if (k === 'cone') { hid.push(S('line', { x1: X(0), y1: Y(0), x2: X(0), y2: Y(sp.h), class: 'sh ax' })); rLine(0, sp.r, cm(sp.r), false); hLine(0, sp.h, cm(sp.h)); if (sp.l) slant(0, `모선 ${cm(sp.l)}`); }
    if (k === 'sph') rLine(sp.r, sp.r, cm(sp.r));
    if (k === 'hemi') rLine(0, sp.r, cm(sp.r), false);
    if (k === 'frus') { rLine(sp.h, sp.r2, cm(sp.r2)); rLine(0, sp.r1, cm(sp.r1), false); hLine(0, sp.h, cm(sp.h)); }
    if (k === 'tube') { rLine(sp.h, sp.R, '', true); lab.push(S('text', { x: X(sp.R * 0.72), y: f1(Y(sp.h) - 8), class: 'lt mid' }, cm(sp.R))); rLine(0, sp.r, cm(sp.r), false); hLine(0, sp.h, cm(sp.h)); }
    if (k === 'cylcone') { rLine(0, sp.r, cm(sp.r), false); hLine(0, sp.h1, cm(sp.h1)); hLine(sp.h1, sp.h1 + sp.h2, cm(sp.h2)); if (sp.l) slant(1, `모선 ${cm(sp.l)}`); }
    if (k === 'cylhemi') { rLine(sp.h, sp.r, cm(sp.r)); hLine(0, sp.h, cm(sp.h)); }
    if (k === 'carve') { rLine(sp.h, sp.r, cm(sp.r)); hLine(0, sp.h, cm(sp.h)); lab.push(S('text', { x: X(-sp.r * 0.6), y: f1(Y(sp.h * 0.62)), class: 'lt mid' }, `모선 ${cm(sp.l)}`)); }
    if (k === 'trio' && o.trioR) rLine(sp.r, sp.r, cm(sp.r));
    if (k === 'dcone') hLine(0, sp.h, cm(sp.h));
    if (sp.noH) lab.length = 0, rLine(0, sp.r, cm(sp.r), false);
  }
  return S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sd-svg', role: 'img', 'aria-label': o.label || '입체도형 그림' }, S('g', {}, fill), over, S('g', {}, hid), S('g', {}, vis), S('g', {}, lab));
}

/* ── 평면도형과 회전축 ── 도형은 축(x = 0)의 오른쪽 */
export function figPath(f, u) {
  const P = (x, y) => `${f1(x * u)},${f1(-y * u)}`;
  if (f.t === 'rect') return `M${P(0, 0)}L${P(f.w, 0)}L${P(f.w, f.h)}L${P(0, f.h)}Z`;
  if (f.t === 'tri') return `M${P(0, 0)}L${P(f.w, 0)}L${P(0, f.h)}Z`;
  if (f.t === 'semi') return `M${P(0, 0)}A${f1(f.R * u)} ${f1(f.R * u)} 0 0 0 ${P(0, 2 * f.R)}Z`;
  if (f.t === 'quarter') return `M${P(0, 0)}L${P(f.R, 0)}A${f1(f.R * u)} ${f1(f.R * u)} 0 0 0 ${P(0, f.R)}Z`;
  if (f.t === 'trap') return `M${P(0, 0)}L${P(f.w1, 0)}L${P(f.w2, f.h)}L${P(0, f.h)}Z`;
  if (f.t === 'gap') return `M${P(f.g, 0)}L${P(f.g + f.w, 0)}L${P(f.g + f.w, f.h)}L${P(f.g, f.h)}Z`;
  if (f.t === 'kite') return `M${P(0, 0)}L${P(f.w, f.a)}L${P(0, f.h)}Z`;
  return `M${P(0, 0)}L${P(f.w, 0)}L${P(f.w, f.h1)}L${P(0, f.h1 + f.h2)}Z`;
}
export const figSize = (f) => ({
  w: f.t === 'semi' || f.t === 'quarter' ? f.R : f.t === 'trap' ? f.w1 : f.t === 'gap' ? f.g + f.w : f.w,
  h: f.t === 'semi' ? 2 * f.R : f.t === 'quarter' ? f.R : f.t === 'house' ? f.h1 + f.h2 : f.h
});
// 축과 함께 그린 평면도형 (small: 보기 단추용)
export function figSVG(f, o = {}) {
  const { w, h } = figSize(f);
  const u = o.u || (o.small ? 16 : 34);
  const padL = o.small ? 10 : 34, padT = o.small ? 10 : 22, W = padL + w * u + (o.small ? 10 : 34), H = padT * 2 + h * u;
  const g = S('g', { transform: `translate(${padL} ${padT + h * u})` },
    S('line', { x1: 0, y1: f1(padT * 0.6), x2: 0, y2: f1(-h * u - padT * 0.6), class: 'ax' }),
    S('path', { d: figPath(f, u), class: 'fg' }));
  if (!o.small) g.append(S('text', { x: -6, y: f1(-h * u - padT * 0.2), class: 'lt end' }, '축'));
  return S('svg', { viewBox: `0 0 ${f1(W)} ${f1(H)}`, class: 'sd-fig' + (o.small ? ' small' : ''), role: 'img', 'aria-label': o.label || '회전축과 평면도형' }, g);
}
// 축을 따라 도는 평면도형 (돌아간 자리를 흐리게 남겨 입체가 보이게)
export function spinView(f, reduce) {
  const { w, h } = figSize(f), u = 30, W = w * u, H = h * u;
  const one = (cls, deg) => S('svg', { viewBox: `0 ${-H} ${f1(W)} ${f1(H)}`, width: f1(W), height: f1(H), class: cls, style: deg != null ? `transform:rotateY(${deg}deg)` : null, 'aria-hidden': 'true' }, S('path', { d: figPath(f, u), class: 'fg' }));
  const stage = document.createElement('div');
  stage.className = 'sd-spin-stage';
  stage.style.width = `${f1(2 * W + 40)}px`;
  stage.style.height = `${f1(H + 30)}px`;
  stage.style.setProperty('--ax', `${f1(W + 20)}px`);
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', '평면도형이 회전축을 따라 한 바퀴 도는 모습');
  stage.append(...[30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((d) => one('sd-ghost', d)));
  if (!reduce) stage.append(one('sd-spinner'));
  else stage.append(one('sd-ghost strong', 0), one('sd-ghost strong', 180));
  const axis = document.createElement('span'); axis.className = 'sd-axis'; axis.setAttribute('aria-hidden', 'true');
  stage.append(axis);
  return stage;
}

/* ── 단면 ── */
export function sectionSVG(sp, cut) {
  const W = 260, H = 190, pad = 24;
  const shapes = [];
  let bw, bh, draw;
  if (cut === 'perp') {
    const Rr = sp.k === 'tube' ? sp.R : sp.r;
    bw = bh = 2 * Rr;
    draw = (X, Y, s) => { shapes.push(S('circle', { cx: X(0), cy: Y(Rr), r: f1(Rr * s), class: 'sec' })); if (sp.k === 'tube') shapes.push(S('circle', { cx: X(0), cy: Y(Rr), r: f1(sp.r * s), class: 'sec-hole' })); };
  } else {
    const prof = { cyl: [[-sp.r, 0], [sp.r, 0], [sp.r, sp.h], [-sp.r, sp.h]], cone: [[-sp.r, 0], [sp.r, 0], [0, sp.h]], frus: [[-sp.r1, 0], [sp.r1, 0], [sp.r2, sp.h], [-sp.r2, sp.h]] }[sp.k];
    if (prof) { bw = 2 * Math.max(...prof.map((p) => Math.abs(p[0]))); bh = Math.max(...prof.map((p) => p[1])); draw = (X, Y) => shapes.push(S('polygon', { points: prof.map(([x, y]) => `${X(x)},${Y(y)}`).join(' '), class: 'sec' })); }
    else if (sp.k === 'tube') { bw = 2 * sp.R; bh = sp.h; draw = (X, Y) => [[-sp.R, -sp.r], [sp.r, sp.R]].forEach(([a, b]) => shapes.push(S('polygon', { points: `${X(a)},${Y(0)} ${X(b)},${Y(0)} ${X(b)},${Y(sp.h)} ${X(a)},${Y(sp.h)}`, class: 'sec' }))); }
    else if (sp.k === 'sph') { bw = bh = 2 * sp.r; draw = (X, Y, s) => shapes.push(S('circle', { cx: X(0), cy: Y(sp.r), r: f1(sp.r * s), class: 'sec' })); }
    else { bw = 2 * sp.r; bh = sp.r; draw = (X, Y, s) => shapes.push(S('path', { d: `M${X(-sp.r)} ${Y(0)}A${f1(sp.r * s)} ${f1(sp.r * s)} 0 0 1 ${X(sp.r)} ${Y(0)}Z`, class: 'sec' })); }
  }
  const s = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
  const X = (x) => f1(W / 2 + x * s), Y = (y) => f1(H - pad - y * s - ((H - 2 * pad) - bh * s) / 2);
  draw(X, Y, s);
  return S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sd-svg sec-svg', role: 'img', 'aria-label': '단면 모양' }, shapes);
}

/* ── 전개도 ── */
export function netSVG(n) {
  const W = 320, H = 260, pad = 20;
  const items = [], labels = [];
  let pts = [];
  if (n.k === 'cyl') {
    const w = 2 * Math.PI * n.r, h = n.h, r = n.r;
    pts = [[0, -r * 2], [w, h + 2 * r]];
    const s = Math.min((W - 2 * pad) / w, (H - 2 * pad) / (h + 4 * r));
    const ox = (W - w * s) / 2, oy = (H - (h + 4 * r) * s) / 2 + 2 * r * s;
    const X = (x) => f1(ox + x * s), Y = (y) => f1(oy + y * s);
    items.push(S('rect', { x: X(0), y: Y(0), width: f1(w * s), height: f1(h * s), class: 'nf' + (n.ask === 'side' ? ' ask' : '') }));
    items.push(S('circle', { cx: X(w / 2), cy: Y(-r), r: f1(r * s), class: 'nf' }), S('circle', { cx: X(w / 2), cy: Y(h + r), r: f1(r * s), class: 'nf' }));
    labels.push(S('line', { x1: X(w / 2), y1: Y(-r), x2: X(w / 2 + r), y2: Y(-r), class: 'lr' }), S('text', { x: X(w / 2 + r / 2), y: f1(Y(-r) - 5), class: 'lt mid' }, `${n.r} cm`));
    labels.push(S('text', { x: f1(X(w) + 6), y: Y(h / 2), class: 'lt' }, `${n.h} cm`));
    labels.push(S('text', { x: X(w / 2), y: f1(Y(h) - 8), class: 'lt mid q' }, n.ask === 'w' ? '가로 = ?' : '넓이 = ?'));
  } else {
    const { l, r, deg } = n;
    const a0 = (90 - deg / 2) * Math.PI / 180, a1 = (90 + deg / 2) * Math.PI / 180;
    const arcPts = Array.from({ length: 41 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 40; return [l * Math.cos(a), l * Math.sin(a)]; });
    const circ = [0, l + r];
    pts = [[0, 0], ...arcPts, [circ[0] - r, circ[1] - r], [circ[0] + r, circ[1] + r]];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
    const s = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
    const ox = (W - bw * s) / 2 - Math.min(...xs) * s, oy = (H - bh * s) / 2 - Math.min(...ys) * s;
    const X = (x) => f1(ox + x * s), Y = (y) => f1(oy + y * s);
    const large = deg > 180 ? 1 : 0;
    const [sx, sy] = arcPts[0], [ex, ey] = arcPts[arcPts.length - 1];
    items.push(S('path', { d: `M${X(0)} ${Y(0)}L${X(sx)} ${Y(sy)}A${f1(l * s)} ${f1(l * s)} 0 ${large} 1 ${X(ex)} ${Y(ey)}Z`, class: 'nf' + (n.ask === 'arc' ? ' ask-arc' : '') }));
    items.push(S('circle', { cx: X(circ[0]), cy: Y(circ[1]), r: f1(r * s), class: 'nf' }));
    if (n.ask === 'arc') items.push(S('path', { d: `M${X(sx)} ${Y(sy)}A${f1(l * s)} ${f1(l * s)} 0 ${large} 1 ${X(ex)} ${Y(ey)}`, class: 'arc-hl' }));
    const ra = (Math.PI / 180) * 90;
    const rr = Math.min(l * 0.22, 1.6);
    items.push(S('path', { d: `M${X(rr * Math.cos(a0))} ${Y(rr * Math.sin(a0))}A${f1(rr * s)} ${f1(rr * s)} 0 ${large} 1 ${X(rr * Math.cos(a1))} ${Y(rr * Math.sin(a1))}`, class: 'ang' }));
    labels.push(S('text', { x: X(0), y: f1(Y(rr) + 16), class: 'lt mid' + (n.ask === 'deg' ? ' q' : '') }, n.ask === 'deg' ? '?' : `${deg}°`));
    labels.push(S('text', { x: f1((X(0) + X(sx)) / 2 + 8), y: f1((Y(0) + Y(sy)) / 2), class: 'lt' }, `${l} cm`));
    labels.push(S('line', { x1: X(circ[0]), y1: Y(circ[1]), x2: X(circ[0] + r), y2: Y(circ[1]), class: 'lr' }), S('text', { x: X(circ[0] + r / 2), y: f1(Y(circ[1]) - 5), class: 'lt mid' + (n.hideR ? ' q' : '') }, n.hideR ? '?' : `${r} cm`));
    // 묻는 호 바깥쪽(오른쪽 아래)에 물음표
    if (n.ask === 'arc') { const a = a0 + (a1 - a0) * 0.18, d = l + 0.9 * Math.max(1, l * 0.08); labels.push(S('text', { x: f1(X(d * Math.cos(a)) + 4), y: f1(Y(d * Math.sin(a)) + 6), class: 'lt q' }, '호 = ?')); }
    void ra;
  }
  return S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'sd-svg net-svg', role: 'img', 'aria-label': n.k === 'cyl' ? '원기둥의 전개도' : '원뿔의 전개도' }, items, labels);
}
