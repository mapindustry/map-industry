// Mouse/touch e tastiera
/* ---------- puntatore ---------- */
// Sfondo: trascina = riquadro di selezione · Spazio + trascina, tasto centrale o un dito su touch = sposta la vista
// Blocchi selezionati trascinati sopra un altro blocco = si comprimono dentro di lui come suoi rami.
// Pallini: trascina da un'uscita a un ingresso (o al contrario) per collegare; lungo il bordo per spostarli;
// ingresso nel vuoto = stacca il collegamento principale; pallino di struttura su un blocco = collegalo come sua parte.
// Clic su un pallino (senza trascinare) = menu del pallino: tipo, duplica, elimina.
// Le posizioni sono fisse: collegare o staccare non sposta nessun blocco.
let P = null, spaceDown = false;
const DROP_WAIT = 450; // ms di sosta sopra un blocco prima che diventi la destinazione del rilascio
const boxEl = $('#box');

// Due dita sulla tela (telefono, tablet) = zoom e spostamento della vista. Il secondo dito annulla quello che il
// primo stava iniziando (un trascinamento già avviato resta dov'è ed è salvato).
const TP = new Map(); // dita appoggiate sulla tela: pointerId → { x, y }
function startPinch() {
  if (P) {
    clearTimeout(P.dropT); S.dropOn = null; S.rail = null; boxEl.hidden = true; cv.classList.remove('panning', 'linking');
    if (P.mode === 'link') S.link = null;
    if (P.moved && (P.mode === 'drag' || P.mode === 'resize' || P.mode === 'enote')) save();
    if (P.mode === 'legend') S.legDrag = null;
  }
  const [a, b] = [...TP.values()], v = view();
  P = { mode: 'pinch', d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, vx: v.x, vy: v.y, k0: v.k };
  lastTap = null; render();
}
function pinchMove() {
  const [a, b] = [...TP.values()], v = view();
  const k = clamp(P.k0 * Math.hypot(b.x - a.x, b.y - a.y) / P.d0, 0.2, 3), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  // il punto della mappa che stava fra le dita all'inizio resta fra le dita
  v.x = mx - (P.mx - P.vx) / P.k0 * k; v.y = my - (P.my - P.vy) / P.k0 * k; v.k = k; v.fresh = false;
  applyView(); placeEditor();
}

