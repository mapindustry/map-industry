// Mappa mentale: posizioni, disegno e operazioni sui blocchi
// Blocco: { id, text, children[], x, y, w?, h?, flip?, color?, fs?, bw?, op?, sub?, edge? }
//   x/y = angolo in alto a sinistra, FISSO: collegare, staccare o ricollegare non sposta nessun blocco
//   w/h = dimensione scelta a mano · flip = ingresso a destra e uscita a sinistra (di norma il contrario)
//   color = indice 0–5 dei token --c0…--c5 · fs = dimensione testo (px) · bw = spessore bordo · op = opacità riquadro
//   sub = struttura interna (un altro livello)
//   edge = { note?, dash?, nx?, ny?, ps? } del collegamento che ENTRA nel blocco
//          ps = uscita dell'idea centrale da cui parte ('l' o 'r'); nx/ny = spostamento della nota
// Nota sulla tela (in tree.notes): { id, x, y, text }
// Dati vecchi (dx/dy/fx/fy, senza x/y) vengono convertiti una volta con il vecchio layout automatico.
const DEF_FS = [16, 14, 13];
const fsOf = (n, depth) => n.fs || DEF_FS[Math.min(depth, 2)];
const nodeFont = (n, depth) => `${depth <= 1 ? 600 : 400} ${fsOf(n, depth)}px ${FB}`;
const bwOf = (n, depth) => n.bw ?? (depth === 0 ? 2 : 1.4);
const hasColor = n => n.color !== undefined && n.color !== null && n.color !== '';
const hasPos = n => n.x !== undefined && n.y !== undefined;
const RMIN = [40, 26], RMAX = [800, 600];
const NOTE_FONT = `500 11.5px ${FB}`, CNOTE_FONT = `400 13px ${FB}`;

