// Mappa mentale: posizioni, pallini, collegamenti, disegno e operazioni sui blocchi
// Blocco: { id, text, type? (vedi js/blocks.js), children[], x, y, w?, h?, primary?, flip?, pin?, color?, fs?, bw?, op?, fold?, tag?, edge? }
//   x/y = angolo in alto a sinistra, FISSO: collegare, staccare o ricollegare non sposta nessun blocco
//   primary = "idea primaria" (attributo scelto dall'utente, anche su più blocchi): stile marcato,
//             di serie ingresso in alto e due uscite laterali
//   pin = { i: [[lato, pos]...], o: [[lato, pos]...], s: [...] } pallini d'ingresso, d'uscita e di struttura sul bordo
//         (lato 'l'|'r'|'t'|'b', pos 0–1 lungo il lato); se manca valgono quelli di serie (vedi defaultPins).
//         Ogni elenco può essere vuoto. Clic su un pallino: tipo, duplica, elimina (editPin)
//   fold = rami compressi nel blocco: i discendenti non si disegnano (etichetta "+N"), restano dove sono
//   flip = di serie ingresso a destra e uscita a sinistra · w/h = dimensione a mano
//   color = indice 0–5 dei token --c0…--c5 · fs = testo (px) · fw = peso del carattere (300–700) · bw = bordo · op = opacità del riquadro
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
//   Stile: color, line ('dash' di serie | 'solid' | 'dot' | 'none'), bw (bordo), fo (opacità dello sfondo),
//   tfs/tfw (dimensione e peso del titolo), ta ('c' = titolo al centro).
//   fold + hide = compresso: resta la barra del titolo, gli elementi in `hide` (id presi al momento) non si vedono;
//   lock = bloccato: né il gruppo né il suo contenuto si spostano.
const DEF_FS = [16, 14, 13];
const fsOf = (n, depth) => n.fs || DEF_FS[Math.min(depth, 2)];
// peso del carattere: scelto sul blocco (fw) o di serie (600 per primarie e primo livello, 400 dopo)
const fwOf = (n, depth) => n.fw || (depth <= 1 ? 600 : 400);
const nodeFont = (n, depth) => `${n.it ? 'italic ' : ''}${fwOf(n, depth)} ${fsOf(n, depth)}px ${FB}`; // it = corsivo
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

// Lo stile di serie dipende dalla profondità (sizeMap): staccare, collegare o eliminare un blocco intermedio la
// cambierebbe, e un blocco diventerebbe grassetto o più grande. `mutate` confronta i livelli prima e dopo: chi cambia
// livello tiene i valori che aveva (fs, fw, bw), come se li avesse scelti. Le idee primarie (livello 0) e gli svincoli no.
function styleLevels(t) {
  const m = new Map(), re = (n, d) => { if (!n.hub && !n.primary) m.set(n.id, Math.max(1, d)); n.children.forEach(c => re(c, d + 1)); };
  if (!t.void) re(t, 0); (t.free || []).forEach(r => re(r, 1));
  return m;
}
function keepLook(t, before) {
  const after = styleLevels(t);
  walkAll(t, n => {
    const a = before.get(n.id), b = after.get(n.id); if (a == null || b == null || a === b) return;
    if (n.fs == null && fsOf(n, a) !== fsOf(n, b)) n.fs = fsOf(n, a);
    if (!n.fw && fwOf(n, a) !== fwOf(n, b)) n.fw = fwOf(n, a);
    if (n.bw == null && bwOf(n, a) !== bwOf(n, b)) n.bw = bwOf(n, a);
  });
}

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
    // elenchi e tabelle hanno misure proprie (js/blocks.js)
    if (n.type === 'table') { M.set(n.id, { ...tableSize(n, lv, fs, font, lh), depth: lv }); n.children.forEach(c => size(c, depth + 1)); return; }
    if (isList(n)) { M.set(n.id, { ...listSize(n, lv, fs, font, lh, padX, padY), depth: lv }); n.children.forEach(c => size(c, depth + 1)); return; }
    if (n.type === 'exp') { M.set(n.id, { ...expSize(n, lv, fs, font, lh, padX, padY), depth: lv }); n.children.forEach(c => size(c, depth + 1)); return; }
    if (isMedia(n)) { M.set(n.id, { ...(n.type === 'img' ? imgSize : audioSize)(n, lv, fs, font, lh), depth: lv }); n.children.forEach(c => size(c, depth + 1)); return; } // js/media.js
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
  if (ensurePins(tree, SZ2)) save();
  if (tidyPins(tree)) save(); // pallini solo dove ci sono collegamenti
  // i rami compressi non hanno posto nel disegno: senza voce in L non si disegnano né loro né i loro collegamenti
  const L = new Map(), hid = foldedSet(tree);
  walkAll(tree, n => { if (!hid.has(n.id)) L.set(n.id, { ...SZ2.get(n.id), x: n.x, y: n.y }); });
  // gruppi compressi: i blocchi nascosti escono da L (L.full li tiene tutti) e i loro collegamenti arrivano alla
  // barra del gruppo (L.px: id → riquadro della barra, con gid per non disegnare quelli interni al gruppo)
  const GH = groupHidden(tree);
  L.full = new Map(L); L.px = new Map();
  (tree.groups || []).forEach(g => {
    if (!g.fold || GH.has(g.id)) return;
    const bar = gRect(g), all = new Set();
    const rec = h => (h.hide || []).forEach(id => { if (all.has(id)) return; all.add(id); const k = findGroup(tree, id); if (k && k.fold) rec(k); });
    rec(g);
    all.forEach(id => { const l = L.full.get(id); if (l) L.px.set(id, { ...bar, depth: l.depth, gid: g.id }); });
  });
  GH.forEach(id => L.delete(id));
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
  if (readOnly()) { S.roOk = true; try { return toggleFold(id, key); } finally { S.roOk = false; } }
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
    // ridimensionata con la maniglia (nt.w/nt.h): il testo va a capo sulla larghezza e si ferma all'altezza
    const lines = wrap(nt.text || 'Nota', nt.w ? Math.max(30, nt.w - 22) : 220, CNOTE_FONT, nt.h ? Math.max(1, Math.floor((nt.h - 14) / 18)) : 10);
    NL.set(nt.id, { x: nt.x, y: nt.y, lines, w: nt.w || Math.max(60, Math.max(...lines.map(s => tw(s, CNOTE_FONT))) + 22), h: nt.h || lines.length * 18 + 14 });
  });
  NL.full = new Map(NL); groupHidden(tree).forEach(id => NL.delete(id)); // note dentro un gruppo compresso
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
// Senza po si cerca il pallino per lato sui pallini salvati, non su quelli provvisori: mentre se ne trascina uno
// la linea non deve saltare su un altro pallino (e i rami compressi su quel pallino non devono riaprirsi)
function outIdx(p, e) {
  const o = pinsOf(p).o; e = e || {}; if (!o.length) return -1;
  if (e.po != null) return clamp(e.po, 0, o.length - 1);
  const B = (p.pin || defaultPins(p)).o || [];
  if (e.ps) { const i = B.findIndex(q => q[0] === e.ps); if (i >= 0) return Math.min(i, o.length - 1); }
  const r = B.findIndex(q => q[0] === 'r'); return r >= 0 ? Math.min(r, o.length - 1) : 0;
}
// i collegamenti che escono da n senza po (rami nuovi, dati vecchi) ricevono l'indice dell'uscita che usano adesso:
// così, quando i pallini cambiano lato, restano attaccati allo stesso pallino
function freezeOuts(t, n) {
  allLinks(t).forEach(L => {
    if (L.from.id !== n.id || isStr(L.e) || L.e.po != null) return;
    const i = outIdx(n, L.e); if (i < 0) return;
    const e = L.extra ? L.e : (L.to.edge = L.to.edge || {}); e.po = i; delete e.ps;
  });
}
const inIdx = (c, e) => Math.min((e && e.pi) || 0, pinsOf(c).i.length - 1);
const strIdx = (p, e) => Math.min((e && e.sp) || 0, pinsOf(p).s.length - 1);
// rombo d'arrivo di un collegamento di struttura (ts, sul blocco figlio)
const tsIdx = (c, e) => Math.min((e && e.ts) || 0, pinsOf(c).s.length - 1);
const isStr = e => !!(e && e.str);
// tratto della linea: continuo, tratteggiato, a puntini (di serie: puntini per la struttura, continuo per il resto;
// `dash: true` è il formato vecchio del tratteggiato)
const lineOf = e => (e && e.line) || (e && e.dash ? 'dash' : isStr(e) ? 'dot' : 'solid');
// spessore: scelto sul collegamento (lw) o di serie (puntini 2.4, dall'idea primaria 2.2, altrimenti 1.5)
const lwOf = (e, depth) => (e && e.lw) || (lineOf(e) === 'dot' ? 2.4 : depth === 0 ? 2.2 : 1.5);
// distanza tra puntini o trattini (gap, px; di serie 5) e opacità della linea (op, 0.1–1; di serie 1)
const GAP = 5, gapOf = e => (e && e.gap) || GAP, eopOf = e => (e && e.op) || 1;
function edgeStyle(e, w) {
  const ln = lineOf(e), da = ln === 'dot' ? `1 ${gapOf(e)}` : ln === 'dash' ? `7 ${gapOf(e)}` : '';
  return `stroke-width:${w}px;` + (da && e && e.gap ? `stroke-dasharray:${da};` : '') + (e && e.op ? `stroke-opacity:${e.op};` : '');
}
const linkData = key => { const L = allLinks(curTree()).find(x => x.key === key); return L ? L.e : {}; };
function linkWidth(key) { const t = curTree(), L = allLinks(t).find(x => x.key === key); return L ? lwOf(L.e, (S.L.get(L.from.id) || {}).depth) : 1.5; }
// pallino sotto il punto p (coordinate della tela): le aree di presa dei pallini vicini si sovrappongono, quindi
// vale il più vicino, non quello disegnato sopra; `want` = tipo preferito quando ce ne sono più nel raggio
function pinAt(n, l, p, want) {
  const P = pinsOf(n), r = n.hub ? 6 : 10; let best = null;
  [['in', P.i], ['out', P.o], ['str', P.s]].forEach(([kind, list]) => list.forEach((q, idx) => {
    const [x, y] = pinXY(l, q), d = Math.hypot(l.x + x - p.x, l.y + y - p.y);
    if (d > r) return;
    const score = d - (want && kind === want ? r : 0);
    if (!best || score < best.score) best = { kind, idx, score };
  }));
  return best && { kind: best.kind, idx: best.idx };
}
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

