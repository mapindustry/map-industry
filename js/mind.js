// Mappa mentale: posizioni, pallini, collegamenti, disegno e operazioni sui blocchi
// Blocco: { id, text, children[], x, y, w?, h?, primary?, flip?, pin?, color?, fs?, bw?, op?, fold?, foldPrev?, tag?, edge? }
//   x/y = angolo in alto a sinistra, FISSO: collegare, staccare o ricollegare non sposta nessun blocco
//   primary = "idea primaria" (attributo scelto dall'utente, anche su più blocchi): stile marcato,
//             di serie ingresso in alto e due uscite laterali
//   pin = { i: [[lato, pos]...], o: [[lato, pos]...], s: [...] } pallini d'ingresso, d'uscita e di struttura sul bordo
//         (lato 'l'|'r'|'t'|'b', pos 0–1 lungo il lato); se manca valgono quelli di serie (vedi defaultPins).
//         Ogni elenco può essere vuoto. Clic su un pallino: tipo, duplica, elimina (editPin)
//   fold = rami compressi nel blocco: i discendenti non si disegnano (etichetta "+N"), restano dove sono
//   flip = di serie ingresso a destra e uscita a sinistra · w/h = dimensione a mano
//   color = indice 0–5 dei token --c0…--c5 · fs = testo (px) · fw = peso del carattere (300–700) · bw = bordo · op = opacità del riquadro
//   foldPrev = con i rami compressi, schema in piccolo mostrato sotto il blocco
//   tag = etichetta: sigla o nota breve su una linguetta attaccata al bordo in alto
//   edge = { po?, pi?, str?, sp?, note?, dash?, nx?, ny? } del collegamento "principale" che entra nel blocco dal genitore
//          po/pi = indice del pallino d'uscita del genitore / d'ingresso del blocco; nx/ny = spostamento della nota
//          str = collegamento di struttura (il blocco è una parte del genitore, non un passo): parte dal pallino
//          di struttura sp e arriva sul lato rivolto al genitore, linea a puntini
// Collegamenti aggiuntivi (più ingressi per blocco), in tree.links: { id, from, to, po?, pi?, str?, sp?, note?, dash?, nx?, ny? }
//   Nelle selezioni e nei menu un collegamento si indica con una chiave: id del blocco figlio, oppure 'x:' + id.
// Nota sulla tela (in tree.notes): { id, x, y, text }
// Gruppo (in tree.groups): { id, x, y, w, h, text } riquadro con titolo. Contiene ciò che vi sta tutto dentro:
//   trascinato dal titolo o dal bordo si sposta con il contenuto; un blocco portato dentro o fuori entra o esce.
const DEF_FS = [16, 14, 13];
const fsOf = (n, depth) => n.fs || DEF_FS[Math.min(depth, 2)];
// peso del carattere: scelto sul blocco (fw) o di serie (600 per primarie e primo livello, 400 dopo)
const fwOf = (n, depth) => n.fw || (depth <= 1 ? 600 : 400);
const nodeFont = (n, depth) => `${fwOf(n, depth)} ${fsOf(n, depth)}px ${FB}`;
const bwOf = (n, depth) => n.bw ?? (depth === 0 ? 2 : 1.4);
const hasColor = n => n.color !== undefined && n.color !== null && n.color !== '';
const hasPos = n => n.x !== undefined && n.y !== undefined;
const RMIN = [40, 26], RMAX = [800, 600];
const TAG_FONT = `600 10.5px ${FB}`;
const HUB = 22; // lato dello svincolo: punto al centro, pallini sul bordo, il mezzo libero per trascinarlo
// x dell'etichetta: in alto a sinistra (dopo il "+N" se c'è); non copre i pallini del bordo in alto
function tagLeft(n, l, w) {
  let x = n.fold && n.children.length ? 24 : 10;
  const P = pinsOf(n);
  [...P.i, ...P.o, ...P.s].filter(q => q[0] === 't').map(q => q[1] * l.w).sort((a, b) => a - b)
    .forEach(px => { if (px > x - 8 && px < x + w + 8) x = px + 10; });
  return x;
}
const NOTE_FONT = `500 11.5px ${FB}`, CNOTE_FONT = `400 13px ${FB}`, GFONT = `600 13px ${FB}`;
const GHEAD = 28, GPAD = 22, GMIN = [120, 70];

