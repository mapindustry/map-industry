// Stile di una parte del testo (richiesto il 2026-11-17): mentre si scrive in un blocco di testo o nel titolo di un
// gruppo si selezionano alcune parole e con il tasto destro si sceglie grassetto, corsivo, sottolineato, barrato o un
// colore solo per loro (la dimensione no: cambierebbe l'altezza delle righe).
// Dati: fmt = [{ s, e, b?, i?, u?, x?, c? }] sul blocco o sul gruppo = intervalli di caratteri del testo (s incluso,
// e escluso), senza sovrapposizioni; b grassetto, i corsivo, u sottolineato, x barrato, c colore 0–5.
// Cambiando il testo gli intervalli seguono (fmtRemap, in endEdit); il disegno divide le righe in <tspan> (richLine).
const FKEYS = ['b', 'i', 'u', 'x', 'c'];
const fkey = st => st ? FKEYS.map(k => st[k] ?? '').join('|') : '';
// stile di ogni carattere (null = come il resto del testo)
function fmtChars(text, fmt) {
  const a = new Array(text.length).fill(null);
  (fmt || []).forEach(r => {
    const st = {}; FKEYS.forEach(k => { if (r[k] != null && r[k] !== false) st[k] = r[k]; });
    if (!Object.keys(st).length) return;
    for (let i = Math.max(0, r.s); i < Math.min(text.length, r.e); i++) a[i] = st;
  });
  return a;
}
// di nuovo a intervalli (quelli vicini con lo stesso stile si uniscono); undefined = nessuno
function fmtRuns(a) {
  const out = []; let cur = null;
  a.forEach((st, i) => {
    const k = fkey(st);
    if (cur && cur.k === k) cur.e = i + 1; else { if (cur && cur.k) out.push(cur); cur = { k, s: i, e: i + 1, st }; }
  });
  if (cur && cur.k) out.push(cur);
  return out.length ? out.map(r => ({ s: r.s, e: r.e, ...r.st })) : undefined;
}
// testo cambiato: le lettere rimaste (allineate carattere per carattere, anche con più modifiche in punti diversi)
// tengono il loro stile; il testo nuovo prende quello delle lettere vicine se è lo stesso da tutte e due le parti
// (si scrive dentro una parola in grassetto)
function fmtRemap(oldT, newT, fmt) {
  if (!fmt || !fmt.length) return undefined;
  oldT = oldT || ''; newT = newT || '';
  const a = fmtChars(oldT, fmt), n = oldT.length, m = newT.length, out = new Array(m).fill(undefined);
  let p = 0; while (p < n && p < m && oldT[p] === newT[p]) { out[p] = a[p]; p++; }
  let q = 0; while (q < n - p && q < m - p && oldT[n - 1 - q] === newT[m - 1 - q]) { out[m - 1 - q] = a[n - 1 - q]; q++; }
  // in mezzo: la sottosequenza comune più lunga (testi brevi; oltre un certo limite restano solo inizio e fine)
  const A = oldT.slice(p, n - q), B = newT.slice(p, m - q), N = A.length, M = B.length;
  if (N && M && N * M <= 1e6) {
    const W = M + 1, D = new Uint32Array((N + 1) * W);
    for (let i = N - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) D[i * W + j] = A[i] === B[j] ? D[(i + 1) * W + j + 1] + 1 : Math.max(D[(i + 1) * W + j], D[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < N && j < M) { if (A[i] === B[j]) { out[p + j] = a[p + i]; i++; j++; } else if (D[(i + 1) * W + j] >= D[i * W + j + 1]) i++; else j++; }
  }
  for (let j = 0; j < m; j++) if (out[j] === undefined) {
    let k = j; while (k < m && out[k] === undefined) k++;
    const L = j > 0 ? out[j - 1] : undefined, R = k < m ? out[k] : undefined;
    const inh = L !== undefined && R !== undefined && fkey(L) === fkey(R) ? L : null;
    for (let x = j; x < k; x++) out[x] = inh;
    j = k - 1;
  }
  return fmtRuns(out);
}
// applica patch ai caratteri s..e (valore null = togli; clear = togli tutto)
function fmtApply(text, fmt, s, e, patch, clear) {
  const a = fmtChars(text, fmt);
  for (let i = s; i < e; i++) {
    const st = clear ? {} : { ...(a[i] || {}) };
    if (!clear) Object.entries(patch).forEach(([k, v]) => { if (v === null || v === undefined || v === '' || v === false) delete st[k]; else st[k] = v; });
    a[i] = Object.keys(st).length ? st : null;
  }
  return fmtRuns(a);
}
// testo come lo salva endEdit (spazi uniti, righe vuote tolte) e posizione di ogni carattere scritto in quel testo
function normMap(raw, multi) {
  let out = '', pend = '', has = false; const map = [];
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\n' && multi) { if (out) pend = '\n'; has = false; map.push(out.length + (pend ? 1 : 0)); continue; }
    if (/\s/.test(ch)) { if (has && pend !== '\n') pend = ' '; map.push(out.length + (pend ? 1 : 0)); continue; }
    out += pend; pend = ''; map.push(out.length); out += ch; has = true;
  }
  map.push(out.length);
  return { text: out, map };
}
// per ogni riga disegnata (da wrap/ell) la posizione nel testo di ciascun carattere (-1 = "…" aggiunto)
function lineIdx(text, lines) {
  let c = 0;
  return lines.map(L => {
    while (c < text.length && /\s/.test(text[c])) c++;
    const idx = []; let cut = false;
    for (const ch of L) {
      if (ch === ' ' && /\s/.test(text[c] || '')) { idx.push(c); while (c < text.length && /\s/.test(text[c]) && text[c] !== '\n') c++; continue; }
      if (text[c] === ch) { idx.push(c); c++; } else { idx.push(-1); cut = true; }
    }
    if (cut) while (c < text.length && !/\s/.test(text[c])) c++; // parola troncata: il resto non si vede
    return idx;
  });
}
// pezzi di una riga con lo stesso stile: [{ t, st }]
function lineParts(line, idx, chars) {
  const out = [];
  [...line].forEach((ch, j) => {
    const st = idx[j] >= 0 ? chars[idx[j]] : null, last = out[out.length - 1];
    if (last && fkey(last.st) === fkey(st)) last.t += ch; else out.push({ t: ch, st });
  });
  return out;
}
const richW = fw => fw >= 600 ? 800 : 700; // grassetto: più marcato del peso del testo
const richFont = (st, fs, fw, it) => `${it || (st && st.i) ? 'italic ' : ''}${st && st.b ? richW(fw) : fw} ${fs}px ${FB}`;
// larghezza di una riga con i suoi stili (il grassetto è più largo)
function richLineW(line, idx, chars, fs, fw, it) { return lineParts(line, idx, chars).reduce((w, p) => w + tw(p.t, richFont(p.st, fs, fw, it)), 0); }
// contenuto di un <text>: testo semplice e <tspan> per le parti con uno stile
function richLine(line, idx, chars, fw) {
  return lineParts(line, idx, chars).map(p => {
    if (!p.st) return esc(p.t);
    const st = p.st, dec = [st.u ? 'underline' : '', st.x ? 'line-through' : ''].filter(Boolean).join(' ');
    const css = (st.b ? `font-weight:${richW(fw)};` : '') + (st.i ? 'font-style:italic;' : '') + (dec ? `text-decoration:${dec};` : '');
    return `<tspan${st.c != null ? ` class="tc c${st.c}"` : ''}${css ? ` style="${css}"` : ''}>${esc(p.t)}</tspan>`;
  }).join('');
}

