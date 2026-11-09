// Mappa mentale: layout ad albero, disegno e operazioni sui blocchi
// Blocco: { id, text, children[], dx?, dy?, w?, h?, color?, fs?, bw?, op?, sub?, edge? }
//   dx/dy = spostamento manuale (vale per tutto il sotto-albero) · w/h = dimensione scelta a mano
//   color = indice 0–5 dei token --c0…--c5 · fs = dimensione testo (px) · bw = spessore bordo · op = opacità riquadro
//   sub = struttura interna (un altro albero) · edge = { note?, dash? } del collegamento che ENTRA nel blocco
// Blocco libero (in tree.free): come sopra + fx, fy = punto di partenza (lato sinistro, centro verticale)
// Nota sulla tela (in tree.notes): { id, x, y, text }
const DEF_FS = [16, 14, 13];
const fsOf = (n, depth) => n.fs || DEF_FS[Math.min(depth, 2)];
const nodeFont = (n, depth) => `${depth <= 1 ? 600 : 400} ${fsOf(n, depth)}px ${FB}`;
const bwOf = (n, depth) => n.bw ?? (depth === 0 ? 2 : 1.4);
const hasColor = n => n.color !== undefined && n.color !== null && n.color !== '';
const RMIN = [40, 26], RMAX = [800, 600];
const NOTE_FONT = `500 11.5px ${FB}`, CNOTE_FONT = `400 13px ${FB}`;

