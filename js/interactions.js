// Mouse/touch e tastiera
/* ---------- puntatore ---------- */
// Sfondo: trascina = riquadro di selezione · Spazio + trascina, tasto centrale o un dito su touch = sposta la vista
// Pallino d'ingresso: trascina su un blocco = riattacca lì, nel vuoto = stacca · pallino d'uscita: trascina su un blocco = collegalo qui
let P = null, spaceDown = false;
const boxEl = $('#box');

cv.addEventListener('pointerdown', e => {
  closeMenu(); hidePreview();
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  const g = e.target.closest('.mn[data-id]'), cn = e.target.closest('[data-note]'), base = { sx: e.clientX, sy: e.clientY, moved: false };
  if (e.button === 1 || spaceDown || (e.pointerType === 'touch' && !g && !cn)) {
    e.preventDefault(); const v = view(); P = { ...base, mode: 'pan', vx: v.x, vy: v.y };
  } else if (g && e.target.closest('[data-sub]')) {
    return openSub(g.dataset.id);
  } else if (g && e.target.closest('[data-anc]')) {
    const id = g.dataset.id, a = e.target.closest('[data-anc]'), dot = a.querySelector('.adot'), l = S.L.get(id);
    S.link = { kind: a.dataset.anc, id, x1: l.x + +dot.getAttribute('cx'), y1: l.y + +dot.getAttribute('cy'), x2: null, y2: null, over: null };
    P = { ...base, mode: 'link', id }; cv.classList.add('linking');
  } else if (g && e.target.closest('[data-rsz]')) {
    const id = g.dataset.id, l = S.L.get(id);
    P = { ...base, mode: 'resize', id, w0: l.w, h0: l.h, dir: l.dir };
  } else if (g || cn) {
    const id = g ? g.dataset.id : cn.dataset.note;
    if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleSel(id); render(); return; }
    const wasMulti = S.sels.has(id) && S.sels.size > 1;
    if (!S.sels.has(id)) selectOnly(id); else S.sel = id;
    const t = curTree();
    const movers = topSelected(t).map(n => ({ o: n, ox: n.dx || 0, oy: n.dy || 0, kx: 'dx', ky: 'dy' }))
      .concat((t.notes || []).filter(nt => S.sels.has(nt.id)).map(nt => ({ o: nt, ox: nt.x, oy: nt.y, kx: 'x', ky: 'y' })));
    P = { ...base, mode: 'drag', id, movers, wasMulti };
  } else {
    P = { ...base, mode: 'box', add: e.shiftKey || e.ctrlKey || e.metaKey, prev: new Set(S.sels) };
  }
  cv.setPointerCapture(e.pointerId);
});

cv.addEventListener('pointermove', e => {
  if (!P) return;
  const dx = e.clientX - P.sx, dy = e.clientY - P.sy;
  if (!P.moved && Math.hypot(dx, dy) < 4) return;
  if (!P.moved && (P.mode === 'drag' || P.mode === 'resize')) snapshot();
  P.moved = true;
  const v = view();
  if (P.mode === 'pan') { cv.classList.add('panning'); v.x = P.vx + dx; v.y = P.vy + dy; v.fresh = false; applyView(); return; }
  if (P.mode === 'box') return dragBox(e);
  if (P.mode === 'link') {
    const p = toSvg(e.clientX, e.clientY), el = document.elementFromPoint(e.clientX, e.clientY), g = el && el.closest('.mn[data-id]');
    S.link.x2 = p.x; S.link.y2 = p.y; S.link.over = g && g.dataset.id !== S.link.id ? g.dataset.id : null;
    return render();
  }
  if (P.mode === 'drag') {
    P.movers.forEach(m => {
      m.o[m.kx] = Math.round(m.ox + dx / v.k); m.o[m.ky] = Math.round(m.oy + dy / v.k);
      if (m.kx === 'dx' && !m.o.dx && !m.o.dy) { delete m.o.dx; delete m.o.dy; }
    });
    return render();
  }
  // ridimensiona: il layout tiene fermo il lato verso il genitore e il centro verticale,
  // quindi la crescita va raddoppiata dove il blocco si allarga su due lati (così la maniglia segue il puntatore)
  const n = findM(curTree(), P.id).n, gx = P.dir === 0 ? 2 : P.dir < 0 ? -1 : 1;
  n.w = clamp(Math.round(P.w0 + gx * dx / v.k), RMIN[0], RMAX[0]); n.h = clamp(Math.round(P.h0 + 2 * dy / v.k), RMIN[1], RMAX[1]);
  render();
});