// Un collegamento parte e arriva SEMPRE su un pallino: processo = uscita → ingresso, struttura = rombo → rombo.
// Se a un blocco manca il pallino che serve (mappe vecchie, pallino eliminato, blocco senza ingressi), se ne aggiunge
// uno sul lato rivolto all'altro blocco, in un punto libero di quel lato.
function ensurePins(t, SZ) {
  let changed = false;
  const box = n => { const s = SZ.get(n.id) || { w: 0, h: 0 }; return { x: n.x || 0, y: n.y || 0, w: s.w, h: s.h }; };
  allLinks(t).forEach(L => {
    const str = isStr(L.e);
    [[L.from, str ? 's' : 'o', L.to], [L.to, str ? 's' : 'i', L.from]].forEach(([n, k, other]) => {
      const B = n.pin || defaultPins(n); if ((B[k] || []).length) return;
      const P = { i: [...(B.i || [])], o: [...(B.o || [])], s: [...(B.s || [])] }, ob = box(other);
      const [side] = facePin(box(n), ob.x + ob.w / 2, ob.y + ob.h / 2), used = [...P.i, ...P.o, ...P.s].filter(q => q[0] === side).map(q => q[1]);
      const pos = [0.5, 0.3, 0.7, 0.2, 0.8].find(v => !used.some(u => Math.abs(u - v) < 0.08)) ?? 0.5;
      P[k].push([side, pos]); n.pin = P; changed = true;
    });
  });
  return changed;
}

