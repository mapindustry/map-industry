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
const item = (a, label, extra = '') => `<button class="it${extra}" data-a="${a}">${label}</button>`;
const SEP = '<div class="msep"></div>';

/* ---------- blocco ---------- */
function nodeMenuHtml() {
  const t = curTree(), nodes = [...S.sels].map(id => findM(t, id)).filter(Boolean).map(f => f.n);
  const one = nodes.length === 1 ? nodes[0] : null, prim = findM(t, S.sel) ? findM(t, S.sel).n : nodes[0], pl = S.L.get(prim.id);
  const cur = one ? (hasColor(one) ? String(one.color) : '') : null;
  let h = `<div class="mhead">${one ? 'Colore' : `Colore di ${nodes.length} blocchi`}</div><div class="sws">` +
    `<button class="sw none${cur === '' ? ' on' : ''}" data-c="" title="Nessun colore" aria-label="Nessun colore"></button>` +
    [0, 1, 2, 3, 4, 5].map(i => `<button class="sw c${i}${cur === String(i) ? ' on' : ''}" data-c="${i}" aria-label="Colore ${i + 1}"></button>`).join('') + `</div>`;
  const op = Math.round((prim.op ?? 1) * 100);
  h += `<div class="mhead">Stile</div>
    <div class="mrow"><span>Testo</span><button class="st" data-st="fs" data-d="-1" aria-label="Testo più piccolo">−</button><span class="val" id="vfs">${fsOf(prim, pl.depth)} px</span><button class="st" data-st="fs" data-d="1" aria-label="Testo più grande">+</button></div>
    <div class="mrow"><span>Bordo</span><button class="st" data-st="bw" data-d="-1" aria-label="Bordo più sottile">−</button><span class="val" id="vbw">${bwOf(prim, pl.depth)} px</span><button class="st" data-st="bw" data-d="1" aria-label="Bordo più spesso">+</button></div>
    <div class="mrow"><span>Opacità</span><input type="range" id="mop" min="10" max="100" step="5" value="${op}" aria-label="Opacità del blocco"><span class="val" id="vop">${op}%</span></div>` + SEP;
  if (one) {
    h += item('edit', 'Rinomina') +
      item('tag', one.tag ? 'Modifica etichetta' : 'Aggiungi etichetta <span>sigla o nota breve</span>') + (one.tag ? item('tagdel', 'Togli etichetta') : '') +
      item('child', 'Aggiungi ramo figlio') +
      (one.children.length ? item('fold', one.fold ? `Apri i rami a ventaglio <span>${countDesc(one)} blocchi</span>` : `Comprimi i rami nel blocco <span>${countDesc(one)} blocchi</span>`) : '') +
      (one.fold && one.children.length ? item('foldprev', one.foldPrev ? 'Nascondi anteprima dei rami' : 'Mostra anteprima dei rami') : '');
    h += item('primary', one.primary ? 'Togli “idea primaria”' : 'Imposta come idea primaria');
    const P = pinsOf(one);
    h += `${SEP}<div class="mhead">Pallini <span class="mnote">trascinali lungo il bordo per spostarli</span></div>` +
      item('addin', `Aggiungi un ingresso <span>ora ${P.i.length}</span>`) + item('addout', `Aggiungi un’uscita <span>ora ${P.o.length}</span>`) +
      item('addstr', `Aggiungi un pallino di struttura <span>ora ${P.s.length}</span>`) +
      (P.i.length ? item('rmin', 'Togli l’ultimo ingresso') : '') + (P.o.length ? item('rmout', 'Togli l’ultima uscita') : '') +
      (P.s.length ? item('rmstr', 'Togli l’ultimo pallino di struttura') : '') +
      (!one.primary ? item('flip', 'Scambia i lati di ingresso e uscita') : '') +
      (one.pin ? item('pinreset', 'Pallini nella posizione standard') : '') + SEP;
    if (findM(t, one.id).p) h += item('detach', 'Stacca dal collegamento');
  }
  h += item('dup', `Duplica${nodes.length > 1 ? ` ${nodes.length} blocchi` : ''} <span>Ctrl+D · Alt + trascina</span>`) + item('copy', 'Copia <span>Ctrl+C</span>') +
    item('group', `Raggruppa${S.sels.size > 1 ? ` ${S.sels.size} elementi` : ''} <span>Ctrl+G</span>`);
  if (S.clip && one) h += item('paste', 'Incolla dentro questo blocco <span>Ctrl+V</span>');
  if (nodes.some(n => n.w || n.h)) h += item('autosize', 'Dimensione automatica');
  const del = nodes.length;
  h += SEP + item('del', `Elimina${del > 1 ? ` ${del} blocchi` : ''}`, ' dng');
  return h;
}
function refreshStyleVals() {
  const t = curTree(), f = findM(t, S.sel); if (!f || menuEl.hidden) return;
  const l = S.L.get(f.n.id);
  const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
  set('vfs', fsOf(f.n, l.depth) + ' px'); set('vbw', bwOf(f.n, l.depth) + ' px');
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
menuEl.addEventListener('change', e => { if (e.target.id === 'mop') opArmed = true; });

/* ---------- pallino (clic o tasto destro) ---------- */
function showPinMenu(cx, cy, id, kind, idx) {
  // uscita o struttura: si possono comprimere i blocchi che ne partono
  const n = findM(curTree(), id).n, key = kind === 'in' ? null : (kind === 'str' ? 's:' : 'o:') + idx, cnt = key ? countPin(n, key) : 0;
  const shut = key && !n.fold && (n.foldOut || []).includes(key);
  showMenu(cx, cy, `<div class="mhead">Pallino <span class="mnote">trascinalo per collegare o spostarlo</span></div>` +
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
    if (isStr(ed)) return showMenu(e.clientX, e.clientY, `<div class="mhead">Collegamento di struttura</div>` +
      item('enote', ed.note ? 'Modifica nota' : 'Scrivi una nota') + (ed.note ? item('enotedel', 'Elimina nota') : '') +
      (ed.nx || ed.ny ? item('enotepos', 'Riporta la nota sulla linea') : '') + SEP +
      item('curve', 'Linea morbida', ed.shape === 'sq' ? '' : ' on') + item('square', 'Linea squadrata', ed.shape === 'sq' ? ' on' : '') + SEP +
      item('edel', 'Elimina collegamento', ' dng'), { kind: 'edge', id });
    return showMenu(e.clientX, e.clientY, `<div class="mhead">Collegamento</div>` +
      item('enote', ed.note ? 'Modifica nota' : 'Scrivi una nota') + (ed.note ? item('enotedel', 'Elimina nota') : '') +
      (ed.nx || ed.ny ? item('enotepos', 'Riporta la nota sulla linea') : '') + SEP +
      item('solid', 'Linea continua', ed.dash ? '' : ' on') + item('dash', 'Linea tratteggiata', ed.dash ? ' on' : '') + SEP +
      item('curve', 'Linea morbida', ed.shape === 'sq' ? '' : ' on') + item('square', 'Linea squadrata', ed.shape === 'sq' ? ' on' : '') + SEP +
      item('einsert', 'Inserisci un blocco intermedio') + SEP +
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
    (S.clip ? SEP + item('paste', 'Incolla qui <span>Ctrl+V</span>') : ''), { kind: 'canvas', x: p.x, y: p.y });
});

/* ---------- azioni ---------- */
menuEl.addEventListener('click', e => {
  if (!MENU) return;
  const sw = e.target.closest('[data-c]'); if (sw) { closeMenu(); return setColor(sw.dataset.c); }
  const st = e.target.closest('[data-st]');
  if (st) { // il menu resta aperto mentre si regola lo stile
    const d = +st.dataset.d;
    if (st.dataset.st === 'fs') eachSelected((n, l) => { n.fs = clamp(fsOf(n, l.depth) + d, 9, 48); });
    else eachSelected((n, l) => { n.bw = clamp(Math.round((bwOf(n, l.depth) + d * 0.5) * 10) / 10, 0, 8); });
    return refreshStyleVals();
  }
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, M = MENU, id = M.id || S.sel; closeMenu();
  if (a === 'edit') startEdit(id, true);
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
  else if (a === 'solid') setEdge(id, { dash: false });
  else if (a === 'dash') setEdge(id, { dash: true });
  else if (a === 'curve') setEdge(id, { shape: '' });
  else if (a === 'square') setEdge(id, { shape: 'sq' });
  else if (a === 'nedit') startNoteEdit(id);
  else if (a === 'group') groupSelected();
  else if (a === 'gedit') startGroupEdit(id);
  else if (a === 'ungroup') ungroup(id);
  else if (a === 'addblock') addFreeBlock(M.x, M.y);
  else if (a === 'addnote') addCanvasNote(M.x, M.y);
});
menuEl.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } });
document.addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('#menu'))) closeMenu(); }, true);
addEventListener('blur', closeMenu);
addEventListener('resize', closeMenu);