/* ---------- dimensioni e posizioni ---------- */
function sizeMap(tree) {
  const M = new Map();
  function size(n, depth) {
    const fs = fsOf(n, depth), font = nodeFont(n, depth), lh = Math.round(fs * 1.28);
    const padX = depth === 0 ? 36 : 24, padY = depth === 0 ? 22 : 14;
    const maxW = n.w ? Math.max(16, n.w - padX) : depth === 0 ? 220 : 200;
    const maxL = n.h ? Math.max(1, Math.floor((n.h - padY + 4) / lh)) : 4;
    const lines = wrap(n.text || 'Senza titolo', maxW, font, maxL);
    const w = n.w || Math.max(Math.max(...lines.map(l => tw(l, font))) + padX, depth === 0 ? 120 : 48);
    M.set(n.id, { lines, lh, w, h: n.h || lines.length * lh + padY, depth });
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
// fondo del sotto-albero (per mettere un blocco nuovo sotto i fratelli)
function subtreeBottom(n, SZ) { let b = -Infinity; walk(n, d => { if (hasPos(d)) b = Math.max(b, d.y + SZ.get(d.id).h); }); return b; }
// un blocco nuovo va vicino al genitore, dal lato della sua uscita, sotto i fratelli già posizionati
function placeNew(tree, p, n, SZ) {
  const pl = SZ.get(p.id), nl = SZ.get(n.id);
  let side;
  if (p === tree) {
    side = n.edge && n.edge.ps;
    if (!side) { // idea centrale: si bilanciano i due lati
      const sides = p.children.filter(c => c !== n && hasPos(c)).map(c => (c.edge && c.edge.ps) || 'r');
      side = sides.filter(s => s === 'l').length < sides.filter(s => s === 'r').length ? 'l' : 'r';
      n.edge = Object.assign({}, n.edge, { ps: side });
    }
  } else side = p.flip ? 'l' : 'r';
  n.flip = side === 'l'; // l'ingresso guarda verso il genitore
  const sibs = p.children.filter(c => c !== n && hasPos(c) && (p !== tree || ((c.edge && c.edge.ps) || 'r') === side));
  n.x = Math.round(side === 'r' ? p.x + pl.w + 50 : p.x - 50 - nl.w);
  n.y = Math.round(sibs.length ? Math.max(...sibs.map(c => subtreeBottom(c, SZ))) + 12 : p.y + pl.h / 2 - nl.h / 2);
  if (!n.flip) delete n.flip;
}
// assegna le posizioni mancanti; true se ha cambiato qualcosa (da salvare)
function ensurePositions(tree, SZ) {
  let any = false; const missing = [];
  walkAll(tree, n => { if (hasPos(n)) any = true; else missing.push(n); });
  if (!missing.length) return false;
  if (!any) {
    const A = autoLayout(tree, SZ);
    walkAll(tree, (n, p) => {
      const a = A.get(n.id); n.x = Math.round(a.x); n.y = Math.round(a.y);
      if (p && a.dir < 0) { n.flip = true; if (p === tree) n.edge = Object.assign({}, n.edge, { ps: 'l' }); }
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
  const SZ = sizeMap(tree);
  if (ensurePositions(tree, SZ)) save();
  const L = new Map(); walkAll(tree, n => L.set(n.id, { ...SZ.get(n.id), x: n.x, y: n.y }));
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

/* ---------- pallini e collegamenti ---------- */
// ogni blocco: ingresso a sinistra e uscita a destra (al contrario con flip)
// idea centrale: ingresso in alto, uscite su entrambi i lati
function anchorsOf(n, l, isRoot) {
  if (isRoot) return [{ kind: 'in', side: 't', x: l.w / 2, y: 0 }, { kind: 'out', side: 'l', x: 0, y: l.h / 2 }, { kind: 'out', side: 'r', x: l.w, y: l.h / 2 }];
  const f = !!n.flip;
  return [{ kind: 'in', side: f ? 'r' : 'l', x: f ? l.w : 0, y: l.h / 2 }, { kind: 'out', side: f ? 'l' : 'r', x: f ? 0 : l.w, y: l.h / 2 }];
}
const TAN = { l: -1, r: 1 };
// la linea parte dall'uscita del genitore e arriva all'ingresso del figlio: sempre quei pallini, anche se i blocchi si girano attorno
function edgeGeom(p, pl, c, cl, rootParent) {
  const ps = rootParent ? ((c.edge && c.edge.ps) || 'r') : (p.flip ? 'l' : 'r'), cs = c.flip ? 'r' : 'l';
  const ax = pl.x + (ps === 'r' ? pl.w : 0), ay = pl.y + pl.h / 2, bx = cl.x + (cs === 'r' ? cl.w : 0), by = cl.y + cl.h / 2;
  const k = clamp(Math.hypot(bx - ax, by - ay) / 2, 30, 160);
  const c1x = ax + TAN[ps] * k, c2x = bx + TAN[cs] * k;
  return { d: `M${ax},${ay} C${c1x},${ay} ${c2x},${by} ${bx},${by}`, mx: (ax + 3 * c1x + 3 * c2x + bx) / 8, my: (ay + by) / 2 };
}
const TIP = {
  in: 'Ingresso: trascina sull’uscita di un blocco per collegarlo, nel vuoto per staccarlo',
  out: 'Uscita: trascina sull’ingresso di un blocco per collegarlo'
};

// markup SVG di un livello; live = tela interattiva (selezione, pallini, maniglie), altrimenti anteprima/esportazione
function treeMarkup(tree, L, NL, live) {
  const single = live && S.sels.size === 1 && !editing, lk = live ? S.link : null;
  const E = new Map(); let edges = '', notes = '', nodes = '';
  function rec(n) {
    const l = L.get(n.id);
    n.children.forEach(c => {
      const k = L.get(c.id), g = edgeGeom(n, l, c, k, n === tree), ed = c.edge || {};
      // la nota sta al centro del collegamento, spostata di nx/ny se l'utente l'ha trascinata
      const nx = g.mx + (ed.nx || 0), ny = g.my + (ed.ny || 0);
      E.set(c.id, { x: nx, y: ny });
      const cls = 'eg' + (ed.dash ? ' dash' : '') + (lk && lk.kind === 'in' && lk.id === c.id ? ' lifted' : '') + (live && S.esel === c.id ? ' sel' : '');
      edges += `<g class="${cls}"${live ? ` data-edge="${c.id}"` : ''}><path class="edge" stroke-width="${l.depth === 0 ? 2.2 : 1.5}" d="${g.d}"/>` +
        (live ? `<path class="ehit" d="${g.d}"><title>Doppio clic: nota · Tasto destro: opzioni del collegamento</title></path>` : '') + `</g>`;
      if (ed.note && !(editing && editing.kind === 'edge' && editing.id === c.id)) {
        const lines = wrap(ed.note, 170, NOTE_FONT, 3), w = Math.max(...lines.map(s => tw(s, NOTE_FONT))) + 16, h = lines.length * 14 + 8;
        const lead = ed.nx || ed.ny ? `<path class="lead" d="M${g.mx},${g.my} L${nx},${ny}"/>` : '';
        notes += `<g class="enote${live && S.esel === c.id ? ' sel' : ''}"${live ? ` data-edge="${c.id}"` : ''}>${lead}<rect x="${nx - w / 2}" y="${ny - h / 2}" width="${w}" height="${h}" rx="7"/>` +
          lines.map((s, i) => `<text x="${nx}" y="${ny - h / 2 + 15 + i * 14}" text-anchor="middle">${esc(s)}</text>`).join('') + `</g>`;
      }
      rec(c);
    });
    const sel = live && S.sels.has(n.id), dd = Math.min(l.depth, 2), pad = (l.h - l.lines.length * l.lh) / 2;
    const fsSt = n.fs ? ` style="font-size:${n.fs}px"` : '';
    const boxSt = (n.bw != null ? `stroke-width:${n.bw}px;` : '') + (n.op != null ? `opacity:${n.op};` : '');
    const txt = l.lines.map((s, i) => `<text x="${l.w / 2}" y="${pad + (i + 0.76) * l.lh}" text-anchor="middle"${fsSt}>${esc(s)}</text>`).join('');
    const sub = n.sub ? `<g class="subicon"${live ? ' data-sub="1"' : ''}><rect class="shit" x="${l.w - 20}" y="1" width="19" height="17"/>` +
      [[0, 0], [4, 0], [0, 4], [4, 4]].map(([a, b]) => `<rect x="${l.w - 13 + a}" y="${5 + b}" width="3" height="3" rx=".6"/>`).join('') + `</g>` : '';
    const anchors = live ? anchorsOf(n, l, n === tree).map(a => {
      const hot = lk && lk.over === n.id && lk.overAnc && lk.overAnc.kind === a.kind && lk.overAnc.side === a.side;
      return `<g class="anc ${a.kind}${hot ? ' hot' : ''}" data-anc="${a.kind}" data-side="${a.side}"><title>${TIP[a.kind]}</title>` +
        `<circle class="ahit" cx="${a.x}" cy="${a.y}" r="10"/><circle class="adot" cx="${a.x}" cy="${a.y}" r="4"/></g>`;
    }).join('') : '';
    const cls = `mn d${dd}${hasColor(n) ? ' cc c' + n.color : ''}${sel ? ' sel' : ''}${lk && lk.over === n.id && !lk.overAnc ? ' drop' : ''}`;
    nodes += `<g class="${cls}"${live ? ` data-id="${n.id}"` : ''} transform="translate(${l.x},${l.y})">` +
      (sel ? `<rect class="ring" x="-5" y="-5" width="${l.w + 10}" height="${l.h + 10}" rx="${dd === 0 ? 14 : 11}"/>` : '') +
      `<rect class="box" width="${l.w}" height="${l.h}" rx="${dd === 0 ? 10 : 7}"${boxSt ? ` style="${boxSt}"` : ''}/>${txt}${sub}` +
      (sel && single ? `<rect class="rsz" data-rsz="1" x="${l.w - 4}" y="${l.h - 4}" width="9" height="9" rx="2"><title>Trascina per ridimensionare</title></rect>` : '') +
      anchors + `</g>`;
  }
  rec(tree); (tree.free || []).forEach(rec);
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
  const rubber = lk && lk.x2 != null ? `<path class="rubber" d="M${lk.x1},${lk.y1} L${lk.x2},${lk.y2}"/>` : '';
  return `<g>${edges}</g><g>${nodes}</g><g>${notes}</g><g>${cnotes}</g>${rubber}`;
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
  if (f.n.edge && f.n.edge.ps) c.edge = { ps: f.n.edge.ps }; // stesso lato dell'idea centrale
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
function removeSelected() {
  const t = curTree(), ids = [...S.sels], delRoot = ids.includes(t.id);
  if (!ids.length) return;
  // anche l'idea centrale si può eliminare, se sulla tela resta un altro blocco libero che ne prende il posto
  if (delRoot && !(t.free || []).some(r => !ids.includes(r.id))) return toast('Sulla tela deve restare almeno un blocco');
  const f0 = findM(t, ids.includes(S.sel) ? S.sel : ids[0]), pid = f0 && f0.p ? f0.p.id : null;
  mutate(tt => {
    ids.forEach(id => {
      if (id === tt.id) return;
      const f = findM(tt, id); if (f && f.list) { f.list.splice(f.list.indexOf(f.n), 1); return; }
      const nt = findNote(tt, id); if (nt) tt.notes.splice(tt.notes.indexOf(nt), 1);
    });
    if (delRoot) promoteRoot(tt, tt.free[0]);
  });
  selectOnly(pid && findM(curTree(), pid) ? pid : null); render();
}
// il blocco libero `nr` diventa la radice del livello: prende con sé gli altri blocchi liberi e le note.
// Nessun blocco si sposta: i rami della nuova radice partono dall'uscita del lato dove già si trovano.
function promoteRoot(t, nr) {
  nr.free = (t.free || []).filter(r => r !== nr); nr.notes = t.notes || [];
  if (!nr.free.length) delete nr.free; if (!nr.notes.length) delete nr.notes;
  delete t.free; delete t.notes; delete nr.flip; delete nr.edge;
  nr.children.forEach(c => { c.edge = Object.assign({}, c.edge, { ps: c.x < nr.x ? 'l' : 'r' }); });
  setLevelRoot(nr);
}
// collega `childId` sotto `parentId`. Nessun blocco si sposta: cambia solo la linea.
// Ogni blocco ha un solo ingresso: se era già collegato, il vecchio collegamento viene sostituito.
// ps = uscita dell'idea centrale scelta ('l' o 'r'), conta solo se il genitore è l'idea centrale
function connect(parentId, childId, ps) {
  const t = curTree(); if (childId === parentId) return render();
  const c = findM(t, childId), p = findM(t, parentId); if (!c || !p) return render();
  if (c.p && c.p.id === parentId) {
    if (p.n === t && ps && ps !== ((c.n.edge && c.n.edge.ps) || 'r')) { setEdge(childId, { ps }); return toast('Collegamento spostato'); }
    render(); return toast('Sono già collegati');
  }
  let inside = false; walk(c.n, n => { if (n.id === parentId) inside = true; });
  if (inside) { render(); return toast('Non puoi collegare un blocco sotto uno dei suoi stessi rami'); }
  mutate(tt => {
    const f = findM(tt, childId), pp = findM(tt, parentId).n;
    if (f.n === tt) {
      // l'idea centrale va sotto un blocco libero: la radice di quel blocco libero diventa la nuova idea centrale
      const nr = tt.free.find(r => { let has = false; walk(r, n => { if (n.id === parentId) has = true; }); return has; });
      promoteRoot(tt, nr);
    } else f.list.splice(f.list.indexOf(f.n), 1);
    pp.children.push(f.n);
    const ed = Object.assign({}, f.n.edge); delete ed.ps; delete ed.nx; delete ed.ny; delete ed.note;
    if (pp === curTree() && ps) ed.ps = ps;
    if (Object.keys(ed).length) f.n.edge = ed; else delete f.n.edge;
  });
  selectOnly(childId); render(); toast('Collegati');
}
// eliminare un collegamento = staccare il blocco in cui entra: il blocco resta dov'è, libero, con i suoi rami
function deleteEdge(id) { detach(id, 'Collegamento eliminato'); }
function detach(id, msg = 'Blocco staccato') {
  const f = findM(curTree(), id); if (!f || !f.p) return render();
  mutate(tt => { const g = findM(tt, id); g.list.splice(g.list.indexOf(g.n), 1); delete g.n.edge; (tt.free = tt.free || []).push(g.n); });
  selectOnly(id); render(); toast(msg);
}
function toggleFlip(id) { mutate(t => { const f = findM(t, id); if (!f || f.n === t) return; if (f.n.flip) delete f.n.flip; else f.n.flip = true; }); }

/* ---------- duplica, copia, incolla ---------- */
// copia profonda con id nuovi (anche rami, struttura interna, suoi blocchi liberi e note)
function cloneFresh(n) {
  const c = JSON.parse(JSON.stringify(n));
  (function re(x) { x.id = uid(); x.children.forEach(re); (x.free || []).forEach(re); (x.notes || []).forEach(nt => { nt.id = uid(); }); if (x.sub) re(x.sub); })(c);
  return c;
}
// copia "staccata": senza i contenuti del livello (se era la radice) e senza collegamento in entrata
function looseCopy(n) { const c = cloneFresh(n); ['free', 'notes', 'edge'].forEach(k => delete c[k]); return c; }
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
// cosa si sposta trascinando: i blocchi selezionati con i loro rami, e le note selezionate
function dragMovers(t) {
  const out = [];
  topSelected(t).forEach(n => walk(n, d => out.push({ o: d, ox: d.x, oy: d.y })));
  (t.notes || []).filter(nt => S.sels.has(nt.id)).forEach(nt => out.push({ o: nt, ox: nt.x, oy: nt.y }));
  return out;
}
function eachSelected(fn) { const ids = [...S.sels], L = S.L; mutate(t => ids.forEach(id => { const f = findM(t, id); if (f) fn(f.n, L.get(id)); })); }
function setColor(c) { eachSelected(n => { if (c === '') delete n.color; else n.color = +c; }); }
function autoSize() { eachSelected(n => { delete n.w; delete n.h; }); }

/* ---------- collegamenti (stile e nota stanno sul blocco figlio) ---------- */
function setEdge(id, patch) {
  mutate(t => {
    const f = findM(t, id); if (!f) return;
    const e = Object.assign({}, f.n.edge, patch);
    Object.keys(e).forEach(k => { if (!e[k]) delete e[k]; });
    if (Object.keys(e).length) f.n.edge = e; else delete f.n.edge;
  });
}

/* ---------- struttura interna ---------- */
function openSub(id) {
  hidePreview();
  const f = findM(curTree(), id); if (!f) return;
  if (!f.n.sub) mutate(() => { f.n.sub = { id: uid(), text: f.n.text, children: [] }; });
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
// anteprima della struttura interna, senza entrarci
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