/* ---------- dimensioni e posizioni ---------- */
// livello di stile: 0 = idea primaria, poi 1 e 2 secondo la profondità nell'albero
function sizeMap(tree) {
  const M = new Map();
  function size(n, depth) {
    // svincolo: un punto senza testo, tappa di un collegamento
    if (n.hub) { M.set(n.id, { lines: [], lh: 0, w: HUB, h: HUB, depth: 2 }); n.children.forEach(c => size(c, depth + 1)); return; }
    const lv = n.primary ? 0 : Math.max(1, depth);
    const fs = fsOf(n, lv), font = nodeFont(n, lv), lh = Math.round(fs * 1.28);
    const padX = lv === 0 ? 36 : 24, padY = lv === 0 ? 22 : 14;
    const maxW = n.w ? Math.max(16, n.w - padX) : lv === 0 ? 220 : 200;
    const maxL = n.h ? Math.max(1, Math.floor((n.h - padY + 4) / lh)) : 4;
    const lines = wrap(n.text || 'Senza titolo', maxW, font, maxL);
    const w = n.w || Math.max(Math.max(...lines.map(l => tw(l, font))) + padX, lv === 0 ? 120 : 48);
    M.set(n.id, { lines, lh, w, h: n.h || lines.length * lh + padY, depth: lv });
    n.children.forEach(c => size(c, depth + 1));
  }
  if (!tree.void) size(tree, 0); (tree.free || []).forEach(r => size(r, 1));
  return M;
}
// vecchio layout automatico ad albero: usato solo per convertire le mappe senza posizioni
function autoLayout(root, SZ) {
  const A = new Map(), VG = 10, HG = 46;
  walkAll(root, n => A.set(n.id, { w: SZ.get(n.id).w, h: SZ.get(n.id).h }));
  const sh = n => { const a = A.get(n.id), t = n.children.reduce((s, c) => s + sh(c), 0) + VG * Math.max(0, n.children.length - 1); return (a.sh = Math.max(a.h, t)); };
  function place(n, edge, cy, dir) {
    const a = A.get(n.id); a.x = dir > 0 ? edge : edge - a.w; a.y = cy - a.h / 2; a.dir = dir;
    const total = n.children.reduce((s, c) => s + A.get(c.id).sh, 0) + VG * Math.max(0, n.children.length - 1);
    let y = cy - total / 2; const ne = dir > 0 ? a.x + a.w + HG : a.x - HG;
    n.children.forEach(c => { const s = A.get(c.id).sh; place(c, ne, y + s / 2, dir); y += s + VG; });
  }
  const off = (n, ox, oy) => { const a = A.get(n.id); ox += n.dx || 0; oy += n.dy || 0; a.x += ox; a.y += oy; n.children.forEach(c => off(c, ox, oy)); };
  sh(root);
  const r = A.get(root.id); r.x = -r.w / 2; r.y = -r.h / 2; r.dir = 0;
  const kids = root.children, half = Math.ceil(kids.length / 2);
  [[kids.slice(0, half), 1], [kids.slice(half), -1]].forEach(([side, dir]) => {
    const total = side.reduce((s, c) => s + A.get(c.id).sh, 0) + 14 * Math.max(0, side.length - 1);
    let y = -total / 2;
    side.forEach(c => { const s = A.get(c.id).sh; place(c, dir > 0 ? r.x + r.w + 60 : r.x - 60, y + s / 2, dir); y += s + 14; });
  });
  off(root, 0, 0);
  (root.free || []).forEach(fr => { sh(fr); place(fr, fr.fx || 0, fr.fy || 0, 1); off(fr, 0, 0); });
  return A;
}
function subtreeEdge(n, SZ, which) {
  let v = -Infinity; walk(n, d => { if (hasPos(d)) v = Math.max(v, which === 'b' ? d.y + SZ.get(d.id).h : d.x + SZ.get(d.id).w); }); return v;
}
// un blocco nuovo va vicino al genitore, davanti all'uscita usata, dopo i fratelli già posizionati
function placeNew(tree, p, n, SZ) {
  const pl = SZ.get(p.id), nl = SZ.get(n.id), outs = pinsOf(p).o;
  let idx = n.edge && n.edge.po != null ? Math.min(n.edge.po, outs.length - 1) : null;
  if (idx === null) {
    // più uscite (per esempio l'idea primaria): si sceglie la meno usata
    const used = outs.map((_, i) => p.children.filter(c => c !== n && hasPos(c) && outIdx(p, c.edge) === i).length);
    // a parità, prima l'uscita di destra: il primo ramo nasce a destra
    const least = used.map((u, i) => u === Math.min(...used) ? i : -1).filter(i => i >= 0), right = least.find(i => outs[i][0] === 'r');
    idx = outs.length > 1 ? (right !== undefined ? right : least[0]) : 0;
    if (outs.length > 1) n.edge = Object.assign({}, n.edge, { po: idx });
  }
  // la parte di una struttura va davanti al pallino di struttura; un blocco senza uscite usa il lato destro
  const src = n.edge && n.edge.str ? pinsOf(p).s[strIdx(p, n.edge)] || ['b', 0.5] : outs[idx] || ['r', 0.5];
  const side = src[0], [ax, ay] = pinXY(pl, src), px = p.x + ax, py = p.y + ay;
  if (side === 'l') n.flip = true; // l'ingresso guarda verso il genitore
  const sibs = p.children.filter(c => c !== n && hasPos(c) && outIdx(p, c.edge) === idx);
  if (side === 'l' || side === 'r') {
    // oltre la colonna dei fratelli del genitore (se più larghi, il nuovo ramo finirebbe sopra di loro)
    const f = findM(tree, p.id), col = ((f && f.list) || []).filter(c => c !== p && hasPos(c) && c.x < p.x + pl.w && c.x + SZ.get(c.id).w > p.x);
    const edge = side === 'r' ? Math.max(px, ...col.map(c => c.x + SZ.get(c.id).w)) : Math.min(px, ...col.map(c => c.x));
    n.x = Math.round(side === 'r' ? edge + 50 : edge - 50 - nl.w);
    n.y = Math.round(sibs.length ? Math.max(...sibs.map(c => subtreeEdge(c, SZ, 'b'))) + 12 : py - nl.h / 2);
  } else {
    n.y = Math.round(side === 'b' ? py + 40 : py - 40 - nl.h);
    n.x = Math.round(sibs.length ? Math.max(...sibs.map(c => subtreeEdge(c, SZ, 'r'))) + 12 : px - nl.w / 2);
  }
}
// assegna le posizioni mancanti; true se ha cambiato qualcosa (da salvare)
function ensurePositions(tree, SZ) {
  let any = false, changed = false; const missing = [];
  if (!tree.void && tree.primary === undefined) { tree.primary = true; changed = true; } // la radice nasce idea primaria
  walkAll(tree, n => { if (hasPos(n)) any = true; else missing.push(n); });
  if (!missing.length) return changed;
  if (!any) {
    const A = autoLayout(tree, SZ);
    walkAll(tree, (n, p) => {
      const a = A.get(n.id); n.x = Math.round(a.x); n.y = Math.round(a.y);
      if (p && a.dir < 0) { n.flip = true; if (p === tree) n.edge = Object.assign({}, n.edge, { po: 0 }); }
      ['dx', 'dy', 'fx', 'fy'].forEach(k => delete n[k]);
    });
    return true;
  }
  walkAll(tree, (n, p) => {
    if (hasPos(n)) return;
    if (!p) { n.x = Math.round(n.fx || 0); n.y = Math.round((n.fy || 0) - SZ.get(n.id).h / 2); delete n.fx; delete n.fy; return; }
    placeNew(tree, p, n, SZ);
  });
  return true;
}
function mindLayout(tree) {
  const SZ = sizeMap(tree), changed = ensurePositions(tree, SZ);
  const SZ2 = changed && tree.primary && !tree.void ? sizeMap(tree) : SZ; // la radice può essere appena diventata primaria
  if (changed) save();
  // i rami compressi non hanno posto nel disegno: senza voce in L non si disegnano né loro né i loro collegamenti
  const L = new Map(), hid = foldedSet(tree);
  walkAll(tree, n => { if (!hid.has(n.id)) L.set(n.id, { ...SZ2.get(n.id), x: n.x, y: n.y }); });
  return L;
}
// Ramo compresso (fold sul blocco): i discendenti restano nei dati con le loro posizioni, ma non si vedono;
// riaprendolo tornano a ventaglio dov'erano.
// Si può comprimere anche un solo pallino (uscita o struttura): foldOut = ['o:1', 's:0', ...] sul blocco,
// e si nascondono solo i rami che partono da quel pallino. pinKey dice da quale pallino parte il ramo c.
const pinKey = (n, c) => isStr(c.edge) ? 's:' + strIdx(n, c.edge) : 'o:' + outIdx(n, c.edge);
const isFoldedChild = (n, c) => !!n.fold || (n.foldOut || []).includes(pinKey(n, c));
function foldedSet(tree) {
  const hid = new Set();
  walkAll(tree, n => { if (!hid.has(n.id)) n.children.forEach(c => { if (isFoldedChild(n, c)) walk(c, d => hid.add(d.id)); }); });
  return hid;
}
function countDesc(n) { let k = -1; walk(n, () => k++); return k; }
// blocchi che partono da un pallino (con i loro rami)
const countPin = (n, key) => n.children.filter(c => pinKey(n, c) === key).reduce((s, c) => s + countDesc(c) + 1, 0);
// key = un pallino ('o:1', 's:0'); senza key si comprimono o aprono tutti i rami del blocco
function toggleFold(id, key) {
  const f = findM(curTree(), id); if (!f || !f.n.children.length) return;
  if (key && !countPin(f.n, key)) return;
  let closed = false;
  mutate(t => {
    const n = findM(t, id).n;
    if (key) {
      const fo = n.foldOut || []; closed = !fo.includes(key);
      n.foldOut = closed ? fo.concat(key) : fo.filter(k => k !== key); if (!n.foldOut.length) delete n.foldOut;
    } else { closed = !n.fold; if (n.fold) delete n.fold; else { n.fold = true; delete n.foldOut; } }
  });
  if (closed) { selectOnly(id); render(); }
}
function notesLayout(tree) {
  const NL = new Map();
  (tree.notes || []).forEach(nt => {
    const lines = wrap(nt.text || 'Nota', 220, CNOTE_FONT, 10);
    NL.set(nt.id, { x: nt.x, y: nt.y, lines, w: Math.max(60, Math.max(...lines.map(s => tw(s, CNOTE_FONT))) + 22), h: lines.length * 18 + 14 });
  });
  return NL;
}
const shiftTree = (n, dx, dy) => walk(n, d => { if (hasPos(d)) { d.x = Math.round(d.x + dx); d.y = Math.round(d.y + dy); } });