/* ---------- collegamenti ---------- */
// la linea parte da un pallino d'uscita e arriva a un pallino d'ingresso: sempre quelli, ovunque si spostino i blocchi.
// Collegamento di struttura: parte dal pallino di struttura e arriva sul lato del blocco rivolto verso di esso.
function linkGeom(pn, pl, cn, cl, e) {
  const P = pinsOf(pn), str = isStr(e);
  const a = (str ? P.s[strIdx(pn, e)] : P.o[outIdx(pn, e)]) || facePin(pl, cl.x + cl.w / 2, cl.y + cl.h / 2);
  const [ax1, ay1] = pinXY(pl, a);
  const b = (str ? pinsOf(cn).s[tsIdx(cn, e)] : pinsOf(cn).i[inIdx(cn, e)]) || facePin(cl, pl.x + ax1, pl.y + ay1);
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

// markup SVG della mappa; live = tela interattiva (selezione, pallini, maniglie), altrimenti anteprima/esportazione
function treeMarkup(tree, L, NL, live) {
  const single = live && S.sels.size === 1 && !editing, lk = live ? S.link : null;
  const F = live ? findMarks(tree, L) : null, fcls = id => !F || !F.on ? '' : (F.hit.has(id) ? ' hit' : '') + (F.cur === id ? ' cur' : '') + (F.inside.has(id) ? ' hitin' : '');
  const E = new Map(); let edges = '', notes = '', nodes = '';
  allLinks(tree).forEach(({ key, from, to, e }) => {
    const PX = L.px || new Map(), pl = L.get(from.id) || PX.get(from.id), cl = L.get(to.id) || PX.get(to.id);
    if (!pl || !cl || (pl.gid && pl.gid === cl.gid)) return; // dentro lo stesso gruppo compresso: non si vede
    const g = linkGeom(from, pl, to, cl, e);
    // la nota sta al centro del collegamento, spostata di nx/ny se l'utente l'ha trascinata
    const nx = g.mx + (e.nx || 0), ny = g.my + (e.ny || 0);
    E.set(key, { x: nx, y: ny });
    const esel = live && (S.esel === key || S.esels.has(key));
    const cls = 'eg l-' + lineOf(e) + (isStr(e) ? ' str' : '') + (hasColor(e) ? ' cc c' + e.color : '') + (esel ? ' sel' : '');
    edges += `<g class="${cls}"${live ? ` data-edge="${key}"` : ''}><path class="edge" style="${edgeStyle(e, lwOf(e, pl.depth) + (esel ? 1 : 0))}" d="${g.d}"/>` +
      (live ? `<path class="ehit" d="${g.d}"><title>Doppio clic: nota · Tasto destro: opzioni del collegamento</title></path>` : '') + `</g>`;
    if (e.note && !(editing && editing.kind === 'edge' && editing.id === key)) {
      const lines = wrap(e.note, 170, NOTE_FONT, 3), w = Math.max(...lines.map(s => tw(s, NOTE_FONT))) + 16, h = lines.length * 14 + 8;
      const lead = e.nx || e.ny ? `<path class="lead" d="M${g.mx},${g.my} L${nx},${ny}"/>` : '';
      // etichetta a pillola chiara: deve distinguersi a colpo d'occhio dai blocchi (scuri) e dalle note della tela (gialle)
      notes += `<g class="enote${esel ? ' sel' : ''}"${live ? ` data-edge="${key}"` : ''}>${lead}<rect x="${nx - w / 2}" y="${ny - h / 2}" width="${w}" height="${h}" rx="${lines.length > 1 ? 10 : h / 2}"/>` +
        lines.map((s, i) => `<text x="${nx}" y="${ny - h / 2 + 15 + i * 14}" text-anchor="middle">${esc(s)}</text>`).join('') + `</g>`;
    }
  });
  walkAll(tree, n => {
    const l = L.get(n.id); if (!l) return; // dentro un ramo compresso
    const sel = live && S.sels.has(n.id), dd = Math.min(l.depth, 2), pad = (l.h - l.lines.length * l.lh) / 2;
    const fsSt = n.fs || n.fw || n.it ? ` style="${n.fs ? `font-size:${n.fs}px;` : ''}${n.fw ? `font-weight:${n.fw};` : ''}${n.it ? 'font-style:italic' : ''}"` : '';
    const boxSt = (n.bw != null ? `stroke-width:${n.bw}px;` : '') + (n.op != null ? `opacity:${n.op};` : '');
    const txt = n.type === 'table' && l.tb ? tableMarkup(n, l, live, fsSt) : isList(n) && l.rows ? listMarkup(n, l, live, fsSt) : n.type === 'exp' && l.ex ? expMarkup(n, l, live, fsSt)
      : l.im ? imgMarkup(n, l, live, fsSt) : l.au ? audioMarkup(n, l, live, fsSt)
      : l.lines.map((s, i) => `<text x="${l.w / 2}" y="${pad + (i + 0.76) * l.lh}" text-anchor="middle"${fsSt}>${esc(s)}</text>`).join('');
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
      nodes += `<g class="mn hub${sel ? ' sel' : ''}${fcls(n.id)}${lk && lk.over === n.id && !lk.overAnc ? ' drop' : ''}"${live ? ` data-id="${n.id}"` : ''} transform="translate(${l.x},${l.y})">` +
        (live ? `<title>Svincolo: trascinalo per spostare la tappa · Tasto destro: opzioni</title>` : '') +
        (sel ? `<circle class="ring" cx="${c}" cy="${c}" r="${c + 3}"/>` : '') +
        `<circle class="hubhit" cx="${c}" cy="${c}" r="${c}"/>${spokes ? `<path class="edge hubline" d="${spokes}"/>` : ''}<circle class="hubdot" cx="${c}" cy="${c}" r="5.5"/>` + anchors + fold + `</g>`;
      return;
    }
    const cls = `mn d${dd}${hasColor(n) ? ' cc c' + n.color : ''}${sel ? ' sel' : ''}${(lk && lk.over === n.id && !lk.overAnc) || (live && S.dropOn === n.id) ? ' drop' : ''}${fcls(n.id)}`;
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
      refMarkup(n, l, live) + anchors + fold + `</g>`;
  });
  // note sulla tela: appunti, non blocchi
  let cnotes = '';
  (tree.notes || []).forEach(nt => {
    const l = NL.get(nt.id), sel = live && S.sels.has(nt.id), hide = editing && editing.kind === 'note' && editing.id === nt.id;
    if (!l) return; // nascosta in un gruppo compresso
    cnotes += `<g class="cnote${sel ? ' sel' : ''}${fcls(nt.id)}${hide ? ' editing' : ''}"${live ? ` data-note="${nt.id}"` : ''} transform="translate(${l.x},${l.y})">` +
      (sel ? `<rect class="ring" x="-4" y="-4" width="${l.w + 8}" height="${l.h + 8}" rx="7"/>` : '') +
      `<rect class="nbox" width="${l.w}" height="${l.h}" rx="4"/><rect class="nbar" width="3" height="${l.h}" rx="1.5"/>` +
      l.lines.map((s, i) => `<text x="12" y="${20 + i * 18}">${esc(s)}</text>`).join('') +
      (sel && single ? `<rect class="rsz" data-rsz="1" x="${l.w - 4}" y="${l.h - 4}" width="9" height="9" rx="2"><title>Trascina per ridimensionare</title></rect>` : '') + `</g>`;
  });
  // gruppi: riquadri sotto a tutto; si prendono dal titolo o dal bordo, l'interno lascia passare i clic
  let grps = '';
  const GH = groupHidden(tree);
  (tree.groups || []).forEach(g => {
    if (GH.has(g.id)) return; // dentro un gruppo compresso
    const sel = live && S.sels.has(g.id), hide = editing && editing.kind === 'group' && editing.id === g.id;
    const r = gRect(g), hd = gHead(g), ln = glineOf(g), fs = gfsOf(g);
    const boxSt = `stroke-width:${gbwOf(g)}px;fill-opacity:${gfoOf(g)};` + (ln === 'none' ? 'stroke:none;' : `stroke-dasharray:${GLINE[ln]};`);
    // a destra nella barra: "+N" del gruppo compresso e il lucchetto del gruppo bloccato
    const cnt = g.fold ? (g.hide || []).filter(id => findM(tree, id) || findNote(tree, id)).length : 0;
    const bw = tw('+' + cnt, `600 11px ${FB}`) + 12, bx = r.w - bw - 10, by = (hd - 18) / 2;
    const badge = g.fold ? `<g class="fold"${live ? ` data-gfold="${g.id}"` : ''}>${live ? '<title>Clic: espandi il gruppo</title>' : ''}<rect x="${bx}" y="${by}" width="${bw}" height="18" rx="9"/>` +
      `<text x="${bx + bw / 2}" y="${by + 13}" text-anchor="middle">+${cnt}</text></g>` : '';
    const lx = (g.fold ? bx : r.w) - 22, lock = g.lock && live ? `<g class="glock" transform="translate(${lx},${Math.round((hd - 13) / 2)})"><title>Gruppo bloccato</title><rect x="0.5" y="5.5" width="10" height="7" rx="1.5"/><path d="M2.8 5.5V3.8a2.7 2.7 0 0 1 5.4 0V5.5"/></g>` : '';
    const right = (g.fold ? bw + 10 : 0) + (lock ? 24 : 0), cx = g.ta === 'c';
    const tx = cx ? (r.w - right) / 2 : 14, tmax = r.w - 28 - right;
    grps += `<g class="grp${hasColor(g) ? ' cc c' + g.color : ''}${g.fold ? ' gfold' : ''}${sel ? ' sel' : ''}${hide ? ' editing' : ''}"${live ? ` data-grp="${g.id}"` : ''} transform="translate(${g.x},${g.y})">` +
      `<rect class="gbox" width="${r.w}" height="${r.h}" rx="12" style="${boxSt}"/>` +
      (live ? `<rect class="ghit" width="${r.w}" height="${r.h}" rx="12"/><rect class="ghead" width="${r.w}" height="${hd}" rx="12"><title>${g.lock ? 'Gruppo bloccato' : 'Trascina per spostare il gruppo con il suo contenuto'} · Doppio clic: rinomina</title></rect>` : '') +
      `<text class="gtitle" x="${tx}" y="${Math.round(hd / 2 + fs * 0.36)}"${cx ? ' text-anchor="middle"' : ''} style="font-size:${fs}px;font-weight:${gfwOf(g)}${g.ti ? ';font-style:italic' : ''}">${esc(ell(gTitle(g), tmax, gFont(g)))}</text>` +
      badge + lock +
      (sel ? `<rect class="ring" x="-5" y="-5" width="${r.w + 10}" height="${r.h + 10}" rx="15"/>` : '') +
      (sel && single && !g.fold && !g.lock ? `<rect class="rsz" data-rsz="1" x="${r.w - 4}" y="${r.h - 4}" width="9" height="9" rx="2"><title>Trascina per ridimensionare</title></rect>` : '') + `</g>`;
  });
  if (live) S.E = E;
  const rubber = lk && lk.x2 != null && !lk.pinMove ? `<path class="rubber" d="M${lk.x1},${lk.y1} L${lk.x2},${lk.y2}"/>` : '';
  // binario (Maiusc + trascina): linea guida lungo la direzione in cui scorre il blocco
  const rl = live && S.rail, rail = rl ? `<path class="rail" d="${rl.dir === 'h' ? `M${rl.x - 1e4},${rl.y} H${rl.x + 1e4}` : `M${rl.x},${rl.y - 1e4} V${rl.y + 1e4}`}"/>` : '';
  return `<g>${grps}</g>${rail}<g>${edges}</g><g>${nodes}</g><g>${notes}</g><g>${cnotes}</g>${rubber}`;
}

