// Mouse/touch e tastiera
/* ---------- puntatore ---------- */
// Sfondo: trascina = riquadro di selezione · Spazio + trascina, tasto centrale o un dito su touch = sposta la vista
// Pallini: si trascina da un'uscita a un ingresso (o al contrario) per collegare; ingresso nel vuoto = stacca.
// Le posizioni sono fisse: collegare o staccare non sposta nessun blocco.
let P = null, spaceDown = false;
const boxEl = $('#box');

cv.addEventListener('pointerdown', e => {
  closeMenu(); hidePreview();
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  const g = e.target.closest('.mn[data-id]'), cn = e.target.closest('[data-note]'), base = { sx: e.clientX, sy: e.clientY, moved: false };
  if (e.button === 1 || spaceDown || (e.pointerType === 'touch' && !g && !cn)) {
    e.preventDefault(); const v = view(); P = { ...base, mode: 'pan', vx: v.x, vy: v.y };
  } else if (e.target.closest('.enote[data-edge]')) {
    // nota di un collegamento: trascinandola si sposta, con un clic si seleziona il collegamento
    const id = e.target.closest('.enote').dataset.edge, ed = findM(curTree(), id).n.edge || {};
    P = { ...base, mode: 'enote', id, ox: ed.nx || 0, oy: ed.ny || 0 };
  } else if (e.target.closest('[data-subprev]')) {
    return openSub(e.target.closest('[data-subprev]').dataset.subprev); // clic sullo schema: si entra
  } else if (g && e.target.closest('[data-sub]')) {
    return openSub(g.dataset.id);
  } else if (g && e.target.closest('[data-anc]')) {
    const id = g.dataset.id, a = e.target.closest('[data-anc]'), dot = a.querySelector('.adot'), l = S.L.get(id);
    S.link = { kind: a.dataset.anc, side: a.dataset.side, id, x1: l.x + +dot.getAttribute('cx'), y1: l.y + +dot.getAttribute('cy'), x2: null, y2: null, over: null, overAnc: null };
    P = { ...base, mode: 'link', id }; cv.classList.add('linking');
  } else if (g && e.target.closest('[data-rsz]')) {
    const id = g.dataset.id, l = S.L.get(id);
    P = { ...base, mode: 'resize', id, w0: l.w, h0: l.h };
  } else if (g || cn) {
    const id = g ? g.dataset.id : cn.dataset.note;
    if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleSel(id); render(); return; }
    const wasMulti = S.sels.has(id) && S.sels.size > 1;
    if (!S.sels.has(id)) selectOnly(id); else S.sel = id;
    P = { ...base, mode: 'drag', id, movers: dragMovers(curTree()), wasMulti, alt: e.altKey };
  } else {
    // sfondo o collegamento: trascinando si disegna il riquadro, con un clic su un collegamento lo si seleziona
    const edge = e.target.closest('[data-edge]');
    P = { ...base, mode: 'box', add: e.shiftKey || e.ctrlKey || e.metaKey, prev: new Set(S.sels), edge: edge && edge.dataset.edge };
  }
  cv.setPointerCapture(e.pointerId);
});

