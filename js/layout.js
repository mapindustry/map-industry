// Disposizione automatica dei gruppi (richiesta il 2026-11-17): g.lay = 'col' (in colonna), 'row' (in riga),
// 'grid' (a griglia). Il contenuto diretto del gruppo (ciò che vi sta tutto dentro e non dentro un suo gruppo interno)
// sta in fila nell'ordine g.ord (id; quelli che mancano secondo la posizione) con lo stesso spazio, e il gruppo prende
// la misura che serve, almeno quella scelta con la maniglia (g.lw, g.lh: misure minime). Si rifà a ogni disegno (render), quindi segue testi che cambiano e blocchi aggiunti o tolti; i gruppi
// che lo contengono si allargano per tenerlo. I gruppi interni si dispongono per primi.
// Trascinando (S.layDrag = { skip, top, sizes, home, target, idx }): ciò che si trascina non conta nei gruppi, nel
// gruppo disposto sotto il puntatore si apre il posto (idx) e gli altri si spostano; al rilascio entra lì (layDrop).
// Contenitore, Kanban e Fasi della barra dei componenti sono gruppi disposti (layComponent).
const LYPAD = 16, LYGAP = 12;
const LAYS = { col: 1, row: 1, grid: 1 };
const areaOf = r => r.w * r.h;

