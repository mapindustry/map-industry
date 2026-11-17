// Blocco calendario (n.type 'cal', richiesto il 2026-11-17): un mese alla volta, settimana da lunedì.
// - n.cal = 'AAAA-MM' mese mostrato (di serie il mese corrente); ‹ › cambiano mese (anche in sola lettura: è un modo di
//   guardare la mappa). n.days = ['AAAA-MM-GG', …] giorni segnati: clic su un giorno = segna/togli (deciso al rilascio,
//   così il blocco si trascina anche dai giorni). n.text = titolo sopra il mese (vuoto = niente titolo).
// - Colore dei segni (richiesto il 2026-11-17): n.dcol = colore di serie di tutti i segni (0–5, nel menu del blocco),
//   n.dayc = { 'AAAA-MM-GG': 0–5 } colore di un giorno (tasto destro sul giorno). Senza colore: --accent.
// - Vista (n.view, richiesta il 2026-11-17): 1 = un mese (di serie, non salvato), 3 = tre mesi affiancati (da n.cal;
//   le frecce scorrono di un mese), 12 = l'anno di n.cal in 4 colonne × 3 righe (le frecce cambiano anno). Nel menu del
//   blocco: Vista. Con più mesi ognuno ha il suo nome sopra e le caselle sono più piccole; i mesi di una riga sono alti
//   uguali.
// - La maniglia cambia solo la larghezza: le caselle seguono, l'altezza è automatica.
// - Nota di un giorno (richiesta il 2026-11-17): n.dnote = { 'AAAA-MM-GG': testo }. Tasto destro sul giorno → Scrivi una
//   nota (editor 'dnote', id "blocco|giorno"; lo segna anche). Sul calendario un triangolino nell'angolo del giorno e il
//   testo al passaggio del mouse. Togliere il segno toglie anche colore e nota. Una tabella collegata al calendario
//   mostra i giorni segnati con colore e nota (js/blocks.js, calTables).
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GSET = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const p2 = v => String(v).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const thisMonth = () => ymd(new Date()).slice(0, 7);
const calMonth = n => /^\d{4}-\d{2}$/.test(n.cal || '') ? n.cal : thisMonth();
const CAL_P = 8, CAL_G = 14; // margine interno, spazio tra i mesi
const MESI3 = MESI.map(m => m.slice(0, 3));
const calView = n => n.view === 3 || n.view === 12 ? n.view : 1;
// mesi mostrati: [anno, mese 1–12]
function calMonths(n) {
  const v = calView(n), [y, m] = calMonth(n).split('-').map(Number), m0 = v === 12 ? 1 : m;
  return Array.from({ length: v }, (_, i) => { const d = new Date(y, m0 - 1 + i, 1); return [d.getFullYear(), d.getMonth() + 1]; });
}
function calLabel(n) {
  const ms = calMonths(n), v = ms.length, [y, m] = ms[0], [y2, m2] = ms[v - 1];
  if (v === 1) return `${MESI[m - 1]} ${y}`;
  if (v === 12) return String(y);
  return y === y2 ? `${MESI3[m - 1]} – ${MESI3[m2 - 1]} ${y}` : `${MESI3[m - 1]} ${y} – ${MESI3[m2 - 1]} ${y2}`;
}

