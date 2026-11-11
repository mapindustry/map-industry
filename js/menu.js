// Menu del tasto destro: su un blocco, su un collegamento, su una nota, sulla tela vuota
// Struttura comune: titolo dell'oggetto (mtitle), azioni con la scorciatoia a destra, Elimina, poi le sezioni di stile
// (mhead) in fondo; i valori regolabili (−/+, forme, tratti) lasciano aperto il menu.
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
// voce: etichetta, a destra la scorciatoia o un conteggio (k), sotto una spiegazione breve (sub)
const item = (a, label, extra = '', k = '', sub = '') =>
  `<button class="it${extra}" data-a="${a}" role="menuitem"><span class="l">${label}</span>${k ? `<kbd>${k}</kbd>` : ''}${sub ? `<small>${sub}</small>` : ''}</button>`;
const SEP = '<div class="msep"></div>';
const title = (t, sub = '') => `<div class="mtitle">${t}${sub ? `<small>${sub}</small>` : ''}</div>`;
const head = t => `<div class="mhead">${t}</div>`;
const stepper = (label, st, val, id, minus, plus, extra = '') =>
  `<div class="mrow"><span>${label}</span><button class="st" data-st="${st}" data-d="-1"${extra} aria-label="${minus}">−</button><span class="val" id="${id}">${val}</span><button class="st" data-st="${st}" data-d="1"${extra} aria-label="${plus}">+</button></div>`;
// scelta tra poche opzioni con un disegno (forma e tratto del collegamento)
const seg = (label, opts) => `<div class="mrow seg"><span>${label}</span><div class="sgs">` +
  opts.map(([a, name, on, svg]) => `<button class="sg${on ? ' on' : ''}" data-a="${a}" title="${name}" aria-label="${name}" aria-pressed="${on}">${svg}</button>`).join('') + `</div></div>`;
const ico = d => `<svg viewBox="0 0 28 14" width="28" height="14" aria-hidden="true"><path d="${d}"/></svg>`;
const icoLine = da => `<svg viewBox="0 0 28 14" width="28" height="14" aria-hidden="true"><path d="M3 7H25"${da ? ` stroke-dasharray="${da}"` : ''}/></svg>`;
// in cima alla sezione Stile: copia lo stile, e incollalo se quello copiato è dello stesso tipo (blocco o collegamento)
const styleItems = (kind, n) => item('stcopy', 'Copia stile') +
  (S.style && S.style.kind === kind ? item('stpaste', n > 1 ? `Incolla stile su ${n} ${kind === 'edge' ? 'collegamenti' : 'blocchi'}` : 'Incolla stile') : '');
// tipi di blocco: [chiave, nome, disegno, titolo del menu]
const BTYPES = [
  ['text', 'Testo', ico('M5 4H23M5 7.5H23M5 11H16'), 'Blocco'],
  ['ul', 'Elenco puntato', ico('M5.5 4h0.1M5.5 10h0.1M10 4H23M10 10H23'), 'Elenco puntato'],
  ['ol', 'Elenco numerato', '<span class="sgt">1.</span>', 'Elenco numerato'],
  ['todo', 'Lista di controllo', ico('M4 3.5h6v6H4zM5.6 6.6l1.3 1.3 2-2.6M13 6.5H24'), 'Lista di controllo'],
  ['table', 'Tabella', ico('M4 2.5H24V11.5H4ZM4 5.5H24M11 2.5V11.5M17.5 2.5V11.5'), 'Tabella'],
  ['exp', 'Espandibile', ico('M4 3l3 2.5L4 8M10 5.5H24M10 10H20'), 'Blocco espandibile'],
  ['img', 'Immagine', ico('M5 2.5H23V11.5H5ZM5 11.5L11 6l4 3.5 2.5-2L23 11.5'), 'Immagine'],
  ['audio', 'Audio', ico('M5 5.5H8L12 2.5V11.5L8 8.5H5ZM15.5 4.5Q17.5 7 15.5 9.5M18.5 2.5Q22 7 18.5 11.5'), 'Audio']];