cv.addEventListener('pointerdown', e => {
  closeMenu(); hidePreview();
  if (e.pointerType === 'touch') {
    TP.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (TP.size >= 2) {
      e.preventDefault(); if (TP.size === 2) startPinch();
      try { cv.setPointerCapture(e.pointerId); } catch (err) {} // il dito potrebbe essersi già alzato
      return;
    }
  }
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  const g = e.target.closest('.mn[data-id]'), cn = e.target.closest('[data-note]'), gr = e.target.closest('[data-grp]'), lg = e.target.closest('[data-leg]'), base = { sx: e.clientX, sy: e.clientY, moved: false };
  if (readOnly() && !e.target.closest('[data-fold], [data-gfold], [data-xtog], [data-play], [data-seek], [data-ref]')) {
    // sola lettura: trascinando si sposta la vista, con un clic si seleziona (per guardare, cercare, copiare)
    const v = view(); P = { ...base, mode: 'pan', vx: v.x, vy: v.y, pick: g ? g.dataset.id : cn ? cn.dataset.note : gr ? gr.dataset.grp : null, ro: true };
  } else if (e.button === 1 || spaceDown || (e.pointerType === 'touch' && !g && !cn && !gr && !lg)) {
    e.preventDefault(); const v = view(); P = { ...base, mode: 'pan', vx: v.x, vy: v.y };
  } else if (e.target.closest('.enote[data-edge]')) {
    // nota di un collegamento: trascinandola si sposta, con un clic si seleziona il collegamento
    const id = e.target.closest('.enote').dataset.edge, ed = edgeData(curTree(), id) || {};
    P = { ...base, mode: 'enote', id, ox: ed.nx || 0, oy: ed.ny || 0 };
  } else if (g && e.target.closest('[data-xtog]')) {
    return toggleExp(g.dataset.id); // blocco espandibile: apre o chiude il testo
  } else if (g && e.target.closest('[data-ref]')) {
    return openRef(g.dataset.id); // linguetta della mappa collegata: la apre
  } else if (g && e.target.closest('[data-play]')) {
    return playAudio(g.dataset.id); // audio: ascolta / pausa
  } else if (g && e.target.closest('[data-seek]')) {
    return seekAudio(g.dataset.id, toSvg(e.clientX, e.clientY)); // audio: salta a quel punto
  } else if (g && e.target.closest('[data-chk]')) {
    return toggleCheck(g.dataset.id, +e.target.closest('[data-chk]').dataset.chk); // lista di controllo: spunta
  } else if (gr && e.target.closest('[data-gfold]')) {
    hidePreview(); return toggleGroupFold(gr.dataset.grp); // "+N" del gruppo compresso: si espande
  } else if (g && e.target.closest('[data-fold]')) {
    const k = e.target.closest('[data-fold]').dataset.fold; // etichetta "+N": riapre i rami compressi (tutti o di un pallino)
    hidePreview(); return toggleFold(g.dataset.id, k === 'all' ? null : k);
  } else if (g && e.target.closest('[data-anc]')) {
    const id = g.dataset.id, a = e.target.closest('[data-anc]'), l = S.L.get(id);
    const hit = pinAt(findM(curTree(), id).n, l, toSvg(e.clientX, e.clientY)) || { kind: a.dataset.anc, idx: +a.dataset.idx };
    const { kind, idx } = hit;
    const [px, py] = pinXY(l, pinsOf(findM(curTree(), id).n)[PK[kind]][idx]);
    // Ctrl: trascinato su un altro pallino dello stesso blocco lo fonde con quello (merge); il pallino non scorre sul bordo
    S.link = { kind, idx, id, merge: e.ctrlKey || e.metaKey, x1: l.x + px, y1: l.y + py, x2: null, y2: null, over: null, overAnc: null, pinMove: null };
    P = { ...base, mode: 'link', id }; cv.classList.add('linking');
  } else if (g && e.target.closest('[data-rsz]')) {
    const id = g.dataset.id, l = S.L.get(id);
    P = { ...base, mode: 'resize', id, w0: l.w, h0: l.h };
  } else if (cn && e.target.closest('[data-rsz]')) { // nota della tela: maniglia in basso a destra
    const id = cn.dataset.note, l = S.NL.get(id);
    P = { ...base, mode: 'resize', id, note: true, w0: l.w, h0: l.h };
  } else if (gr && e.target.closest('[data-rsz]')) {
    const grp = findGroup(curTree(), gr.dataset.grp);
    P = { ...base, mode: 'resize', id: grp.id, grp: true, w0: grp.w, h0: grp.h };
  } else if (lg) {
    // legenda: ferma in un angolo dello schermo; trascinata si aggancia all'angolo più vicino
    const lo = legendLayout(curTree()), p = legendPos(lo, curTree().legend.corner);
    selectOnly(LEG); render(); P = { ...base, mode: 'legend', ox: p.x, oy: p.y };
  } else if (g || cn || gr) {
    const id = g ? g.dataset.id : cn ? cn.dataset.note : gr.dataset.grp;
    if (e.ctrlKey || e.metaKey || e.shiftKey) keepEdge();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl + trascina da un blocco: collegamento con i pallini scelti da soli; Ctrl + clic: selezione (al rilascio)
      if (g && !readOnly()) { P = { ...base, mode: 'clink', id }; cv.setPointerCapture(e.pointerId); return; }
      toggleSel(id); render(); return;
    }
    // Maiusc: con un clic aggiunge o toglie dalla selezione; trascinando, la selezione scorre su un binario
    const wasSel = S.sels.has(id), wasMulti = !e.shiftKey && wasSel && S.sels.size > 1;
    if (e.shiftKey) { if (!wasSel) toggleSel(id); else S.sel = id; render(); }
    else if (!wasSel) selectOnly(id); else S.sel = id;
    P = { ...base, mode: 'drag', id, movers: dragMovers(curTree()), wasMulti, alt: e.altKey, shiftOff: e.shiftKey && wasSel };
    const lockS = lockedSet(curTree()); P.locked = P.movers.some(m => lockS.has(m.o)); // gruppo bloccato: non si sposta
  } else {
    // sfondo o collegamento: trascinando si disegna il riquadro, con un clic su un collegamento lo si seleziona
    const edge = e.target.closest('[data-edge]'), add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (add) keepEdge();
    P = { ...base, mode: 'box', add: e.shiftKey || e.ctrlKey || e.metaKey, prev: new Set(S.sels), prevE: new Set(S.esels), edge: edge && edge.dataset.edge };
  }
  cv.setPointerCapture(e.pointerId);
});

