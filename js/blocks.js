// Tipi di blocco (n.type): testo (di serie, nessun campo), 'ul' elenco puntato, 'ol' elenco numerato,
// 'todo' lista di controllo, 'table' tabella. Si sceglie dal menu del blocco (Tipo).
// - Elenchi: ogni riga del testo (Maiusc+Invio, o Invio mentre si scrive un elenco) è una voce; il segno sta a
//   sinistra e le voci vanno a capo allineate. Lista di controllo: n.done = testi delle voci spuntate (così restano
//   giuste anche se le voci cambiano ordine); clic sulla casella = spunta.
// - Tabella: n.table = { rows: [[cella, …], …] }, la prima riga è l'intestazione; n.text è il titolo sopra la
//   tabella (vuoto = niente titolo). Doppio clic su una cella per scriverla, Tab passa alla successiva (dall'ultima
//   aggiunge una riga). Righe e colonne dal menu. La tabella si misura da sola (niente maniglia di ridimensionamento).
// - Espandibile ('exp'): titolo (n.text) con una freccina; aperto (n.open) mostra sotto il testo (n.body) più piccolo.
//   Clic sulla freccina = apre/chiude (anche in sola lettura); doppio clic sul testo per scriverlo (Invio = a capo,
//   Ctrl+Invio o clic fuori per finire).
const LISTS = { ul: 1, ol: 1, todo: 1 };
const isList = n => !!(n && LISTS[n.type]);
const listItems = n => { const it = String(n.text || '').split('\n').filter(s => s.trim()); return it.length ? it : ['']; };
const isDone = (n, s) => (n.done || []).includes(s);

/* ---------- misure ---------- */
function listSize(n, lv, fs, font, lh, padX, padY) {
  const items = listItems(n);
  const mw = n.type === 'ol' ? Math.ceil(tw(items.length + '.', font)) + 8 : n.type === 'todo' ? Math.round(fs) + 7 : Math.round(fs * 0.6) + 8;
  const maxW = Math.max(40, (n.w ? n.w - padX : 260) - mw);
  let rows = [];
  items.forEach((s, k) => wrap(s, maxW, font, 3).forEach((t, j) => rows.push({ t, k, first: j === 0 })));
  const maxR = n.h ? Math.max(1, Math.floor((n.h - padY + 4) / lh)) : 40;
  if (rows.length > maxR) { rows = rows.slice(0, maxR); rows[maxR - 1].t = ell(rows[maxR - 1].t + '…', maxW, font); }
  const w = n.w || Math.max(Math.max(...rows.map(r => tw(r.t, font))) + mw + padX, 100);
  return { lines: rows.map(r => r.t), rows, items, mw, lh, w, h: n.h || rows.length * lh + padY, padX };
}
const tableRows = n => (n.table && n.table.rows && n.table.rows.length ? n.table.rows : [['Colonna 1', 'Colonna 2'], ['', '']]);
const cellFont = (n, fs, head) => `${n.it ? 'italic ' : ''}${head ? 600 : 400} ${fs}px ${FB}`;
function tableSize(n, lv, fs, font, lh) {
  const rows = tableRows(n), nc = Math.max(...rows.map(r => r.length)), cfs = Math.max(10, fs - 1);
  const colW = [];
  for (let c = 0; c < nc; c++) colW.push(Math.min(240, Math.max(56, ...rows.map((r, i) => tw(r[c] || '', cellFont(n, cfs, i === 0)) + 18))));
  const rowH = Math.round(cfs * 1.28) + 10, title = n.text ? ell(n.text, 420, font) : '', titleH = title ? lh + 14 : 0;
  let w = colW.reduce((a, b) => a + b, 0);
  if (title && tw(title, font) + 28 > w) { colW[nc - 1] += tw(title, font) + 28 - w; w = tw(title, font) + 28; }
  const colX = []; colW.reduce((x, cw, i) => (colX[i] = x) + cw, 0);
  return { lines: title ? [title] : [], lh, w: Math.ceil(w), h: titleH + rows.length * rowH, tb: { rows, nc, colX, colW, rowH, titleH, cfs } };
}