let MENU_CELL = null; // cella della tabella su cui si è aperto il menu: [riga, colonna]
const plural = (n, one, many) => n === 1 ? one : `${n} ${many}`;
// corsivo del testo (blocchi) o del titolo (gruppi): Normale | Corsivo, il menu resta aperto
const italicSeg = (p, on) => seg('Stile', [[p + '-off', 'Normale', !on, '<span class="sgt">Aa</span>'], [p + '-on', 'Corsivo', on, '<span class="sgt it">Aa</span>']]);
// fila dei colori (blocchi e gruppi); cur = colore attuale ('' = nessuno, null = misto)
const swatches = cur => `<div class="sws" role="group" aria-label="Colore">` +
  `<button class="sw none${cur === '' ? ' on' : ''}" data-c="" title="Nessun colore" aria-label="Nessun colore"></button>` +
  [0, 1, 2, 3, 4, 5].map(i => `<button class="sw c${i}${cur === String(i) ? ' on' : ''}" data-c="${i}" aria-label="Colore ${i + 1}"></button>`).join('') + `</div>`;

/* ---------- gruppo ---------- */
// azioni (rinomina, comprimi, seleziona e adatta al contenuto, blocca), Sciogli, poi lo stile: colore in alto come
// per i blocchi, bordo, spessore, sfondo, titolo. Tutto ciò che si regola lascia aperto il menu.
function groupMenuHtml(g) {
  const t = curTree(), its = groupItems(t, g), cnt = its.filter(i => i.kind !== 'group').length, ln = glineOf(g);
  const gs = [...S.sels].filter(id => findGroup(t, id)).length, fo = Math.round(gfoOf(g) * 100), ta = g.ta || 'l';
  const box = da => `<svg viewBox="0 0 28 14" width="28" height="14" aria-hidden="true"><rect x="4" y="2" width="20" height="10" rx="3"${da ? ` stroke-dasharray="${da}"` : ''}/></svg>`;
  return title('Gruppo', g.lock ? 'Bloccato: non si sposta' : 'Trascinalo dal titolo o dal bordo') + swatches(hasColor(g) ? String(g.color) : '') + SEP +
    item('gedit', 'Rinomina', '', 'F2') +
    item('gfold', g.fold ? 'Espandi il gruppo' : 'Comprimi il gruppo', '', plural(cnt, '1 elemento', 'elementi'), g.fold ? '' : 'Resta solo la barra del titolo') +
    (g.fold ? '' : item('gsel', 'Seleziona il contenuto')) + item('gfit', 'Adatta al contenuto') +
    item('glock', 'Blocca', g.lock ? ' on' : '', '', 'Il gruppo e il contenuto non si spostano') + item('legadd', 'Inserisci in legenda', '', '', 'Poi scrivi cosa significa') + SEP +
    item('ungroup', 'Sciogli il gruppo', ' dng', '', 'Toglie solo il riquadro, i blocchi restano') + SEP +
    head('Stile') + item('stcopy', 'Copia stile') + (S.style && S.style.kind === 'group' ? item('stpaste', gs > 1 ? `Incolla stile su ${gs} gruppi` : 'Incolla stile') : '') +
    seg('Bordo', [['gl-solid', 'Continuo', ln === 'solid', box('')], ['gl-dash', 'Tratteggiato', ln === 'dash', box('4 3')],
      ['gl-dot', 'A puntini', ln === 'dot', box('0.1 3')], ['gl-none', 'Nessun bordo', ln === 'none', box('0 40')]]) +
    stepper('Spessore', 'gbw', gbwOf(g) + ' px', 'vgbw', 'Bordo più sottile', 'Bordo più spesso') +
    `<div class="mrow"><span>Sfondo</span><input type="range" id="mgfo" min="0" max="60" step="2" value="${fo}" aria-label="Opacità dello sfondo del gruppo"><span class="val" id="vgfo">${fo}%</span></div>` +
    head('Titolo') + stepper('Testo', 'gfs', gfsOf(g) + ' px', 'vgfs', 'Titolo più piccolo', 'Titolo più grande') +
    `<div class="mrow wide"><span>Peso</span><select id="mgfw" aria-label="Peso del titolo">${FW.map(([v, l]) => `<option value="${v}"${gfwOf(g) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>` +
    italicSeg('gti', !!g.ti) +
    seg('Posizione', [['gta-l', 'A sinistra', ta === 'l', ico('M4 4H18M4 10H13')], ['gta-c', 'Al centro', ta === 'c', ico('M7 4H21M9.5 10H18.5')]]);
}
// gruppi su cui agiscono le regolazioni dello stile: quelli selezionati (almeno quello del menu)
const menuGroups = () => { const t = curTree(), ids = [...S.sels].filter(id => findGroup(t, id)); return ids.length ? ids : [MENU.id]; };

/* ---------- blocco ---------- */
function nodeMenuHtml() {
  const t = curTree(), nodes = [...S.sels].map(id => findM(t, id)).filter(Boolean).map(f => f.n);
  const one = nodes.length === 1 ? nodes[0] : null, prim = findM(t, S.sel) ? findM(t, S.sel).n : nodes[0], pl = S.L.get(prim.id);
  if (one && one.hub) return hubMenuHtml(one, t);
  const cur = one ? (hasColor(one) ? String(one.color) : '') : null;
  const ty = one ? (one.type || 'text') : null;
  let h = title(one ? (BTYPES.find(b => b[0] === ty) || BTYPES[0])[3] : `${nodes.length} blocchi`) + swatches(cur) +
    seg('Tipo', BTYPES.map(([k, l, ic]) => ['bt-' + k, l, ty === k, ic])) + SEP;
  if (one && one.type === 'table') {
    const rows = tableRows(one), nc = Math.max(...rows.map(r => r.length)), cl = MENU_CELL;
    h += (cl ? (rows.length > 1 ? item('trdel', 'Elimina questa riga') : '') + (nc > 1 ? item('tcdel', 'Elimina questa colonna') : '') : '') +
      stepper('Righe', 'trow', rows.length, 'vtrow', 'Togli l’ultima riga', 'Aggiungi una riga') +
      stepper('Colonne', 'tcol', nc, 'vtcol', 'Togli l’ultima colonna', 'Aggiungi una colonna') + SEP;
  }
  if (one && isMedia(one)) h += item('media', one.type === 'img' ? (one.img ? 'Cambia immagine…' : 'Scegli un’immagine…') : (one.audio ? 'Cambia audio…' : 'Scegli un audio…')) + SEP;
  if (one) {
    const nd = countDesc(one);
    h += item('edit', isMedia(one) ? (one.type === 'img' ? 'Didascalia' : 'Titolo') : 'Rinomina', '', 'F2') +
      item('tag', one.tag ? 'Modifica etichetta' : 'Aggiungi etichetta') + (one.tag ? item('tagdel', 'Togli etichetta') : '') +
      item('child', 'Aggiungi ramo', '', 'Tab') +
      item('primary', 'Idea primaria', one.primary ? ' on' : '') + SEP;
    if (one.children.length) h +=
      item('fold', one.fold ? 'Espandi i rami' : 'Comprimi i rami', '', plural(nd, '1 blocco', 'blocchi')) +
      item('selbranch', 'Seleziona il ramo') + SEP;
  }
  h += item('dup', 'Duplica', '', 'Ctrl+D') + item('copy', 'Copia', '', 'Ctrl+C') +
    (S.clip && one ? item('paste', 'Incolla dentro', '', 'Ctrl+V') : '') +
    item('group', 'Raggruppa', '', 'Ctrl+G') + item('legadd', 'Inserisci in legenda', '', '', 'Poi scrivi cosa significa') + SEP +
    (one && findM(t, one.id).p ? item('detach', 'Stacca dal collegamento') : '') +
    item('del', nodes.length > 1 ? `Elimina ${nodes.length} blocchi` : 'Elimina', ' dng', 'Canc');
  // più blocchi (o note) selezionati: allinea e spazia, il menu resta aperto per provarne più d'uno
  const many = [...S.sels].filter(id => S.L.has(id) || S.NL.has(id)).length;
  if (many > 1) h += SEP + head('Disponi') +
    seg('Colonna', [['al', 'Allinea a sinistra', false, ico('M4 1V13M8 4.5H23M8 9.5H17')], ['ac', 'Centra in colonna', false, ico('M14 1V13M6 4.5H22M9 9.5H19')],
      ['ar', 'Allinea a destra', false, ico('M24 1V13M5 4.5H20M11 9.5H20')]]) +
    seg('Riga', [['at', 'Allinea in alto', false, ico('M6 1.5H22M10.5 4.5V12.5M17.5 4.5V9')], ['am', 'Centra in riga', false, ico('M6 7H22M10.5 2V12M17.5 4V10')],
      ['ab', 'Allinea in basso', false, ico('M6 12.5H22M10.5 1.5V9.5M17.5 5V9.5')]]) +
    (many > 2 ? seg('Spazia', [['dh', 'Stessa distanza in orizzontale', false, ico('M3 2V12M25 2V12M10 4.5V9.5M18 4.5V9.5')],
      ['dv', 'Stessa distanza in verticale', false, ico('M8 1.5H20M8 12.5H20M11 5.2H17M11 8.8H17')]]) : '');
  // stile e pallini in fondo: il menu è lungo, le azioni restano in vista
  const op =Math.round((prim.op ?? 1) * 100);
  h += SEP + head('Stile') + styleItems('node', nodes.length) +
    `<div class="mrow"><span>Testo</span><button class="st" data-st="fs" data-d="-1" aria-label="Testo più piccolo">−</button><span class="numw"><input type="number" class="num" id="mfs" min="9" max="48" step="1" value="${fsOf(prim, pl.depth)}" aria-label="Dimensione del testo in px"> px</span><button class="st" data-st="fs" data-d="1" aria-label="Testo più grande">+</button></div>
    <div class="mrow wide"><span>Peso</span><select id="mfw" aria-label="Peso del carattere">${FW.map(([v, t]) => `<option value="${v}"${fwOf(prim, pl.depth) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>` +
    italicSeg('it', !!prim.it) +
    stepper('Bordo', 'bw', bwOf(prim, pl.depth) + ' px', 'vbw', 'Bordo più sottile', 'Bordo più spesso') +
    `<div class="mrow"><span>Opacità</span><input type="range" id="mop" min="10" max="100" step="5" value="${op}" aria-label="Opacità del blocco"><span class="val" id="vop">${op}%</span></div>` +
    (nodes.some(n => n.w || n.h) ? item('autosize', 'Dimensione automatica') : '');
  if (one) h += SEP + pinsHtml(one, 0) +
    (!one.primary ? item('flip', 'Scambia ingresso e uscita') : '') +
    (one.pin ? item('pinreset', 'Pallini nella posizione standard') : '');
  return h;
}
// pallini come contatori: −/+ toglie l'ultimo o ne aggiunge uno (il menu resta aperto); min = minimo per tipo
function pinsHtml(n, min) {
  const P = pinsOf(n), row = (k, label, cnt) => stepper(label, 'pin', cnt, 'vp' + k, `Togli un pallino (${label})`, `Aggiungi un pallino (${label})`, ` data-k="${k}"`);
  return head('Pallini') + row('in', 'Ingressi', P.i.length) + row('out', 'Uscite', P.o.length) + (min ? '' : row('str', 'Struttura', P.s.length));
}
const FW = [[300, 'Leggero'], [400, 'Normale'], [500, 'Medio'], [600, 'Semigrassetto'], [700, 'Grassetto']];
function refreshStyleVals() {
  const t = curTree(), f = findM(t, S.sel); if (!f || menuEl.hidden) return;
  const l = S.L.get(f.n.id);
  const set = (id, v) => { const el = $('#' + id); if (el) el.textContent = v; };
  const fsIn = $('#mfs'); if (fsIn && document.activeElement !== fsIn) fsIn.value = fsOf(f.n, l.depth);
  set('vbw', bwOf(f.n, l.depth) + ' px');
  const P = pinsOf(f.n); set('vpin', P.i.length); set('vpout', P.o.length); set('vpstr', P.s.length);
}
// opacità: un solo passo di annullamento per ogni trascinamento del cursore
let opArmed = true;
menuEl.addEventListener('input', e => {
  if (e.target.id === 'meop') { // opacità del collegamento: come quella dei blocchi, un passo di annullamento per gesto
    const v = +e.target.value / 100; $('#veop').textContent = Math.round(v * 100) + '%';
    if (opArmed) { snapshot(); opArmed = false; }
    const t = curTree();
    edgeTargets(MENU.id).forEach(key => {
      const ed = edgeData(t, key, true); if (!ed) return;
      if (v >= 1) delete ed.op; else ed.op = v;
      if (!key.startsWith('x:')) { const f = findM(t, key); if (f && f.n.edge && !Object.keys(f.n.edge).length) delete f.n.edge; }
    });
    save(); render(); return;
  }
  if (e.target.id === 'mgfo') { // opacità dello sfondo del gruppo
    const v = +e.target.value / 100; $('#vgfo').textContent = Math.round(v * 100) + '%';
    if (opArmed) { snapshot(); opArmed = false; }
    const t = curTree(); menuGroups().forEach(id => { const g = findGroup(t, id); if (g) { if (v === GDEF.fo) delete g.fo; else g.fo = v; } });
    save(); render(); return;
  }
  if (e.target.id !== 'mop') return;
  const v = +e.target.value / 100; $('#vop').textContent = Math.round(v * 100) + '%';
  if (opArmed) { snapshot(); opArmed = false; }
  const t = curTree(); S.sels.forEach(id => { const f = findM(t, id); if (f) { if (v >= 1) delete f.n.op; else f.n.op = v; } });
  save(); render();
});
menuEl.addEventListener('change', e => {
  if (e.target.id === 'mop' || e.target.id === 'meop' || e.target.id === 'mgfo') opArmed = true;
  if (e.target.id === 'mgfw') setGroupStyle({ tfw: +e.target.value }, menuGroups());
  // dimensione scritta a mano (9–48 px) e peso del carattere: valgono per tutti i blocchi selezionati
  if (e.target.id === 'mfs') { const v = Math.round(+e.target.value); if (v) { const fs = clamp(v, 9, 48); e.target.value = fs; eachSelected(n => { n.fs = fs; }); } }
  if (e.target.id === 'mfw') { const v = +e.target.value; eachSelected(n => { n.fw = v; }); }
});

// svincolo: rami, stacca, elimina (eliminandolo la linea si ricongiunge), pallini in fondo (almeno uno per tipo)
function hubMenuHtml(one, t) {
  return title('Svincolo', 'Tappa di un collegamento') +
    (one.children.length ? item('fold', one.fold ? 'Espandi i rami' : 'Comprimi i rami', '', plural(countDesc(one), '1 blocco', 'blocchi')) + SEP : '') +
    (findM(t, one.id).p ? item('detach', 'Stacca dal collegamento') : '') +
    item('del', 'Elimina svincolo', ' dng', 'Canc', 'La linea si ricongiunge') + SEP +
    pinsHtml(one, 1) + (one.pin ? item('pinreset', 'Pallini nella posizione standard') : '');
}

/* ---------- pallino (clic o tasto destro) ---------- */
function showPinMenu(cx, cy, id, kind, idx) {
  // uscita o struttura: si possono comprimere i blocchi che ne partono
  const n = findM(curTree(), id).n, key = kind === 'in' ? null : (kind === 'str' ? 's:' : 'o:') + idx, cnt = key ? countPin(n, key) : 0;
  const shut = key && !n.fold && (n.foldOut || []).includes(key);
  const TY = [['ptin', 'Ingresso', 'in'], ['ptout', 'Uscita', 'out'], ['ptstr', 'Struttura', 'str']];
  showMenu(cx + 14, cy + 14, title('Pallino', 'Trascinalo per collegare o per spostarlo') +
    (cnt && !n.fold ? item('pfold', shut ? 'Espandi i blocchi collegati' : 'Comprimi i blocchi collegati', '', String(cnt)) + SEP : '') +
    head('Tipo') + TY.map(([a, l, k]) => item(a, l, kind === k ? ' on' : '')).join('') + SEP +
    item('pdup', 'Duplica') + item('pdel', 'Elimina pallino', ' dng'), { kind: 'pin', id, pk: kind, idx, key });
}

/* ---------- apertura ---------- */
cv.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (editing) return;
  hidePreview();
  if (readOnly()) {
    const el0 = document.elementFromPoint(e.clientX, e.clientY) || e.target, g0 = el0.closest('.mn[data-id]');
    if (g0) { selectOnly(g0.dataset.id); render(); }
    return showMenu(e.clientX, e.clientY, title('Sola lettura', 'La mappa è bloccata') + (g0 ? item('copy', 'Copia', '', 'Ctrl+C') : '') +
      item('fit', 'Adatta alla vista') + SEP + item('unlock', 'Sblocca per modificare'), { kind: 'ro' });
  }
  const el = document.elementFromPoint(e.clientX, e.clientY) || e.target;
  const g = el.closest('.mn[data-id]'), edge = el.closest('[data-edge]'), cn = el.closest('[data-note]'), gr = el.closest('[data-grp]');
  const an = g && el.closest('[data-anc]'), lg = el.closest('[data-leg]');
  if (lg) { // legenda: opzioni della riga sotto il puntatore e della legenda
    const row = el.closest('[data-lrow]'); selectOnly(LEG); render();
    return showMenu(e.clientX, e.clientY, legendMenuHtml(row && row.dataset.lrow), { kind: 'legend', id: LEG, row: row && row.dataset.lrow });
  }
  if (an) { selectOnly(g.dataset.id); render(); return showPinMenu(e.clientX, e.clientY, g.dataset.id, an.dataset.anc, +an.dataset.idx); }
  if (g) {
    MENU_CELL = cellAt(g.dataset.id, toSvg(e.clientX, e.clientY)); // cella della tabella sotto il puntatore (anche sul testo)
    if (!S.sels.has(g.dataset.id)) selectOnly(g.dataset.id); else S.sel = g.dataset.id;
    render(); return showMenu(e.clientX, e.clientY, nodeMenuHtml(), { kind: 'node' });
  }
  if (edge) {
    const id = edge.dataset.edge, ed = edgeData(curTree(), id) || {};
    // fa parte di più collegamenti presi col riquadro: la selezione resta e lo stile vale per tutti
    const many = S.esels.size > 1 && S.esels.has(id);
    if (many) S.esel = id; else selectEdge(id);
    render();
    // forma e tratto valgono per tutti i collegamenti, anche quelli di struttura (di serie a puntini)
    const sh = ed.shape || 'curve', ln = lineOf(ed);
    // colore: uguale per tutti i presi col riquadro, altrimenti nessuno spuntato (misto)
    const cols = edgeTargets(id).map(k => { const x = edgeData(curTree(), k) || {}; return hasColor(x) ? String(x.color) : ''; });
    const ecol = swatches(cols.every(c => c === cols[0]) ? cols[0] : null);
    return showMenu(e.clientX, e.clientY, (many ? title(S.esels.size + ' collegamenti', 'Lo stile vale per tutti') + ecol + SEP + head('Stile') + styleItems('edge', S.esels.size) :
      title(isStr(ed) ? 'Collegamento di struttura' : 'Collegamento') + ecol + SEP +
      item('enote', ed.note ? 'Modifica nota' : 'Scrivi una nota', '', 'Doppio clic') + (ed.note ? item('enotedel', 'Togli la nota') : '') +
      (ed.nx || ed.ny ? item('enotepos', 'Riporta la nota sulla linea') : '') +
      (isStr(ed) ? '' : SEP + item('einsert', 'Inserisci un blocco intermedio') + item('ehub', 'Inserisci uno svincolo')) + SEP +
      item('legadd', 'Inserisci in legenda', '', '', 'Poi scrivi cosa significa') + SEP +
      item('edel', 'Elimina collegamento', ' dng', 'Canc') + SEP + head('Stile') + styleItems('edge', 1)) +
      seg('Forma', [['curve', 'Morbida', sh === 'curve', ico('M3 11C13 11 15 3 25 3')], ['straight', 'Dritta', sh === 'st', ico('M3 11L25 3')],
        ['square', 'Squadrata', sh === 'sq', ico('M3 11H14V3H25')]]) +
      seg('Tratto', [['lsolid', 'Continuo', ln === 'solid', icoLine('')], ['ldash', 'Tratteggiato', ln === 'dash', icoLine('5 3')],
        ['ldot', 'A puntini', ln === 'dot', icoLine('0.1 4')]]) +
      stepper('Spessore', 'lw', linkWidth(id) + ' px', 'vlw', 'Linea più sottile', 'Linea più spessa') +
      // distanza tra puntini o trattini: solo con un tratto non continuo (la riga compare cambiando tratto)
      `<div id="rgap"${ln === 'solid' ? ' hidden' : ''}>${stepper('Distanza', 'gap', gapOf(ed) + ' px', 'vgap', 'Puntini più vicini', 'Puntini più distanti')}</div>` +
      `<div class="mrow"><span>Opacità</span><input type="range" id="meop" min="10" max="100" step="5" value="${Math.round(eopOf(ed) * 100)}" aria-label="Opacità del collegamento"><span class="val" id="veop">${Math.round(eopOf(ed) * 100)}%</span></div>`, { kind: 'edge', id });
  }
  if (cn) {
    selectOnly(cn.dataset.note); render();
    return showMenu(e.clientX, e.clientY, title('Nota') + item('nedit', 'Modifica', '', 'F2') + SEP +
      item('dup', 'Duplica', '', 'Ctrl+D') + item('copy', 'Copia', '', 'Ctrl+C') + item('group', 'Raggruppa', '', 'Ctrl+G') + item('legadd', 'Inserisci in legenda', '', '', 'Poi scrivi cosa significa') + SEP +
      item('del', 'Elimina nota', ' dng', 'Canc'), { kind: 'note', id: cn.dataset.note });
  }
  if (gr) {
    const id = gr.dataset.grp; if (!S.sels.has(id)) selectOnly(id); else S.sel = id;
    render(); return showMenu(e.clientX, e.clientY, groupMenuHtml(findGroup(curTree(), id)), { kind: 'group', id });
  }
  const p = toSvg(e.clientX, e.clientY);
  clearSel(); render();
  showMenu(e.clientX, e.clientY, item('addblock', 'Aggiungi blocco') + item('addnote', 'Aggiungi nota') +
    (S.clip ? item('paste', 'Incolla qui', '', 'Ctrl+V') : '') +
    SEP + item('fit', 'Adatta alla vista'), { kind: 'canvas', x: p.x, y: p.y });
});

/* ---------- azioni ---------- */
menuEl.addEventListener('click', e => {
  if (!MENU) return;
  const sw = e.target.closest('[data-c]');
  if (sw) {
    if (MENU.kind === 'edge') { // colore dei collegamenti: il menu resta aperto, per provarne più d'uno
      setEdgeStyle(MENU.id, { color: sw.dataset.c === '' ? null : +sw.dataset.c });
      sw.parentNode.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === sw)); return;
    }
    if (MENU.kind === 'group') { const ids = menuGroups(); closeMenu(); return setGroupStyle({ color: sw.dataset.c === '' ? null : +sw.dataset.c }, ids); }
    closeMenu(); return setColor(sw.dataset.c);
  }
  const st = e.target.closest('[data-st]');
  if (st) { // il menu resta aperto mentre si regola lo stile
    const d = +st.dataset.d;
    if (st.dataset.st === 'trow' || st.dataset.st === 'tcol') { // righe e colonne della tabella
      const r = st.dataset.st === 'trow'; resizeTable(S.sel, r ? d : 0, r ? 0 : d);
      const rows = tableRows(findM(curTree(), S.sel).n); $('#vtrow').textContent = rows.length; $('#vtcol').textContent = Math.max(...rows.map(x => x.length)); return;
    }
    if (st.dataset.st === 'gbw' || st.dataset.st === 'gfs') { // gruppo: spessore del bordo (½ px) e dimensione del titolo
      const g = findGroup(curTree(), MENU.id), bw = st.dataset.st === 'gbw';
      const v = bw ? clamp(Math.round((gbwOf(g) + d * 0.5) * 10) / 10, 0.5, 6) : clamp(gfsOf(g) + d, 9, 36);
      setGroupStyle(bw ? { bw: v } : { tfs: v }, menuGroups()); $(bw ? '#vgbw' : '#vgfs').textContent = v + ' px'; return;
    }
    if (st.dataset.st === 'lw') { // spessore del collegamento, a passi di mezzo pixel
      const w = clamp(Math.round((linkWidth(MENU.id) + d * 0.5) * 10) / 10, 0.5, 8);
      setEdgeStyle(MENU.id, { lw: w }); $('#vlw').textContent = w + ' px'; return;
    }
    if (st.dataset.st === 'gap') { // distanza tra puntini o trattini, a passi di 1 px
      const g = clamp(gapOf(linkData(MENU.id)) + d, 2, 30);
      setEdgeStyle(MENU.id, { gap: g }); $('#vgap').textContent = g + ' px'; return;
    }
    if (st.dataset.st === 'pin') { // contatore dei pallini: −/+ toglie l'ultimo o ne aggiunge uno
      const k = st.dataset.k, n = findM(curTree(), MENU.id || S.sel).n, len = pinsOf(n)[PK[k]].length;
      if (d > 0) addPin(n.id, k); else if (len > (n.hub ? 1 : 0)) removePin(n.id, k); else return;
      return refreshStyleVals();
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
    setEdgeStyle(id, a in SH ? { shape: SH[a] } : { line: a.slice(1), dash: false });
    (a in SH ? Object.keys(SH) : LN).forEach(k => { const x = menuEl.querySelector(`[data-a="${k}"]`); x.classList.toggle('on', k === a); x.setAttribute('aria-pressed', k === a); });
    if (LN.includes(a)) $('#rgap').hidden = a === 'lsolid';
    return;
  }
  if (a in ARRANGE) return arrangeSelected(a); // allinea / spazia: il menu resta aperto
  // bordo e posizione del titolo del gruppo: il menu resta aperto
  if (a === 'it-on' || a === 'it-off') { // corsivo dei blocchi selezionati
    eachSelected(n => { if (a === 'it-on') n.it = true; else delete n.it; });
    b.closest('.sgs').querySelectorAll('.sg').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    return;
  }
  if (a.startsWith('bt-')) { // tipo di blocco: il menu si ricostruisce (cambiano le voci della tabella)
    setBlockType(a.slice(3)); const x = menuEl.style.left, y = menuEl.style.top;
    menuEl.innerHTML = nodeMenuHtml(); menuEl.style.left = x; menuEl.style.top = y; return;
  }
  if (a.startsWith('lc-')) { // angolo della legenda: il menu resta aperto
    setLegendCorner(a.slice(3));
    b.closest('.sgs').querySelectorAll('.sg').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    return;
  }
  if (a.startsWith('gl-') || a.startsWith('gta-') || a.startsWith('gti-')) {
    setGroupStyle(a.startsWith('gl-') ? { line: a.slice(3) } : a.startsWith('gti-') ? { ti: a === 'gti-on' } : { ta: a.slice(4) }, menuGroups());
    b.closest('.sgs').querySelectorAll('.sg').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    return;
  }
  closeMenu();
  if (a === 'edit') startEdit(id, true);
  if (a === 'media') pickMedia(id);
  else if (a === 'fit') fit();
  else if (a === 'selbranch') selectBranch(id);
  else if (a === 'child') addChild(id);
  else if (a === 'detach') detach(id);
  else if (a === 'flip') toggleFlip(id);
  else if (a === 'primary') togglePrimary(id);
  else if (a === 'fold') toggleFold(id);
  else if (a === 'tag') startTagEdit(id);
  else if (a === 'tagdel') mutate(t => { const f = findM(t, id); if (f) delete f.n.tag; });
  else if (a === 'ptin' || a === 'ptout' || a === 'ptstr') { const nk = a.slice(2); if (nk !== M.pk) editPin(id, M.pk, M.idx, 'type', nk); }
  else if (a === 'pfold') toggleFold(id, M.key);
  else if (a === 'pdup') editPin(id, M.pk, M.idx, 'dup');
  else if (a === 'pdel') editPin(id, M.pk, M.idx, 'del');
  else if (a === 'pinreset') resetPins(id);
  else if (a === 'einsert') insertOnLink(id);
  else if (a === 'ehub') insertOnLink(id, true);
  else if (a === 'autosize') autoSize();
  else if (a === 'dup') duplicateSelected();
  else if (a === 'copy') copySelected();
  else if (a === 'stcopy') copyStyle();
  else if (a === 'stpaste') pasteStyle();
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
  else if (a === 'unlock') toggleLock();
  else if (a === 'trdel' || a === 'tcdel') deleteTableLine(S.sel, MENU_CELL[0], MENU_CELL[1], a === 'trdel' ? 'row' : 'col');
  else if (a === 'legadd') addToLegend();
  else if (a === 'lredit') startLegendEdit(M.row);
  else if (a === 'lrup' || a === 'lrdown') moveLegendRow(M.row, a === 'lrup' ? -1 : 1);
  else if (a === 'lrdel') removeLegendRow(M.row);
  else if (a === 'ltitle') startLegendTitle();
  else if (a === 'ldel') deleteLegend();
  else if (a === 'gfold') toggleGroupFold(id);
  else if (a === 'gsel') selectGroupContents(id);
  else if (a === 'gfit') fitGroup(id);
  else if (a === 'glock') toggleGroupLock(id);
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