function mindLayout(root) {
  const L = new Map(), VG = 10, HG = 46;
  function size(n, depth) {
    const fs = fsOf(n, depth), font = nodeFont(n, depth), lh = Math.round(fs * 1.28);
    const padX = depth === 0 ? 36 : 24, padY = depth === 0 ? 22 : 14;
    const maxW = n.w ? Math.max(16, n.w - padX) : depth === 0 ? 220 : 200;
    const maxL = n.h ? Math.max(1, Math.floor((n.h - padY + 4) / lh)) : 4;
    const lines = wrap(n.text || 'Senza titolo', maxW, font, maxL);
    const w = n.w || Math.max(Math.max(...lines.map(l => tw(l, font))) + padX, depth === 0 ? 120 : 48);
    L.set(n.id, { lines, lh, w, h: n.h || lines.length * lh + padY, depth });
    n.children.forEach(c => size(c, depth + 1));
  }
  function sh(n) {
    const l = L.get(n.id), t = n.children.reduce((a, c) => a + sh(c), 0) + VG * Math.max(0, n.children.length - 1);
    return (l.sh = Math.max(l.h, t));
  }
  function place(n, edge, cy, dir) {
    const l = L.get(n.id);
    l.x = dir > 0 ? edge : edge - l.w; l.y = cy - l.h / 2; l.dir = dir;
    if (!n.children.length) return;
    const total = n.children.reduce((a, c) => a + L.get(c.id).sh, 0) + VG * (n.children.length - 1);
    let y = cy - total / 2; const ne = dir > 0 ? l.x + l.w + HG : l.x - HG;
    n.children.forEach(c => { const s = L.get(c.id).sh; place(c, ne, y + s / 2, dir); y += s + VG; });
  }
  function off(n, ox, oy) {
    const l = L.get(n.id); ox += n.dx || 0; oy += n.dy || 0; l.x += ox; l.y += oy;
    n.children.forEach(c => off(c, ox, oy));
  }
  size(root, 0); sh(root);
  // rami principali divisi a metà: prima metà a destra, seconda a sinistra
  const r = L.get(root.id); r.x = -r.w / 2; r.y = -r.h / 2; r.dir = 0;
  const kids = root.children, half = Math.ceil(kids.length / 2);
  [[kids.slice(0, half), 1], [kids.slice(half), -1]].forEach(([side, dir]) => {
    const total = side.reduce((a, c) => a + L.get(c.id).sh, 0) + 14 * Math.max(0, side.length - 1);
    let y = -total / 2;
    side.forEach(c => { const s = L.get(c.id).sh; place(c, dir > 0 ? r.x + r.w + 60 : r.x - 60, y + s / 2, dir); y += s + 14; });
  });
  off(root, 0, 0);
  // blocchi liberi: alberi senza collegamento, con i rami verso destra
  (root.free || []).forEach(fr => { size(fr, 1); sh(fr); place(fr, fr.fx || 0, fr.fy || 0, 1); L.get(fr.id).free = true; off(fr, 0, 0); });
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

// pallini di ancoraggio: piccoli, area di presa più grande del pallino
const anc = (kind, x, y, tip) =>
  `<g class="anc ${kind}" data-anc="${kind}"><title>${tip}</title><circle class="ahit" cx="${x}" cy="${y}" r="9"/><circle class="adot" cx="${x}" cy="${y}" r="2.2"/></g>`;
const TIP_IN = 'Ingresso: trascina su un blocco per riattaccarlo lì, nel vuoto per staccarlo';
const TIP_OUT = 'Uscita: trascina su un blocco per collegarlo qui';

// markup SVG di un livello; live = tela interattiva (selezione, ancoraggi, maniglie), altrimenti anteprima/esportazione
function treeMarkup(tree, L, NL, live) {
  const single = live && S.sels.size === 1 && !editing, lk = live ? S.link : null;
  const E = new Map(); let edges = '', notes = '', nodes = '';
  function rec(n) {
    const l = L.get(n.id);
    n.children.forEach(c => {
      const k = L.get(c.id), right = k.x + k.w / 2 >= l.x + l.w / 2; k.inLeft = right;
      const x1 = right ? l.x + l.w : l.x, y1 = l.y + l.h / 2, x2 = right ? k.x : k.x + k.w, y2 = k.y + k.h / 2;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, ed = c.edge || {};
      E.set(c.id, { x: mx, y: my });
      const cls = 'eg' + (ed.dash ? ' dash' : '') + (lk && lk.kind === 'in' && lk.id === c.id ? ' lifted' : '');
      edges += `<g class="${cls}"${live ? ` data-edge="${c.id}"` : ''}><path class="edge" stroke-width="${l.depth === 0 ? 2.2 : 1.5}" d="${d}"/>` +
        (live ? `<path class="ehit" d="${d}"><title>Doppio clic: nota · Tasto destro: opzioni del collegamento</title></path>` : '') + `</g>`;
      if (ed.note && !(editing && editing.kind === 'edge' && editing.id === c.id)) {
        const lines = wrap(ed.note, 170, NOTE_FONT, 3), w = Math.max(...lines.map(s => tw(s, NOTE_FONT))) + 16, h = lines.length * 14 + 8;
        notes += `<g class="enote"${live ? ` data-edge="${c.id}"` : ''}><rect x="${mx - w / 2}" y="${my - h / 2}" width="${w}" height="${h}" rx="7"/>` +
          lines.map((s, i) => `<text x="${mx}" y="${my - h / 2 + 15 + i * 14}" text-anchor="middle">${esc(s)}</text>`).join('') + `</g>`;
      }
      rec(c);
    });
    const sel = live && S.sels.has(n.id), dd = Math.min(l.depth, 2), pad = (l.h - l.lines.length * l.lh) / 2;
    const fsSt = n.fs ? ` style="font-size:${n.fs}px"` : '';
    const boxSt = (n.bw != null ? `stroke-width:${n.bw}px;` : '') + (n.op != null ? `opacity:${n.op};` : '');
    const txt = l.lines.map((s, i) => `<text x="${l.w / 2}" y="${pad + (i + 0.76) * l.lh}" text-anchor="middle"${fsSt}>${esc(s)}</text>`).join('');
    const sub = n.sub ? `<g class="subicon"${live ? ' data-sub="1"' : ''}><rect class="shit" x="${l.w - 20}" y="1" width="19" height="17"/>` +
      [[0, 0], [4, 0], [0, 4], [4, 4]].map(([a, b]) => `<rect x="${l.w - 13 + a}" y="${5 + b}" width="3" height="3" rx=".6"/>`).join('') + `</g>` : '';
    let anchors = '';
    if (live) {
      // idea centrale: uscite sui due lati (i rami partono da entrambi), ingresso in alto
      if (n === tree) anchors = anc('in', l.w / 2, 0, TIP_IN) + anc('out', 0, l.h / 2, TIP_OUT) + anc('out', l.w, l.h / 2, TIP_OUT);
      else { const inL = l.inLeft ?? true; anchors = anc('in', inL ? 0 : l.w, l.h / 2, TIP_IN) + anc('out', inL ? l.w : 0, l.h / 2, TIP_OUT); }
    }
    const cls = `mn d${dd}${hasColor(n) ? ' cc c' + n.color : ''}${sel ? ' sel' : ''}${lk && lk.over === n.id ? ' drop' : ''}`;
    nodes += `<g class="${cls}"${live ? ` data-id="${n.id}"` : ''} transform="translate(${l.x},${l.y})">` +
      (sel ? `<rect class="ring" x="-5" y="-5" width="${l.w + 10}" height="${l.h + 10}" rx="${dd === 0 ? 14 : 11}"/>` : '') +
      `<rect class="box" width="${l.w}" height="${l.h}" rx="${dd === 0 ? 10 : 7}"${boxSt ? ` style="${boxSt}"` : ''}/>${txt}${sub}${anchors}` +
      // maniglia sul lato esterno: il blocco cresce allontanandosi dal genitore
      (sel && single ? `<rect class="rsz${l.dir < 0 ? ' left' : ''}" data-rsz="1" x="${l.dir < 0 ? -5 : l.w - 5}" y="${l.h - 5}" width="10" height="10" rx="2"><title>Trascina per ridimensionare</title></rect>` : '') + `</g>`;
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
function addChild(id) {
  const c = mk('Nuova idea');
  mutate(t => { const f = findM(t, id); if (f) f.n.children.push(c); });
  selectOnly(c.id); render(); startEdit(c.id, true);
}
function addSibling(id) {
  const f = findM(curTree(), id); if (!f) return; if (!f.p) return addChild(id);
  const c = mk('Nuova idea');
  mutate(t => { const g = findM(t, id); g.p.children.splice(g.p.children.indexOf(g.n) + 1, 0, c); });
  selectOnly(c.id); render(); startEdit(c.id, true);
}
function addFreeBlock(x, y) {
  const c = { ...mk('Nuovo blocco'), fx: Math.round(x), fy: Math.round(y) };
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
// il blocco libero `nr` diventa la radice del livello: prende con sé gli altri blocchi liberi e le note
function promoteRoot(t, nr) {
  nr.free = (t.free || []).filter(r => r !== nr); nr.notes = t.notes || [];
  if (!nr.free.length) delete nr.free; if (!nr.notes.length) delete nr.notes;
  delete t.free; delete t.notes; ['fx', 'fy', 'dx', 'dy'].forEach(k => delete nr[k]);
  setLevelRoot(nr);
}
// collega `childId` (con i suoi rami) sotto `parentId`: ogni blocco ha un solo ingresso, quindi viene spostato, non duplicato
function reparent(childId, parentId) {
  const t = curTree(); if (childId === parentId) return render();
  const c = findM(t, childId), np = findM(t, parentId); if (!c || !np) return render();
  if (c.p && c.p.id === parentId) { render(); return toast('Sono già collegati'); }
  let inside = false; walk(c.n, n => { if (n.id === parentId) inside = true; });
  if (inside) { render(); return toast('Non puoi collegare un blocco sotto uno dei suoi stessi rami'); }
  mutate(tt => {
    const f = findM(tt, childId), p = findM(tt, parentId).n;
    if (f.n === tt) {
      // l'idea centrale va sotto un blocco libero: la radice di quel blocco libero diventa la nuova idea centrale
      const nr = tt.free.find(r => { let has = false; walk(r, n => { if (n.id === parentId) has = true; }); return has; });
      promoteRoot(tt, nr); p.children.push(tt);
    } else {
      f.list.splice(f.list.indexOf(f.n), 1); p.children.push(f.n);
    }
    ['dx', 'dy', 'fx', 'fy'].forEach(k => delete f.n[k]);
  });
  selectOnly(childId); render(); toast('Collegamento spostato');
}
// stacca un blocco dal genitore: resta sulla tela come blocco libero, nel punto indicato
function detach(id, x, y) {
  const t = curTree(), f = findM(t, id); if (!f || !f.p) return render();
  const l = S.L.get(id);
  mutate(tt => {
    const g = findM(tt, id); g.list.splice(g.list.indexOf(g.n), 1); delete g.n.dx; delete g.n.dy; delete g.n.edge;
    g.n.fx = Math.round(x ?? l.x); g.n.fy = Math.round(y ?? l.y + l.h / 2); (tt.free = tt.free || []).push(g.n);
  });
  selectOnly(id); render(); toast('Blocco staccato');
}
// blocchi e note selezionati senza antenati selezionati (per spostarli una volta sola)
function topSelected(tree) {
  const out = [];
  const rec = (n, anc) => { const s = S.sels.has(n.id); if (s && !anc) out.push(n); n.children.forEach(c => rec(c, anc || s)); };
  rec(tree, false); (tree.free || []).forEach(r => rec(r, false));
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