/* ---------- pallini ---------- */
// Tre tipi: ingresso (i) e uscita (o) disegnano un processo; struttura (s) collega il blocco alle sue parti,
// con una linea a puntini che arriva sul lato del blocco d'arrivo (non chiede ingressi né uscite).
// Ogni tipo può avere zero pallini: un blocco può avere solo ingressi, solo uscite o nessuno dei due.
const PK = { in: 'i', out: 'o', str: 's' };
function defaultPins(n) {
  if (n.primary && !n.hub) return { i: [['t', 0.5]], o: [['l', 0.5], ['r', 0.5]], s: [] };
  return n.flip ? { i: [['r', 0.5]], o: [['l', 0.5]], s: [] } : { i: [['l', 0.5]], o: [['r', 0.5]], s: [] };
}
// pallini del blocco; mentre se ne trascina uno lungo il bordo vale la posizione provvisoria
function pinsOf(n) {
  const B = n.pin || defaultPins(n);
  let P = { i: B.i || [], o: B.o || [], s: B.s || [] };
  const lk = S.link;
  if (lk && lk.pinMove && lk.id === n.id) { P = JSON.parse(JSON.stringify(P)); P[PK[lk.kind]][lk.idx] = lk.pinMove; }
  return P;
}
const pinXY = (l, [side, t]) => side === 'l' ? [0, t * l.h] : side === 'r' ? [l.w, t * l.h] : side === 't' ? [t * l.w, 0] : [t * l.w, l.h];
const SIDES = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
// quale uscita del genitore usa un collegamento (dati vecchi: ps = lato 'l'/'r')
// -1 = il blocco non ha pallini di quel tipo: la linea arriva sul lato rivolto all'altro blocco
function outIdx(p, e) {
  const o = pinsOf(p).o; e = e || {}; if (!o.length) return -1;
  if (e.po != null) return clamp(e.po, 0, o.length - 1);
  if (e.ps) { const i = o.findIndex(q => q[0] === e.ps); if (i >= 0) return i; }
  const r = o.findIndex(q => q[0] === 'r'); return r >= 0 ? r : 0;
}
const inIdx = (c, e) => Math.min((e && e.pi) || 0, pinsOf(c).i.length - 1);
const strIdx = (p, e) => Math.min((e && e.sp) || 0, pinsOf(p).s.length - 1);
const isStr = e => !!(e && e.str);
// tratto della linea: continuo, tratteggiato, a puntini (di serie: puntini per la struttura, continuo per il resto;
// `dash: true` è il formato vecchio del tratteggiato)
const lineOf = e => (e && e.line) || (e && e.dash ? 'dash' : isStr(e) ? 'dot' : 'solid');
// spessore: scelto sul collegamento (lw) o di serie (puntini 2.4, dall'idea primaria 2.2, altrimenti 1.5)
const lwOf = (e, depth) => (e && e.lw) || (lineOf(e) === 'dot' ? 2.4 : depth === 0 ? 2.2 : 1.5);
function linkWidth(key) { const t = curTree(), L = allLinks(t).find(x => x.key === key); return L ? lwOf(L.e, (S.L.get(L.from.id) || {}).depth) : 1.5; }
// lato del blocco rivolto verso il punto (x, y), a metà
function facePin(l, x, y) {
  const dx = (x - (l.x + l.w / 2)) / l.w, dy = (y - (l.y + l.h / 2)) / l.h;
  return Math.abs(dx) >= Math.abs(dy) ? [dx < 0 ? 'l' : 'r', 0.5] : [dy < 0 ? 't' : 'b', 0.5];
}
// punto del bordo più vicino a p (coordinate della tela): lato, posizione 0–1 e distanza dal bordo
function nearestBorder(l, p) {
  const qx = p.x - l.x, qy = p.y - l.y, inside = qx >= 0 && qx <= l.w && qy >= 0 && qy <= l.h;
  let side, dist;
  if (inside) {
    const d = { l: qx, r: l.w - qx, t: qy, b: l.h - qy }; side = Object.keys(d).reduce((a, b) => d[a] <= d[b] ? a : b); dist = 0;
  } else {
    const cx = clamp(qx, 0, l.w), cy = clamp(qy, 0, l.h); dist = Math.hypot(qx - cx, qy - cy);
    side = cx === 0 ? 'l' : cx === l.w ? 'r' : cy === 0 ? 't' : 'b';
  }
  let t = side === 'l' || side === 'r' ? qy / l.h : qx / l.w;
  t = clamp(Math.round(t * 20) / 20, 0.1, 0.9); if (Math.abs(t - 0.5) < 0.08) t = 0.5;
  return { side, t, dist };
}

/* ---------- collegamenti ---------- */
// la linea parte da un pallino d'uscita e arriva a un pallino d'ingresso: sempre quelli, ovunque si spostino i blocchi.
// Collegamento di struttura: parte dal pallino di struttura e arriva sul lato del blocco rivolto verso di esso.
function linkGeom(pn, pl, cn, cl, e) {
  const P = pinsOf(pn), str = isStr(e);
  const a = (str ? P.s[strIdx(pn, e)] : P.o[outIdx(pn, e)]) || facePin(pl, cl.x + cl.w / 2, cl.y + cl.h / 2);
  const [ax1, ay1] = pinXY(pl, a);
  const b = (!str && pinsOf(cn).i[inIdx(cn, e)]) || facePin(cl, pl.x + ax1, pl.y + ay1);
  const [ax0, ay0] = pinXY(pl, a), [bx0, by0] = pinXY(cl, b);
  const ax = pl.x + ax0, ay = pl.y + ay0, bx = cl.x + bx0, by = cl.y + by0;
  const ta = SIDES[a[0]], tb = SIDES[b[0]];
  if (e && e.shape === 'st') return { d: `M${ax},${ay} L${bx},${by}`, mx: (ax + bx) / 2, my: (ay + by) / 2 }; // dritta
  if (e && e.shape === 'sq') {
    // squadrato: esce dritto dal pallino, gira ad angolo retto a metà strada, entra dritto nell'altro pallino
    const s = 18, a1x = ax + ta[0] * s, a1y = ay + ta[1] * s, b1x = bx + tb[0] * s, b1y = by + tb[1] * s;
    const pts = ta[0] ? [[(a1x + b1x) / 2, a1y], [(a1x + b1x) / 2, b1y]] : [[a1x, (a1y + b1y) / 2], [b1x, (a1y + b1y) / 2]];
    const d = `M${ax},${ay} L${a1x},${a1y} L${pts[0][0]},${pts[0][1]} L${pts[1][0]},${pts[1][1]} L${b1x},${b1y} L${bx},${by}`;
    return { d, mx: (pts[0][0] + pts[1][0]) / 2, my: (pts[0][1] + pts[1][1]) / 2 };
  }
  const k = clamp(Math.hypot(bx - ax, by - ay) / 2, 30, 160);
  const c1x = ax + ta[0] * k, c1y = ay + ta[1] * k, c2x = bx + tb[0] * k, c2y = by + tb[1] * k;
  return { d: `M${ax},${ay} C${c1x},${c1y} ${c2x},${c2y} ${bx},${by}`, mx: (ax + 3 * c1x + 3 * c2x + bx) / 8, my: (ay + 3 * c1y + 3 * c2y + by) / 8 };
}
// tutti i collegamenti di un livello: { key, from, to, e (dati: stile, nota, pallini), extra }
function allLinks(tree) {
  const out = [];
  walkAll(tree, (n, p) => { if (p) out.push({ key: n.id, from: p, to: n, e: n.edge || {}, extra: false }); });
  (tree.links || []).forEach(x => {
    const a = findM(tree, x.from), b = findM(tree, x.to);
    if (a && b) out.push({ key: 'x:' + x.id, from: a.n, to: b.n, e: x, extra: true });
  });
  return out;
}
// dati modificabili di un collegamento dalla sua chiave (create = crea edge sul blocco se manca)
function edgeData(tree, key, create) {
  if (key.startsWith('x:')) return (tree.links || []).find(x => x.id === key.slice(2)) || null;
  const f = findM(tree, key); if (!f || !f.p) return null;
  if (!f.n.edge && create) f.n.edge = {};
  return f.n.edge || {};
}
const TIP = {
  in: 'Ingresso: trascina sull’uscita di un blocco per collegarlo, lungo il bordo per spostarlo, nel vuoto per staccarlo',
  out: 'Uscita: trascina sull’ingresso di un blocco per collegarlo, lungo il bordo per spostarlo',
  str: 'Struttura: trascina su un blocco per collegarlo come sua parte, lungo il bordo per spostarlo'
};
const PIN_TIP = ' · Clic: tipo, duplica, elimina';

// Anteprima dei rami compressi: il blocco con i suoi rami aperti, in piccolo (copia, i dati non cambiano)
function foldMini(n, key) {
  const t = JSON.parse(JSON.stringify(n)); delete t.fold; delete t.foldOut; delete t.foldPrev; delete t.edge; t.primary = !!n.primary;
  if (key) t.children = t.children.filter((c, i) => pinKey(n, n.children[i]) === key); // solo i rami di quel pallino
  const L = mindLayout(t); return { t, L, b: levelBounds(L, new Map()) };
}
// schema dei rami compressi disegnato sulla tela, sotto il blocco (tasto destro → Mostra anteprima)
function foldPreviewMarkup(n, l, live) {
  const { t, L, b } = foldMini(n);
  const pad = 14, head = 20, k = Math.min(0.55, 300 / (b.w + pad * 2), 190 / (b.h + pad * 2));
  const w = Math.max(170, (b.w + pad * 2) * k), h = (b.h + pad * 2) * k + head, x = l.x, y = l.y + l.h + 16;
  const title = `Rami compressi · ${countDesc(n)} blocchi`;
  return `<g class="subprev"${live ? ` data-foldprev="${n.id}"` : ''}>${live ? '<title>Clic per aprire i rami a ventaglio</title>' : ''}` +
    `<path class="splead" d="M${x + 18},${l.y + l.h} L${x + 18},${y}"/>` +
    `<rect class="spbox" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>` +
    `<text class="sptitle" x="${x + 10}" y="${y + 14}">${esc(ell(title, w - 18, `600 10.5px ${FB}`))}</text>` +
    `<g transform="translate(${x + (w - b.w * k) / 2 - b.x * k},${y + head + pad * k - b.y * k}) scale(${k})">${treeMarkup(t, L, new Map(), false, false)}</g></g>`;
}