/* ---------- disegno ---------- */
function listMarkup(n, l, live, fsSt) {
  const fs = fsOf(n, l.depth), x0 = l.padX / 2, pad = (l.h - l.rows.length * l.lh) / 2;
  return l.rows.map((r, i) => {
    const y = pad + (i + 0.76) * l.lh, item = l.items[r.k], done = n.type === 'todo' && isDone(n, item);
    let mark = '';
    if (r.first) {
      if (n.type === 'ul') mark = `<circle class="lmark" cx="${x0 + 4}" cy="${y - fs * 0.33}" r="${Math.max(2, fs * 0.15)}"/>`;
      else if (n.type === 'ol') mark = `<text class="lnum" x="${x0 + l.mw - 7}" y="${y}" text-anchor="end"${fsSt}>${r.k + 1}.</text>`;
      else {
        const s = Math.round(fs * 0.9), by = y - s * 0.86;
        mark = `<g class="chk${done ? ' on' : ''}"${live ? ` data-chk="${r.k}"` : ''}>${live ? `<title>${done ? 'Togli la spunta' : 'Spunta'}</title>` : ''}` +
          `<rect x="${x0}" y="${by}" width="${s}" height="${s}" rx="3"/>` +
          (done ? `<path d="M${x0 + s * 0.22},${by + s * 0.52} L${x0 + s * 0.42},${by + s * 0.72} L${x0 + s * 0.8},${by + s * 0.28}"/>` : '') + `</g>`;
      }
    }
    return mark + `<text class="litem${done ? ' done' : ''}" x="${x0 + l.mw}" y="${y}"${fsSt}>${esc(r.t)}</text>`;
  }).join('');
}
function tableMarkup(n, l, live, fsSt) {
  const T = l.tb, fs = fsOf(n, l.depth);
  let s = l.lines.length ? `<text x="${l.w / 2}" y="${T.titleH / 2 + fs * 0.36}" text-anchor="middle"${fsSt}>${esc(l.lines[0])}</text>` : '';
  s += `<rect class="thead" x="0.5" y="${T.titleH + 0.5}" width="${l.w - 1}" height="${T.rowH}" rx="${T.titleH ? 0 : 6}"/>`;
  let grid = '';
  for (let r = T.titleH ? 0 : 1; r < T.rows.length; r++) grid += `M0,${T.titleH + r * T.rowH} H${l.w} `;
  for (let c = 1; c < T.nc; c++) grid += `M${T.colX[c]},${T.titleH} V${l.h} `;
  s += `<path class="tgrid" d="${grid}"/>`;
  T.rows.forEach((row, r) => {
    for (let c = 0; c < T.nc; c++) {
      const x = T.colX[c], y = T.titleH + r * T.rowH, v = row[c] || '';
      if (live) s += `<rect class="tcell" data-cell="${r}:${c}" x="${x}" y="${y}" width="${T.colW[c]}" height="${T.rowH}"/>`;
      if (v) s += `<text class="tct${r === 0 ? ' th' : ''}" x="${x + 9}" y="${y + T.rowH / 2 + T.cfs * 0.36}" style="font-size:${T.cfs}px${n.it ? ';font-style:italic' : ''}">${esc(ell(v, T.colW[c] - 18, cellFont(n, T.cfs, r === 0)))}</text>`;
    }
  });
  return s;
}

