// Legenda: riquadro sulla tela con una riga per ogni stile da spiegare (campione + descrizione).
// tree.legend = { corner, text, items: [{ id, kind: 'node'|'edge'|'group'|'note', s: { stile }, text }] }
// Sta ferma in un angolo dello schermo (corner: 'tl' 'tr' 'bl' 'br', di serie 'br'), sopra la tela: non segue né lo
// spostamento né lo zoom. Disegnata in <g id="lg">, fuori da #vp. Trascinata, si aggancia all'angolo più vicino.
// Si riempie dal tasto destro di un elemento ("Inserisci in legenda"): il campione è una copia dello stile in quel
// momento, quindi cambiando poi l'elemento la legenda resta com'è. Doppio clic su una riga = descrizione, sul titolo =
// rinomina; tasto destro = sposta, togli, angolo, elimina. Nell'esportazione va accanto alla mappa, dalla stessa parte.
const LEG = 'legend', LEG_FONT = `400 13px ${FB}`, LEG_TFONT = `600 13px ${FB}`;
const LROW = 28, LHEAD = 34, LSW = 44, LPAD = 14, LMAXT = 320;

// stile di un elemento, come si vede (per il campione)
function legendStyle(kind, id) {
  const t = curTree();
  if (kind === 'edge') {
    const e = edgeData(t, id) || {};
    return { shape: e.shape || '', line: lineOf(e), lw: linkWidth(id), gap: gapOf(e), op: eopOf(e) };
  }
  if (kind === 'group') {
    const g = findGroup(t, id);
    return { color: hasColor(g) ? g.color : null, line: glineOf(g), bw: gbwOf(g), fo: gfoOf(g) };
  }
  if (kind === 'note') return {};
  const f = findM(t, id), l = S.L.get(id), d = l ? l.depth : 2, n = f.n;
  return { color: hasColor(n) ? n.color : null, fw: fwOf(n, d), it: !!n.it, bw: bwOf(n, d), op: n.op ?? 1, hub: !!n.hub };
}
// elementi del tasto destro che vanno in legenda: il collegamento selezionato, oppure blocchi, note e gruppi selezionati
function legendTargets() {
  const t = curTree();
  if (S.esel) return [{ kind: 'edge', id: S.esel }];
  return [...S.sels].map(id => findM(t, id) ? { kind: 'node', id } : findNote(t, id) ? { kind: 'note', id } : findGroup(t, id) ? { kind: 'group', id } : null).filter(Boolean);
}
// inserisce una riga per ogni stile non ancora in legenda (crea la legenda in alto a destra della vista, se manca)
// e apre subito la descrizione della prima riga nuova
function addToLegend() {
  const tg = legendTargets(); if (!tg.length) return toast('Seleziona un elemento da mettere in legenda');
  const t0 = curTree(), have = new Set(((t0.legend || {}).items || []).map(i => i.kind + JSON.stringify(i.s)));
  const rows = [];
  tg.forEach(({ kind, id }) => {
    const s = legendStyle(kind, id), k = kind + JSON.stringify(s);
    if (!have.has(k)) { have.add(k); rows.push({ id: uid(), kind, s, text: '' }); }
  });
  if (!rows.length) return toast('Questo stile è già in legenda');
  mutate(t => {
    if (!t.legend) t.legend = { corner: 'br', text: 'Legenda', items: [] };
    t.legend.items.push(...rows);
  });
  selectOnly(LEG); render(); startLegendEdit(rows[0].id); markFresh();
}