function dragBox(e) {
  const x1 = Math.min(P.sx, e.clientX), y1 = Math.min(P.sy, e.clientY), x2 = Math.max(P.sx, e.clientX), y2 = Math.max(P.sy, e.clientY);
  Object.assign(boxEl.style, { left: x1 + 'px', top: y1 + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' }); boxEl.hidden = false;
  const a = toSvg(x1, y1), b = toSvg(x2, y2);
  const hit = M => [...M].filter(([, l]) => l.x < b.x && l.x + l.w > a.x && l.y < b.y && l.y + l.h > a.y).map(([id]) => id);
  const hits = hit(S.L).concat(hit(S.NL));
  S.sels = new Set(P.add ? [...P.prev, ...hits] : hits);
  S.sel = hits.length ? hits[hits.length - 1] : [...S.sels].pop() || null;
  render();
}

function endPointer(e) {
  if (!P) return; cv.classList.remove('panning'); boxEl.hidden = true;
  if (P.mode === 'link') {
    const lk = S.link, moved = P.moved; S.link = null; P = null; cv.classList.remove('linking');
    if (!moved) { selectOnly(lk.id); return render(); }
    if (lk.over) return lk.kind === 'in' ? reparent(lk.id, lk.over) : reparent(lk.over, lk.id);
    if (lk.kind === 'in') return detach(lk.id, lk.x2, lk.y2);
    render(); return toast('Rilascia sopra un blocco per collegarlo');
  }
  if (!P.moved) {
    const had = S.sels.size;
    if (P.mode === 'box' && !P.add) clearSel();
    if (P.mode === 'drag' && P.wasMulti) selectOnly(P.id);
    if (P.mode !== 'box' || had !== S.sels.size) render();
  } else if (P.mode === 'drag' || P.mode === 'resize') save();
  P = null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('dblclick', e => {
  // il primo clic ridisegna la tela: si guarda cosa c'è sotto il puntatore adesso, non e.target
  const el = document.elementFromPoint(e.clientX, e.clientY); if (!el) return;
  const edge = el.closest('[data-edge]'); if (edge) return startEdgeNote(edge.dataset.edge);
  const cn = el.closest('[data-note]'); if (cn) return startNoteEdit(cn.dataset.note);
  const g = el.closest('.mn[data-id]'); if (g && !el.closest('[data-anc]')) startEdit(g.dataset.id, true);
});
cv.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
cv.addEventListener('wheel', e => {
  e.preventDefault(); closeMenu(); hidePreview();
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
  else { const v = view(); v.x -= e.deltaX; v.y -= e.deltaY; v.fresh = false; applyView(); }
  placeEditor();
}, { passive: false });
// anteprima della struttura interna passando sull'icona
cv.addEventListener('pointerover', e => {
  const s = e.target.closest('[data-sub]'); if (!s || P) return;
  showPreview(s.closest('.mn').dataset.id, s.getBoundingClientRect());
});
cv.addEventListener('pointerout', e => { if (e.target.closest('[data-sub]')) hidePreview(); });

/* ---------- tastiera ---------- */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (editing) endEdit(true); return saveProject(); }
  if (editing || !$('#menu').hidden || e.target.closest('.bar')) return;
  if (e.code === 'Space') { e.preventDefault(); if (!spaceDown) { spaceDown = true; cv.classList.add('grab'); } return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') {
    if (S.sels.size) { clearSel(); return render(); }
    if (S.path.length) return goToLevel(S.path.length - 1);
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return removeSelected(); }
  const t = curTree();
  if (!S.sel) { if (e.key === 'Tab') { e.preventDefault(); selectOnly(t.id); render(); } return; }
  if (findNote(t, S.sel)) { if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); startNoteEdit(S.sel); } return; }
  if (e.key === 'Tab') { e.preventDefault(); return addChild(S.sel); }
  if (e.key === 'Enter') { e.preventDefault(); return addSibling(S.sel); }
  if (e.key === 'F2') { e.preventDefault(); return startEdit(S.sel, false); }
});
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; cv.classList.remove('grab'); } });
addEventListener('blur', () => { spaceDown = false; cv.classList.remove('grab'); });
