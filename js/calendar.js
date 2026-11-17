// Blocco calendario (n.type 'cal', richiesto il 2026-11-17): un mese alla volta, settimana da lunedì.
// - n.cal = 'AAAA-MM' mese mostrato (di serie il mese corrente); ‹ › cambiano mese (anche in sola lettura: è un modo di
//   guardare la mappa). n.days = ['AAAA-MM-GG', …] giorni segnati: clic su un giorno = segna/togli (deciso al rilascio,
//   così il blocco si trascina anche dai giorni). n.text = titolo sopra il mese (vuoto = niente titolo).
// - Colore dei segni (richiesto il 2026-11-17): n.dcol = colore di serie di tutti i segni (0–5, nel menu del blocco),
//   n.dayc = { 'AAAA-MM-GG': 0–5 } colore di un giorno (tasto destro sul giorno). Senza colore: --accent.
// - La maniglia cambia solo la larghezza: le caselle seguono, l'altezza è automatica.
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const GSET = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const p2 = v => String(v).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const thisMonth = () => ymd(new Date()).slice(0, 7);
const calMonth = n => /^\d{4}-\d{2}$/.test(n.cal || '') ? n.cal : thisMonth();
const CAL_P = 8; // margine interno

function calSize(n, lv, fs, font, lh) {
  const [y, m] = calMonth(n).split('-').map(Number);
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7, nd = new Date(y, m, 0).getDate(), weeks = Math.ceil((first + nd) / 7);
  const w = Math.round(Math.max(170, n.w || 7 * Math.max(28, fs * 2.3) + 2 * CAL_P)), cw = (w - 2 * CAL_P) / 7, ch = Math.round(Math.min(cw * 0.82, Math.max(22, fs * 2)));
  const lines = n.text ? wrap(n.text, w - 24, font, 2) : [], titleH = lines.length ? lines.length * lh + 10 : 0;
  const headH = Math.round(fs * 1.28) + 12, dowH = 16, gridY = titleH + headH + dowH;
  return { lines, lh, w, h: gridY + weeks * ch + CAL_P, cal: { y, m, first, nd, cw, ch, titleH, headH, gridY, dfs: Math.max(10, Math.round(fs * 0.85)) } };
}
function calMarkup(n, l, live, fsSt) {
  const C = l.cal, fs = fsOf(n, l.depth), days = new Set(n.days || []), today = live ? ymd(new Date()) : '';
  let s = l.lines.map((t, i) => `<text x="${l.w / 2}" y="${6 + (i + 0.76) * l.lh}" text-anchor="middle"${fsSt}>${esc(t)}</text>`).join('');
  if (C.titleH) s += `<path class="xsep" d="M${CAL_P},${C.titleH} H${l.w - CAL_P}"/>`;
  const hy = C.titleH + C.headH / 2;
  s += `<text class="calm" x="${l.w / 2}" y="${hy + fs * 0.34}" text-anchor="middle" style="font-size:${fs}px${n.it ? ';font-style:italic' : ''}">${MESI[C.m - 1]} ${C.y}</text>`;
  if (live) [[-1, 'Mese precedente', CAL_P + 4, 1], [1, 'Mese successivo', l.w - CAL_P - 4, -1]].forEach(([d, t, x, sg]) => {
    s += `<g class="xchev calnav" data-calnav="${d}"><title>${t}</title><rect class="xhit" x="${sg > 0 ? x - 6 : x - 22}" y="${C.titleH}" width="28" height="${C.headH}"/>` +
      `<path d="M${x + 7 * sg},${hy - 5} L${x + 2 * sg},${hy} L${x + 7 * sg},${hy + 5}"/></g>`;
  });
  GSET.forEach((g, i) => { s += `<text class="caldow${i > 4 ? ' we' : ''}" x="${CAL_P + C.cw * (i + 0.5)}" y="${C.gridY - 5}" text-anchor="middle">${g}</text>`; });
  const r = Math.min(C.cw, C.ch) * 0.42;
  for (let d = 1; d <= C.nd; d++) {
    const k = C.first + d - 1, c = k % 7, cx = CAL_P + C.cw * (c + 0.5), cy = C.gridY + C.ch * (Math.floor(k / 7) + 0.5);
    const key = `${C.y}-${p2(C.m)}-${p2(d)}`, on = days.has(key), dc = on ? dayColor(n, key) : null;
    s += `<g class="cald${on ? ' on' : ''}${dc != null ? ' cc c' + dc : ''}${key === today ? ' today' : ''}${c > 4 ? ' we' : ''}"${live ? ` data-day="${key}"` : ''}>` +
      (live ? `<rect class="calhit" x="${cx - C.cw / 2}" y="${cy - C.ch / 2}" width="${C.cw}" height="${C.ch}"/>` : '') +
      (on || key === today ? `<circle cx="${cx}" cy="${cy}" r="${r}"/>` : '') +
      `<text x="${cx}" y="${cy + C.dfs * 0.35}" text-anchor="middle" style="font-size:${C.dfs}px">${d}</text></g>`;
  }
  return s;
}
// colore del segno di un giorno: il suo, altrimenti quello del calendario, altrimenti nessuno (null = --accent)
const dayColor = (n, key) => n.dayc && n.dayc[key] != null ? n.dayc[key] : n.dcol != null ? n.dcol : null;
const dayName = key => { const [y, m, d] = key.split('-').map(Number); return `${d} ${MESI[m - 1].toLowerCase()} ${y}`; };
// tasto destro su un giorno: colore del segno (sceglierlo segna anche il giorno) e segna/togli
function dayMenuHtml(n, key) {
  const on = (n.days || []).includes(key), own = n.dayc && n.dayc[key] != null ? String(n.dayc[key]) : '';
  return title(dayName(key), on ? 'Giorno segnato' : 'Scegli un colore per segnarlo') +
    swatches(on ? own : null).replace(/data-c=/g, 'data-dc=').replace('title="Nessun colore" aria-label="Nessun colore"', 'title="Colore del calendario" aria-label="Colore del calendario"') + SEP +
    item('daytog', on ? 'Togli il segno' : 'Segna il giorno');
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
const dropDayc = (n, keep) => { if (!n.dayc) return; Object.keys(n.dayc).forEach(k => { if (!keep(k)) delete n.dayc[k]; }); if (!Object.keys(n.dayc).length) delete n.dayc; };
// ‹ › : mese precedente o successivo
function calNav(id, d) {
  if (readOnly()) { S.roOk = true; try { return calNav(id, d); } finally { S.roOk = false; } }
  mutate(t => { const f = findM(t, id); if (!f) return; const [y, m] = calMonth(f.n).split('-').map(Number); f.n.cal = ymd(new Date(y, m - 1 + d, 1)).slice(0, 7); });
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
// segni del mese mostrato: quanti sono, e toglierli tutti
const calMarks = n => (n.days || []).filter(d => d.startsWith(calMonth(n) + '-')).length;
function calClear(id) {
  mutate(t => { const f = findM(t, id); if (!f) return; const n = f.n, m = calMonth(n) + '-'; n.days = (n.days || []).filter(d => !d.startsWith(m)); dropDayc(n, k => !k.startsWith(m)); if (!n.days.length) delete n.days; });
}
// editor del titolo: sopra il mese
function calEditorBox(l, f, sx, sy, k) {
  const fs = fsOf(f.n, l.depth);
  return { x: sx(l.x + CAL_P), y: sy(l.y + 4), w: (l.w - 2 * CAL_P) * k, h: Math.max(l.cal.titleH - 6, l.lh + 6) * k, font: nodeFont(f.n, l.depth), fs, lh: l.lh, minW: 160 };
}
