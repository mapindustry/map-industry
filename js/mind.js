// Mappa mentale: posizioni, pallini, collegamenti, disegno e operazioni sui blocchi
// Blocco: { id, text, children[], x, y, w?, h?, primary?, flip?, pin?, color?, fs?, bw?, op?, sub?, subOpen?, edge? }
//   x/y = angolo in alto a sinistra, FISSO: collegare, staccare o ricollegare non sposta nessun blocco
//   primary = "idea primaria" (attributo scelto dall'utente, anche su più blocchi): stile marcato,
//             di serie ingresso in alto e due uscite laterali
//   pin = { i: [[lato, pos]...], o: [[lato, pos]...] } pallini d'ingresso e d'uscita sul bordo
//         (lato 'l'|'r'|'t'|'b', pos 0–1 lungo il lato); se manca valgono quelli di serie (vedi defaultPins)
//   flip = di serie ingresso a destra e uscita a sinistra · w/h = dimensione a mano
//   color = indice 0–5 dei token --c0…--c5 · fs = testo (px) · bw = bordo · op = opacità del riquadro
//   sub = struttura interna (un altro livello) · subOpen = schema mostrato sotto il blocco
//   edge = { po?, pi?, note?, dash?, nx?, ny? } del collegamento "principale" che entra nel blocco dal genitore
//          po/pi = indice del pallino d'uscita del genitore / d'ingresso del blocco; nx/ny = spostamento della nota
// Collegamenti aggiuntivi (più ingressi per blocco), in tree.links: { id, from, to, po?, pi?, note?, dash?, nx?, ny? }
//   Nelle selezioni e nei menu un collegamento si indica con una chiave: id del blocco figlio, oppure 'x:' + id.
// Nota sulla tela (in tree.notes): { id, x, y, text }
const DEF_FS = [16, 14, 13];
const fsOf = (n, depth) => n.fs || DEF_FS[Math.min(depth, 2)];
const nodeFont = (n, depth) => `${depth <= 1 ? 600 : 400} ${fsOf(n, depth)}px ${FB}`;
const bwOf = (n, depth) => n.bw ?? (depth === 0 ? 2 : 1.4);
const hasColor = n => n.color !== undefined && n.color !== null && n.color !== '';
const hasPos = n => n.x !== undefined && n.y !== undefined;
const RMIN = [40, 26], RMAX = [800, 600];
const NOTE_FONT = `500 11.5px ${FB}`, CNOTE_FONT = `400 13px ${FB}`;