/* ---------- azioni ---------- */
function setBlockType(type, ids = [...S.sels]) {
  mutate(t => ids.forEach(id => {
    const f = findM(t, id); if (!f || f.n.hub) return; const n = f.n;
    if (type === 'text') delete n.type; else n.type = type;
    if (type === 'table' && !n.table) n.table = { rows: [['Colonna 1', 'Colonna 2'], ['', '']] };
    if (type === 'exp' && n.body === undefined) n.open = true; // la prima volta aperto, pronto per scrivere il testo
  }));
}
function toggleCheck(id, k) {
  mutate(t => {
    const n = findM(t, id).n, s = listItems(n)[k]; if (s === undefined) return;
    n.done = isDone(n, s) ? n.done.filter(x => x !== s) : (n.done || []).concat(s);
    if (!n.done.length) delete n.done;
  });
}
// righe e colonne: aggiunte o tolte in fondo (almeno l'intestazione e una colonna)
function resizeTable(id, dr, dc) {
  mutate(t => {
    const n = findM(t, id).n, rows = (n.table = { rows: tableRows(n).map(r => r.slice()) }).rows, nc = Math.max(...rows.map(r => r.length));
    rows.forEach(r => { while (r.length < nc) r.push(''); });
    if (dr > 0) rows.push(Array(nc).fill('')); else if (dr < 0 && rows.length > 1) rows.pop();
    if (dc > 0) rows.forEach((r, i) => r.push(i === 0 ? `Colonna ${nc + 1}` : '')); else if (dc < 0 && nc > 1) rows.forEach(r => r.pop());
  });
}
function deleteTableLine(id, r, c, what) {
  mutate(t => {
    const n = findM(t, id).n, rows = (n.table = { rows: tableRows(n).map(x => x.slice()) }).rows;
    if (what === 'row' && rows.length > 1) rows.splice(r, 1);
    if (what === 'col' && Math.max(...rows.map(x => x.length)) > 1) rows.forEach(x => x.splice(c, 1));
  });
}
// cella sotto il punto p (coordinate della tela) di un blocco tabella: [riga, colonna], o null (titolo, fuori)
function cellAt(id, p) {
  const l = S.L.get(id); if (!l || !l.tb) return null;
  const T = l.tb, y = p.y - l.y - T.titleH, x = p.x - l.x; if (y < 0 || x < 0 || x > l.w) return null;
  const r = Math.floor(y / T.rowH); if (r >= T.rows.length) return null;
  let c = T.colX.findIndex((cx, i) => x >= cx && x < cx + T.colW[i]); if (c < 0) c = T.nc - 1;
  return [r, c];
}
// modifica di una cella: editing.id = "idBlocco|riga|colonna"
const cellRef = s => { const [id, r, c] = s.split('|'); return { id, r: +r, c: +c }; };
function startCellEdit(id, r, c) {
  const f = findM(curTree(), id); if (!f) return;
  selectOnly(id); beginEdit('cell', `${id}|${r}|${c}`, (tableRows(f.n)[r] || [])[c] || '', true);
}
function cellEditorBox(sx, sy, k) {
  const { id, r, c } = cellRef(editing.id), l = S.L.get(id), f = findM(curTree(), id); if (!l || !l.tb || !f) return null;
  const T = l.tb; if (c >= T.nc) return null;
  return { x: sx(l.x + T.colX[c] + 2), y: sy(l.y + T.titleH + r * T.rowH + 2), w: (T.colW[c] - 4) * k, h: (T.rowH - 4) * k,
    font: cellFont(f.n, T.cfs, r === 0), fs: T.cfs, lh: Math.round(T.cfs * 1.28), minW: 80, left: true };
}
function commitCell(ref, v) {
  const { id, r, c } = cellRef(ref), f = findM(curTree(), id); if (!f) return;
  snapshot();
  const rows = (f.n.table = { rows: tableRows(f.n).map(x => x.slice()) }).rows;
  while (rows.length <= r) rows.push([]); while (rows[r].length <= c) rows[r].push('');
  rows[r][c] = v; save();
}
// Tab: cella successiva; dopo l'ultima si aggiunge una riga
function nextCell(ref) {
  const { id, r, c } = cellRef(ref), f = findM(curTree(), id); if (!f) return;
  const rows = tableRows(f.n), nc = Math.max(...rows.map(x => x.length));
  if (c + 1 < nc) return startCellEdit(id, r, c + 1);
  if (r + 1 >= rows.length) resizeTable(id, 1, 0);
  startCellEdit(id, r + 1, 0);
}