function render() {
  if (noTab()) return renderBar(); // pagina vuota: niente mappa da disegnare
  const tree = curTree(), L = mindLayout(tree), NL = notesLayout(tree); S.L = L; S.NL = NL;
  const imgs = takeImages(); vp.innerHTML = treeMarkup(tree, L, NL, true); keepImages(imgs); renderLegend();
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
// collegamenti selezionati: quello cliccato (S.esel) e quelli presi col riquadro o con Maiusc (S.esels)
function selEdges() { return [...new Set([...S.esels, ...(S.esel ? [S.esel] : [])])]; }
// toglie dei collegamenti dentro una modifica: un aggiuntivo sparisce, il principale si stacca (il blocco resta libero)
function cutEdges(tt, keys) {
  keys.forEach(key => {
    if (key.startsWith('x:')) { tt.links = (tt.links || []).filter(x => x.id !== key.slice(2)); if (!tt.links.length) delete tt.links; return; }
    const g = findM(tt, key); if (!g || !g.p) return;
    g.list.splice(g.list.indexOf(g.n), 1); delete g.n.edge; (tt.free = tt.free || []).push(g.n);
  });
}
// Canc: blocchi, note, gruppi e collegamenti selezionati, in un solo passo di annullamento
function removeSelected() {
  const t = curTree(), ids = [...S.sels], ek = selEdges(), delRoot = ids.includes(t.id);
  if (!ids.length && !ek.length) return;
  if (!ids.length && ek.length === 1) return deleteEdge(ek[0]);
  const f0 = ids.length && findM(t, ids.includes(S.sel) ? S.sel : ids[0]), pid = f0 && f0.p && !ids.includes(f0.p.id) ? f0.p.id : null;
  mutate(tt => {
    cutEdges(tt, ek);
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
      if (id === LEG) { delete tt.legend; return; }
      const f = findM(tt, id); if (f && f.list) { bridge(f.n, f.p, f.list); return; }
      const nt = findNote(tt, id); if (nt) tt.notes.splice(tt.notes.indexOf(nt), 1);
      const g = findGroup(tt, id); if (g) { tt.groups.splice(tt.groups.indexOf(g), 1); if (!tt.groups.length) delete tt.groups; } // solo il riquadro
    });
    // la radice eliminata: prende il suo posto un blocco libero rimasto, altrimenti la tela resta vuota (con le note)
    if (delRoot) { if (tt.free && tt.free.length) promoteRoot(tt, tt.free[0]); else emptyLevel(tt); }
    cleanLinks(curTree());
  });
  selectOnly(pid && findM(curTree(), pid) ? pid : null); render();
  if (!ids.length) toast(ek.length + ' collegamenti eliminati');
}
// il blocco libero `nr` diventa la radice dei dati del livello: prende con sé blocchi liberi, collegamenti aggiuntivi e note.
// Nessun blocco si sposta e nessuno cambia aspetto (l'attributo "primaria" resta quello che era).
function promoteRoot(t, nr) {
  nr.free = (t.free || []).filter(r => r !== nr); nr.notes = t.notes || []; nr.links = t.links || []; nr.groups = t.groups || []; if (t.legend) nr.legend = t.legend;
  ['free', 'notes', 'links', 'groups'].forEach(k => { if (!nr[k].length) delete nr[k]; });
  delete t.free; delete t.notes; delete t.links; delete t.groups; delete t.legend; delete nr.edge;
  if (nr.primary === undefined) nr.primary = false;
  setLevelRoot(nr);
}
// livello senza blocchi: resta un contenitore invisibile che tiene le note
function emptyLevel(t) {
  const v = { id: uid(), text: t.text, children: [], void: true }; if (t.notes && t.notes.length) v.notes = t.notes; if (t.groups && t.groups.length) v.groups = t.groups; if (t.legend) v.legend = t.legend;
  setLevelRoot(v);
}
// collega l'uscita `po` di `fromId` all'ingresso `pi` di `toId`. Nessun blocco si sposta: cambia solo la linea.
// Se il blocco d'arrivo non ha ancora un genitore diventa suo figlio, altrimenti si aggiunge un collegamento:
// così un blocco può avere più ingressi.
// sp (indice di un pallino di struttura) al posto di po/pi = collegamento di struttura: `to` è una parte di `from`
// add = { from: [tipo, [lato, pos]], to: [tipo, [lato, pos]] }: pallini nuovi da aggiungere in fondo all'elenco di quel
// tipo (gli indici po/pi/sp/ts passati sono già quelli dei pallini nuovi), nello stesso passo di annullamento
function link(fromId, po, toId, pi, sp = null, ts = 0, add = null) {
  const t = curTree(); if (fromId === toId) return render();
  const a = findM(t, fromId), b = findM(t, toId); if (!a || !b) return render();
  const links = allLinks(t), str = sp != null;
  const same = links.find(L => L.from.id === fromId && L.to.id === toId);
  if (same && add) { render(); return toast('Sono già collegati'); }
  if (same) {
    // stesso collegamento con pallini diversi (o di altro tipo): si riaggancia
    const moved = str ? !isStr(same.e) || strIdx(a.n, same.e) !== sp || tsIdx(b.n, same.e) !== ts
      : isStr(same.e) || outIdx(a.n, same.e) !== po || inIdx(b.n, same.e) !== pi;
    if (moved) { setEdge(same.key, str ? { str: true, sp, ts, po: undefined, pi: undefined } : { po, pi, str: false, sp: undefined, ts: undefined }); return toast('Collegamento spostato'); }
    render(); return toast('Sono già collegati');
  }
  const ends = str ? { str: true, sp, ts } : { po, pi };
  if (links.some(L => L.from.id === toId && L.to.id === fromId)) { render(); return toast('Esiste già il collegamento opposto'); }
  let inside = false; walk(b.n, n => { if (n.id === fromId) inside = true; });
  const asChild = !b.p && !inside;
  mutate(tt => {
    if (add) { // pallini nuovi in fondo agli elenchi: gli indici degli altri collegamenti non cambiano
      if (add.from) pinData(findM(tt, fromId).n)[add.from[0]].push(add.from[1]);
      if (add.to) pinData(findM(tt, toId).n)[add.to[0]].push(add.to[1]);
    }
    if (asChild) {
      const f = findM(tt, toId), pp = findM(tt, fromId).n;
      if (f.n === tt) {
        // la radice dei dati va sotto un blocco libero: la radice di quel blocco libero prende il suo posto
        const nr = tt.free.find(r => { let has = false; walk(r, n => { if (n.id === fromId) has = true; }); return has; });
        promoteRoot(tt, nr);
      } else f.list.splice(f.list.indexOf(f.n), 1);
      pp.children.push(f.n);
      const ed = Object.assign({}, f.n.edge, ends); delete ed.ps;
      if (str) { delete ed.po; delete ed.pi; } else { delete ed.str; delete ed.sp; delete ed.ts; }
      Object.keys(ed).forEach(k => { if (!ed[k] && ed[k] !== 0) delete ed[k]; }); if (!ed.pi) delete ed.pi;
      f.n.edge = ed;
    } else {
      const lx = { id: uid(), from: fromId, to: toId, ...ends }; if (!lx.pi) delete lx.pi;
      (tt.links = tt.links || []).push(lx);
    }
  });
  selectOnly(toId); render(); toast('Collegati');
}
// Ctrl + trascina da un blocco a un altro: ogni volta un pallino d'uscita nuovo sul primo; sul secondo l'ingresso su cui
// si rilascia o, sul corpo del blocco, uno nuovo. I nuovi stanno sui lati che si guardano, all'altezza dell'altro blocco
// e lontani dai pallini che ci sono già (newPinPos).
// Poi si possono cambiare come sempre, trascinando i pallini o dal loro menu.
function nearestPin(list, l, x, y) {
  let best = -1, bd = Infinity;
  list.forEach((q, i) => { const [qx, qy] = pinXY(l, q), d = Math.hypot(l.x + qx - x, l.y + qy - y); if (d < bd) { bd = d; best = i; } });
  return best;
}
// punto da cui parte la linea mentre si trascina: dove nascerà il pallino d'uscita nuovo
function autoOutPoint(id, x, y) {
  const f = findM(curTree(), id), l = S.L.get(id), [px, py] = pinXY(l, newPinPos(f.n, l, x, y));
  return { x: l.x + px, y: l.y + py };
}
// lato rivolto al punto (x, y) e posizione libera più vicina a quella del punto proiettato sul lato
function newPinPos(n, l, x, y) {
  const [side] = facePin(l, x, y), P = pinsOf(n);
  const want = clamp(side === 'l' || side === 'r' ? (y - l.y) / l.h : (x - l.x) / l.w, 0.15, 0.85);
  const used = [...P.i, ...P.o, ...P.s].filter(q => q[0] === side).map(q => q[1]);
  let best = want, bd = Infinity;
  for (let v = 0.1; v <= 0.901; v += 0.05) {
    if (used.some(u => Math.abs(u - v) < 0.12)) continue;
    if (Math.abs(v - want) < bd) { bd = Math.abs(v - want); best = Math.round(v * 100) / 100; }
  }
  return [side, best];
}
// pi = ingresso esistente su cui si è rilasciato (altrimenti ne nasce uno nuovo); l'uscita è sempre nuova
function autoLink(fromId, toId, pi) {
  const t = curTree(), a = findM(t, fromId), b = findM(t, toId), al = S.L.get(fromId), bl = S.L.get(toId); if (!a || !b || !al || !bl) return render();
  const tgt = pi != null ? pinsOf(b.n).i[pi] : null, [tx, ty] = tgt ? pinXY(bl, tgt) : [bl.w / 2, bl.h / 2];
  const o = newPinPos(a.n, al, bl.x + tx, bl.y + ty);
  if (tgt) return link(fromId, pinsOf(a.n).o.length, toId, pi, null, 0, { from: ['o', o] });
  const [ox, oy] = pinXY(al, o), i = newPinPos(b.n, bl, al.x + ox, al.y + oy);
  link(fromId, pinsOf(a.n).o.length, toId, pinsOf(b.n).i.length, null, 0, { from: ['o', o], to: ['i', i] });
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
/* ---------- pallini legati ai collegamenti ----------
// Dal 2026-11-11 i pallini esistono solo dove c'è un collegamento: non si aggiungono a mano, compaiono quando si
// collega (Ctrl + trascina, o trascinando da un pallino) e spariscono quando non hanno più collegamenti (tidyPins,
// a ogni disegno). Si può cambiarne il tipo (changePinType: il collegamento cambia verso o diventa di struttura),
// fonderne due (mergePins, Ctrl + trascina un pallino su un altro) o eliminarli con i loro collegamenti (deletePin).
// Per cambiare pallini e collegamenti insieme si lavora sui riferimenti ai pallini (pinEnds), poi pinWrite riscrive
// gli indici (po/pi, sp/ts) di tutti i collegamenti. */
function pinData(n) { // pallini salvati nel blocco, con i tre elenchi (i blocchi vecchi prendono quelli di serie)
  if (!n.pin) { const d = defaultPins(n); n.pin = { i: d.i.map(q => [...q]), o: d.o.map(q => [...q]), s: d.s.map(q => [...q]) }; }
  ['i', 'o', 's'].forEach(k => { if (!n.pin[k]) n.pin[k] = []; });
  return n.pin;
}
function pinEnds(t) {
  return allLinks(t).map(L => {
    const str = isStr(L.e), fk = str ? 's' : 'o', tk = str ? 's' : 'i';
    const fi = str ? strIdx(L.from, L.e) : outIdx(L.from, L.e), ti = str ? tsIdx(L.to, L.e) : inIdx(L.to, L.e);
    return { L, str, from: L.from, to: L.to, fp: pinData(L.from)[fk][fi] || null, tp: pinData(L.to)[tk][ti] || null };
  });
}
function pinWrite(t, ends) {
  ends.forEach(x => {
    const e = x.get ? x.get() : x.L.extra ? x.L.e : (x.L.to.edge = x.L.to.edge || {});
    const ix = (n, k, q) => q ? pinData(n)[k].indexOf(q) : -1;
    delete e.ps;
    if (x.str) {
      e.str = true; delete e.po; delete e.pi;
      const sp = ix(x.from, 's', x.fp), ts = ix(x.to, 's', x.tp);
      if (sp > 0) e.sp = sp; else delete e.sp;
      if (ts > 0) e.ts = ts; else delete e.ts;
    } else {
      delete e.str; delete e.sp; delete e.ts;
      const po = ix(x.from, 'o', x.fp), pi = ix(x.to, 'i', x.tp);
      if (po >= 0) e.po = po; else delete e.po;
      if (pi > 0) e.pi = pi; else delete e.pi;
    }
  });
  walkAll(t, n => { if (n.edge && !Object.keys(n.edge).length) delete n.edge; });
}
// a ogni disegno: pallini salvati in tutti i blocchi, poi via quelli senza collegamenti (true = dati cambiati)
function tidyPins(t) {
  let changed = false;
  walkAll(t, n => { if (!n.pin || !n.pin.i || !n.pin.o || !n.pin.s) { pinData(n); changed = true; } });
  const ends = pinEnds(t), used = new Set();
  ends.forEach(x => { if (x.fp) used.add(x.fp); if (x.tp) used.add(x.tp); });
  let drop = false;
  walkAll(t, n => { if (['i', 'o', 's'].some(k => n.pin[k].some(q => !used.has(q)))) drop = true; });
  if (!drop) return changed;
  walkAll(t, n => {
    const fo = (n.foldOut || []).map(key => n.pin[key[0]][+key.slice(2)]); // rami compressi su un pallino: per riferimento
    ['i', 'o', 's'].forEach(k => { n.pin[k] = n.pin[k].filter(q => used.has(q)); });
    if (n.foldOut) {
      n.foldOut = n.foldOut.map((key, j) => { const i = fo[j] ? n.pin[key[0]].indexOf(fo[j]) : -1; return i < 0 ? null : key[0] + ':' + i; }).filter(Boolean);
      if (!n.foldOut.length) delete n.foldOut;
    }
  });
  pinWrite(t, ends);
  return true;
}
// collegamento d'albero (padre → figlio) che deve cambiare verso: il figlio si stacca (resta dov'è) e il collegamento
// diventa aggiuntivo, dal figlio al padre, con lo stesso stile e la stessa nota
function reverseEnd(t, x) {
  if (x.L.extra) { const lx = x.L.e; [lx.from, lx.to] = [lx.to, lx.from]; x.get = () => lx; return; }
  const C = x.L.to, Pn = x.L.from, f = findM(t, C.id);
  const lx = { id: uid(), ...(C.edge || {}), from: C.id, to: Pn.id };
  f.list.splice(f.list.indexOf(C), 1); delete C.edge; (t.free = t.free || []).push(C);
  (t.links = t.links || []).push(lx); x.get = () => lx;
}
// cambia il tipo di un pallino: i suoi collegamenti lo seguono. Ingresso → uscita (o il contrario): il collegamento
// cambia verso; verso struttura: diventa di struttura. All'altro capo il pallino cambia tipo anche lui se serve solo
// a questi collegamenti, altrimenti ne nasce uno nuovo accanto.
function changePinType(id, kind, idx, nk) {
  const t0 = curTree(), N0 = findM(t0, id).n, X0 = pinData(N0)[PK[kind]][idx]; if (!X0 || kind === nk) return;
  const ends0 = pinEnds(t0), touch0 = ends0.filter(x => (x.from === N0 && x.fp === X0) || (x.to === N0 && x.tp === X0));
  // cambiando verso non deve nascere un doppione
  const clash = touch0.some(x => {
    const atFrom = x.from === N0, wantFrom = nk === 'out' ? true : nk === 'in' ? false : atFrom, M = atFrom ? x.to : x.from;
    return wantFrom !== atFrom && ends0.some(y => y !== x && y.from === (wantFrom ? N0 : M) && y.to === (wantFrom ? M : N0));
  });
  if (clash) return toast('Nell’altro verso c’è già un collegamento tra questi blocchi');
  mutate(t => {
    const N = findM(t, id).n, P = pinData(N), X = P[PK[kind]][idx]; if (!X) return;
    const ends = pinEnds(t), touch = ends.filter(x => (x.from === N && x.fp === X) || (x.to === N && x.tp === X));
    P[PK[kind]].splice(idx, 1); P[PK[nk]].push(X);
    const moved = new Map();
    touch.forEach(x => {
      const atFrom = x.from === N && x.fp === X, wantFrom = nk === 'out' ? true : nk === 'in' ? false : atFrom, str = nk === 'str';
      const M = atFrom ? x.to : x.from, Q = atFrom ? x.tp : x.fp, qk = x.str ? 's' : atFrom ? 'i' : 'o', mk = str ? 's' : wantFrom ? 'i' : 'o';
      let Q2 = Q;
      if (Q && qk !== mk) {
        if (moved.has(Q)) Q2 = moved.get(Q);
        else {
          const MP = pinData(M), shared = ends.some(y => !touch.includes(y) && (y.fp === Q || y.tp === Q));
          if (!shared) { MP[qk].splice(MP[qk].indexOf(Q), 1); MP[mk].push(Q); }
          else {
            const used = [...MP.i, ...MP.o, ...MP.s].filter(q => q[0] === Q[0]).map(q => q[1]);
            const v = [0.12, -0.12, 0.24, -0.24].map(d => Math.round((Q[1] + d) * 100) / 100).find(v => v >= 0.08 && v <= 0.92 && !used.some(u => Math.abs(u - v) < 0.08));
            Q2 = [Q[0], v ?? Q[1]]; MP[mk].push(Q2);
          }
          moved.set(Q, Q2);
        }
      }
      if (wantFrom !== atFrom) reverseEnd(t, x);
      x.str = str;
      if (wantFrom) { x.from = N; x.fp = X; x.to = M; x.tp = Q2; } else { x.to = N; x.tp = X; x.from = M; x.fp = Q2; }
    });
    pinWrite(t, ends);
  });
}
// Ctrl + trascina un pallino su un altro dello stesso blocco: i collegamenti del primo passano al secondo
function mergePins(id, kind, a, b) {
  mutate(t => {
    const N = findM(t, id).n, list = pinData(N)[PK[kind]], A = list[a], B = list[b]; if (!A || !B || A === B) return;
    const ends = pinEnds(t);
    ends.forEach(x => { if (x.from === N && x.fp === A) x.fp = B; if (x.to === N && x.tp === A) x.tp = B; });
    if (N.foldOut) { N.foldOut = N.foldOut.filter(k => k !== PK[kind] + ':' + a); if (!N.foldOut.length) delete N.foldOut; }
    list.splice(list.indexOf(A), 1);
    pinWrite(t, ends);
  });
  toast('Pallini fusi');
}
// elimina il pallino con tutti i suoi collegamenti (i blocchi restano dove sono)
function deletePin(id, kind, idx) {
  const t0 = curTree(), N0 = findM(t0, id).n, X0 = pinData(N0)[PK[kind]][idx]; if (!X0) return;
  const keys = pinEnds(t0).filter(x => (x.from === N0 && x.fp === X0) || (x.to === N0 && x.tp === X0)).map(x => x.L.key);
  mutate(t => keys.forEach(key => {
    if (key.startsWith('x:')) { t.links = (t.links || []).filter(x => x.id !== key.slice(2)); if (!t.links.length) delete t.links; }
    else { const g = findM(t, key); if (g && g.p) { g.list.splice(g.list.indexOf(g.n), 1); delete g.n.edge; (t.free = t.free || []).push(g.n); } }
  }));
  clearSel(); render(); toast(keys.length === 1 ? 'Collegamento eliminato' : `${keys.length} collegamenti eliminati`);
}
function setPin(id, kind, idx, pos) {
  mutate(t => {
    const n = findM(t, id).n, P = JSON.parse(JSON.stringify(pinsOf(n)));
    freezeOuts(t, n); P[PK[kind]][idx] = pos; n.pin = P;
  });
}

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
function selectMany(ids) { S.sels = new Set(ids); S.sel = ids[ids.length - 1] || null; S.esel = null; S.esels = new Set(); }
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
  // un gruppo porta con sé il contenuto; un gruppo compresso al suo interno porta anche ciò che ha nascosto
  const addG = g => { if (seen.has(g)) return; add(g); groupItems(t, g).forEach(i => i.kind === 'node' ? addB(i.o) : i.kind === 'group' ? addG(i.o) : add(i.o)); };
  (t.groups || []).filter(g => S.sels.has(g.id)).forEach(addG);
  return out;
}