// markup SVG della mappa; live = tela interattiva (selezione, pallini, maniglie), altrimenti anteprima/esportazione
// previews = disegna anche gli schemi dei rami compressi con l'anteprima accesa
function treeMarkup(tree, L, NL, live, previews = live) {
  const single = live && S.sels.size === 1 && !editing, lk = live ? S.link : null;
  const E = new Map(); let edges = '', notes = '', nodes = '', prevs = '';
  allLinks(tree).forEach(({ key, from, to, e }) => {
    const pl = L.get(from.id), cl = L.get(to.id); if (!pl || !cl) return;
    const g = linkGeom(from, pl, to, cl, e);
    // la nota sta al centro del collegamento, spostata di nx/ny se l'utente l'ha trascinata
    const nx = g.mx + (e.nx || 0), ny = g.my + (e.ny || 0);
    E.set(key, { x: nx, y: ny });
    const cls = 'eg l-' + lineOf(e) + (isStr(e) ? ' str' : '') + (live && S.esel === key ? ' sel' : '');
    edges += `<g class="${cls}"${live ? ` data-edge="${key}"` : ''}><path class="edge" style="stroke-width:${lwOf(e, pl.depth) + (live && S.esel === key ? 1 : 0)}px" d="${g.d}"/>` +
      (live ? `<path class="ehit" d="${g.d}"><title>Doppio clic: nota · Tasto destro: opzioni del collegamento</title></path>` : '') + `</g>`;
    if (e.note && !(editing && editing.kind === 'edge' && editing.id === key)) {
      const lines = wrap(e.note, 170, NOTE_FONT, 3), w = Math.max(...lines.map(s => tw(s, NOTE_FONT))) + 16, h = lines.length * 14 + 8;
      const lead = e.nx || e.ny ? `<path class="lead" d="M${g.mx},${g.my} L${nx},${ny}"/>` : '';
      // etichetta a pillola chiara: deve distinguersi a colpo d'occhio dai blocchi (scuri) e dalle note della tela (gialle)
      notes += `<g class="enote${live && S.esel === key ? ' sel' : ''}"${live ? ` data-edge="${key}"` : ''}>${lead}<rect x="${nx - w / 2}" y="${ny - h / 2}" width="${w}" height="${h}" rx="${lines.length > 1 ? 10 : h / 2}"/>` +
        lines.map((s, i) => `<text x="${nx}" y="${ny - h / 2 + 15 + i * 14}" text-anchor="middle">${esc(s)}</text>`).join('') + `</g>`;
    }
  });
  walkAll(tree, n => {
    const l = L.get(n.id); if (!l) return; // dentro un ramo compresso
    const sel = live && S.sels.has(n.id), dd = Math.min(l.depth, 2), pad = (l.h - l.lines.length * l.lh) / 2;
    const fsSt = n.fs || n.fw ? ` style="${n.fs ? `font-size:${n.fs}px;` : ''}${n.fw ? `font-weight:${n.fw}` : ''}"` : '';
    const boxSt = (n.bw != null ? `stroke-width:${n.bw}px;` : '') + (n.op != null ? `opacity:${n.op};` : '');
    const txt = l.lines.map((s, i) => `<text x="${l.w / 2}" y="${pad + (i + 0.76) * l.lh}" text-anchor="middle"${fsSt}>${esc(s)}</text>`).join('');
    // ramo compresso: etichetta "+N" sull'angolo in alto a sinistra; con un clic si riapre, passandoci sopra l'anteprima
    const folded = n.fold && n.children.length;
    const badge = (key, bx, by, k, title) => `<g class="fold"${live ? ` data-fold="${key}"` : ''}>${live ? `<title>${title}</title>` : ''}` +
      `<rect x="${bx}" y="${by}" width="${tw('+' + k, `600 11px ${FB}`) + 12}" height="18" rx="9"/><text x="${bx + (tw('+' + k, `600 11px ${FB}`) + 12) / 2}" y="${by + 13}" text-anchor="middle">+${k}</text></g>`;
    let fold = folded ? badge('all', -14, -11, countDesc(n), 'Clic: apri i rami a ventaglio') : '';
    // pallino compresso: "+N" appena fuori dal pallino, dalla parte dove partono i rami
    if (!n.fold) (n.foldOut || []).forEach(key => {
      const k = countPin(n, key), pin = pinsOf(n)[key[0]][+key.slice(2)]; if (!k || !pin) return;
      const [x, y] = pinXY(l, pin), bw = tw('+' + k, `600 11px ${FB}`) + 12;
      const [bx, by] = pin[0] === 'r' ? [x + 9, y - 9] : pin[0] === 'l' ? [x - 9 - bw, y - 9] : pin[0] === 't' ? [x - bw / 2, y - 27] : [x - bw / 2, y + 9];
      fold += badge(key, bx, by, k, 'Clic: apri i blocchi collegati a questo pallino');
    });
    // etichetta del blocco: linguetta sopra il bordo in alto a sinistra (sigla o nota breve); doppio clic per scriverla
    const tagW = n.tag ? Math.min(tw(n.tag, TAG_FONT), 170) + 12 : 0, tagX = n.tag ? tagLeft(n, l, tagW) : 0;
    const tag = n.tag && !(editing && editing.kind === 'tag' && editing.id === n.id)
      ? `<g class="tag"${live ? ' data-tag="1"' : ''}>${live ? '<title>Doppio clic: modifica l’etichetta</title>' : ''}<rect x="${tagX}" y="-17" width="${tagW}" height="17" rx="5"/>` +
        `<text x="${tagX + tagW / 2}" y="-5" text-anchor="middle">${esc(ell(n.tag, 170, TAG_FONT))}</text></g>` : '';
    let anchors = '';
    if (live) {
      const P = pinsOf(n);
      [['in', P.i], ['out', P.o], ['str', P.s]].forEach(([kind, list]) => list.forEach((pin, idx) => {
        const [x, y] = pinXY(l, pin);
        const hot = lk && lk.over === n.id && lk.overAnc && lk.overAnc.kind === kind && lk.overAnc.idx === idx;
        const moving = lk && lk.pinMove && lk.id === n.id && lk.kind === kind && lk.idx === idx;
        // il pallino di struttura è un rombo, per distinguerlo da ingressi e uscite
        const dot = kind === 'str' ? `<rect class="adot" x="${x - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${x} ${y})"/>`
          : `<circle class="adot" cx="${x}" cy="${y}" r="4"/>`;
        anchors += `<g class="anc ${kind}${hot ? ' hot' : ''}${moving ? ' moving' : ''}" data-anc="${kind}" data-idx="${idx}"><title>${TIP[kind] + PIN_TIP}</title>` +
          `<circle class="ahit" cx="${x}" cy="${y}" r="${n.hub ? 6 : 10}"/>${dot}</g>`;
      }));
    }
    if (n.hub) {
      // svincolo: un punto sulla linea; il centro si trascina, i pallini sul bordo collegano o diramano
      const c = HUB / 2, P = pinsOf(n);
      // tratti dal centro ai pallini: la linea sembra passare dentro lo svincolo
      const spokes = [...P.i, ...P.o, ...P.s].map(q => { const [x, y] = pinXY(l, q); return `M${c},${c} L${x},${y}`; }).join(' ');
      nodes += `<g class="mn hub${sel ? ' sel' : ''}${lk && lk.over === n.id && !lk.overAnc ? ' drop' : ''}"${live ? ` data-id="${n.id}"` : ''} transform="translate(${l.x},${l.y})">` +
        (live ? `<title>Svincolo: trascinalo per spostare la tappa · Tasto destro: opzioni</title>` : '') +
        (sel ? `<circle class="ring" cx="${c}" cy="${c}" r="${c + 3}"/>` : '') +
        `<circle class="hubhit" cx="${c}" cy="${c}" r="${c}"/>${spokes ? `<path class="edge hubline" d="${spokes}"/>` : ''}<circle class="hubdot" cx="${c}" cy="${c}" r="5.5"/>` + anchors + fold + `</g>`;
      return;
    }
    if (previews && folded && n.foldPrev) prevs += foldPreviewMarkup(n, l, live);
    const cls = `mn d${dd}${hasColor(n) ? ' cc c' + n.color : ''}${sel ? ' sel' : ''}${(lk && lk.over === n.id && !lk.overAnc) || (live && S.dropOn === n.id) ? ' drop' : ''}`;
    // testo troncato (troppe righe o riga troppo lunga): al passaggio si legge per intero
    const flat = s => String(s || '').replace(/\s+/g, ' ').trim(), cut = live && n.text && flat(l.lines.join(' ')) !== flat(n.text);
    nodes += `<g class="${cls}"${live ? ` data-id="${n.id}"` : ''} transform="translate(${l.x},${l.y})">` + (cut ? `<title>${esc(n.text)}</title>` : '') +
      // idea primaria (stile 0): bagliore dietro il blocco, per riconoscerla subito
      (dd === 0 ? `<rect class="glow" x="-4" y="-4" width="${l.w + 8}" height="${l.h + 8}" rx="14"/>` : '') +
      (sel ? `<rect class="ring" x="-5" y="-5" width="${l.w + 10}" height="${l.h + 10}" rx="${dd === 0 ? 14 : 11}"/>` : '') + tag +
      // blocco con rami compressi: un secondo riquadro sfalsato dietro, come una pila
      (folded ? `<rect class="stack" x="5" y="5" width="${l.w}" height="${l.h}" rx="${dd === 0 ? 10 : 7}"/>` : '') +
      `<rect class="box" width="${l.w}" height="${l.h}" rx="${dd === 0 ? 10 : 7}"${boxSt ? ` style="${boxSt}"` : ''}/>${txt}` +
      (sel && single ? `<rect class="rsz" data-rsz="1" x="${l.w - 4}" y="${l.h - 4}" width="9" height="9" rx="2"><title>Trascina per ridimensionare</title></rect>` : '') +
      anchors + fold + `</g>`;
  });
  // note sulla tela: appunti, non blocchi
  let cnotes = '';
  (tree.notes || []).forEach(nt => {
    const l = NL.get(nt.id), sel = live && S.sels.has(nt.id), hide = editing && editing.kind === 'note' && editing.id === nt.id;
    cnotes += `<g class="cnote${sel ? ' sel' : ''}${hide ? ' editing' : ''}"${live ? ` data-note="${nt.id}"` : ''} transform="translate(${l.x},${l.y})">` +
      (sel ? `<rect class="ring" x="-4" y="-4" width="${l.w + 8}" height="${l.h + 8}" rx="7"/>` : '') +
      `<rect class="nbox" width="${l.w}" height="${l.h}" rx="4"/><rect class="nbar" width="3" height="${l.h}" rx="1.5"/>` +
      l.lines.map((s, i) => `<text x="12" y="${20 + i * 18}">${esc(s)}</text>`).join('') + `</g>`;
  });
  // gruppi: riquadri sotto a tutto; si prendono dal titolo o dal bordo, l'interno lascia passare i clic
  let grps = '';
  (tree.groups || []).forEach(g => {
    const sel = live && S.sels.has(g.id), hide = editing && editing.kind === 'group' && editing.id === g.id;
    grps += `<g class="grp${sel ? ' sel' : ''}${hide ? ' editing' : ''}"${live ? ` data-grp="${g.id}"` : ''} transform="translate(${g.x},${g.y})">` +
      `<rect class="gbox" width="${g.w}" height="${g.h}" rx="12"/>` +
      (live ? `<rect class="ghit" width="${g.w}" height="${g.h}" rx="12"/><rect class="ghead" width="${g.w}" height="${GHEAD}" rx="12"><title>Trascina per spostare il gruppo con il suo contenuto · Doppio clic: rinomina</title></rect>` : '') +
      `<text class="gtitle" x="14" y="19">${esc(ell(g.text || 'Gruppo', g.w - 28, GFONT))}</text>` +
      (sel ? `<rect class="ring" x="-5" y="-5" width="${g.w + 10}" height="${g.h + 10}" rx="15"/>` : '') +
      (sel && single ? `<rect class="rsz" data-rsz="1" x="${g.w - 4}" y="${g.h - 4}" width="9" height="9" rx="2"><title>Trascina per ridimensionare</title></rect>` : '') + `</g>`;
  });
  if (live) S.E = E;
  const rubber = lk && lk.x2 != null && !lk.pinMove ? `<path class="rubber" d="M${lk.x1},${lk.y1} L${lk.x2},${lk.y2}"/>` : '';
  return `<g>${grps}</g><g>${prevs}</g><g>${edges}</g><g>${nodes}</g><g>${notes}</g><g>${cnotes}</g>${rubber}`;
}