// misure: larghezza dal testo più lungo, una riga per voce
function legendLayout(tree) {
  const lg = tree.legend; if (!lg) return null;
  const txt = i => ell(i.text || 'Descrizione', LMAXT, LEG_FONT);
  const tws = lg.items.map(i => tw(txt(i), LEG_FONT));
  const w = Math.max(200, LPAD * 2 + LSW + 12 + Math.max(0, ...tws), LPAD * 2 + tw(lg.text || 'Legenda', LEG_TFONT));
  return { w: Math.ceil(w), h: LHEAD + lg.items.length * LROW + (lg.items.length ? 8 : 4), txt };
}
// posizione sullo schermo: nell'angolo scelto (sotto la barra e il campo di ricerca), o dove la si sta trascinando
const LMARGIN = 16;
function legendPos(lo, corner) {
  if (S.legDrag) return S.legDrag;
  const c = corner || 'br', top = BAR_H + LMARGIN + (FIND && c === 'tr' ? 44 : 0);
  return { x: c[1] === 'l' ? LMARGIN : viewW() - lo.w - LMARGIN, y: c[0] === 't' ? top : innerHeight - lo.h - LMARGIN };
}
// angolo più vicino al centro della legenda
function nearestCorner(x, y, lo) { return (y + lo.h / 2 < innerHeight / 2 ? 't' : 'b') + (x + lo.w / 2 < viewW() / 2 ? 'l' : 'r'); }
function setLegendCorner(c) { mutate(t => { if (t.legend) t.legend.corner = c; }); }
// disegno sulla tela (live) in <g id="lg">; per l'esportazione pos = punto della tela accanto alla mappa
function renderLegend() { $('#lg').innerHTML = legendMarkup(curTree(), true); }
addEventListener('resize', () => { if (curTree() && curTree().legend) renderLegend(); });
// campione dello stile, in un riquadro LSW × 22
function legendSample(i) {
  const s = i.s || {}, cc = s.color != null ? ` cc c${s.color}` : '';
  if (i.kind === 'edge') {
    const d = s.shape === 'st' ? 'M2 19L42 5' : s.shape === 'sq' ? 'M2 19H22V5H42' : 'M2 19C18 19 26 5 42 5';
    const e = { line: s.line, gap: s.gap, op: s.op < 1 ? s.op : 0 };
    return `<g class="eg l-${s.line || 'solid'}"><path class="edge" d="${d}" style="${edgeStyle(e, s.lw || 1.5)}"/></g>`;
  }
  if (i.kind === 'group') {
    const ln = s.line || 'dash';
    const st = `stroke-width:${s.bw ?? 1.2}px;fill-opacity:${s.fo ?? 0.08};` + (ln === 'none' ? 'stroke:none;' : `stroke-dasharray:${GLINE[ln]};`);
    return `<g class="grp${cc}"><rect class="gbox" x="1" y="2" width="${LSW - 2}" height="20" rx="6" style="${st}"/></g>`;
  }
  if (i.kind === 'note') return `<g class="cnote"><rect class="nbox" x="0" y="2" width="${LSW}" height="20" rx="3"/><rect class="nbar" y="2" width="3" height="20" rx="1.5"/></g>`;
  if (s.hub) return `<g class="mn hub"><circle class="hubdot" cx="${LSW / 2}" cy="12" r="5.5"/></g>`;
  const st = `stroke-width:${s.bw ?? 1.4}px;` + (s.op != null && s.op < 1 ? `opacity:${s.op};` : '');
  return `<g class="mn d2${cc}"><rect class="box" x="1" y="2" width="${LSW - 2}" height="20" rx="6" style="${st}"/>` +
    `<text x="${LSW / 2}" y="16.5" text-anchor="middle" style="font-size:11px;font-weight:${s.fw || 400}${s.it ? ';font-style:italic' : ''}">Aa</text></g>`;
}
function legendMarkup(tree, live, at) {
  const lo = legendLayout(tree); if (!lo) return '';
  const pos = at || legendPos(lo, tree.legend.corner);
  const lg = tree.legend, sel = live && S.sels.has(LEG), ed = live && editing;
  const rows = lg.items.map((i, k) => {
    const hide = ed && editing.kind === 'legrow' && editing.id === i.id, empty = !i.text;
    if (empty && !live) return `<g transform="translate(${LPAD},${LHEAD + k * LROW})">${legendSample(i)}</g>`;
    return `<g class="lrow"${live ? ` data-lrow="${i.id}"` : ''} transform="translate(${LPAD},${LHEAD + k * LROW})">${legendSample(i)}` +
      (hide ? '' : `<text class="ltext${empty ? ' lempty' : ''}" x="${LSW + 12}" y="16.5">${esc(lo.txt(i))}</text>`) + `</g>`;
  }).join('');
  const thide = ed && editing.kind === 'legtitle';
  return `<g class="leg${sel ? ' sel' : ''}"${live ? ` data-leg="1"` : ''} transform="translate(${pos.x},${pos.y})">` +
    (live ? `<title>Legenda · Trascinala verso un altro angolo · Doppio clic: descrizione o titolo · Tasto destro: opzioni</title>` : '') +
    `<rect class="lbox" width="${lo.w}" height="${lo.h}" rx="10"/>` +
    (thide ? '' : `<text class="ltitle" x="${LPAD}" y="22"${live ? ' data-ltitle="1"' : ''}>${esc(ell(lg.text || 'Legenda', lo.w - LPAD * 2, LEG_TFONT))}</text>`) +
    (lg.items.length ? `<path class="lsep" d="M${LPAD},${LHEAD - 4} H${lo.w - LPAD}"/>` : '') + rows +
    (sel ? `<rect class="ring" x="-5" y="-5" width="${lo.w + 10}" height="${lo.h + 10}" rx="13"/>` : '') + `</g>`;
}