/* ---------- blocco espandibile ---------- */
const EXP_CH = 20; // spazio della freccina a sinistra del titolo
const bodyFont = (n, bfs) => `${n.it ? 'italic ' : ''}400 ${bfs}px ${FB}`;
function expSize(n, lv, fs, font, lh, padX, padY) {
  const maxW = Math.max(60, (n.w ? n.w - padX : 260) - EXP_CH);
  const lines = wrap(n.text || 'Senza titolo', maxW, font, 2), titleH = lines.length * lh + padY;
  const bfs = Math.max(10, Math.round(fs * 0.85)), blh = Math.round(bfs * 1.38), bf = bodyFont(n, bfs);
  const body = n.open ? wrap(n.body || 'Doppio clic per scrivere il testo', maxW + EXP_CH, bf, n.h ? Math.max(1, Math.floor((n.h - titleH - 14) / blh)) : 30) : [];
  const w = n.w || Math.max(Math.max(...lines.map(t => tw(t, font))) + EXP_CH + padX, ...body.map(t => tw(t, bf) + padX), 120);
  return { lines, lh, w, h: n.open ? (n.h || titleH + 10 + body.length * blh + 10) : titleH, padX, ex: { titleH, body, bfs, blh, open: !!n.open, empty: !n.body } };
}
function expMarkup(n, l, live, fsSt) {
  const E = l.ex, x0 = l.padX / 2, fs = fsOf(n, l.depth), ty = (E.titleH - l.lines.length * l.lh) / 2, cy = E.titleH / 2;
  // freccina: verso destra chiusa, verso il basso aperta
  const ch = E.open ? `M${x0 + 2},${cy - 3} L${x0 + 7},${cy + 3} L${x0 + 12},${cy - 3}` : `M${x0 + 4},${cy - 5} L${x0 + 10},${cy} L${x0 + 4},${cy + 5}`;
  let s = `<g class="xchev"${live ? ` data-xtog="1"` : ''}>${live ? `<title>${E.open ? 'Chiudi' : 'Apri'} il testo</title><rect class="xhit" x="${x0 - 6}" y="0" width="${EXP_CH + 6}" height="${E.titleH}"/>` : ''}<path d="${ch}"/></g>`;
  s += l.lines.map((t, i) => `<text class="litem" x="${x0 + EXP_CH}" y="${ty + (i + 0.76) * l.lh}"${fsSt}>${esc(t)}</text>`).join('');
  if (E.open) {
    s += `<path class="xsep" d="M${x0},${E.titleH} H${l.w - x0}"/>`;
    if (!(E.empty && !live)) s += E.body.map((t, i) => `<text class="xbody${E.empty ? ' xempty' : ''}" x="${x0}" y="${E.titleH + 10 + (i + 0.78) * E.blh}" style="font-size:${E.bfs}px${n.it ? ';font-style:italic' : ''}">${esc(t)}</text>`).join('');
  }
  return s;
}
// apre/chiude il testo (resta possibile in sola lettura: è un modo di guardare la mappa)
function toggleExp(id) {
  if (readOnly()) { S.roOk = true; try { return toggleExp(id); } finally { S.roOk = false; } }
  mutate(t => { const f = findM(t, id); if (!f) return; if (f.n.open) delete f.n.open; else f.n.open = true; });
}
// doppio clic sotto il titolo di un blocco espandibile aperto: si scrive il testo
const inExpBody = (id, p) => { const l = S.L.get(id); return !!(l && l.ex && l.ex.open && p.y - l.y > l.ex.titleH); };
function startBodyEdit(id) {
  const f = findM(curTree(), id); if (!f) return;
  selectOnly(id); beginEdit('body', id, f.n.body || '', false);
}
function bodyEditorBox(sx, sy, k) {
  const l = S.L.get(editing.id), f = findM(curTree(), editing.id); if (!l || !l.ex || !f) return null;
  const E = l.ex;
  return { x: sx(l.x + l.padX / 2 - 3), y: sy(l.y + E.titleH + 6), w: (l.w - l.padX + 6) * k, h: (l.h - E.titleH - 10) * k,
    font: bodyFont(f.n, E.bfs), fs: E.bfs, lh: E.blh, minW: 180, left: true };
}