function calSize(n, lv, fs, font, lh) {
  const ms = calMonths(n), v = ms.length, cols = v === 12 ? 4 : v, rows = Math.ceil(v / cols), multi = v > 1;
  const cw0 = multi ? Math.max(20, fs * 1.6) : Math.max(28, fs * 2.3);
  const natW = cols * 7 * cw0 + (cols - 1) * CAL_G + 2 * CAL_P;
  const w = Math.round(Math.max(multi ? 120 * cols : 170, n.w || natW));
  const pw = (w - 2 * CAL_P - (cols - 1) * CAL_G) / cols, cw = pw / 7, ch = Math.round(Math.min(cw * 0.82, Math.max(multi ? 18 : 22, fs * (multi ? 1.5 : 2))));
  const lines = n.text ? wrap(n.text, w - 24, font, 2) : [], titleH = lines.length ? lines.length * lh + 10 : 0;
  const headH = Math.round(fs * 1.28) + 12, dfs = Math.max(multi ? 9 : 10, Math.round(fs * (multi ? 0.72 : 0.85)));
  const mh = multi ? Math.round(dfs * 1.3) + 8 : 0, dowH = multi ? 14 : 16; // nome del mese, lettere dei giorni
  const info = ms.map(([y, m]) => { const first = (new Date(y, m - 1, 1).getDay() + 6) % 7, nd = new Date(y, m, 0).getDate(); return { y, m, first, nd, weeks: Math.ceil((first + nd) / 7) }; });
  let top = titleH + headH;
  for (let r = 0; r < rows; r++) {
    const row = info.slice(r * cols, r * cols + cols), wk = Math.max(...row.map(i => i.weeks)); // mesi di una riga alti uguali
    row.forEach((i, c) => { i.x = CAL_P + c * (pw + CAL_G); i.top = top; i.gridY = top + mh + dowH; });
    top += mh + dowH + wk * ch + (r < rows - 1 ? CAL_G : 0);
  }
  return { lines, lh, w, h: top + CAL_P, cal: { months: info, multi, cw, ch, pw, titleH, headH, mh, dfs, label: calLabel(n) } };
}
function calMarkup(n, l, live, fsSt) {
  const C = l.cal, fs = fsOf(n, l.depth), days = new Set(n.days || []), today = live ? ymd(new Date()) : '';
  let s = l.lines.map((t, i) => `<text x="${l.w / 2}" y="${6 + (i + 0.76) * l.lh}" text-anchor="middle"${fsSt}>${esc(t)}</text>`).join('');
  if (C.titleH) s += `<path class="xsep" d="M${CAL_P},${C.titleH} H${l.w - CAL_P}"/>`;
  const hy = C.titleH + C.headH / 2, yr = C.months.length === 12;
  s += `<text class="calm" x="${l.w / 2}" y="${hy + fs * 0.34}" text-anchor="middle" style="font-size:${fs}px${n.it ? ';font-style:italic' : ''}">${C.label}</text>`;
  if (live) [[-1, yr ? 'Anno precedente' : 'Mese precedente', CAL_P + 4, 1], [1, yr ? 'Anno successivo' : 'Mese successivo', l.w - CAL_P - 4, -1]].forEach(([d, t, x, sg]) => {
    s += `<g class="xchev calnav" data-calnav="${d}"><title>${t}</title><rect class="xhit" x="${sg > 0 ? x - 6 : x - 22}" y="${C.titleH}" width="28" height="${C.headH}"/>` +
      `<path d="M${x + 7 * sg},${hy - 5} L${x + 2 * sg},${hy} L${x + 7 * sg},${hy + 5}"/></g>`;
  });
  const r = Math.min(C.cw, C.ch) * 0.42, cm = thisMonth();
  C.months.forEach(M => {
    // con più mesi: il nome sopra ognuno (il mese corrente in evidenza)
    if (C.multi) s += `<text class="calmm${`${M.y}-${p2(M.m)}` === cm && live ? ' now' : ''}" x="${M.x + C.pw / 2}" y="${M.top + C.mh - 6}" text-anchor="middle" style="font-size:${C.dfs + 1}px">${MESI[M.m - 1]}${C.months.length === 12 ? '' : ' ' + M.y}</text>`;
    GSET.forEach((g, i) => { s += `<text class="caldow${i > 4 ? ' we' : ''}" x="${M.x + C.cw * (i + 0.5)}" y="${M.gridY - 4}" text-anchor="middle"${C.multi ? ' style="font-size:9px"' : ''}>${g}</text>`; });
    for (let d = 1; d <= M.nd; d++) {
      const k = M.first + d - 1, c = k % 7, cx = M.x + C.cw * (c + 0.5), cy = M.gridY + C.ch * (Math.floor(k / 7) + 0.5);
      const key = `${M.y}-${p2(M.m)}-${p2(d)}`, on = days.has(key), dc = on ? dayColor(n, key) : null, nt = on && n.dnote ? n.dnote[key] : '';
      const tz = Math.max(4, Math.min(7, C.cw * 0.22)), tx = cx + C.cw / 2 - 1, ty = cy - C.ch / 2 + 1; // triangolino della nota
      s += `<g class="cald${on ? ' on' : ''}${dc != null ? ' cc c' + dc : ''}${key === today ? ' today' : ''}${c > 4 ? ' we' : ''}"${live ? ` data-day="${key}"` : ''}>` +
        (live && nt ? `<title>${esc(dayName(key))}: ${esc(nt)}</title>` : '') +
        (live ? `<rect class="calhit" x="${cx - C.cw / 2}" y="${cy - C.ch / 2}" width="${C.cw}" height="${C.ch}"/>` : '') +
        (on || key === today ? `<circle cx="${cx}" cy="${cy}" r="${r}"/>` : '') +
        (nt ? `<path class="calnt" d="M${tx},${ty} h${-tz} L${tx},${ty + tz} Z"/>` : '') +
        `<text x="${cx}" y="${cy + C.dfs * 0.35}" text-anchor="middle" style="font-size:${C.dfs}px">${d}</text></g>`;
    }
  });
  return s;
}
// colore del segno di un giorno: il suo, altrimenti quello del calendario, altrimenti nessuno (null = --accent)
const dayColor = (n, key) => n.dayc && n.dayc[key] != null ? n.dayc[key] : n.dcol != null ? n.dcol : null;
const dayName = key => { const [y, m, d] = key.split('-').map(Number); return `${d} ${MESI[m - 1].toLowerCase()} ${y}`; };
// tasto destro su un giorno: colore del segno (sceglierlo segna anche il giorno) e segna/togli
function dayMenuHtml(n, key) {
  const on = (n.days || []).includes(key), own = n.dayc && n.dayc[key] != null ? String(n.dayc[key]) : '', nt = n.dnote ? n.dnote[key] : '';
  return title(dayName(key), on ? 'Giorno segnato' : 'Scegli un colore per segnarlo') +
    swatches(on ? own : null).replace(/data-c=/g, 'data-dc=').replace('title="Nessun colore" aria-label="Nessun colore"', 'title="Colore del calendario" aria-label="Colore del calendario"') + SEP +
    item('daynote', nt ? 'Modifica la nota' : 'Scrivi una nota', '', '', nt ? '' : 'Segna anche il giorno') + (nt ? item('daynotedel', 'Togli la nota') : '') + SEP +
    item('daytog', on ? 'Togli il segno' : 'Segna il giorno', '', '', on && nt ? 'Toglie anche la nota' : '');
}
// nota di un giorno: editor sotto la casella del giorno
const dnoteRef = s => { const [id, day] = s.split('|'); return { id, day }; };
function startDayNote(id, day) {
  const f = findM(curTree(), id); if (!f) return;
  selectOnly(id); beginEdit('dnote', `${id}|${day}`, (f.n.dnote || {})[day] || '', true);
}
// casella di un giorno nel blocco (coordinate del blocco), se il suo mese è mostrato
function calDayRect(l, day) {
  const C = l.cal, [y, m, d] = day.split('-').map(Number), M = C && C.months.find(x => x.y === y && x.m === m); if (!M) return null;
  const k = M.first + d - 1;
  return { x: M.x + C.cw * (k % 7), y: M.gridY + C.ch * Math.floor(k / 7), w: C.cw, h: C.ch };
}
function dnoteEditorBox(sx, sy, k) {
  const { id, day } = dnoteRef(editing.id), l = S.L.get(id); if (!l || !l.cal) return null;
  const r = calDayRect(l, day) || { x: 0, y: l.h, w: l.w, h: 0 };
  return { x: sx(l.x + r.x + r.w / 2) - 110 * k, y: sy(l.y + r.y + r.h + 3), w: 220 * k, h: 24 * k, font: `400 12px ${FB}`, fs: 12, lh: 16, minW: 220, left: true };
}
function setDayNote(ref, v) {
  const { id, day } = dnoteRef(ref);
  mutate(t => {
    const f = findM(t, id); if (!f) return; const n = f.n;
    if (v) {
      if (!(n.days || []).includes(day)) n.days = (n.days || []).concat(day).sort(); // scrivere la nota segna il giorno
      n.dnote = n.dnote || {}; n.dnote[day] = v;
    } else if (n.dnote) { delete n.dnote[day]; if (!Object.keys(n.dnote).length) delete n.dnote; }
  });
}
function setDayColor(id, key, c) {
  mutate(t => {
    const f = findM(t, id); if (!f) return; const n = f.n;
    if (!(n.days || []).includes(key)) n.days = (n.days || []).concat(key).sort();
    n.dayc = n.dayc || {}; if (c === null) delete n.dayc[key]; else n.dayc[key] = c;
    if (!Object.keys(n.dayc).length) delete n.dayc;
  });
}
// colore di serie dei segni (menu del blocco): vale per i giorni senza un colore proprio
function setMarkColor(id, c) { mutate(t => { const f = findM(t, id); if (!f) return; if (c === null) delete f.n.dcol; else f.n.dcol = c; }); }
// giorni non più segnati: perdono colore e nota
const dropDayc = (n, keep) => ['dayc', 'dnote'].forEach(f => { if (!n[f]) return; Object.keys(n[f]).forEach(k => { if (!keep(k)) delete n[f][k]; }); if (!Object.keys(n[f]).length) delete n[f]; });
// ‹ › : mese precedente o successivo (vista annuale: anno)
function calNav(id, d) {
  if (readOnly()) { S.roOk = true; try { return calNav(id, d); } finally { S.roOk = false; } }
  mutate(t => { const f = findM(t, id); if (!f) return; const [y, m] = calMonth(f.n).split('-').map(Number); f.n.cal = ymd(new Date(y, m - 1 + d * (calView(f.n) === 12 ? 12 : 1), 1)).slice(0, 7); });
}
// vista: 1 mese, 3 mesi, anno (la larghezza scelta a mano non vale più: ogni vista ha la sua misura)
function setCalView(id, v) {
  mutate(t => { const f = findM(t, id); if (!f) return; if (v === 1) delete f.n.view; else f.n.view = v; delete f.n.w; delete f.n.h; });
}
function calToday(id) { mutate(t => { const f = findM(t, id); if (f) f.n.cal = thisMonth(); }); }
function toggleDay(id, key) {
  mutate(t => {
    const f = findM(t, id); if (!f) return; const n = f.n, ds = n.days || [];
    n.days = ds.includes(key) ? ds.filter(x => x !== key) : ds.concat(key).sort();
    dropDayc(n, k => n.days.includes(k)); // giorno tolto: perde anche il suo colore
    if (!n.days.length) delete n.days;
  });
}
// segni dei mesi mostrati: quanti sono, e toglierli tutti
const calShown = n => { const ms = new Set(calMonths(n).map(([y, m]) => `${y}-${p2(m)}`)); return d => ms.has(d.slice(0, 7)); };
const calMarks = n => (n.days || []).filter(calShown(n)).length;
function calClear(id) {
  mutate(t => { const f = findM(t, id); if (!f) return; const n = f.n, sh = calShown(n); n.days = (n.days || []).filter(d => !sh(d)); dropDayc(n, k => !sh(k)); if (!n.days.length) delete n.days; });
}
// editor del titolo: sopra il mese
function calEditorBox(l, f, sx, sy, k) {
  const fs = fsOf(f.n, l.depth);
  return { x: sx(l.x + CAL_P), y: sy(l.y + 4), w: (l.w - 2 * CAL_P) * k, h: Math.max(l.cal.titleH - 6, l.lh + 6) * k, font: nodeFont(f.n, l.depth), fs, lh: l.lh, minW: 160 };
}