function render() {
  const tree = curTree(), L = mindLayout(tree), NL = notesLayout(tree); S.L = L; S.NL = NL;
  vp.innerHTML = treeMarkup(tree, L, NL, true);
  applyView(); renderBar();
}

/* ---------- operazioni sui blocchi ---------- */
// i blocchi nuovi non hanno x/y: li colloca ensurePositions al prossimo disegno
function addChild(id) {
  const c = mk('Nuova idea'), f0 = findM(curTree(), id), P0 = f0 && pinsOf(f0.n);
  if (P0 && !P0.o.length && P0.s.length) c.edge = { str: true, sp: 0 }; // blocco senza uscite: il figlio è una sua parte
  mutate(t => { const f = findM(t, id); if (f) f.n.children.push(c); });
  selectOnly(c.id); render(); startEdit(c.id, true); markFresh(id);
}
function addSibling(id) {
  const f = findM(curTree(), id); if (!f) return; if (!f.p) return addChild(id);
  const c = mk('Nuova idea');
  if (isStr(f.n.edge)) c.edge = { str: true, sp: f.n.edge.sp || 0 }; // stesso pallino di struttura
  else if (f.n.edge && f.n.edge.po != null) c.edge = { po: f.n.edge.po }; // stessa uscita del genitore
  mutate(t => { const g = findM(t, id); g.p.children.splice(g.p.children.indexOf(g.n) + 1, 0, c); });
  selectOnly(c.id); render(); startEdit(c.id, true); markFresh(id);
}
function addFreeBlock(x, y) {
  const c = { ...mk('Nuovo blocco'), x: Math.round(x), y: Math.round(y - 15) };
  mutate(t => (t.free = t.free || []).push(c));
  selectOnly(c.id); render(); startEdit(c.id, true); markFresh();
}
function addCanvasNote(x, y) {
  const nt = { id: uid(), x: Math.round(x), y: Math.round(y), text: 'Nota' };
  mutate(t => (t.notes = t.notes || []).push(nt));
  selectOnly(nt.id); render(); startNoteEdit(nt.id); markFresh();
}
// toglie i collegamenti aggiuntivi che puntano a blocchi non più presenti
function cleanLinks(t) { if (t.links) { t.links = t.links.filter(x => findM(t, x.from) && findM(t, x.to)); if (!t.links.length) delete t.links; } }
function removeSelected() {
  const t = curTree(), ids = [...S.sels], delRoot = ids.includes(t.id);
  if (!ids.length) return;
  const f0 = findM(t, ids.includes(S.sel) ? S.sel : ids[0]), pid = f0 && f0.p && !ids.includes(f0.p.id) ? f0.p.id : null;
  mutate(tt => {
    // si elimina solo il blocco, non quello che viene dopo: i suoi rami passano al genitore (A → X → B diventa A → B,
    // dalla stessa uscita di A e nello stesso ingresso di B) o, se X non ha genitore, restano liberi dove sono
    const bridge = (n, p, list) => {
      const kids = n.children; n.children = [];
      kids.forEach(c => {
        if (p) {
          const up = n.edge || {}, ed = { ...(c.edge || {}) };
          ['po', 'ps', 'str', 'sp'].forEach(k => delete ed[k]);
          ['po', 'ps', 'str', 'sp'].forEach(k => { if (up[k] !== undefined) ed[k] = up[k]; });
          if (Object.keys(ed).length) c.edge = ed; else delete c.edge;
        } else delete c.edge;
        delete c.dx; delete c.dy;
      });
      if (p) list.splice(list.indexOf(n), 1, ...kids);
      else { list.splice(list.indexOf(n), 1); (tt.free = tt.free || []).push(...kids); }
    };
    if (delRoot) { (tt.free = tt.free || []).push(...tt.children.map(c => { delete c.edge; return c; })); tt.children = []; }
    ids.forEach(id => {
      if (id === tt.id) return;
      const f = findM(tt, id); if (f && f.list) { bridge(f.n, f.p, f.list); return; }
      const nt = findNote(tt, id); if (nt) tt.notes.splice(tt.notes.indexOf(nt), 1);
      const g = findGroup(tt, id); if (g) { tt.groups.splice(tt.groups.indexOf(g), 1); if (!tt.groups.length) delete tt.groups; } // solo il riquadro
    });
    // la radice eliminata: prende il suo posto un blocco libero rimasto, altrimenti la tela resta vuota (con le note)
    if (delRoot) { if (tt.free && tt.free.length) promoteRoot(tt, tt.free[0]); else emptyLevel(tt); }
    cleanLinks(curTree());
  });
  selectOnly(pid && findM(curTree(), pid) ? pid : null); render();
}
// il blocco libero `nr` diventa la radice dei dati del livello: prende con sé blocchi liberi, collegamenti aggiuntivi e note.
// Nessun blocco si sposta e nessuno cambia aspetto (l'attributo "primaria" resta quello che era).
function promoteRoot(t, nr) {
  nr.free = (t.free || []).filter(r => r !== nr); nr.notes = t.notes || []; nr.links = t.links || []; nr.groups = t.groups || [];
  ['free', 'notes', 'links', 'groups'].forEach(k => { if (!nr[k].length) delete nr[k]; });
  delete t.free; delete t.notes; delete t.links; delete t.groups; delete nr.edge;
  if (nr.primary === undefined) nr.primary = false;
  setLevelRoot(nr);
}
// livello senza blocchi: resta un contenitore invisibile che tiene le note
function emptyLevel(t) {
  const v = { id: uid(), text: t.text, children: [], void: true }; if (t.notes && t.notes.length) v.notes = t.notes; if (t.groups && t.groups.length) v.groups = t.groups;
  setLevelRoot(v);
}
// collega l'uscita `po` di `fromId` all'ingresso `pi` di `toId`. Nessun blocco si sposta: cambia solo la linea.
// Se il blocco d'arrivo non ha ancora un genitore diventa suo figlio, altrimenti si aggiunge un collegamento:
// così un blocco può avere più ingressi.
// sp (indice di un pallino di struttura) al posto di po/pi = collegamento di struttura: `to` è una parte di `from`
function link(fromId, po, toId, pi, sp = null) {
  const t = curTree(); if (fromId === toId) return render();
  const a = findM(t, fromId), b = findM(t, toId); if (!a || !b) return render();
  const links = allLinks(t), str = sp != null;
  const same = links.find(L => L.from.id === fromId && L.to.id === toId);
  if (same) {
    // stesso collegamento con pallini diversi (o di altro tipo): si riaggancia
    const moved = str ? !isStr(same.e) || strIdx(a.n, same.e) !== sp
      : isStr(same.e) || outIdx(a.n, same.e) !== po || inIdx(b.n, same.e) !== pi;
    if (moved) { setEdge(same.key, str ? { str: true, sp, po: undefined, pi: undefined } : { po, pi, str: false, sp: undefined }); return toast('Collegamento spostato'); }
    render(); return toast('Sono già collegati');
  }
  const ends = str ? { str: true, sp } : { po, pi };
  if (links.some(L => L.from.id === toId && L.to.id === fromId)) { render(); return toast('Esiste già il collegamento opposto'); }
  let inside = false; walk(b.n, n => { if (n.id === fromId) inside = true; });
  const asChild = !b.p && !inside;
  mutate(tt => {
    if (asChild) {
      const f = findM(tt, toId), pp = findM(tt, fromId).n;
      if (f.n === tt) {
        // la radice dei dati va sotto un blocco libero: la radice di quel blocco libero prende il suo posto
        const nr = tt.free.find(r => { let has = false; walk(r, n => { if (n.id === fromId) has = true; }); return has; });
        promoteRoot(tt, nr);
      } else f.list.splice(f.list.indexOf(f.n), 1);
      pp.children.push(f.n);
      const ed = Object.assign({}, f.n.edge, ends); delete ed.ps;
      if (str) { delete ed.po; delete ed.pi; } else { delete ed.str; delete ed.sp; }
      Object.keys(ed).forEach(k => { if (!ed[k] && ed[k] !== 0) delete ed[k]; }); if (!ed.pi) delete ed.pi;
      f.n.edge = ed;
    } else {
      const lx = { id: uid(), from: fromId, to: toId, ...ends }; if (!lx.pi) delete lx.pi;
      (tt.links = tt.links || []).push(lx);
    }
  });
  selectOnly(toId); render(); toast('Collegati');
}
// eliminare un collegamento: quello aggiuntivo sparisce; quello principale stacca il blocco, che resta dov'è
function deleteEdge(key) {
  if (key.startsWith('x:')) { mutate(t => { t.links = (t.links || []).filter(x => x.id !== key.slice(2)); if (!t.links.length) delete t.links; }); clearSel(); render(); return toast('Collegamento eliminato'); }
  detach(key, 'Collegamento eliminato');
}
function detach(id, msg = 'Blocco staccato') {
  const f = findM(curTree(), id); if (!f || !f.p) return render();
  mutate(tt => { const g = findM(tt, id); g.list.splice(g.list.indexOf(g.n), 1); delete g.n.edge; (tt.free = tt.free || []).push(g.n); });
  selectOnly(id); render(); toast(msg);
}
// blocco intermedio su un collegamento (tasto destro sul collegamento): A → nuovo → B, nessun blocco si sposta
// hub = svincolo: un punto senza testo che fa solo da tappa; i pallini guardano verso i due blocchi
function insertOnLink(key, hub) {
  const t = curTree(), Lk = allLinks(t).find(L => L.key === key); if (!Lk) return;
  const fl = S.L.get(Lk.from.id), tl = S.L.get(Lk.to.id), g = linkGeom(Lk.from, fl, Lk.to, tl, Lk.e);
  const n = hub ? { ...mk(''), hub: true } : mk('Nuova idea'), pi = Math.max(0, inIdx(Lk.to, Lk.e)), po = Math.max(0, outIdx(Lk.from, Lk.e));
  const SZ = sizeMap({ id: 'tmp', text: '', children: [n] }), s = SZ.get(n.id);
  n.x = Math.round(g.mx - s.w / 2); n.y = Math.round(g.my - s.h / 2);
  if (hub) {
    const hl = { x: n.x, y: n.y, w: s.w, h: s.h };
    n.pin = { i: [facePin(hl, fl.x + fl.w / 2, fl.y + fl.h / 2)], o: [facePin(hl, tl.x + tl.w / 2, tl.y + tl.h / 2)], s: [] };
    if (n.pin.i[0][0] === n.pin.o[0][0]) n.pin.o[0] = [{ l: 'r', r: 'l', t: 'b', b: 't' }[n.pin.i[0][0]], 0.5];
  }
  const keep = { note: Lk.e.note, dash: Lk.e.dash, line: Lk.e.line, shape: Lk.e.shape };
  mutate(tt => {
    if (Lk.extra) {
      // il nuovo blocco diventa figlio del primo blocco, poi un collegamento aggiuntivo verso il secondo
      tt.links = tt.links.filter(x => x.id !== key.slice(2)); if (!tt.links.length) delete tt.links;
      n.edge = { po, ...keep }; findM(tt, Lk.from.id).n.children.push(n);
      const lx = { id: uid(), from: n.id, to: Lk.to.id, po: 0, pi }; if (hub && Lk.e.shape) lx.shape = Lk.e.shape;
      (tt.links = tt.links || []).push(lx);
    } else {
      const f = findM(tt, Lk.to.id), i = f.p.children.indexOf(f.n);
      n.edge = { po, ...keep }; f.p.children.splice(i, 1, n); n.children.push(f.n);
      f.n.edge = { pi }; if (hub && Lk.e.shape) f.n.edge.shape = Lk.e.shape; // il tratto dopo lo svincolo resta dello stesso tipo
      if (!f.n.edge.pi) delete f.n.edge.pi; if (!Object.keys(f.n.edge).length) delete f.n.edge;
    }
    Object.keys(n.edge).forEach(k => { if (n.edge[k] === undefined) delete n.edge[k]; });
  });
  selectOnly(n.id); render(); if (!hub) { startEdit(n.id, true); markFresh(); }
}
function toggleFlip(id) { mutate(t => { const f = findM(t, id); if (!f) return; delete f.n.pin; if (f.n.flip) delete f.n.flip; else f.n.flip = true; }); }
function togglePrimary(id) { mutate(t => { const f = findM(t, id); if (!f) return; if (f.n.primary) { if (f.n === t) f.n.primary = false; else delete f.n.primary; } else f.n.primary = true; }); }
// pallini: aggiungi / togli / sposta / di serie
function spreadSide(list, side) { const on = list.filter(p => p[0] === side); on.forEach((p, i) => { p[1] = Math.round((i + 1) / (on.length + 1) * 100) / 100; }); }
function addPin(id, kind) {
  mutate(t => {
    const n = findM(t, id).n, P = JSON.parse(JSON.stringify(pinsOf(n))), list = P[PK[kind]];
    const side = list.length ? list[list.length - 1][0] : { in: 'l', out: 'r', str: 'b' }[kind];
    list.push([side, 0.5]); spreadSide(list, side); n.pin = P;
  });
}
function removePin(id, kind) { const n = findM(curTree(), id).n, len = pinsOf(n)[PK[kind]].length; if (len) editPin(id, kind, len - 1, 'del'); }
function setPin(id, kind, idx, pos) {
  mutate(t => { const n = findM(t, id).n, P = JSON.parse(JSON.stringify(pinsOf(n))); P[PK[kind]][idx] = pos; n.pin = P; });
}
// Un pallino si duplica, si elimina o cambia tipo. I collegamenti che lo usano lo seguono: da uscita a struttura
// (e viceversa) restano attaccati e cambiano linea; se il pallino sparisce o diventa ingresso/uscita incompatibile,
// passano a un altro pallino dello stesso tipo o, se non ce ne sono, al lato rivolto all'altro blocco.
function editPin(id, kind, idx, op, nk) {
  mutate(t => {
    const n = findM(t, id).n, P = JSON.parse(JSON.stringify(pinsOf(n))), list = P[PK[kind]], pin = list[idx];
    if (!pin) return;
    if (op === 'dup') { list.push([pin[0], Math.round((pin[1] <= 0.75 ? pin[1] + 0.15 : pin[1] - 0.15) * 100) / 100]); n.pin = P; return; }
    // gli indici dei pallini di questo tipo cambiano: i loro rami compressi si riaprono
    if (n.foldOut) { n.foldOut = n.foldOut.filter(k => k[0] !== PK[kind]); if (!n.foldOut.length) delete n.foldOut; }
    // collegamenti che usano un pallino di questo tipo, con l'indice attuale (calcolato prima di cambiare i pallini)
    const fld = { in: 'pi', out: 'po', str: 'sp' }[kind], cur = { in: inIdx, out: outIdx, str: strIdx }[kind];
    const ends = [];
    allLinks(t).forEach(L => {
      const fromSide = kind !== 'in', node = fromSide ? L.from : L.to;
      if (node.id !== id || (kind === 'str') !== isStr(L.e)) return;
      const e = L.extra ? L.e : (L.to.edge = L.to.edge || {});
      ends.push({ e, i: cur(n, e) });
    });
    list.splice(idx, 1);
    let ni = null;
    if (op === 'type') { P[PK[nk]].push(pin); ni = P[PK[nk]].length - 1; }
    n.pin = P;
    ends.forEach(({ e, i }) => {
      if (i !== idx) { if (i > idx) e[fld] = i - 1; else if (i >= 0) e[fld] = i; return; }
      delete e[fld];
      if (ni === null || kind === 'in' || nk === 'in') return;
      if (nk === 'str') { e.str = true; e.sp = ni; delete e.po; delete e.pi; } else { delete e.str; delete e.sp; e.po = ni; }
    });
    walkAll(t, x => { if (x.edge && !Object.keys(x.edge).length) delete x.edge; });
  });
}
function resetPins(id) { mutate(t => { delete findM(t, id).n.pin; }); }