/* ---------- copia e incolla lo stile ---------- */
// Stile di un blocco (colore, testo, peso, bordo, opacità) o di un collegamento (forma, tratto, spessore, distanza dei
// puntini, opacità): si copiano i valori come si vedono, così chi li riceve appare uguale. S.style = { kind, data }.
// Testo, posizione, dimensione, pallini e note restano quelli di chi riceve lo stile.
function copyStyle() {
  const t = curTree();
  if (S.esel) {
    const e = edgeData(t, S.esel) || {};
    S.style = { kind: 'edge', data: { color: hasColor(e) ? e.color : null, shape: e.shape || '', line: lineOf(e), lw: linkWidth(S.esel), gap: gapOf(e), op: eopOf(e) } };
    return toast('Stile del collegamento copiato');
  }
  const g = S.sel && findGroup(t, S.sel);
  if (g) {
    S.style = { kind: 'group', data: { color: hasColor(g) ? g.color : null, line: glineOf(g), bw: gbwOf(g), fo: gfoOf(g), tfs: gfsOf(g), tfw: gfwOf(g), ta: g.ta || 'l', ti: !!g.ti } };
    return toast('Stile del gruppo copiato');
  }
  const f = S.sel && findM(t, S.sel), l = f && S.L.get(f.n.id);
  if (!f || !l) return toast('Seleziona un blocco o un collegamento');
  const n = f.n;
  S.style = { kind: 'node', data: { color: hasColor(n) ? n.color : null, fs: fsOf(n, l.depth), fw: fwOf(n, l.depth), bw: bwOf(n, l.depth), op: n.op ?? null, it: n.it ? true : null } };
  toast('Stile del blocco copiato');
}
function pasteStyle() {
  const st = S.style; if (!st) return toast('Nessuno stile copiato');
  // collegamenti: quello del menu, o tutti quelli presi col riquadro (anche insieme a dei blocchi)
  const ek = S.esels.size ? [...S.esels] : S.esel ? [S.esel] : [];
  if (st.kind === 'edge' && ek.length) { setEdges(ek, { ...st.data, dash: false }); return toast('Stile incollato'); }
  if (S.esel) return toast(st.kind === 'group' ? 'Lo stile copiato è di un gruppo: incollalo su un gruppo' : 'Lo stile copiato è di un blocco: incollalo su un blocco');
  const gids = [...S.sels].filter(id => findGroup(curTree(), id));
  if (gids.length && st.kind === 'group') { setGroupStyle(st.data, gids); return toast('Stile incollato'); }
  if (gids.length && ![...S.sels].some(id => S.L.has(id))) return toast('Lo stile copiato non è di un gruppo');
  if (![...S.sels].some(id => S.L.has(id))) return toast('Seleziona un blocco o un collegamento');
  if (st.kind !== 'node') return toast(st.kind === 'group' ? 'Lo stile copiato è di un gruppo: incollalo su un gruppo' : 'Lo stile copiato è di un collegamento: incollalo su un collegamento');
  eachSelected(n => Object.entries(st.data).forEach(([k, v]) => { if (v === null) delete n[k]; else n[k] = v; }));
  toast('Stile incollato');
}