// contenuto diretto di g secondo le misure LF/NF: niente di nascosto da gruppi compressi, niente di trascinato (skip)
function layMembers(t, g, LF, NF, skip, GH) {
  const out = [], ok = (id, l) => !!l && !skip.has(id) && !GH.has(id) && within(l, g);
  walkAll(t, d => { const l = LF.get(d.id); if (ok(d.id, l)) out.push({ o: d, id: d.id, kind: 'node', l }); });
  (t.notes || []).forEach(nt => { const l = NF.get(nt.id); if (ok(nt.id, l)) out.push({ o: nt, id: nt.id, kind: 'note', l }); });
  (t.groups || []).forEach(h => { const r = gRect(h); if (h !== g && ok(h.id, r)) out.push({ o: h, id: h.id, kind: 'group', l: r }); });
  const gs = out.filter(i => i.kind === 'group');
  return out.filter(i => !gs.some(h => h !== i && areaOf(h.l) > areaOf(i.l) && within(i.l, h.l)));
}
// ordine: quello salvato, poi i nuovi secondo la posizione (in colonna dall'alto, in riga da sinistra)
function layOrder(g, its) {
  const ord = g.ord || [], k = i => { const x = ord.indexOf(i.id); return x < 0 ? 1e9 : x; };
  const pos = (a, b) => g.lay === 'row' ? a.l.x - b.l.x || a.l.y - b.l.y : a.l.y - b.l.y || a.l.x - b.l.x;
  return its.sort((a, b) => k(a) - k(b) || pos(a, b));
}
// posizioni dentro l'area del contenuto (dal suo angolo) e misura dell'area
function layPlace(g, list) {
  const n = list.length, pos = [];
  if (!n) return { pos, w: 0, h: 0 };
  if (g.lay === 'grid') {
    const k = Math.max(1, Math.ceil(Math.sqrt(n))), cw = Math.max(...list.map(i => i.w)), rh = [];
    list.forEach((it, i) => { const r = Math.floor(i / k); rh[r] = Math.max(rh[r] || 0, it.h); });
    let y = 0; const ry = rh.map(h => { const v = y; y += h + LYGAP; return v; });
    list.forEach((it, i) => pos.push([(i % k) * (cw + LYGAP), ry[Math.floor(i / k)]]));
    return { pos, w: Math.min(n, k) * (cw + LYGAP) - LYGAP, h: y - LYGAP };
  }
  const col = g.lay === 'col'; let a = 0;
  list.forEach(it => { pos.push(col ? [0, a] : [a, 0]); a += (col ? it.h : it.w) + LYGAP; });
  const cross = Math.max(...list.map(i => col ? i.w : i.h));
  return { pos, w: col ? cross : a - LYGAP, h: col ? a - LYGAP : cross };
}
// sposta un elemento (dati e misure del disegno): un blocco con i rami compressi, un gruppo con tutto il contenuto
function layShift(t, it, dx, dy, LF, NF) {
  const done = new Set();
  const mv = o => { if (done.has(o)) return; done.add(o); o.x = Math.round(o.x + dx); o.y = Math.round(o.y + dy); const l = LF.get(o.id) || NF.get(o.id); if (l && l !== o) { l.x += dx; l.y += dy; } };
  const node = n => { mv(n); n.children.forEach(c => { if (isFoldedChild(n, c)) walk(c, d => { if (hasPos(d)) mv(d); }); }); };
  const grp = h => { const its = groupItems(t, h, LF, NF); mv(h); its.forEach(i => i.kind === 'node' ? node(i.o) : i.kind === 'group' ? grp(i.o) : mv(i.o)); };
  if (it.kind === 'node') node(it.o); else if (it.kind === 'group') grp(it.o); else mv(it.o);
}
// dispone tutti i gruppi con g.lay; true se qualcosa è cambiato (posizioni, misure o ordine)
function layoutGroups(t, L, NL) {
  const gs = (t.groups || []).filter(g => LAYS[g.lay] && !g.fold); if (!gs.length) return false;
  const LF = L.full || L, NF = NL.full || NL, GH = groupHidden(t), D = S.layDrag, skip = D ? D.skip : new Set();
  let changed = false;
  gs.sort((a, b) => areaOf(a) - areaOf(b)).forEach(g => {
    if (GH.has(g.id)) return;
    const r0 = { x: g.x, y: g.y, w: g.w, h: g.h }, its = layOrder(g, layMembers(t, g, LF, NF, skip, GH));
    const list = its.map(i => ({ i, w: i.l.w, h: i.l.h }));
    if (D && D.target === g.id) list.splice(clamp(D.idx, 0, list.length), 0, ...D.sizes.map(s => ({ w: s.w, h: s.h }))); // posto per ciò che si trascina
    const pl = layPlace(g, list), hd = gHead(g), minW = Math.max(GMIN[0], Math.ceil(tw(gTitle(g), gFont(g))) + 28 + (g.lock ? 24 : 0));
    // mentre si trascina i gruppi non si stringono (si lascia anche in fondo alla fila); al rilascio sì
    const k0 = D && D.r0[g.id] || { w: 0, h: 0 };
    g.w = Math.round(Math.max(minW, pl.w + 2 * LYPAD, g.lw || 0, k0.w));
    g.h = Math.round(Math.max(GMIN[1], pl.h + 2 * LYPAD + hd, g.lh || 0, k0.h));
    list.forEach((it, k) => {
      if (!it.i) return;
      const dx = Math.round(g.x + LYPAD + pl.pos[k][0] - it.i.l.x), dy = Math.round(g.y + hd + LYPAD + pl.pos[k][1] - it.i.l.y);
      if (dx || dy) { layShift(t, it.i, dx, dy, LF, NF); changed = true; }
    });
    if (!D) { const ids = its.map(i => i.id); if (String(ids) !== String(g.ord || [])) { if (ids.length) g.ord = ids; else delete g.ord; changed = true; } }
    if (g.w !== r0.w || g.h !== r0.h) {
      changed = true;
      growOuter(t, r0, g); // i gruppi che lo contenevano si allargano per tenerlo dentro (quelli disposti poi si stringono)
    }
  });
  return changed;
}