/* ---------- duplica, copia, incolla ---------- */
// copia profonda con id nuovi (anche rami, struttura interna con i suoi blocchi liberi, collegamenti e note)
function cloneFresh(n) {
  const c = JSON.parse(JSON.stringify(n)), map = {}, conts = [];
  (function re(x) {
    map[x.id] = uid(); x.id = map[x.id]; if (x.links) conts.push(x);
    x.children.forEach(re); (x.free || []).forEach(re); (x.notes || []).forEach(nt => { nt.id = uid(); }); (x.groups || []).forEach(g => { g.id = uid(); });
  })(c);
  conts.forEach(x => x.links.forEach(L => { L.id = uid(); L.from = map[L.from] || L.from; L.to = map[L.to] || L.to; }));
  return c;
}
// copia "staccata": senza i contenuti del livello (se era la radice) e senza collegamento in entrata
function looseCopy(n) { const c = cloneFresh(n); ['free', 'notes', 'links', 'groups', 'edge'].forEach(k => delete c[k]); return c; }
function selectMany(ids) { S.sels = new Set(ids); S.sel = ids[ids.length - 1] || null; S.esel = null; }
// il blocco con tutti i suoi rami: trascinandolo si sposta tutto insieme
function selectBranch(id) { const f = findM(curTree(), id); if (!f) return; const ids = []; walk(f.n, d => ids.push(d.id)); selectMany(ids); S.sel = id; render(); }
// altezza del sotto-albero sullo schermo (per mettere la copia subito sotto)
function treeSpan(n, L) { let y1 = Infinity, y2 = -Infinity; walk(n, d => { const l = L.get(d.id); if (l) { y1 = Math.min(y1, l.y); y2 = Math.max(y2, l.y + l.h); } }); return y2 - y1; }
function duplicateSelected() {
  const t = curTree(), tops = topSelected(t), notes = (t.notes || []).filter(nt => S.sels.has(nt.id)), L = S.L, ids = [];
  if (!tops.length && !notes.length) return;
  mutate(tt => {
    tops.forEach(n0 => {
      const f = findM(tt, n0.id);
      if (f.p) { const c = cloneFresh(f.n); shiftTree(c, 0, treeSpan(n0, L) + 12); f.p.children.splice(f.p.children.indexOf(f.n) + 1, 0, c); ids.push(c.id); return; }
      const c = looseCopy(f.n); shiftTree(c, 30, 30); (tt.free = tt.free || []).push(c); ids.push(c.id);
    });
    notes.forEach(nt => { const c = { ...nt, id: uid(), x: nt.x + 24, y: nt.y + 24 }; tt.notes.push(c); ids.push(c.id); });
  });
  selectMany(ids); render(); toast(ids.length > 1 ? `${ids.length} copie create` : 'Copia creata');
}
function copySelected() {
  const t = curTree(), nodes = topSelected(t).map(n => looseCopy(n)), notes = (t.notes || []).filter(nt => S.sels.has(nt.id)).map(nt => ({ ...nt }));
  if (!nodes.length && !notes.length) return;
  S.clip = { nodes, notes, src: topSelected(t).map(n => n.id) }; toast(`Copiat${nodes.length + notes.length > 1 ? 'i' : 'o'}: ${nodes.length + notes.length}`);
}
// incolla: dentro il blocco selezionato (come rami, accanto a lui) oppure liberi nel punto indicato
// inside = richiesto dal menu "Incolla dentro questo blocco". Con Ctrl+V il blocco appena copiato (ancora selezionato)
// non riceve la propria copia: va libera dove sta il mouse.
function pasteClip(at, inside = !at) {
  if (!S.clip) return toast('Niente da incollare');
  const t = curTree(), ids = [];
  const target = S.sels.size === 1 && findM(t, S.sel) && (inside || !(S.clip.src || []).includes(S.sel)) ? S.sel : null;
  mutate(tt => {
    S.clip.nodes.forEach((n, i) => {
      const c = cloneFresh(n), ox = c.x, oy = c.y;
      if (target) {
        const p = findM(tt, target).n; p.children.push(c); delete c.x; delete c.y;
        placeNew(tt, p, c, sizeMap(tt)); const dx = c.x - ox, dy = c.y - oy;
        c.children.forEach(ch => shiftTree(ch, dx, dy));
      } else { shiftTree(c, at.x - ox + i * 24, at.y - oy + i * 24); (tt.free = tt.free || []).push(c); }
      ids.push(c.id);
    });
    S.clip.notes.forEach((nt, i) => { const c = { ...nt, id: uid(), x: Math.round(at ? at.x + 12 + i * 24 : nt.x + 24), y: Math.round(at ? at.y + 36 + i * 24 : nt.y + 24) }; (tt.notes = tt.notes || []).push(c); ids.push(c.id); });
  });
  selectMany(ids); render();
}
// Alt + trascina: le copie nascono staccate nel punto degli originali (senza passare da mutate: lo snapshot è già fatto)
function altCopies(t) {
  const ids = [], movers = [];
  topSelected(t).forEach(n => {
    const c = looseCopy(n); (t.free = t.free || []).push(c); ids.push(c.id);
    walk(c, d => movers.push({ o: d, ox: d.x, oy: d.y }));
  });
  (t.notes || []).filter(nt => S.sels.has(nt.id)).forEach(nt => {
    const c = { ...nt, id: uid() }; t.notes.push(c); ids.push(c.id); movers.push({ o: c, ox: c.x, oy: c.y });
  });
  selectMany(ids); return movers;
}