/* ---------- allinea e spazia ---------- */
// Blocchi e note selezionati: allineati a un lato (o al centro) del riquadro che li contiene tutti, oppure
// equidistanti (stesso spazio vuoto tra uno e l'altro; il primo e l'ultimo restano dove sono, se c'è posto).
// Un blocco con i rami compressi si porta dietro i rami nascosti, come quando lo si trascina.
const ARRANGE = { al: 1, ac: 1, ar: 1, at: 1, am: 1, ab: 1, dh: 1, dv: 1 };
function arrangeSelected(op) {
  const t = curTree(), items = [...S.sels].map(id => {
    const f = findM(t, id); if (f && S.L.get(id)) return { o: f.n, l: S.L.get(id), node: true };
    const nt = findNote(t, id); return nt && S.NL.get(id) ? { o: nt, l: S.NL.get(id) } : null;
  }).filter(Boolean);
  const dist = op[0] === 'd';
  if (items.length < (dist ? 3 : 2)) return toast(dist ? 'Seleziona almeno tre blocchi' : 'Seleziona almeno due blocchi');
  const locked = lockedSet(t); if (items.some(i => locked.has(i.o))) return toast('Alcuni elementi sono in un gruppo bloccato');
  const x1 = Math.min(...items.map(i => i.l.x)), x2 = Math.max(...items.map(i => i.l.x + i.l.w));
  const y1 = Math.min(...items.map(i => i.l.y)), y2 = Math.max(...items.map(i => i.l.y + i.l.h));
  items.forEach(i => { i.x = i.l.x; i.y = i.l.y; });
  if (op === 'al') items.forEach(i => { i.x = x1; });
  else if (op === 'ac') items.forEach(i => { i.x = (x1 + x2) / 2 - i.l.w / 2; });
  else if (op === 'ar') items.forEach(i => { i.x = x2 - i.l.w; });
  else if (op === 'at') items.forEach(i => { i.y = y1; });
  else if (op === 'am') items.forEach(i => { i.y = (y1 + y2) / 2 - i.l.h / 2; });
  else if (op === 'ab') items.forEach(i => { i.y = y2 - i.l.h; });
  else {
    const [p, s] = op === 'dh' ? ['x', 'w'] : ['y', 'h'];
    items.sort((a, b) => (a.l[p] + a.l[s] / 2) - (b.l[p] + b.l[s] / 2));
    const first = items[0].l, last = items[items.length - 1].l;
    // se si sovrapporrebbero (blocchi già incolonnati), si stendono con uno spazio minimo e l'ultimo si sposta
    const gap = Math.max(24, (last[p] + last[s] - first[p] - items.reduce((k, i) => k + i.l[s], 0)) / (items.length - 1));
    let at = first[p]; items.forEach(i => { i[p] = at; at += i.l[s] + gap; });
  }
  mutate(() => items.forEach(i => {
    const dx = Math.round(i.x - i.l.x), dy = Math.round(i.y - i.l.y); if (!dx && !dy) return;
    const mv = o => { o.x = Math.round(o.x + dx); o.y = Math.round(o.y + dy); };
    if (!i.node) return mv(i.o);
    mv(i.o); i.o.children.forEach(c => { if (isFoldedChild(i.o, c)) walk(c, d => { if (hasPos(d)) mv(d); }); });
  }));
}