// i gruppi che contenevano il riquadro r0 si allargano fino a contenere g: quelli disposti solo verso destra e in basso
// (il loro angolo in alto a sinistra è fermo: lo decide la fila), gli altri come quando ci si lascia dentro qualcosa
function growOuter(t, r0, g) {
  (t.groups || []).filter(h => h !== g && !h.fold && within(r0, h)).sort((a, b) => areaOf(a) - areaOf(b)).forEach(h => {
    if (!LAYS[h.lay]) return growTo(h, [g]);
    h.w = Math.max(h.w, Math.round(g.x + g.w + LYPAD - h.x)); h.h = Math.max(h.h, Math.round(g.y + g.h + LYPAD - h.y));
  });
}
// porta gli elementi (id) dentro g, oltre la fine della fila (in riga a destra, altrimenti sotto: lì non cadono dentro
// un gruppo che sta già nella fila); g si allarga per tenerli, poi la disposizione li mette al loro posto
function layBring(t, g, ids, sizes) {
  const LF = S.L.full || S.L, NF = S.NL.full || S.NL, r0 = { x: g.x, y: g.y, w: g.w, h: g.h }, hd = gHead(g), row = g.lay === 'row';
  ids.forEach((id, k) => {
    const f = findM(t, id), nt = !f && findNote(t, id), h = !f && !nt && findGroup(t, id), o = f ? f.n : nt || h; if (!o) return;
    const x0 = row ? g.x + g.w : g.x + LYPAD, y0 = row ? g.y + hd + LYPAD : g.y + g.h;
    layShift(t, { o, kind: f ? 'node' : nt ? 'note' : 'group' }, Math.round(x0 - o.x), Math.round(y0 - o.y), LF, NF);
    if (row) { g.w += sizes[k].w + LYPAD; g.h = Math.max(g.h, sizes[k].h + 2 * LYPAD + hd); }
    else { g.h += sizes[k].h + LYPAD; g.w = Math.max(g.w, sizes[k].w + 2 * LYPAD); }
  });
  growOuter(t, r0, g);
}

/* ---------- trascinamento ---------- */
function layDragStart(t, movers) {
  if (!(t.groups || []).some(g => LAYS[g.lay])) return null;
  const LF = S.L.full || S.L, NF = S.NL.full || S.NL, GH = groupHidden(t), skip = new Set(movers.map(m => m.o.id));
  const box = id => LF.get(id) || NF.get(id) || (findGroup(t, id) && gRect(findGroup(t, id)));
  const sel = [...S.sels].filter(id => skip.has(id) && box(id)), selG = sel.map(id => findGroup(t, id)).filter(Boolean);
  // in cima: i selezionati che non stanno dentro un gruppo trascinato anche lui
  const top = sel.filter(id => !selG.some(g => g.id !== id && within(box(id), gRect(g)))).sort((a, b) => box(a).y - box(b).y || box(a).x - box(b).x);
  const home = top.length && (t.groups || []).find(g => LAYS[g.lay] && !g.fold && layMembers(t, g, LF, NF, new Set(), GH).some(i => i.id === top[0]));
  const r0 = {}; (t.groups || []).forEach(g => { if (LAYS[g.lay]) r0[g.id] = { w: g.w, h: g.h }; });
  return { skip, top, sizes: top.map(id => ({ w: box(id).w, h: box(id).h })), home: home ? home.id : null, target: null, idx: 0, r0 };
}
// gruppo sotto il puntatore (il più interno): se è disposto diventa la destinazione, con il posto dove si lascia
function layDragMove(t, p) {
  const D = S.layDrag; if (!D) return null;
  const GH = groupHidden(t); let T = null;
  (t.groups || []).forEach(g => {
    if (D.skip.has(g.id) || g.fold || g.lock || GH.has(g.id) || p.x < g.x || p.x > g.x + g.w || p.y < g.y || p.y > g.y + g.h) return;
    if (!T || areaOf(g) < areaOf(T)) T = g;
  });
  if (!T || !LAYS[T.lay] || !D.top.length) { D.target = null; return null; }
  // posizioni come sarebbero senza il posto già aperto (chi viene dopo è spostato della sua misura): così non salta
  const open = D.target === T.id ? D.idx : -1, col = T.lay === 'col';
  const gap = D.sizes.reduce((a, s) => a + (col ? s.h : s.w) + LYGAP, 0);
  const its = layOrder(T, layMembers(t, T, S.L.full || S.L, S.NL.full || S.NL, D.skip, GH)).map((i, k) =>
    open >= 0 && k >= open && T.lay !== 'grid' ? { ...i.l, x: i.l.x - (col ? 0 : gap), y: i.l.y - (col ? gap : 0) } : i.l);
  D.idx = its.filter(l => col ? l.y + l.h / 2 < p.y : T.lay === 'row' ? l.x + l.w / 2 < p.x
    : l.y + l.h < p.y || (l.y <= p.y && l.x + l.w / 2 < p.x)).length;
  D.target = T.id; return T;
}
// rilascio in un gruppo disposto: ciò che si trascinava entra al posto scelto
function layDrop(t, g, D, movers, sz) {
  const ids = layOrder(g, layMembers(t, g, S.L.full || S.L, S.NL.full || S.NL, D.skip, groupHidden(t))).map(i => i.id);
  ids.splice(clamp(D.idx, 0, ids.length), 0, ...D.top); g.ord = ids;
  layBring(t, g, D.top, D.sizes); // deve starci dentro; poi la disposizione lo mette in fila
}
// un elemento appena aggiunto nel punto p: se lì c'è un gruppo disposto entra nella fila, al posto più vicino
function layAdopt(t, id, box, p) {
  const GH = groupHidden(t); let T = null;
  (t.groups || []).forEach(g => { if (!g.fold && !g.lock && !GH.has(g.id) && p.x >= g.x && p.x <= g.x + g.w && p.y >= g.y && p.y <= g.y + g.h && (!T || areaOf(g) < areaOf(T))) T = g; });
  if (!T || !LAYS[T.lay]) return;
  const its = layOrder(T, layMembers(t, T, S.L.full || S.L, S.NL.full || S.NL, new Set([id]), GH));
  const idx = its.filter(i => T.lay === 'row' ? i.l.x + i.l.w / 2 < p.x : i.l.y + i.l.h / 2 < p.y).length;
  T.ord = its.map(i => i.id); T.ord.splice(idx, 0, id);
  layBring(t, T, [id], [box]);
}
// disposizione scelta dal menu del gruppo ('none' = libera)
// aspetto da contenitore (bordo spesso, ombra, titolo su etichetta): dal menu del gruppo
function toggleGroupCt(ids = [...S.sels]) {
  const t = curTree(), on = !ids.every(id => (findGroup(t, id) || {}).ct);
  mutate(tt => ids.forEach(id => { const g = findGroup(tt, id); if (!g) return; if (on) g.ct = true; else delete g.ct; }));
}
function setGroupLay(v, ids = [...S.sels]) {
  mutate(t => ids.forEach(id => {
    const g = findGroup(t, id); if (!g) return;
    delete g.ord; delete g.lw; delete g.lh;
    if (v === 'none') delete g.lay; else g.lay = v;
  }));
}