let lastMouse = null; // per incollare dove si trova il mouse
cv.addEventListener('pointermove', e => {
  lastMouse = { x: e.clientX, y: e.clientY };
  if (TP.has(e.pointerId)) TP.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (P && P.mode === 'pinch') { if (TP.size >= 2) pinchMove(); return; }
  if (P && P.mode === 'pinchEnd') return;
  if (!P) return;
  const dx = e.clientX - P.sx, dy = e.clientY - P.sy;
  if (!P.moved && Math.hypot(dx, dy) < 4) return;
  if (P.mode === 'drag' && P.locked) { if (!P.warned) { P.warned = true; toast('Gruppo bloccato: sbloccalo dal menu per spostarlo'); } return; }
  if (P.mode === 'clink') { // Ctrl tenuto e il mouse si è mosso: parte un collegamento dal blocco
    const l = S.L.get(P.id); if (!l) { P = null; return; }
    S.link = { kind: 'out', idx: null, id: P.id, auto: true, x1: l.x + l.w / 2, y1: l.y + l.h / 2, x2: null, y2: null, over: null, overAnc: null, pinMove: null };
    P.mode = 'link'; cv.classList.add('linking');
  }
  if (!P.moved && (P.mode === 'drag' || P.mode === 'resize' || P.mode === 'enote')) {
    snapshot();
    if (P.mode === 'drag' && P.alt) P.movers = altCopies(curTree()); // Alt + trascina: si sposta la copia
  }
  P.moved = true;
  const v = view();
  if (P.mode === 'pan') { cv.classList.add('panning'); v.x = P.vx + dx; v.y = P.vy + dy; v.fresh = false; applyView(); return; }
  if (P.mode === 'box') return dragBox(e);
  if (P.mode === 'legend') { S.legDrag = { x: P.ox + dx, y: P.oy + dy }; return renderLegend(); }
  if (P.mode === 'enote') {
    const ed = edgeData(curTree(), P.id, true);
    ed.nx = Math.round(P.ox + dx / v.k); ed.ny = Math.round(P.oy + dy / v.k);
    if (!ed.nx && !ed.ny) { delete ed.nx; delete ed.ny; }
    selectEdge(P.id); return render();
  }
  if (P.mode === 'link') {
    const p = toSvg(e.clientX, e.clientY), lk = S.link;
    // vicino al bordo del proprio blocco il pallino scorre lungo il bordo; lontano si disegna un collegamento
    const nb = nearestBorder(S.L.get(lk.id), p);
    lk.pinMove = !lk.auto && !lk.merge && nb.dist <= 16 / v.k ? [nb.side, nb.t] : null;
    if (lk.auto) { const sp = autoOutPoint(lk.id, p.x, p.y); lk.x1 = sp.x; lk.y1 = sp.y; } // dal pallino d'uscita più vicino
    lk.x2 = p.x; lk.y2 = p.y; lk.over = null; lk.overAnc = null;
    if (!lk.pinMove) {
      lk.pinMove = null; render(); // il disegno va aggiornato prima di cercare cosa c'è sotto il puntatore
      const el = document.elementFromPoint(e.clientX, e.clientY), g = el && el.closest('.mn[data-id]');
      const ok = g && g.dataset.id !== lk.id, a = ok && el.closest('[data-anc]');
      lk.over = ok ? g.dataset.id : null;
      // sul pallino più vicino al puntatore (preferendo quello compatibile), non su quello disegnato sopra
      if (lk.merge && g && g.dataset.id === lk.id) { // Ctrl su un pallino, sopra il suo blocco: pallino con cui fonderlo
        const hit = pinAt(findM(curTree(), lk.id).n, S.L.get(lk.id), p, lk.kind);
        lk.over = lk.id; lk.overAnc = hit && !(hit.kind === lk.kind && hit.idx === lk.idx) ? hit : null;
        return render();
      }
      // sopra un pallino si aggancia a quello, sul corpo del blocco ne nascerà uno nuovo
      lk.overAnc = ok ? pinAt(findM(curTree(), lk.over).n, S.L.get(lk.over), p, { out: 'in', in: 'out', str: 'str' }[lk.kind])
        || (a ? { kind: a.dataset.anc, idx: +a.dataset.idx } : null) : null;
    }
    return render();
  }
  if (P.mode === 'drag') {
    // Maiusc tenuto: il movimento resta su un binario orizzontale o verticale (quello dello spostamento maggiore)
    const rail = e.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v') : null;
    const mx = rail === 'v' ? 0 : dx, my = rail === 'h' ? 0 : dy;
    P.movers.forEach(m => { m.o.x = Math.round(m.ox + mx / v.k); m.o.y = Math.round(m.oy + my / v.k); });
    const pl = S.L.get(P.id) || S.NL.get(P.id) || findGroup(curTree(), P.id);
    S.rail = rail && pl ? { dir: rail, x: pl.x + pl.w / 2 + mx / v.k, y: pl.y + pl.h / 2 + my / v.k } : null;
    // sopra un altro blocco: dopo una breve sosta (DROP_WAIT) quello diventa la destinazione e, rilasciando,
    // la struttura selezionata si comprime dentro di lui (foldInto). Senza sosta è solo uno spostamento.
    let cand = null;
    if (!P.alt) {
      const p = toSvg(e.clientX, e.clientY), t = curTree();
      S.L.forEach((l, id) => { if (!S.sels.has(id) && p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h) cand = id; });
      if (cand && !canFoldInto(t, cand)) cand = null;
    }
    if (cand !== P.cand) {
      P.cand = cand; S.dropOn = null; clearTimeout(P.dropT);
      if (cand) { const me = P; P.dropT = setTimeout(() => { if (P === me && me.cand === cand) { S.dropOn = cand; render(); } }, DROP_WAIT); }
    }
    return render();
  }
  // ridimensiona dall'angolo in basso a destra: l'angolo in alto a sinistra resta fermo
  if (P.grp) {
    const grp = findGroup(curTree(), P.id);
    grp.w = Math.max(GMIN[0], Math.round(P.w0 + dx / v.k)); grp.h = Math.max(GMIN[1], Math.round(P.h0 + dy / v.k));
    return render();
  }
  if (P.note) {
    const nt = findNote(curTree(), P.id);
    nt.w = clamp(Math.round(P.w0 + dx / v.k), 60, 800); nt.h = clamp(Math.round(P.h0 + dy / v.k), 32, 800);
    return render();
  }
  const n = findM(curTree(), P.id).n;
  n.w = clamp(Math.round(P.w0 + dx / v.k), RMIN[0], RMAX[0]);
  if (n.type === 'table') delete n.h; else n.h = clamp(Math.round(P.h0 + dy / v.k), RMIN[1], RMAX[1]); // tabella: altezza automatica
  render();
});