/* ---------- dimensioni e posizioni ---------- */
// livello di stile: 0 = idea primaria, poi 1 e 2 secondo la profondità nell'albero
function sizeMap(tree) {
  const M = new Map();
  function size(n, depth) {
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
  size(tree, 0); (tree.free || []).forEach(r => size(r, 1));
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
    idx = outs.length > 1 ? used.indexOf(Math.min(...used)) : 0;
    if (outs.length > 1) n.edge = Object.assign({}, n.edge, { po: idx });
  }
  const side = outs[idx][0], [ax, ay] = pinXY(pl, outs[idx]), px = p.x + ax, py = p.y + ay;
  if (side === 'l') n.flip = true; // l'ingresso guarda verso il genitore
  const sibs = p.children.filter(c => c !== n && hasPos(c) && outIdx(p, c.edge) === idx);
  if (side === 'l' || side === 'r') {
    n.x = Math.round(side === 'r' ? px + 50 : px - 50 - nl.w);
    n.y = Math.round(sibs.length ? Math.max(...sibs.map(c => subtreeEdge(c, SZ, 'b'))) + 12 : py - nl.h / 2);
  } else {
    n.y = Math.round(side === 'b' ? py + 40 : py - 40 - nl.h);
    n.x = Math.round(sibs.length ? Math.max(...sibs.map(c => subtreeEdge(c, SZ, 'r'))) + 12 : px - nl.w / 2);
  }
}
// assegna le posizioni mancanti; true se ha cambiato qualcosa (da salvare)
function ensurePositions(tree, SZ) {
  let any = false, changed = false; const missing = [];
  if (tree.primary === undefined) { tree.primary = true; changed = true; } // la radice nasce idea primaria
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
  const SZ2 = changed && tree.primary ? sizeMap(tree) : SZ; // la radice può essere appena diventata primaria
  if (changed) save();
  const L = new Map(); walkAll(tree, n => L.set(n.id, { ...SZ2.get(n.id), x: n.x, y: n.y }));
  return L;
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
function defaultPins(n) {
  if (n.primary) return { i: [['t', 0.5]], o: [['l', 0.5], ['r', 0.5]] };
  return n.flip ? { i: [['r', 0.5]], o: [['l', 0.5]] } : { i: [['l', 0.5]], o: [['r', 0.5]] };
}
// pallini del blocco; mentre se ne trascina uno lungo il bordo vale la posizione provvisoria
function pinsOf(n) {
  let P = n.pin || defaultPins(n);
  const lk = S.link;
  if (lk && lk.pinMove && lk.id === n.id) { P = JSON.parse(JSON.stringify(P)); P[lk.kind === 'in' ? 'i' : 'o'][lk.idx] = lk.pinMove; }
  return P;
}
const pinXY = (l, [side, t]) => side === 'l' ? [0, t * l.h] : side === 'r' ? [l.w, t * l.h] : side === 't' ? [t * l.w, 0] : [t * l.w, l.h];
const SIDES = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
// quale uscita del genitore usa un collegamento (dati vecchi: ps = lato 'l'/'r')
function outIdx(p, e) {
  const o = pinsOf(p).o; e = e || {};
  if (e.po != null) return Math.min(e.po, o.length - 1);
  if (e.ps) { const i = o.findIndex(q => q[0] === e.ps); if (i >= 0) return i; }
  const r = o.findIndex(q => q[0] === 'r'); return r >= 0 ? r : 0;
}
const inIdx = (c, e) => Math.min((e && e.pi) || 0, pinsOf(c).i.length - 1);
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
// la linea parte da un pallino d'uscita e arriva a un pallino d'ingresso: sempre quelli, ovunque si spostino i blocchi
function linkGeom(pn, pl, po, cn, cl, pi) {
  const a = pinsOf(pn).o[po], b = pinsOf(cn).i[pi];
  const [ax0, ay0] = pinXY(pl, a), [bx0, by0] = pinXY(cl, b);
  const ax = pl.x + ax0, ay = pl.y + ay0, bx = cl.x + bx0, by = cl.y + by0;
  const k = clamp(Math.hypot(bx - ax, by - ay) / 2, 30, 160), ta = SIDES[a[0]], tb = SIDES[b[0]];
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
  out: 'Uscita: trascina sull’ingresso di un blocco per collegarlo, lungo il bordo per spostarlo'
};

// schema della struttura interna disegnato sulla tela, sotto il blocco (tasto destro → Mostra anteprima)
function subPreviewMarkup(n, l, live) {
  const sub = n.sub, L = mindLayout(sub), NL = notesLayout(sub), b = levelBounds(L, NL);
  const pad = 14, head = 20, k = Math.min(0.55, 300 / (b.w + pad * 2), 190 / (b.h + pad * 2));
  const w = Math.max(170, (b.w + pad * 2) * k), h = (b.h + pad * 2) * k + head, x = l.x, y = l.y + l.h + 16;
  let count = 0; walkAll(sub, () => count++);
  const title = `Struttura interna · ${count > 1 ? `${count - 1} blocchi` : 'vuota'}`;
  return `<g class="subprev"${live ? ` data-subprev="${n.id}"` : ''}>${live ? '<title>Clic per entrare nella struttura interna</title>' : ''}` +
    `<path class="splead" d="M${x + 18},${l.y + l.h} L${x + 18},${y}"/>` +
    `<rect class="spbox" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>` +
    `<text class="sptitle" x="${x + 10}" y="${y + 14}">${esc(ell(title, w - 18, `600 10.5px ${FB}`))}</text>` +
    `<g transform="translate(${x + (w - b.w * k) / 2 - b.x * k},${y + head + pad * k - b.y * k}) scale(${k})">${treeMarkup(sub, L, NL, false, false)}</g></g>`;
}

// markup SVG di un livello; live = tela interattiva (selezione, pallini, maniglie), altrimenti anteprima/esportazione
// previews = disegna anche gli schemi delle strutture interne aperti sulla tela
function treeMarkup(tree, L, NL, live, previews = live) {
  const single = live && S.sels.size === 1 && !editing, lk = live ? S.link : null;
  const E = new Map(); let edges = '', notes = '', nodes = '', prevs = '';
  allLinks(tree).forEach(({ key, from, to, e }) => {
    const pl = L.get(from.id), cl = L.get(to.id); if (!pl || !cl) return;
    const g = linkGeom(from, pl, outIdx(from, e), to, cl, inIdx(to, e));
    // la nota sta al centro del collegamento, spostata di nx/ny se l'utente l'ha trascinata
    const nx = g.mx + (e.nx || 0), ny = g.my + (e.ny || 0);
    E.set(key, { x: nx, y: ny });
    const cls = 'eg' + (e.dash ? ' dash' : '') + (live && S.esel === key ? ' sel' : '');
    edges += `<g class="${cls}"${live ? ` data-edge="${key}"` : ''}><path class="edge" stroke-width="${pl.depth === 0 ? 2.2 : 1.5}" d="${g.d}"/>` +
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
    const l = L.get(n.id);
    const sel = live && S.sels.has(n.id), dd = Math.min(l.depth, 2), pad = (l.h - l.lines.length * l.lh) / 2;
    const fsSt = n.fs ? ` style="font-size:${n.fs}px"` : '';
    const boxSt = (n.bw != null ? `stroke-width:${n.bw}px;` : '') + (n.op != null ? `opacity:${n.op};` : '');
    const txt = l.lines.map((s, i) => `<text x="${l.w / 2}" y="${pad + (i + 0.76) * l.lh}" text-anchor="middle"${fsSt}>${esc(s)}</text>`).join('');
    const sub = n.sub ? `<g class="subicon"${live ? ' data-sub="1"' : ''}><rect class="shit" x="${l.w - 20}" y="1" width="19" height="17"/>` +
      [[0, 0], [4, 0], [0, 4], [4, 4]].map(([a, b]) => `<rect x="${l.w - 13 + a}" y="${5 + b}" width="3" height="3" rx=".6"/>`).join('') + `</g>` : '';
    let anchors = '';
    if (live) {
      const P = pinsOf(n);
      [['in', P.i], ['out', P.o]].forEach(([kind, list]) => list.forEach((pin, idx) => {
        const [x, y] = pinXY(l, pin);
        const hot = lk && lk.over === n.id && lk.overAnc && lk.overAnc.kind === kind && lk.overAnc.idx === idx;
        const moving = lk && lk.pinMove && lk.id === n.id && lk.kind === kind && lk.idx === idx;
        anchors += `<g class="anc ${kind}${hot ? ' hot' : ''}${moving ? ' moving' : ''}" data-anc="${kind}" data-idx="${idx}"><title>${TIP[kind]}</title>` +
          `<circle class="ahit" cx="${x}" cy="${y}" r="10"/><circle class="adot" cx="${x}" cy="${y}" r="4"/></g>`;
      }));
    }
    if (previews && n.sub && n.subOpen) prevs += subPreviewMarkup(n, l, live);
    const cls = `mn d${dd}${hasColor(n) ? ' cc c' + n.color : ''}${sel ? ' sel' : ''}${lk && lk.over === n.id && !lk.overAnc ? ' drop' : ''}${n.sub ? ' hassub' : ''}`;
    nodes += `<g class="${cls}"${live ? ` data-id="${n.id}"` : ''} transform="translate(${l.x},${l.y})">` +
      (sel ? `<rect class="ring" x="-5" y="-5" width="${l.w + 10}" height="${l.h + 10}" rx="${dd === 0 ? 14 : 11}"/>` : '') +
      // blocco con struttura interna: un secondo riquadro sfalsato dietro, come una pila
      (n.sub ? `<rect class="stack" x="5" y="5" width="${l.w}" height="${l.h}" rx="${dd === 0 ? 10 : 7}"/>` : '') +
      `<rect class="box" width="${l.w}" height="${l.h}" rx="${dd === 0 ? 10 : 7}"${boxSt ? ` style="${boxSt}"` : ''}/>${txt}${sub}` +
      (sel && single ? `<rect class="rsz" data-rsz="1" x="${l.w - 4}" y="${l.h - 4}" width="9" height="9" rx="2"><title>Trascina per ridimensionare</title></rect>` : '') +
      anchors + `</g>`;
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
  if (live) S.E = E;
  const rubber = lk && lk.x2 != null && !lk.pinMove ? `<path class="rubber" d="M${lk.x1},${lk.y1} L${lk.x2},${lk.y2}"/>` : '';
  return `<g>${prevs}</g><g>${edges}</g><g>${nodes}</g><g>${notes}</g><g>${cnotes}</g>${rubber}`;
}

function render() {
  const tree = curTree(), L = mindLayout(tree), NL = notesLayout(tree); S.L = L; S.NL = NL;
  vp.innerHTML = treeMarkup(tree, L, NL, true);
  document.body.classList.toggle('inner', S.path.length > 0);
  applyView(); renderCrumbs(); renderBar();
}

// percorso dei livelli, visibile solo dentro una struttura interna
function renderCrumbs() {
  const el = $('#crumbs');
  if (!S.path.length) { el.hidden = true; return; }
  const names = ['Mappa']; let t = S.root;
  for (const id of S.path) { const n = findM(t, id).n; names.push(n.text || 'Senza titolo'); t = n.sub; }
  el.innerHTML = names.map((s, i) => i < names.length - 1
    ? `<button data-lvl="${i}">${esc(ell(s, 160, `500 13px ${FB}`))}</button><span class="sep">›</span>`
    : `<span class="here">${esc(ell(s, 220, `600 13px ${FB}`))}</span>`).join('');
  el.hidden = false;
}
$('#crumbs').addEventListener('click', e => { const b = e.target.closest('[data-lvl]'); if (b) goToLevel(+b.dataset.lvl); });

/* ---------- operazioni sui blocchi ---------- */
// i blocchi nuovi non hanno x/y: li colloca ensurePositions al prossimo disegno
function addChild(id) {
  const c = mk('Nuova idea');
  mutate(t => { const f = findM(t, id); if (f) f.n.children.push(c); });
  selectOnly(c.id); render(); startEdit(c.id, true);
}
function addSibling(id) {
  const f = findM(curTree(), id); if (!f) return; if (!f.p) return addChild(id);
  const c = mk('Nuova idea');
  if (f.n.edge && f.n.edge.po != null) c.edge = { po: f.n.edge.po }; // stessa uscita del genitore
  mutate(t => { const g = findM(t, id); g.p.children.splice(g.p.children.indexOf(g.n) + 1, 0, c); });
  selectOnly(c.id); render(); startEdit(c.id, true);
}
function addFreeBlock(x, y) {
  const c = { ...mk('Nuovo blocco'), x: Math.round(x), y: Math.round(y - 15) };
  mutate(t => (t.free = t.free || []).push(c));
  selectOnly(c.id); render(); startEdit(c.id, true);
}
function addCanvasNote(x, y) {
  const nt = { id: uid(), x: Math.round(x), y: Math.round(y), text: 'Nota' };
  mutate(t => (t.notes = t.notes || []).push(nt));
  selectOnly(nt.id); render(); startNoteEdit(nt.id);
}
// toglie i collegamenti aggiuntivi che puntano a blocchi non più presenti
function cleanLinks(t) { if (t.links) { t.links = t.links.filter(x => findM(t, x.from) && findM(t, x.to)); if (!t.links.length) delete t.links; } }
function removeSelected() {
  const t = curTree(), ids = [...S.sels], delRoot = ids.includes(t.id);
  if (!ids.length) return;
  // anche la radice del livello si può eliminare, se sulla tela resta un altro blocco libero che ne prende il posto
  if (delRoot && !(t.free || []).some(r => !ids.includes(r.id))) return toast('Sulla tela deve restare almeno un blocco');
  const f0 = findM(t, ids.includes(S.sel) ? S.sel : ids[0]), pid = f0 && f0.p ? f0.p.id : null;
  mutate(tt => {
    ids.forEach(id => {
      if (id === tt.id) return;
      const f = findM(tt, id); if (f && f.list) { f.list.splice(f.list.indexOf(f.n), 1); return; }
      const nt = findNote(tt, id); if (nt) tt.notes.splice(tt.notes.indexOf(nt), 1);
    });
    if (delRoot) promoteRoot(tt, tt.free[0]);
    cleanLinks(curTree());
  });
  selectOnly(pid && findM(curTree(), pid) ? pid : null); render();
}
// il blocco libero `nr` diventa la radice dei dati del livello: prende con sé blocchi liberi, collegamenti aggiuntivi e note.
// Nessun blocco si sposta e nessuno cambia aspetto (l'attributo "primaria" resta quello che era).
function promoteRoot(t, nr) {
  nr.free = (t.free || []).filter(r => r !== nr); nr.notes = t.notes || []; nr.links = t.links || [];
  ['free', 'notes', 'links'].forEach(k => { if (!nr[k].length) delete nr[k]; });
  delete t.free; delete t.notes; delete t.links; delete nr.edge;
  if (nr.primary === undefined) nr.primary = false;
  setLevelRoot(nr);
}
// collega l'uscita `po` di `fromId` all'ingresso `pi` di `toId`. Nessun blocco si sposta: cambia solo la linea.
// Se il blocco d'arrivo non ha ancora un genitore diventa suo figlio, altrimenti si aggiunge un collegamento:
// così un blocco può avere più ingressi.
function link(fromId, po, toId, pi) {
  const t = curTree(); if (fromId === toId) return render();
  const a = findM(t, fromId), b = findM(t, toId); if (!a || !b) return render();
  const links = allLinks(t);
  const same = links.find(L => L.from.id === fromId && L.to.id === toId);
  if (same) {
    // stesso collegamento con pallini diversi: si riaggancia
    if (outIdx(a.n, same.e) !== po || inIdx(b.n, same.e) !== pi) { setEdge(same.key, { po, pi }); return toast('Collegamento spostato'); }
    render(); return toast('Sono già collegati');
  }
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
      const ed = Object.assign({}, f.n.edge, { po, pi }); delete ed.ps;
      Object.keys(ed).forEach(k => { if (!ed[k] && ed[k] !== 0) delete ed[k]; }); if (!ed.pi) delete ed.pi;
      f.n.edge = ed;
    } else {
      const lx = { id: uid(), from: fromId, to: toId, po, pi }; if (!pi) delete lx.pi;
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
function insertOnLink(key) {
  const t = curTree(), Lk = allLinks(t).find(L => L.key === key); if (!Lk) return;
  const g = linkGeom(Lk.from, S.L.get(Lk.from.id), outIdx(Lk.from, Lk.e), Lk.to, S.L.get(Lk.to.id), inIdx(Lk.to, Lk.e));
  const n = mk('Nuova idea'), pi = inIdx(Lk.to, Lk.e), po = outIdx(Lk.from, Lk.e);
  const SZ = sizeMap({ id: 'tmp', text: '', children: [n] }), s = SZ.get(n.id);
  n.x = Math.round(g.mx - s.w / 2); n.y = Math.round(g.my - s.h / 2);
  const keep = { note: Lk.e.note, dash: Lk.e.dash };
  mutate(tt => {
    if (Lk.extra) {
      // il nuovo blocco diventa figlio del primo blocco, poi un collegamento aggiuntivo verso il secondo
      tt.links = tt.links.filter(x => x.id !== key.slice(2)); if (!tt.links.length) delete tt.links;
      n.edge = { po, ...keep }; findM(tt, Lk.from.id).n.children.push(n);
      (tt.links = tt.links || []).push({ id: uid(), from: n.id, to: Lk.to.id, po: 0, pi });
    } else {
      const f = findM(tt, Lk.to.id), i = f.p.children.indexOf(f.n);
      n.edge = { po, ...keep }; f.p.children.splice(i, 1, n); n.children.push(f.n);
      f.n.edge = { pi }; if (!pi) delete f.n.edge;
    }
    Object.keys(n.edge).forEach(k => { if (n.edge[k] === undefined) delete n.edge[k]; });
  });
  selectOnly(n.id); render(); startEdit(n.id, true);
}
function toggleFlip(id) { mutate(t => { const f = findM(t, id); if (!f) return; delete f.n.pin; if (f.n.flip) delete f.n.flip; else f.n.flip = true; }); }
function togglePrimary(id) { mutate(t => { const f = findM(t, id); if (!f) return; if (f.n.primary) { if (f.n === t) f.n.primary = false; else delete f.n.primary; } else f.n.primary = true; }); }
// pallini: aggiungi / togli / sposta / di serie
function spreadSide(list, side) { const on = list.filter(p => p[0] === side); on.forEach((p, i) => { p[1] = Math.round((i + 1) / (on.length + 1) * 100) / 100; }); }
function addPin(id, kind) {
  mutate(t => {
    const n = findM(t, id).n, P = JSON.parse(JSON.stringify(pinsOf(n))), list = P[kind === 'in' ? 'i' : 'o'];
    const side = list[list.length - 1][0]; list.push([side, 0.5]); spreadSide(list, side); n.pin = P;
  });
}
function removePin(id, kind) {
  mutate(t => {
    const n = findM(t, id).n, P = JSON.parse(JSON.stringify(pinsOf(n))), list = P[kind === 'in' ? 'i' : 'o'];
    if (list.length > 1) list.pop(); n.pin = P;
  });
}
function setPin(id, kind, idx, pos) {
  mutate(t => { const n = findM(t, id).n, P = JSON.parse(JSON.stringify(n.pin || defaultPins(n))); P[kind === 'in' ? 'i' : 'o'][idx] = pos; n.pin = P; });
}
function resetPins(id) { mutate(t => { delete findM(t, id).n.pin; }); }

/* ---------- duplica, copia, incolla ---------- */
// copia profonda con id nuovi (anche rami, struttura interna con i suoi blocchi liberi, collegamenti e note)
function cloneFresh(n) {
  const c = JSON.parse(JSON.stringify(n)), map = {}, conts = [];
  (function re(x) {
    map[x.id] = uid(); x.id = map[x.id]; if (x.links) conts.push(x);
    x.children.forEach(re); (x.free || []).forEach(re); (x.notes || []).forEach(nt => { nt.id = uid(); }); if (x.sub) re(x.sub);
  })(c);
  conts.forEach(x => x.links.forEach(L => { L.id = uid(); L.from = map[L.from] || L.from; L.to = map[L.to] || L.to; }));
  return c;
}
// copia "staccata": senza i contenuti del livello (se era la radice) e senza collegamento in entrata
function looseCopy(n) { const c = cloneFresh(n); ['free', 'notes', 'links', 'edge'].forEach(k => delete c[k]); return c; }
function selectMany(ids) { S.sels = new Set(ids); S.sel = ids[ids.length - 1] || null; S.esel = null; }
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
  S.clip = { nodes, notes }; toast(`Copiat${nodes.length + notes.length > 1 ? 'i' : 'o'}: ${nodes.length + notes.length}`);
}
// incolla: dentro il blocco selezionato (come rami, accanto a lui) oppure liberi nel punto indicato
function pasteClip(at) {
  if (!S.clip) return toast('Niente da incollare');
  const t = curTree(), target = S.sels.size === 1 && findM(t, S.sel) ? S.sel : null, ids = [];
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
function topSelected(tree) {
  const out = [];
  const rec = (n, anc) => { const s = S.sels.has(n.id); if (s && !anc) out.push(n); n.children.forEach(c => rec(c, anc || s)); };
  rec(tree, false); (tree.free || []).forEach(r => rec(r, false));
  return out;
}
// cosa si sposta trascinando: solo i blocchi e le note selezionati (i figli restano dove sono)
function dragMovers(t) {
  const out = [];
  walkAll(t, d => { if (S.sels.has(d.id)) out.push({ o: d, ox: d.x, oy: d.y }); });
  (t.notes || []).filter(nt => S.sels.has(nt.id)).forEach(nt => out.push({ o: nt, ox: nt.x, oy: nt.y }));
  return out;
}
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
const toggleSubPreview = id => mutate(t => { const f = findM(t, id); if (!f) return; if (f.n.subOpen) delete f.n.subOpen; else f.n.subOpen = true; });

/* ---------- struttura interna ---------- */
function openSub(id) {
  hidePreview();
  const f = findM(curTree(), id); if (!f) return;
  if (!f.n.sub) mutate(() => { f.n.sub = { id: uid(), text: f.n.text, children: [], primary: true }; });
  else f.n.sub.text = f.n.text;
  S.path.push(id); clearSel(); render();
  if (view().fresh) fit();
}
function goToLevel(lvl) {
  if (lvl >= S.path.length) return;
  const back = S.path[lvl]; S.path = S.path.slice(0, lvl);
  selectOnly(back); render(); if (view().fresh) fit();
}
// riquadro che contiene tutto un livello (coordinate della tela)
function levelBounds(L, NL) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  [L, NL].forEach(M => M.forEach(l => { x1 = Math.min(x1, l.x); y1 = Math.min(y1, l.y); x2 = Math.max(x2, l.x + l.w); y2 = Math.max(y2, l.y + l.h); }));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
// anteprima della struttura interna (passando sull'icona), senza entrarci
const prevEl = $('#preview');
function showPreview(id, rect) {
  const f = findM(curTree(), id); if (!f || !f.n.sub) return;
  const sub = f.n.sub, L = mindLayout(sub), NL = notesLayout(sub), b = levelBounds(L, NL);
  const pad = 16, w = b.w + pad * 2, h = b.h + pad * 2, k = Math.min(1, 340 / w, 220 / h);
  let count = 0; walkAll(sub, () => count++);
  prevEl.innerHTML = `<div class="ptitle">Struttura interna · ${count > 1 ? `${count - 1} blocchi` : 'vuota'} · clic per entrare</div>` +
    `<svg viewBox="${b.x - pad} ${b.y - pad} ${w} ${h}" width="${Math.round(w * k)}" height="${Math.round(h * k)}">${treeMarkup(sub, L, NL, false)}</svg>`;
  prevEl.hidden = false;
  const r = prevEl.getBoundingClientRect();
  let left = rect.right + 10; if (left + r.width > innerWidth - 8) left = rect.left - r.width - 10;
  prevEl.style.left = clamp(left, 8, innerWidth - r.width - 8) + 'px';
  prevEl.style.top = clamp(rect.top - 10, BAR_H + 8, innerHeight - r.height - 8) + 'px';
}
function hidePreview() { prevEl.hidden = true; }