/* ---------- componenti: Contenitore, Kanban, Fasi ---------- */
const CONT = (text, x, y, w = 220) => ({ id: uid(), x: Math.round(x), y: Math.round(y), w, h: 120, text, lay: 'col', lw: w, line: 'solid', fo: 0.14, ct: true });
function layComponent(k, x, y) {
  const hd = GHEAD, add = [], links = [], cards = [];
  if (k === 'cont') add.push(CONT('Contenitore', x - 110, y - 60));
  if (k === 'kanban') {
    const cw = 220, W = 3 * cw + 2 * LYGAP + 2 * LYPAD, H = hd + 2 * LYPAD + 140;
    const outer = { id: uid(), x: Math.round(x - W / 2), y: Math.round(y - H / 2), w: W, h: H, text: 'Kanban', lay: 'row', line: 'none', fo: 0.05 };
    add.push(outer);
    ['Da fare', 'In corso', 'Fatto'].forEach((s, i) => add.push(Object.assign(CONT(s, outer.x + LYPAD + i * (cw + LYGAP), outer.y + hd + LYPAD, cw), { h: 140, lh: 140 }))); // colonne alte uguali
    const c = mk('Prima attività'); c.x = add[1].x + LYPAD; c.y = add[1].y + hd + LYPAD; cards.push(c);
  }
  if (k === 'fasi') {
    const cw = 200, step = cw + 90;
    [1, 2, 3].forEach(i => add.push(CONT('Fase ' + i, x - step - cw / 2 + (i - 1) * step, y - 60, cw)));
    add.forEach((g, i) => { g.pin = { i: i ? [['l', 0.5]] : [], o: i < 2 ? [['r', 0.5]] : [], s: [] }; });
    links.push({ id: uid(), from: add[0].id, to: add[1].id, po: 0, pi: 0 }, { id: uid(), from: add[1].id, to: add[2].id, po: 0, pi: 0 });
  }
  mutate(t => {
    (t.groups = t.groups || []).push(...add);
    if (links.length) (t.links = t.links || []).push(...links);
    if (cards.length) (t.free = t.free || []).push(...cards);
  });
  const main = add[0]; selectOnly(main.id); render(); startGroupEdit(main.id); if (k === 'cont') markFresh();
}