let lastMouse = null; // per incollare dove si trova il mouse
cv.addEventListener('pointermove', e => {
  lastMouse = { x: e.clientX, y: e.clientY };
  if (!P) return;
  const dx = e.clientX - P.sx, dy = e.clientY - P.sy;
  if (!P.moved && Math.hypot(dx, dy) < 4) return;
  if (!P.moved && (P.mode === 'drag' || P.mode === 'resize' || P.mode === 'enote')) {
    snapshot();
    if (P.mode === 'drag' && P.alt) P.movers = altCopies(curTree()); // Alt + trascina: si sposta la copia
  }
  P.moved = true;
  const v = view();
  if (P.mode === 'pan') { cv.classList.add('panning'); v.x = P.vx + dx; v.y = P.vy + dy; v.fresh = false; applyView(); return; }
  if (P.mode === 'box') return dragBox(e);
  if (P.mode === 'enote') {
    const n = findM(curTree(), P.id).n; n.edge = n.edge || {};
    n.edge.nx = Math.round(P.ox + dx / v.k); n.edge.ny = Math.round(P.oy + dy / v.k);
    if (!n.edge.nx && !n.edge.ny) { delete n.edge.nx; delete n.edge.ny; }
    selectEdge(P.id); return render();
  }
  if (P.mode === 'link') {
    const p = toSvg(e.clientX, e.clientY), el = document.elementFromPoint(e.clientX, e.clientY), g = el && el.closest('.mn[data-id]');
    const ok = g && g.dataset.id !== S.link.id, a = ok && el.closest('[data-anc]');
    S.link.x2 = p.x; S.link.y2 = p.y; S.link.over = ok ? g.dataset.id : null;
    S.link.overAnc = a ? { kind: a.dataset.anc, side: a.dataset.side } : null;
    return render();
  }
  if (P.mode === 'drag') {
    P.movers.forEach(m => { m.o.x = Math.round(m.ox + dx / v.k); m.o.y = Math.round(m.oy + dy / v.k); });
    return render();
  }
  // ridimensiona dall'angolo in basso a destra: l'angolo in alto a sinistra resta fermo
  const n = findM(curTree(), P.id).n;
  n.w = clamp(Math.round(P.w0 + dx / v.k), RMIN[0], RMAX[0]); n.h = clamp(Math.round(P.h0 + dy / v.k), RMIN[1], RMAX[1]);
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
    if (lk.over) {
      const oa = lk.overAnc;
      // un'uscita va su un ingresso e viceversa; sul corpo del blocco vale il pallino giusto
      if (oa && oa.kind === lk.kind) { render(); return toast(lk.kind === 'out' ? 'Un’uscita va collegata a un ingresso' : 'Un ingresso va collegato a un’uscita'); }
      if (lk.kind === 'out') return connect(lk.id, lk.over, lk.side);
      const t = curTree(), pl = S.L.get(lk.over), cl = S.L.get(lk.id);
      const side = oa ? oa.side : lk.over === t.id ? (cl.x + cl.w / 2 < pl.x + pl.w / 2 ? 'l' : 'r') : null;
      return connect(lk.over, lk.id, side);
    }
    if (lk.kind === 'in') return detach(lk.id); // resta esattamente dov'è
    render(); return toast('Rilascia sull’ingresso di un blocco per collegarlo');
  }
  if (!P.moved) {
    const had = S.sels.size, hadE = S.esel;
    if (P.mode === 'enote' || (P.mode === 'box' && P.edge)) selectEdge(P.id || P.edge);
    else if (P.mode === 'box' && !P.add) clearSel();
    if (P.mode === 'drag' && P.wasMulti) selectOnly(P.id);
    if (P.mode !== 'box' || had !== S.sels.size || hadE !== S.esel) render();
  } else if (P.mode === 'drag' || P.mode === 'resize' || P.mode === 'enote') {
    save(); if (P.alt && P.mode === 'drag') toast(S.sels.size > 1 ? `${S.sels.size} copie create` : 'Copia creata');
  }
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
  if (editing || !$('#menu').hidden || (e.target.closest && e.target.closest('.bar'))) return;
  if (e.code === 'Space') { e.preventDefault(); if (!spaceDown) { spaceDown = true; cv.classList.add('grab'); } return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'c') { e.preventDefault(); return copySelected(); }
    if (k === 'd') { e.preventDefault(); return duplicateSelected(); }
    if (k === 'v') {
      e.preventDefault();
      const m = lastMouse && lastMouse.y > BAR_H ? lastMouse : { x: innerWidth / 2, y: (innerHeight + BAR_H) / 2 };
      return pasteClip(toSvg(m.x, m.y));
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (S.esel && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); return deleteEdge(S.esel); }
  if (e.key === 'Escape') {
    if (S.sels.size || S.esel) { clearSel(); return render(); }
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