// Riquadro di selezione, come nei programmi di disegno: trascinato verso destra (finestra, altro colore) prende solo ciò
// che vi sta tutto dentro; verso sinistra basta toccarlo. I collegamenti contano per ogni punto della linea.
function edgePoints() { // punti lungo ogni collegamento disegnato (coordinate della mappa), presi una volta per riquadro
  const pts = new Map();
  cv.querySelectorAll('#vp g[data-edge] > path.edge').forEach(p => {
    const len = p.getTotalLength(), n = Math.max(2, Math.ceil(len / 4)), a = [];
    for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(len * i / n); a.push([q.x, q.y]); }
    pts.set(p.parentNode.dataset.edge, a);
  });
  return pts;
}
function dragBox(e) {
  const x1 = Math.min(P.sx, e.clientX), y1 = Math.min(P.sy, e.clientY), x2 = Math.max(P.sx, e.clientX), y2 = Math.max(P.sy, e.clientY);
  const win = e.clientX >= P.sx; boxEl.classList.toggle('win', win);
  Object.assign(boxEl.style, { left: x1 + 'px', top: y1 + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' }); boxEl.hidden = false;
  const a = toSvg(x1, y1), b = toSvg(x2, y2);
  const hit = M => [...M].filter(([, l]) => win ? l.x >= a.x && l.x + l.w <= b.x && l.y >= a.y && l.y + l.h <= b.y
    : l.x < b.x && l.x + l.w > a.x && l.y < b.y && l.y + l.h > a.y).map(([id]) => id);
  // i gruppi solo se il riquadro li contiene per intero (si può selezionare anche dentro un gruppo)
  const GH = groupHidden(curTree());
  const gh = (curTree().groups || []).filter(g => { const r = gRect(g); return !GH.has(g.id) && r.x >= a.x && r.y >= a.y && r.x + r.w <= b.x && r.y + r.h <= b.y; }).map(g => g.id);
  const hits = hit(S.L).concat(hit(S.NL), gh);
  S.sels = new Set(P.add ? [...P.prev, ...hits] : hits);
  S.sel = hits.length ? hits[hits.length - 1] : [...S.sels].pop() || null;
  // collegamenti (per dar loro lo stesso stile): finestra = tutta la linea dentro, altrimenti basta un punto
  if (!P.epts) P.epts = edgePoints();
  const inside = ([x, y]) => x >= a.x && x <= b.x && y >= a.y && y <= b.y;
  const eh = [...P.epts].filter(([, q]) => win ? q.every(inside) : q.some(inside)).map(([k]) => k);
  S.esels = new Set(P.add ? [...P.prevE, ...eh] : eh); S.esel = null;
  render();
}

// Doppio clic riconosciuto qui: la tela si ridisegna a ogni clic, quindi l'elemento premuto sparisce prima del
// rilascio e i browser recenti non mandano più né click né dblclick. Due rilasci senza trascinamento, entro 450 ms
// e 8 px, valgono un doppio clic (onDouble, dopo il ridisegno: si guarda cosa c'è sotto il puntatore adesso).
let lastTap = null;
function endPointer(e) {
  TP.delete(e.pointerId);
  // fine dello zoom con due dita: il dito rimasto non fa nulla finché non si alza
  if (P && P.mode === 'pinch') { P = TP.size ? { mode: 'pinchEnd', moved: true } : null; lastTap = null; return; }
  if (P && P.mode === 'pinchEnd') { if (!TP.size) P = null; return; }
  const tap = P && !P.moved && e.type === 'pointerup' && P.mode !== 'link' && P.mode !== 'clink' && (e.pointerType !== 'mouse' || e.button === 0);
  endPointerCore(e);
  if (!tap) { lastTap = null; return; }
  const now = performance.now();
  if (lastTap && now - lastTap.t < 450 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 8) { lastTap = null; onDouble(e); }
  else lastTap = { t: now, x: e.clientX, y: e.clientY };
}
function endPointerCore(e) {
  if (!P) return; cv.classList.remove('panning'); boxEl.hidden = true; clearTimeout(P.dropT);
  if (S.rail) { S.rail = null; render(); }
  if (P.mode === 'legend') {
    const d = S.legDrag; S.legDrag = null; P = null;
    if (d) return setLegendCorner(nearestCorner(d.x, d.y, legendLayout(curTree())));
    return;
  }
  if (P.mode === 'clink') { const id = P.id; P = null; toggleSel(id); return render(); } // Ctrl + clic senza trascinare
  if (P.mode === 'link') {
    const lk = S.link, moved = P.moved; S.link = null; P = null; cv.classList.remove('linking');
    if (lk.auto) { // Ctrl + trascina dal blocco: sopra un ingresso si aggancia a quello, sul blocco ne nasce uno nuovo
      if (!lk.over) { render(); return toast('Rilascia su un altro blocco per collegarli'); }
      if (lk.overAnc && lk.overAnc.kind !== 'in') { render(); return toast('Un’uscita va collegata a un ingresso'); }
      return autoLink(lk.id, lk.over, lk.overAnc && lk.overAnc.idx);
    }
    if (lk.merge && moved && lk.over === lk.id) { // Ctrl + pallino su un altro pallino dello stesso blocco: si fondono
      const oa = lk.overAnc; render();
      if (!oa) return toast('Rilascia su un altro pallino di questo blocco per fonderli');
      if (oa.kind !== lk.kind) return toast('Pallini di tipo diverso: cambia prima il tipo di uno dei due');
      return mergePins(lk.id, lk.kind, lk.idx, oa.idx);
    }
    if (lk.merge && moved && !lk.over) { render(); return toast('Con Ctrl: rilascia su un altro pallino per fonderli, o su un blocco per collegarlo'); }
    if (!moved) { selectOnly(lk.id); render(); return showPinMenu(e.clientX, e.clientY, lk.id, lk.kind, lk.idx); } // clic sul pallino
    if (lk.pinMove) return setPin(lk.id, lk.kind, lk.idx, lk.pinMove); // pallino spostato lungo il bordo
    if (lk.over) {
      // sempre da pallino a pallino: uscita → ingresso, rombo → rombo. Sopra un pallino si aggancia a quello; sul corpo
      // del blocco nasce un pallino nuovo, sul lato rivolto al pallino di partenza
      const oa = lk.overAnc, want = { out: 'in', in: 'out', str: 'str' }[lk.kind];
      if (oa && oa.kind !== want) {
        render();
        return toast({ out: 'Un’uscita va collegata a un ingresso', in: 'Un ingresso va collegato a un’uscita', str: 'Un rombo di struttura va collegato a un altro rombo' }[lk.kind]);
      }
      const target = findM(curTree(), lk.over).n, tl = S.L.get(lk.over);
      const nw = oa ? null : [PK[want], newPinPos(target, tl, lk.x1, lk.y1)], tIdx = oa ? oa.idx : pinsOf(target)[PK[want]].length;
      if (lk.kind === 'str') return link(lk.id, null, lk.over, null, lk.idx, tIdx, nw && { to: nw });
      return lk.kind === 'out' ? link(lk.id, lk.idx, lk.over, tIdx, null, 0, nw && { to: nw }) : link(lk.over, tIdx, lk.id, lk.idx, null, 0, nw && { from: nw });
    }
    if (lk.kind === 'in') { // ingresso nel vuoto: si stacca il collegamento principale, il blocco resta dov'è
      const f = findM(curTree(), lk.id); if (f && f.p) return detach(lk.id);
      render(); return toast('Questo blocco non ha un collegamento da staccare');
    }
    render(); return toast(lk.kind === 'str' ? 'Rilascia su un blocco per collegarlo come sua parte' : 'Rilascia sull’ingresso di un blocco per collegarlo');
  }
  if (P.ro && !P.moved) { if (P.pick) selectOnly(P.pick); else clearSel(); render(); P = null; return; }
  if (!P.moved) {
    const had = S.sels.size, hadE = S.esel, hadES = S.esels.size;
    if (P.mode === 'box' && P.edge && P.add) toggleEdgeSel(P.edge); // Maiusc/Ctrl + clic: aggiunge o toglie il collegamento
    else if (P.mode === 'enote' || (P.mode === 'box' && P.edge)) selectEdge(P.id || P.edge);
    else if (P.mode === 'box' && !P.add) clearSel();
    if (P.mode === 'drag' && P.wasMulti) selectOnly(P.id);
    if (P.mode === 'drag' && P.shiftOff) { toggleSel(P.id); render(); } // Maiusc+clic su un selezionato: lo toglie
    if (P.mode !== 'box' || had !== S.sels.size || hadE !== S.esel || hadES !== S.esels.size) render();
  } else if (P.mode === 'drag' && S.dropOn) {
    const id = S.dropOn; S.dropOn = null; foldInto(id, P.movers);
  } else if (P.mode === 'drag' || P.mode === 'resize' || P.mode === 'enote') {
    save(); if (P.alt && P.mode === 'drag') toast(S.sels.size > 1 ? `${S.sels.size} copie create` : 'Copia creata');
  }
  P = null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
function onDouble(e) {
  // il primo clic ridisegna la tela: si guarda cosa c'è sotto il puntatore adesso, non e.target
  if (readOnly()) return roToast();
  const el = document.elementFromPoint(e.clientX, e.clientY); if (!el) return;
  // legenda: doppio clic su una riga = descrizione, altrove = titolo
  const lr = el.closest('[data-lrow]'); if (lr) return startLegendEdit(lr.dataset.lrow);
  if (el.closest('[data-leg]')) return startLegendTitle();
  const edge = el.closest('[data-edge]'); if (edge) return startEdgeNote(edge.dataset.edge);
  const cn = el.closest('[data-note]'); if (cn) return startNoteEdit(cn.dataset.note);
  const g = el.closest('.mn[data-id]');
  if (g && el.closest('[data-tag]')) return startTagEdit(g.dataset.id);
  const cell = g && cellAt(g.dataset.id, toSvg(e.clientX, e.clientY)); if (cell) return startCellEdit(g.dataset.id, cell[0], cell[1]); // anche sul testo della cella
  if (g && !el.closest('[data-anc]')) { const n = (findM(curTree(), g.dataset.id) || {}).n; if (isMedia(n) && !n[n.type]) return pickMedia(n.id); } // immagine o audio ancora da scegliere
  if (g && !el.closest('[data-anc], [data-xtog]') && inExpBody(g.dataset.id, toSvg(e.clientX, e.clientY))) return startBodyEdit(g.dataset.id);
  if (g && !el.closest('[data-anc], [data-xtog]')) return startEdit(g.dataset.id, true);
  const gr = el.closest('[data-grp]'); if (gr && !el.closest('[data-rsz]')) startGroupEdit(gr.dataset.grp);
}
cv.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
cv.addEventListener('wheel', e => {
  e.preventDefault(); closeMenu(); hidePreview();
  if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
  else { const v = view(); v.x -= e.deltaX; v.y -= e.deltaY; v.fresh = false; applyView(); }
  placeEditor();
}, { passive: false });
// anteprima dei rami compressi passando sull'etichetta "+N"
cv.addEventListener('pointerover', e => {
  const gf = e.target.closest('[data-gfold]'); if (gf && !P) return showGroupPreview(gf.dataset.gfold);
  const s = e.target.closest('[data-fold]'); if (!s || P) return;
  showPreview(s.closest('.mn').dataset.id, s.getBoundingClientRect(), s.dataset.fold === 'all' ? null : s.dataset.fold);
});
cv.addEventListener('pointerout', e => { if (e.target.closest('[data-fold], [data-gfold]')) hidePreview(); });

/* ---------- tastiera ---------- */
// frecce: la selezione passa al blocco visibile più vicino in quella direzione (e la vista lo segue se è fuori schermo)
function moveSel(key) {
  const a = S.L.get(S.sel), ax = a.x + a.w / 2, ay = a.y + a.h / 2, hor = key === 'ArrowLeft' || key === 'ArrowRight';
  const sign = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
  let best = null, bd = Infinity;
  S.L.forEach((l, id) => {
    if (id === S.sel) return;
    const dx = l.x + l.w / 2 - ax, dy = l.y + l.h / 2 - ay, along = (hor ? dx : dy) * sign, across = Math.abs(hor ? dy : dx);
    if (along <= 0 || across > along * 2) return;
    const d = along + across * 2; if (d < bd) { bd = d; best = id; }
  });
  if (!best) return;
  selectOnly(best);
  const l = S.L.get(best), v = view(), m = 40, x1 = v.x + l.x * v.k, y1 = v.y + l.y * v.k, x2 = x1 + l.w * v.k, y2 = y1 + l.h * v.k;
  if (x1 < m) v.x += m - x1; else if (x2 > viewW() - m) v.x -= x2 - (viewW() - m);
  if (y1 < BAR_H + m) v.y += BAR_H + m - y1; else if (y2 > innerHeight - m) v.y -= y2 - (innerHeight - m);
  v.fresh = false; render();
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (editing) endEdit(true); return saveProject(); }
  if (noTab()) return; // pagina vuota (nessuna scheda aperta): niente scorciatoie della mappa
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !editing) { e.preventDefault(); closeMenu(); return openFind(); }
  if (editing || !$('#menu').hidden || (e.target.closest && e.target.closest('.bar, #find, #side'))) return; // #side, non .side: con la barra aperta anche <body> ha la classe side
  if (e.code === 'Space') { e.preventDefault(); if (!spaceDown) { spaceDown = true; cv.classList.add('grab'); } return; }
  if (readOnly() && !(e.key.startsWith('Arrow') || e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c'))) {
    if (e.key.length === 1 && !(e.ctrlKey || e.metaKey) || ['Delete', 'Backspace', 'Enter', 'Tab', 'F2'].includes(e.key) || (e.ctrlKey || e.metaKey)) { e.preventDefault(); roToast(); }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); return redo(); }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'c') { e.preventDefault(); return copySelected(); }
    if (k === 'd') { e.preventDefault(); return duplicateSelected(); }
    if (k === 'g') { e.preventDefault(); return groupSelected(); }
    if (k === 'v') {
      e.preventDefault();
      const m = lastMouse && lastMouse.y > BAR_H ? lastMouse : { x: innerWidth / 2, y: (innerHeight + BAR_H) / 2 };
      return pasteClip(toSvg(m.x, m.y));
    }
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') {
    if (FIND) return closeFind();
    if (S.sels.size || S.esel || S.esels.size) { clearSel(); return render(); }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return removeSelected(); }
  const t = curTree();
  if (!S.sel) { if (e.key === 'Tab') { e.preventDefault(); if (!t.void) { selectOnly(t.id); render(); } } return; }
  if (e.key.startsWith('Arrow') && S.L.get(S.sel)) { e.preventDefault(); return moveSel(e.key); }
  if (findGroup(t, S.sel)) { if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); startGroupEdit(S.sel); } return; }
  if (findNote(t, S.sel)) { if (e.key === 'F2' || e.key === 'Enter') { e.preventDefault(); startNoteEdit(S.sel); } return; }
  if (e.key === 'Tab') { e.preventDefault(); return addChild(S.sel); }
  if (e.key === 'Enter') { e.preventDefault(); return addSibling(S.sel); }
  if (e.key === 'F2') { e.preventDefault(); return startEdit(S.sel, false); }
});
document.addEventListener('keyup', e => { if (e.code === 'Space') { spaceDown = false; cv.classList.remove('grab'); } });
addEventListener('blur', () => { spaceDown = false; cv.classList.remove('grab'); });