/* ---------- gruppi ---------- */
const findGroup = (tree, id) => (tree.groups || []).find(g => g.id === id);
// titolo del gruppo: può essere vuoto (gruppo senza nome); i gruppi vecchi senza il campo si chiamano "Gruppo"
const gTitle = g => g.text == null ? 'Gruppo' : g.text;
const GLINE = { solid: 'none', dash: '6 4', dot: '0.1 4.5' };
const glineOf = g => g.line || 'dash', gbwOf = g => g.bw ?? 1.2, gfoOf = g => g.fo ?? 0.08;
const gfsOf = g => g.tfs || 13, gfwOf = g => g.tfw || 600, gFont = g => `${g.ti ? 'italic ' : ''}${gfwOf(g)} ${gfsOf(g)}px ${FB}`; // ti = titolo in corsivo
const gHead = g => Math.max(GHEAD, Math.round(gfsOf(g) + 15)); // la barra del titolo cresce con il titolo
// riquadro visibile: compresso = solo la barra, larga almeno quanto titolo, "+N" e lucchetto
const gRect = g => g.fold ? { x: g.x, y: g.y, w: Math.max(g.w, Math.ceil(tw(gTitle(g), gFont(g))) + 80 + (g.lock ? 24 : 0)), h: gHead(g) } : g;
// id nascosti dai gruppi compressi (blocchi, note, gruppi)
function groupHidden(tree) { const H = new Set(); (tree.groups || []).forEach(g => { if (g.fold) (g.hide || []).forEach(id => H.add(id)); }); return H; }
// contenuto di un gruppo: ciò che vi sta tutto dentro (contando anche gli elementi nascosti) oppure, se è compresso,
// gli elementi che ha nascosto più ciò che sta dentro la barra. [{ o, id, kind: 'node'|'note'|'group', l }]
function groupItems(t, g) {
  const LF = S.L.full || S.L, NF = S.NL.full || S.NL, box = gRect(g), hid = g.fold ? new Set(g.hide || []) : null;
  const inG = (id, l) => !!l && (hid ? hid.has(id) || within(l, box) : within(l, g)), out = [];
  walkAll(t, d => { const l = LF.get(d.id); if (inG(d.id, l)) out.push({ o: d, id: d.id, kind: 'node', l }); });
  (t.notes || []).forEach(nt => { const l = NF.get(nt.id); if (inG(nt.id, l)) out.push({ o: nt, id: nt.id, kind: 'note', l }); });
  // un gruppo interno conta per quello che si vede: compresso, basta che ci stia la sua barra
  (t.groups || []).forEach(h => { const r = gRect(h); if (h !== g && inG(h.id, r)) out.push({ o: h, id: h.id, kind: 'group', l: r }); });
  return out;
}
// oggetti che non si possono spostare: i gruppi bloccati e il loro contenuto
function lockedSet(t) {
  const out = new Set(); (t.groups || []).forEach(g => { if (g.lock) { out.add(g); groupItems(t, g).forEach(i => out.add(i.o)); } }); return out;
}
// stile dei gruppi selezionati (i valori di serie si tolgono dai dati)
const GDEF = { line: 'dash', bw: 1.2, fo: 0.08, tfs: 13, tfw: 600, ta: 'l', color: null, ti: false };
function setGroupStyle(patch, ids = [...S.sels]) {
  mutate(t => ids.forEach(id => {
    const g = findGroup(t, id); if (!g) return;
    Object.entries(patch).forEach(([k, v]) => { if (v === null || v === undefined || v === '' || v === GDEF[k]) delete g[k]; else g[k] = v; });
  }));
}
function toggleGroupFold(id) {
  const t = curTree(), g = findGroup(t, id); if (!g) return;
  if (readOnly()) { S.roOk = true; try { return toggleGroupFold(id); } finally { S.roOk = false; } }
  if (g.fold) return mutate(tt => { const h = findGroup(tt, id); delete h.fold; delete h.hide; });
  const ids = groupItems(t, g).map(i => i.id);
  if (!ids.length) return toast('Il gruppo è vuoto');
  mutate(tt => { const h = findGroup(tt, id); h.fold = true; h.hide = ids; });
  selectOnly(id); render();
}
// adatta al contenuto: il riquadro si stringe o si allarga attorno a ciò che contiene, con il margine di serie
function fitGroup(id) {
  const t = curTree(), g = findGroup(t, id); if (!g) return;
  const its = groupItems(t, g); if (!its.length) return toast('Il gruppo è vuoto');
  const x1 = Math.min(...its.map(i => i.l.x)), y1 = Math.min(...its.map(i => i.l.y));
  const x2 = Math.max(...its.map(i => i.l.x + i.l.w)), y2 = Math.max(...its.map(i => i.l.y + i.l.h)), hd = gHead(g);
  mutate(tt => {
    const h = findGroup(tt, id);
    h.x = Math.round(x1 - GPAD); h.y = Math.round(y1 - GPAD - hd);
    h.w = Math.max(GMIN[0], Math.round(x2 - x1 + GPAD * 2), Math.ceil(tw(gTitle(h), gFont(h))) + 28);
    h.h = Math.max(GMIN[1], Math.round(y2 - y1 + GPAD * 2 + hd));
  });
}
function selectGroupContents(id) {
  const t = curTree(), g = findGroup(t, id); if (!g) return;
  if (g.fold) return toast('Espandi il gruppo per selezionarne il contenuto');
  const ids = groupItems(t, g).map(i => i.id); if (!ids.length) return toast('Il gruppo è vuoto');
  S.sels = new Set(ids); S.sel = ids[0]; S.esel = null; S.esels = new Set(); render();
}
const toggleGroupLock = id => mutate(t => { const g = findGroup(t, id); if (g) { if (g.lock) delete g.lock; else g.lock = true; } });
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
function setEdge(key, patch) { setEdges([key], patch); }
// collegamenti presi col riquadro (S.esels): lo stile scelto sul menu di uno di loro vale per tutti
function edgeTargets(key) { return S.esels.size > 1 && S.esels.has(key) ? [...S.esels] : [key]; }
function setEdgeStyle(key, patch) { setEdges(edgeTargets(key), patch); }
function setEdges(keys, patch) {
  mutate(t => keys.forEach(key => {
    const e = edgeData(t, key, true); if (!e) return;
    Object.assign(e, patch);
    if (e.gap === GAP) delete e.gap; if (e.op >= 1) delete e.op; // valori di serie: non si salvano
    // si tolgono i valori vuoti; po (indice dell'uscita) vale anche 0
    Object.keys(e).forEach(k => { if (['id', 'from', 'to'].includes(k) || ((k === 'po' || k === 'color') && typeof e[k] === 'number')) return; if (!e[k]) delete e[k]; });
    if (!key.startsWith('x:')) { const f = findM(t, key); if (f && !Object.keys(f.n.edge).length) delete f.n.edge; }
  }));
}