// blocchi selezionati senza antenati selezionati
// Struttura trascinata sopra un blocco: i blocchi selezionati, con i loro rami, diventano rami compressi di quel blocco.
// Tornano come erano prima del trascinamento e si spostano tutti insieme accanto al blocco, così riaprendoli
// si vedono a ventaglio. Il blocco d'arrivo non può essere selezionato né stare dentro un ramo selezionato.
function canFoldInto(t, id) {
  if (!findM(t, id)) return false;
  let ok = true; topSelected(t).forEach(s => walk(s, d => { if (d.id === id) ok = false; })); return ok;
}
// movers = quelli del trascinamento (posizioni di partenza); lo snapshot per annullare è già stato fatto all'inizio
function foldInto(id, movers) {
  let t = curTree();
  const tops = topSelected(t); if (!tops.length || !canFoldInto(t, id)) return false;
  movers.forEach(m => { m.o.x = m.ox; m.o.y = m.oy; });
  const SZ = sizeMap(t), target = findM(t, id).n, tl = SZ.get(id);
  let x1 = Infinity, y1 = Infinity, y2 = -Infinity;
  tops.forEach(s => walk(s, d => { if (hasPos(d)) { const z = SZ.get(d.id); x1 = Math.min(x1, d.x); y1 = Math.min(y1, d.y); y2 = Math.max(y2, d.y + z.h); } }));
  if (x1 !== Infinity) tops.forEach(s => shiftTree(s, target.x + tl.w + 60 - x1, target.y + tl.h / 2 - (y1 + y2) / 2));
  tops.forEach(s => {
    if (s === t) { // la radice dei dati: prende il suo posto la radice dell'albero libero che contiene il blocco d'arrivo
      const nr = t.free.find(r => { let has = false; walk(r, d => { if (d.id === id) has = true; }); return has; });
      promoteRoot(t, nr); t = curTree();
    } else { const f = findM(t, s.id); f.list.splice(f.list.indexOf(s), 1); }
    if (s.edge) { ['po', 'pi', 'ps', 'sp', 'str'].forEach(k => delete s.edge[k]); if (!Object.keys(s.edge).length) delete s.edge; }
    target.children.push(s);
  });
  // un collegamento aggiuntivo tra il blocco e un ramo appena entrato ripeterebbe il legame d'albero
  const ids = new Set(tops.map(s => s.id));
  if (t.links) { t.links = t.links.filter(x => !((x.from === id && ids.has(x.to)) || (x.to === id && ids.has(x.from)))); if (!t.links.length) delete t.links; }
  if (t.free && !t.free.length) delete t.free;
  target.fold = true;
  selectOnly(id); save(); render();
  const cnt = countDesc(target);
  toast(`${cnt} ${cnt === 1 ? 'blocco compresso' : 'blocchi compressi'} in «${ell(target.text || 'Senza titolo', 160, `500 13px ${FB}`)}» · Ctrl+Z per annullare`);
  return true;
}
function topSelected(tree) {
  const out = [];
  const rec = (n, anc) => { const s = S.sels.has(n.id); if (s && !anc) out.push(n); n.children.forEach(c => rec(c, anc || s)); };
  rec(tree, false); (tree.free || []).forEach(r => rec(r, false));
  return out;
}
// cosa si sposta trascinando: solo i blocchi e le note selezionati (i figli restano dove sono)
// un gruppo selezionato si porta dietro tutto ciò che contiene (blocchi, note, altri gruppi)
function dragMovers(t) {
  const out = [], seen = new Set(), add = o => { if (!seen.has(o)) { seen.add(o); out.push({ o, ox: o.x, oy: o.y }); } };
  // un blocco con i rami compressi si porta dietro i rami nascosti, così riaprendoli restano attorno a lui
  const addB = d => { add(d); d.children.forEach(c => { if (isFoldedChild(d, c)) walk(c, add); }); };
  walkAll(t, d => { if (S.sels.has(d.id)) addB(d); });
  (t.notes || []).filter(nt => S.sels.has(nt.id)).forEach(add);
  (t.groups || []).filter(g => S.sels.has(g.id)).forEach(g => {
    add(g);
    walkAll(t, d => { const l = S.L.get(d.id); if (l && within(l, g)) addB(d); });
    (t.notes || []).forEach(nt => { const l = S.NL.get(nt.id); if (l && within(l, g)) add(nt); });
    t.groups.forEach(h => { if (h !== g && within(h, g)) add(h); });
  });
  return out;
}