/* ---------- menu del tasto destro sul testo selezionato nell'editor ---------- */
// l'editor resta aperto con la selezione visibile; scegliendo una voce il testo si salva (blur) e lo stile si applica
function fmtTarget(t, M) { return M.gk ? findGroup(t, M.id) : (findM(t, M.id) || {}).n; }
ed.addEventListener('contextmenu', e => {
  if (!editing || readOnly()) return;
  const k = editing.kind, f = k === 'node' && findM(curTree(), editing.id);
  if (!(k === 'group' || (f && isTextBlock(f.n)))) return; // altri testi: il menu del browser (copia, incolla)
  const raw = ed.value; let s0 = ed.selectionStart, e0 = ed.selectionEnd;
  while (s0 < e0 && /\s/.test(raw[s0])) s0++;
  while (e0 > s0 && /\s/.test(raw[e0 - 1])) e0--;
  if (s0 >= e0) return; // niente di selezionato
  e.preventDefault(); e.stopPropagation();
  const nm = normMap(raw, k === 'node'), s = nm.map[s0], en = nm.map[e0 - 1] + 1;
  const M = { kind: 'fmt', id: editing.id, gk: k === 'group', text: nm.text, s, e: en, keep: true };
  const o = fmtTarget(curTree(), M), cur = fmtChars(nm.text, fmtRemap(o.text || '', nm.text, o.fmt)).slice(s, en);
  const all = key => cur.every(c => c && c[key]), cols = cur.map(c => c && c.c != null ? String(c.c) : '');
  showMenu(e.clientX, e.clientY, title('Testo selezionato', '«' + esc(ell(nm.text.slice(s, en).replace(/\n/g, ' '), 200, `500 12px ${FB}`)) + '»') +
    swatches(cols.every(c => c === cols[0]) ? cols[0] : null) + SEP +
    item('fb', '<b>Grassetto</b>', all('b') ? ' on' : '') + item('fi', '<i>Corsivo</i>', all('i') ? ' on' : '') +
    item('fu', '<u>Sottolineato</u>', all('u') ? ' on' : '') + item('fx', '<s>Barrato</s>', all('x') ? ' on' : '') + SEP +
    item('fclr', 'Togli lo stile', '', '', 'Solo del testo selezionato'), M);
});
// voce scelta: prima si salva il testo (se l'editor è ancora aperto), poi lo stile va sui caratteri selezionati
function fmtClick(e) {
  const b = e.target.closest('[data-a], [data-c]'); if (!b) return;
  const M = MENU; closeMenu(); if (editing) endEdit(true);
  const t = curTree(), o = fmtTarget(t, M); if (!o) return;
  if ((o.text || '') !== M.text) return toast('Il testo è cambiato: selezionalo di nuovo');
  const KEY = { fb: 'b', fi: 'i', fu: 'u', fx: 'x' }, a = b.dataset.a;
  let patch = {}, clear = false;
  if (b.dataset.c !== undefined) patch = { c: b.dataset.c === '' ? null : +b.dataset.c };
  else if (a === 'fclr') clear = true;
  else if (KEY[a]) { const k = KEY[a], cur = fmtChars(o.text, o.fmt).slice(M.s, M.e); patch = { [k]: cur.every(c => c && c[k]) ? null : true }; }
  else return;
  mutate(tt => { const x = fmtTarget(tt, M); if (!x) return; const f = fmtApply(x.text, x.fmt, M.s, M.e, patch, clear); if (f) x.fmt = f; else delete x.fmt; });
  selectOnly(M.id); render();
}
