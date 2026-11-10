// Menu del tasto destro: su un blocco, su un collegamento, su una nota, sulla tela vuota
const menuEl = $('#menu');
let MENU = null; // { kind, id?, x?, y? }

function showMenu(cx, cy, html, ctx) {
  MENU = ctx; menuEl.innerHTML = html; menuEl.hidden = false;
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = Math.max(8, Math.min(cx, innerWidth - r.width - 8)) + 'px';
  menuEl.style.top = Math.max(8, Math.min(cy, innerHeight - r.height - 8)) + 'px';
  const first = menuEl.querySelector('.it'); if (first) first.focus({ preventScroll: true });
}
function closeMenu() { menuEl.hidden = true; MENU = null; }
const item = (a, label, extra = '') => `<button class="it${extra}" data-a="${a}" role="menuitem">${label}</button>`;
const SEP = '<div class="msep"></div>';

/* ---------- blocco ---------- */
function nodeMenuHtml() {
  const t = curTree(), nodes = [...S.sels].map(id => findM(t, id)).filter(Boolean).map(f => f.n);
  const one = nodes.length === 1 ? nodes[0] : null, prim = findM(t, S.sel) ? findM(t, S.sel).n : nodes[0], pl = S.L.get(prim.id);
  if (one && one.hub) return hubMenuHtml(one, t);
  const cur = one ? (hasColor(one) ? String(one.color) : '') : null;
  let h = `<div class="mhead">${one ? 'Colore' : `Colore di ${nodes.length} blocchi`}</div><div class="sws">` +
    `<button class="sw none${cur === '' ? ' on' : ''}" data-c="" title="Nessun colore" aria-label="Nessun colore"></button>` +
    [0, 1, 2, 3, 4, 5].map(i => `<button class="sw c${i}${cur === String(i) ? ' on' : ''}" data-c="${i}" aria-label="Colore ${i + 1}"></button>`).join('') + `</div>`;
  const op = Math.round((prim.op ?? 1) * 100);
  // ordine: colore, azioni frequenti, elimina; stile e pallini in fondo (il menu è lungo: le azioni restano in vista)
  const style = `<div class="mhead">Stile</div>
    <div class="mrow"><span>Testo</span><button class="st" data-st="fs" data-d="-1" aria-label="Testo più piccolo">−</button><span class="numw"><input type="number" class="num" id="mfs" min="9" max="48" step="1" value="${fsOf(prim, pl.depth)}" aria-label="Dimensione del testo in px"> px</span><button class="st" data-st="fs" data-d="1" aria-label="Testo più grande">+</button></div>
    <div class="mrow wide"><span>Peso</span><select id="mfw" aria-label="Peso del carattere">${FW.map(([v, t]) => `<option value="${v}"${fwOf(prim, pl.depth) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="mrow"><span>Bordo</span><button class="st" data-st="bw" data-d="-1" aria-label="Bordo più sottile">−</button><span class="val" id="vbw">${bwOf(prim, pl.depth)} px</span><button class="st" data-st="bw" data-d="1" aria-label="Bordo più spesso">+</button></div>
    <div class="mrow"><span>Opacità</span><input type="range" id="mop" min="10" max="100" step="5" value="${op}" aria-label="Opacità del blocco"><span class="val" id="vop">${op}%</span></div>`;
  let pinsH = '';
  if (one) {
    h += item('edit', 'Rinomina') +
      item('tag', one.tag ? 'Modifica etichetta' : 'Aggiungi etichetta <span>sigla o nota breve</span>') + (one.tag ? item('tagdel', 'Togli etichetta') : '') +
      item('child', 'Aggiungi ramo figlio') +
      (one.children.length ? item('fold', one.fold ? `Apri i rami a ventaglio <span>${countDesc(one)} blocchi</span>` : `Comprimi i rami nel blocco <span>${countDesc(one)} blocchi</span>`) : '') +
      (one.fold && one.children.length ? item('foldprev', one.foldPrev ? 'Nascondi anteprima dei rami' : 'Mostra anteprima dei rami') : '');
    h += item('primary', one.primary ? 'Togli “idea primaria”' : 'Imposta come idea primaria') +
      (one.children.length ? item('selbranch', 'Seleziona il ramo <span>per spostarlo tutto insieme</span>') : '');
    const P = pinsOf(one);
    pinsH = `${SEP}<div class="mhead">Pallini <span class="mnote">trascinali lungo il bordo per spostarli</span></div>` +
      item('addin', `Aggiungi un ingresso <span>ora ${P.i.length}</span>`) + item('addout', `Aggiungi un’uscita <span>ora ${P.o.length}</span>`) +
      item('addstr', `Aggiungi un pallino di struttura <span>ora ${P.s.length}</span>`) +
      (P.i.length ? item('rmin', 'Togli l’ultimo ingresso') : '') + (P.o.length ? item('rmout', 'Togli l’ultima uscita') : '') +
      (P.s.length ? item('rmstr', 'Togli l’ultimo pallino di struttura') : '') +
      (!one.primary ? item('flip', 'Scambia i lati di ingresso e uscita') : '') +
      (one.pin ? item('pinreset', 'Pallini nella posizione standard') : '');
    if (findM(t, one.id).p) h += item('detach', 'Stacca dal collegamento');
    h += SEP;
  }
  h += item('dup', `Duplica${nodes.length > 1 ? ` ${nodes.length} blocchi` : ''} <span>Ctrl+D · Alt + trascina</span>`) + item('copy', 'Copia <span>Ctrl+C</span>') +
    item('group', `Raggruppa${S.sels.size > 1 ? ` ${S.sels.size} elementi` : ''} <span>Ctrl+G</span>`);
  if (S.clip && one) h += item('paste', 'Incolla dentro questo blocco <span>Ctrl+V</span>');
  if (nodes.some(n => n.w || n.h)) h += item('autosize', 'Dimensione automatica');
  const del = nodes.length;
  h += SEP + item('del', `Elimina${del > 1 ? ` ${del} blocchi` : ''}`, ' dng') + SEP + style + pinsH;
  return h;
}
const FW = [[300, 'Leggero'], [400, 'Normale'], [500, 'Medio'], [600, 'Semigrassetto'], [700, 'Grassetto']];
function refreshStyleVals() {
  const t = curTree(), f = findM(t, S.sel); if (!f || menuEl.hidden) return;
  const l = S.L.get(f.n.id);
  const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
  const fsIn = $('#mfs'); if (fsIn && document.activeElement !== fsIn) fsIn.value = fsOf(f.n, l.depth);
  set('vbw', bwOf(f.n, l.depth) + ' px');
}
// opacità: un solo passo di annullamento per ogni trascinamento del cursore
let opArmed = true;
menuEl.addEventListener('input', e => {
  if (e.target.id !== 'mop') return;
  const v = +e.target.value / 100; $('#vop').textContent = Math.round(v * 100) + '%';
  if (opArmed) { snapshot(); opArmed = false; }
  const t = curTree(); S.sels.forEach(id => { const f = findM(t, id); if (f) { if (v >= 1) delete f.n.op; else f.n.op = v; } });
  save(); render();
});
menuEl.addEventListener('change', e => {
  if (e.target.id === 'mop') opArmed = true;
  // dimensione scritta a mano (9–48 px) e peso del carattere: valgono per tutti i blocchi selezionati
  if (e.target.id === 'mfs') { const v = Math.round(+e.target.value); if (v) { const fs = clamp(v, 9, 48); e.target.value = fs; eachSelected(n => { n.fs = fs; }); } }
  if (e.target.id === 'mfw') { const v = +e.target.value; eachSelected(n => { n.fw = v; }); }
});

// svincolo: solo pallini, rami, stacca, elimina (eliminandolo la linea si ricongiunge)
function hubMenuHtml(one, t) {
  const P = pinsOf(one);
  return `<div class="mhead">Svincolo <span class="mnote">tappa di un collegamento</span></div>` +
    item('addin', `Aggiungi un ingresso <span>ora ${P.i.length}</span>`) + item('addout', `Aggiungi un’uscita <span>ora ${P.o.length}</span>`) +
    (P.i.length > 1 ? item('rmin', 'Togli l’ultimo ingresso') : '') + (P.o.length > 1 ? item('rmout', 'Togli l’ultima uscita') : '') +
    (one.pin ? item('pinreset', 'Pallini nella posizione standard') : '') +
    (one.children.length ? item('fold', one.fold ? `Apri i rami a ventaglio <span>${countDesc(one)} blocchi</span>` : `Comprimi i rami <span>${countDesc(one)} blocchi</span>`) : '') + SEP +
    (findM(t, one.id).p ? item('detach', 'Stacca dal collegamento') : '') +
    item('del', 'Elimina svincolo <span>la linea si ricongiunge</span>', ' dng');
}

/* ---------- pallino (clic o tasto destro) ---------- */
function showPinMenu(cx, cy, id, kind, idx) {
  // uscita o struttura: si possono comprimere i blocchi che ne partono
  const n = findM(curTree(), id).n, key = kind === 'in' ? null : (kind === 'str' ? 's:' : 'o:') + idx, cnt = key ? countPin(n, key) : 0;
  const shut = key && !n.fold && (n.foldOut || []).includes(key);
  showMenu(cx + 14, cy + 14, `<div class="mhead">Pallino <span class="mnote">trascinalo per collegare o spostarlo</span></div>` +
    (cnt && !n.fold ? item('pfold', shut ? `Apri i blocchi collegati <span>${cnt}</span>` : `Comprimi i blocchi collegati <span>${cnt}</span>`) + SEP : '') +
    item('ptin', 'Ingresso', kind === 'in' ? ' on' : '') + item('ptout', 'Uscita', kind === 'out' ? ' on' : '') +
    item('ptstr', 'Struttura <span>parti del blocco</span>', kind === 'str' ? ' on' : '') + SEP +
    item('pdup', 'Duplica') + item('pdel', 'Elimina pallino', ' dng'), { kind: 'pin', id, pk: kind, idx, key });
}

/* ---------- apertura ---------- */
cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (editing) return;
  hidePreview();
  const el = document.elementFromPoint(e.clientX, e.clientY) || e.target;
  const g = el.closest('.mn[data-id]'), edge = el.closest('[data-edge]'), cn = el.closest('[data-note]'), gr = el.closest('[data-grp]');
  const an = g && el.closest('[data-anc]');
  if (an) { selectOnly(g.dataset.id); render(); return showPinMenu(e.clientX, e.clientY, g.dataset.id, an.dataset.anc, +an.dataset.idx); }
  if (g) {
    if (!S.sels.has(g.dataset.id)) selectOnly(g.dataset.id); else S.sel = g.dataset.id;
    render(); return showMenu(e.clientX, e.clientY, nodeMenuHtml(), { kind: 'node' });
  }
  if (edge) {
    const id = edge.dataset.edge, ed = edgeData(curTree(), id) || {};
    selectEdge(id); render();
    // forma e tratto valgono per tutti i collegamenti, anche quelli di struttura (di serie a puntini)
    const sh = ed.shape || 'curve', ln = lineOf(ed);
    const style = `<div class="mhead">Forma</div>` + item('curve', 'Morbida', sh === 'curve' ? ' on' : '') + item('straight', 'Dritta', sh === 'st' ? ' on' : '') +
      item('square', 'Squadrata', sh === 'sq' ? ' on' : '') +
      `<div class="mhead">Tratto</div>` + item('lsolid', 'Continuo', ln === 'solid' ? ' on' : '') + item('ldash', 'Tratteggiato', ln === 'dash' ? ' on' : '') +
      item('ldot', 'A puntini', ln === 'dot' ? ' on' : '') +
      `<div class="mrow"><span>Spessore</span><button class="st" data-st="lw" data-d="-1" aria-label="Linea più sottile">−</button><span class="val" id="vlw">${linkWidth(id)} px</span><button class="st" data-st="lw" data-d="1" aria-label="Linea più spessa">+</button></div>` + SEP;
    return showMenu(e.clientX, e.clientY, `<div class="mhead">${isStr(ed) ? 'Collegamento di struttura' : 'Collegamento'}</div>` +
      item('enote', ed.note ? 'Modifica nota' : 'Scrivi una nota') + (ed.note ? item('enotedel', 'Elimina nota') : '') +
      (ed.nx || ed.ny ? item('enotepos', 'Riporta la nota sulla linea') : '') + SEP + style +
      (isStr(ed) ? '' : item('einsert', 'Inserisci un blocco intermedio') + item('ehub', 'Inserisci uno svincolo <span>tappa della linea</span>') + SEP) +
      item('edel', 'Elimina collegamento', ' dng'), { kind: 'edge', id });
  }
  if (cn) {
    selectOnly(cn.dataset.note); render();
    return showMenu(e.clientX, e.clientY, `<div class="mhead">Nota</div>` + item('nedit', 'Modifica nota') + item('dup', 'Duplica <span>Ctrl+D · Alt + trascina</span>') +
      item('copy', 'Copia <span>Ctrl+C</span>') + item('group', 'Raggruppa <span>Ctrl+G</span>') + SEP + item('del', 'Elimina nota', ' dng'), { kind: 'note', id: cn.dataset.note });
  }
  if (gr) {
    selectOnly(gr.dataset.grp); render();
    return showMenu(e.clientX, e.clientY, `<div class="mhead">Gruppo <span class="mnote">trascinalo dal titolo o dal bordo</span></div>` + item('gedit', 'Rinomina') +
      SEP + item('ungroup', 'Sciogli il gruppo <span>i blocchi restano</span>', ' dng'), { kind: 'group', id: gr.dataset.grp });
  }
  const p = toSvg(e.clientX, e.clientY);
  clearSel(); render();
  showMenu(e.clientX, e.clientY, item('addblock', 'Aggiungi blocco') + item('addnote', 'Aggiungi nota') +
    (S.clip ? SEP + item('paste', 'Incolla qui <span>Ctrl+V</span>') : '') +
    SEP + item('fit', 'Adatta alla vista <span>tutta la mappa nello schermo</span>'), { kind: 'canvas', x: p.x, y: p.y });
});

/* ---------- azioni ---------- */
menuEl.addEventListener('click', e => {
  if (!MENU) return;
  const sw = e.target.closest('[data-c]'); if (sw) { closeMenu(); return setColor(sw.dataset.c); }
  const st = e.target.closest('[data-st]');
  if (st) { // il menu resta aperto mentre si regola lo stile
    const d = +st.dataset.d;
    if (st.dataset.st === 'lw') { // spessore del collegamento, a passi di mezzo pixel
      const w = clamp(Math.round((linkWidth(MENU.id) + d * 0.5) * 10) / 10, 0.5, 8);
      setEdge(MENU.id, { lw: w }); $('#vlw').textContent = w + ' px'; return;
    }
    if (st.dataset.st === 'fs') eachSelected((n, l) => { n.fs = clamp(fsOf(n, l.depth) + d, 9, 48); });
    else eachSelected((n, l) => { n.bw = clamp(Math.round((bwOf(n, l.depth) + d * 0.5) * 10) / 10, 0, 8); });
    return refreshStyleVals();
  }
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, M = MENU, id = M.id || S.sel;
  // forma e tratto del collegamento: il menu resta aperto, così si provano una dopo l'altra
  const SH = { curve: '', straight: 'st', square: 'sq' }, LN = ['lsolid', 'ldash', 'ldot'];
  if (a in SH || LN.includes(a)) {
    setEdge(id, a in SH ? { shape: SH[a] } : { line: a.slice(1), dash: false });
    (a in SH ? Object.keys(SH) : LN).forEach(k => menuEl.querySelector(`[data-a="${k}"]`).classList.toggle('on', k === a));
    return;
  }
  closeMenu();
  if (a === 'edit') startEdit(id, true);
  else if (a === 'fit') fit();
  else if (a === 'selbranch') selectBranch(id);
  else if (a === 'child') addChild(id);
  else if (a === 'detach') detach(id);
  else if (a === 'flip') toggleFlip(id);
  else if (a === 'primary') togglePrimary(id);
  else if (a === 'addin') addPin(id, 'in');
  else if (a === 'addout') addPin(id, 'out');
  else if (a === 'rmin') removePin(id, 'in');
  else if (a === 'rmout') removePin(id, 'out');
  else if (a === 'fold') toggleFold(id);
  else if (a === 'tag') startTagEdit(id);
  else if (a === 'tagdel') mutate(t => { const f = findM(t, id); if (f) delete f.n.tag; });
  else if (a === 'addstr') addPin(id, 'str');
  else if (a === 'rmstr') removePin(id, 'str');
  else if (a === 'ptin' || a === 'ptout' || a === 'ptstr') { const nk = a.slice(2); if (nk !== M.pk) editPin(id, M.pk, M.idx, 'type', nk); }
  else if (a === 'pfold') toggleFold(id, M.key);
  else if (a === 'pdup') editPin(id, M.pk, M.idx, 'dup');
  else if (a === 'pdel') editPin(id, M.pk, M.idx, 'del');
  else if (a === 'pinreset') resetPins(id);
  else if (a === 'einsert') insertOnLink(id);
  else if (a === 'ehub') insertOnLink(id, true);
  else if (a === 'foldprev') toggleFoldPreview(id);
  else if (a === 'autosize') autoSize();
  else if (a === 'dup') duplicateSelected();
  else if (a === 'copy') copySelected();
  else if (a === 'paste') pasteClip(M.kind === 'canvas' ? { x: M.x, y: M.y } : null);
  else if (a === 'del') removeSelected();
  else if (a === 'enote') startEdgeNote(id);
  else if (a === 'enotedel') setEdge(id, { note: '', nx: 0, ny: 0 });
  else if (a === 'enotepos') setEdge(id, { nx: 0, ny: 0 });
  else if (a === 'edel') deleteEdge(id);
  else if (a === 'nedit') startNoteEdit(id);
  else if (a === 'group') groupSelected();
  else if (a === 'gedit') startGroupEdit(id);
  else if (a === 'ungroup') ungroup(id);
  else if (a === 'addblock') addFreeBlock(M.x, M.y);
  else if (a === 'addnote') addCanvasNote(M.x, M.y);
});
menuEl.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); return closeMenu(); }
  // frecce su e giù: da una voce all'altra (non dentro i campi dello stile)
  if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || e.target.matches('input, select')) return;
  const its = [...menuEl.querySelectorAll('.it')], n = its.length; if (!n) return;
  e.preventDefault();
  const i = its.indexOf(document.activeElement);
  its[e.key === 'ArrowDown' ? (i + 1) % n : (Math.max(i, 0) - 1 + n) % n].focus();
});
document.addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('#menu'))) closeMenu(); }, true);
addEventListener('blur', closeMenu);
addEventListener('resize', closeMenu);