/* ---------- gruppi ---------- */
const findGroup = (tree, id) => (tree.groups || []).find(g => g.id === id);
const within = (l, g) => l.x >= g.x && l.y >= g.y && l.x + l.w <= g.x + g.w && l.y + l.h <= g.y + g.h;
// riquadro attorno ai blocchi e alle note selezionati, con lo spazio per il titolo
function groupSelected() {
  const boxes = [...S.sels].map(id => S.L.get(id) || S.NL.get(id)).filter(Boolean);
  if (!boxes.length) return toast('Seleziona i blocchi da raggruppare');
  const x1 = Math.min(...boxes.map(l => l.x)), y1 = Math.min(...boxes.map(l => l.y));
  const x2 = Math.max(...boxes.map(l => l.x + l.w)), y2 = Math.max(...boxes.map(l => l.y + l.h));
  const g = { id: uid(), x: Math.round(x1 - GPAD), y: Math.round(y1 - GPAD - GHEAD), w: Math.round(x2 - x1 + GPAD * 2), h: Math.round(y2 - y1 + GPAD * 2 + GHEAD), text: 'Gruppo' };
  g.w = Math.max(g.w, GMIN[0]); g.h = Math.max(g.h, GMIN[1]);
  mutate(t => (t.groups = t.groups || []).push(g));
  selectOnly(g.id); render(); startGroupEdit(g.id);
}
// sciogli: sparisce il riquadro, i blocchi restano dove sono
function ungroup(id) { mutate(t => { t.groups = (t.groups || []).filter(g => g.id !== id); if (!t.groups.length) delete t.groups; }); clearSel(); render(); }
function eachSelected(fn) { const ids = [...S.sels], L = S.L; mutate(t => ids.forEach(id => { const f = findM(t, id); if (f) fn(f.n, L.get(id)); })); }
function setColor(c) { eachSelected(n => { if (c === '') delete n.color; else n.color = +c; }); }
function autoSize() { eachSelected(n => { delete n.w; delete n.h; }); }

/* ---------- stile e nota dei collegamenti ---------- */
function setEdge(key, patch) {
  mutate(t => {
    const e = edgeData(t, key, true); if (!e) return;
    Object.assign(e, patch);
    // si tolgono i valori vuoti; po (indice dell'uscita) vale anche 0
    Object.keys(e).forEach(k => { if (['id', 'from', 'to'].includes(k) || (k === 'po' && typeof e[k] === 'number')) return; if (!e[k]) delete e[k]; });
    if (!key.startsWith('x:')) { const f = findM(t, key); if (f && !Object.keys(f.n.edge).length) delete f.n.edge; }
  });
}
const toggleFoldPreview = id => mutate(t => { const f = findM(t, id); if (!f) return; if (f.n.foldPrev) delete f.n.foldPrev; else f.n.foldPrev = true; });

// riquadro che contiene tutta la mappa (coordinate della tela)
function levelBounds(L, NL, G = []) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  [L, NL, G].forEach(M => M.forEach(l => { x1 = Math.min(x1, l.x); y1 = Math.min(y1, l.y); x2 = Math.max(x2, l.x + l.w); y2 = Math.max(y2, l.y + l.h); }));
  if (x1 === Infinity) return { x: 0, y: 0, w: 120, h: 40 }; // livello vuoto
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
// anteprima dei rami compressi (passando sull'etichetta "+N"), senza aprirli
const prevEl = $('#preview');
function showPreview(id, rect, key) {
  const f = findM(curTree(), id); if (!f || !(key ? countPin(f.n, key) : f.n.fold && f.n.children.length)) return;
  const { t, L, b } = foldMini(f.n, key);
  const pad = 16, w = b.w + pad * 2, h = b.h + pad * 2, k = Math.min(1, 340 / w, 220 / h);
  prevEl.innerHTML = `<div class="ptitle">Rami compressi · ${key ? countPin(f.n, key) : countDesc(f.n)} blocchi · clic per aprirli</div>` +
    `<svg viewBox="${b.x - pad} ${b.y - pad} ${w} ${h}" width="${Math.round(w * k)}" height="${Math.round(h * k)}">${treeMarkup(t, L, new Map(), false)}</svg>`;
  prevEl.hidden = false;
  const r = prevEl.getBoundingClientRect();
  let left = rect.right + 10; if (left + r.width > innerWidth - 8) left = rect.left - r.width - 10;
  prevEl.style.left = clamp(left, 8, innerWidth - r.width - 8) + 'px';
  prevEl.style.top = clamp(rect.top - 10, BAR_H + 8, innerHeight - r.height - 8) + 'px';
}
function hidePreview() { prevEl.hidden = true; }
