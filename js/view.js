// Pan e zoom della tela SVG
function view() { return S.views._ || (S.views._ = { x: innerWidth / 2, y: innerHeight / 2, k: 1, fresh: true }); }
function applyView() { const v = view(); vp.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`); }
function toSvg(cx, cy) { const v = view(); return { x: (cx - v.x) / v.k, y: (cy - v.y) / v.k }; }
function zoomAt(cx, cy, f) {
  const v = view(), nk = clamp(v.k * f, 0.2, 3);
  v.x = cx - (cx - v.x) * (nk / v.k); v.y = cy - (cy - v.y) * (nk / v.k); v.k = nk; v.fresh = false; applyView();
}
function fit() {
  let b; try { b = vp.getBBox(); } catch (e) { return; }
  if (!b.width) return;
  const W = innerWidth, H = innerHeight - BAR_H, v = view(); // sotto la barra dei menu
  v.k = clamp(Math.min((W - 80) / b.width, (H - 120) / b.height, 1.2), 0.2, 1.2);
  v.x = (W - b.width * v.k) / 2 - b.x * v.k; v.y = BAR_H + (H - b.height * v.k) / 2 - b.y * v.k; v.fresh = false;
  applyView();
}