/* ---------- modifica ---------- */
function startLegendEdit(itemId) {
  const lg = curTree().legend, i = lg && lg.items.find(x => x.id === itemId); if (!i) return;
  selectOnly(LEG); beginEdit('legrow', itemId, i.text || '', true);
}
function startLegendTitle() { const lg = curTree().legend; if (!lg) return; selectOnly(LEG); beginEdit('legtitle', LEG, lg.text || 'Legenda', true); }
// posizione dell'editor sulla riga o sul titolo (coordinate dello schermo: la legenda non segue lo zoom, k = 1)
function legendEditorBox() {
  const t = curTree(), lo = legendLayout(t); if (!lo) return null;
  const p = legendPos(lo, t.legend.corner);
  if (editing.kind === 'legtitle') return { x: p.x + LPAD - 4, y: p.y + 8, w: lo.w - LPAD * 2 + 8, h: 20, font: LEG_TFONT, fs: 13, lh: 18, minW: 160, left: true, k: 1 };
  const idx = t.legend.items.findIndex(x => x.id === editing.id); if (idx < 0) return null;
  return { x: p.x + LPAD + LSW + 8, y: p.y + LHEAD + idx * LROW + 3, w: Math.max(180, lo.w - LPAD - LSW - 16), h: 20, font: LEG_FONT, fs: 13, lh: 18, minW: 180, left: true, k: 1 };
}
function commitLegendEdit(kind, id, v) {
  const t = curTree(), lg = t.legend; if (!lg) return;
  snapshot();
  if (kind === 'legtitle') lg.text = v || 'Legenda';
  else { const i = lg.items.find(x => x.id === id); if (i) i.text = v; }
  save();
}
function moveLegendRow(id, d) {
  mutate(t => { const it = t.legend.items, i = it.findIndex(x => x.id === id), j = i + d; if (i < 0 || j < 0 || j >= it.length) return; [it[i], it[j]] = [it[j], it[i]]; });
}
function removeLegendRow(id) {
  mutate(t => { t.legend.items = t.legend.items.filter(x => x.id !== id); });
}
function deleteLegend() { mutate(t => { delete t.legend; }); clearSel(); render(); }

/* ---------- menu ---------- */
function legendMenuHtml(rowId) {
  const lg = curTree().legend, it = lg.items, i = it.findIndex(x => x.id === rowId), c = lg.corner || 'br';
  const cor = (x, y) => `<svg viewBox="0 0 28 14" width="28" height="14" aria-hidden="true"><rect x="3" y="1.5" width="22" height="11" rx="2"/><rect x="${x}" y="${y}" width="4" height="3" rx="0.5" fill="currentColor"/></svg>`;
  return title('Legenda', 'Trascinala per spostarla') +
    (i >= 0 ? item('lredit', 'Modifica descrizione', '', 'Doppio clic') +
      (i > 0 ? item('lrup', 'Sposta su') : '') + (i < it.length - 1 ? item('lrdown', 'Sposta giù') : '') +
      item('lrdel', 'Togli dalla legenda', ' dng') + SEP : '') +
    item('ltitle', 'Rinomina la legenda') +
    seg('Angolo', [['lc-tl', 'In alto a sinistra', c === 'tl', cor(5, 3)], ['lc-tr', 'In alto a destra', c === 'tr', cor(19, 3)],
      ['lc-bl', 'In basso a sinistra', c === 'bl', cor(5, 8)], ['lc-br', 'In basso a destra', c === 'br', cor(19, 8)]]) + SEP + item('ldel', 'Elimina la legenda', ' dng', '', 'Toglie il riquadro con tutte le voci');
}
