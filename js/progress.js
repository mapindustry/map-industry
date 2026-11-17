// Blocco avanzamento (n.type 'prog', richiesto il 2026-11-17): titolo dell'attività (n.text) e barra con la percentuale
// n.pct (0–100, di serie 0). Clic o trascinamento sulla barra = imposta l'avanzamento (a passi di 5%), oppure il cursore
// nel menu del blocco. A 100% la barra diventa verde (--win). La maniglia cambia solo la larghezza.
const pctOf = n => clamp(Math.round(+n.pct || 0), 0, 100);
const PG_BAR = 10, PG_PCT = 46; // spessore della barra, spazio della percentuale a destra

function progSize(n, lv, fs, font, lh, padX, padY) {
  const w = Math.round(Math.max(150, n.w || 240)), lines = wrap(n.text || 'Attività', w - padX, font, 3);
  const titleH = padY / 2 + lines.length * lh + 6;
  return { lines, lh, w, h: titleH + PG_BAR + padY / 2 + 6, padX, pg: { ty: padY / 2, barY: titleH, bw: w - padX - PG_PCT } };
}
function progMarkup(n, l, live, fsSt) {
  const x0 = l.padX / 2, G = l.pg, pct = pctOf(n), fs = fsOf(n, l.depth);
  let s = l.lines.map((t, i) => `<text class="litem" x="${x0}" y="${G.ty + (i + 0.76) * l.lh}"${fsSt}>${esc(t)}</text>`).join('');
  s += `<g class="pbar${pct >= 100 ? ' full' : ''}"${live ? ' data-pbar="1"' : ''}>` +
    (live ? `<title>Clic o trascina: avanzamento</title><rect class="phit" x="${x0 - 4}" y="${G.barY - 8}" width="${G.bw + 8}" height="${PG_BAR + 16}"/>` : '') +
    `<rect class="ptrack" x="${x0}" y="${G.barY}" width="${G.bw}" height="${PG_BAR}" rx="${PG_BAR / 2}"/>` +
    (pct ? `<rect class="pfill" x="${x0}" y="${G.barY}" width="${Math.max(PG_BAR, G.bw * pct / 100)}" height="${PG_BAR}" rx="${PG_BAR / 2}"/>` : '') + `</g>` +
    `<text class="ppct${pct >= 100 ? ' full' : ''}" x="${l.w - x0}" y="${G.barY + PG_BAR / 2 + fs * 0.33}" text-anchor="end" style="font-size:${Math.max(10, fs - 1)}px">${pct}%</text>`;
  return s;
}
// percentuale nel punto p (coordinate della tela) della barra, a passi di 5
function pctAt(id, p) {
  const l = S.L.get(id); if (!l || !l.pg) return null;
  return clamp(Math.round((p.x - l.x - l.padX / 2) / l.pg.bw * 20) * 5, 0, 100);
}
function setPct(n, v) { if (v > 0) n.pct = v; else delete n.pct; }
// editor del titolo: sopra la barra
function progEditorBox(l, f, sx, sy, k) {
  return { x: sx(l.x + l.padX / 2 - 3), y: sy(l.y + 4), w: (l.w - l.padX + 6) * k, h: (l.pg.barY - 8) * k, font: nodeFont(f.n, l.depth), fs: fsOf(f.n, l.depth), lh: l.lh, minW: 160, left: true };
}