// riquadro che contiene tutta la mappa (coordinate della tela)
function levelBounds(L, NL, G = []) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  [L, NL, G].forEach(M => M.forEach(l => { x1 = Math.min(x1, l.x); y1 = Math.min(y1, l.y); x2 = Math.max(x2, l.x + l.w); y2 = Math.max(y2, l.y + l.h); }));
  if (x1 === Infinity) return { x: 0, y: 0, w: 120, h: 40 }; // livello vuoto
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
// anteprima dei rami compressi (passando sull'etichetta "+N"), senza aprirli: i blocchi nascosti compaiono in
// trasparenza dove starebbero da aperti. Si disegna su una copia della mappa con quel ramo aperto, sotto ai blocchi
// veri (così il blocco di partenza, ridisegnato per i collegamenti, resta coperto) e senza toccare i dati.
function showPreview(id, rect, key) {
  hidePreview();
  const f = findM(curTree(), id); if (!f || !(key ? countPin(f.n, key) : f.n.fold && f.n.children.length)) return;
  const t = JSON.parse(JSON.stringify(curTree())), n = findM(t, id).n;
  if (key) { n.foldOut = (n.foldOut || []).filter(k => k !== key); if (!n.foldOut.length) delete n.foldOut; } else delete n.fold;
  delete t.notes; delete t.groups; delete t.legend;
  const SZ = sizeMap(t), hid = foldedSet(t), GL = new Map();
  const add = d => { if (!hid.has(d.id) && hasPos(d) && SZ.get(d.id)) GL.set(d.id, { ...SZ.get(d.id), x: d.x, y: d.y }); };
  walkAll(t, d => { if (!(S.L.full || S.L).has(d.id)) add(d); });
  if (!GL.size) return;
  add(n); // il blocco di partenza (coperto da quello vero), per disegnare i collegamenti verso i rami
  // altri blocchi visibili collegati ai rami (collegamenti aggiuntivi), sempre coperti da quelli veri
  (t.links || []).forEach(x => [[x.from, x.to], [x.to, x.from]].forEach(([a, b]) => { if (GL.has(a) && !GL.has(b)) { const g = findM(t, b); if (g) add(g.n); } }));
  ghostLayer(treeMarkup(t, GL, new Map(), false));
}
function ghostLayer(markup) {
  const g = document.createElementNS(SVGNS, 'g'); g.setAttribute('class', 'ghost'); g.id = 'ghost';
  g.innerHTML = markup;
  vp.insertBefore(g, vp.children[2] || null); // dopo gruppi e collegamenti, prima dei blocchi
}
// gruppo compresso: passando sul "+N" il contenuto e il riquadro aperto compaiono in trasparenza
function showGroupPreview(id) {
  hidePreview();
  const t = curTree(), g = findGroup(t, id); if (!g || !g.fold) return;
  const ids = new Set(g.hide || []), LF = S.L.full || S.L, NF = S.NL.full || S.NL, GL = new Map(), NLh = new Map();
  ids.forEach(i => { const l = LF.get(i); if (l) GL.set(i, l); const n = NF.get(i); if (n) NLh.set(i, n); });
  // blocchi fuori dal gruppo collegati a quelli nascosti: disegnati sotto ai veri, servono per le linee
  allLinks(t).forEach(({ from, to }) => [[from.id, to.id], [to.id, from.id]].forEach(([a, b]) => { if (ids.has(a) && !GL.has(b)) { const l = LF.get(b); if (l) GL.set(b, l); } }));
  const c = JSON.parse(JSON.stringify(t)); delete c.legend;
  c.notes = (c.notes || []).filter(nt => NLh.has(nt.id));
  c.groups = (c.groups || []).filter(h => h.id === id || ids.has(h.id)).map(h => { delete h.fold; delete h.hide; delete h.lock; return h; });
  ghostLayer(treeMarkup(c, GL, NLh, false));
}
function hidePreview() { const g = $('#ghost'); if (g) g.remove(); }
