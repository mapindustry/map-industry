// Esportazione del livello visibile: SVG autonomo e PDF (tramite la stampa del browser)
const SVGNS = 'http://www.w3.org/2000/svg', XPAD = 28;
const XSHAPES = new Set(['rect', 'path', 'line', 'circle', 'polygon', 'text']);
const XFONT_URL = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap';
const xctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
const xcolors = {};

// qualsiasi colore CSS (anche color-mix) → rgb() leggibile da ogni programma
function toRgb(c) {
  if (!c || c === 'none' || c.startsWith('url(')) return c;
  if (xcolors[c]) return xcolors[c];
  xctx.clearRect(0, 0, 1, 1); xctx.fillStyle = '#000'; xctx.fillStyle = c; xctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = xctx.getImageData(0, 0, 1, 1).data;
  return (xcolors[c] = a === 0 ? 'none' : a === 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`);
}
// copia sugli elementi gli stili calcolati, così il file non dipende dal CSS dell'app
function inlineStyles(src, dst) {
  const a = src.querySelectorAll('*'), b = dst.querySelectorAll('*');
  for (let i = 0; i < a.length; i++) {
    const s = a[i], d = b[i], tag = s.tagName.toLowerCase();
    // il bagliore delle idee primarie vive di una sfocatura CSS: fuori dall'app sarebbe una cornice piena
    if (tag === 'title' || s.classList.contains('shit') || s.classList.contains('glow')) { d.remove(); continue; }
    if (XSHAPES.has(tag)) {
      const cs = getComputedStyle(s), set = (p, v) => d.style.setProperty(p, v);
      set('fill', toRgb(cs.fill)); set('stroke', toRgb(cs.stroke));
      if (cs.stroke !== 'none') set('stroke-width', cs.strokeWidth);
      if (cs.strokeDasharray !== 'none') set('stroke-dasharray', cs.strokeDasharray);
      if (cs.strokeLinecap !== 'butt') set('stroke-linecap', cs.strokeLinecap);
      if (cs.opacity !== '1') set('opacity', cs.opacity);
      if (tag === 'text') { set('font-family', cs.fontFamily); set('font-size', cs.fontSize); set('font-weight', cs.fontWeight); if (cs.fontStyle !== 'normal') set('font-style', cs.fontStyle); }
    }
    d.removeAttribute('class');
  }
}
// disegna il livello in versione statica (senza selezione né pallini), in tema chiaro
function snapshotSvg() {
  const root = document.documentElement, theme = root.dataset.theme;
  root.dataset.theme = 'light';
  const t = curTree(), L = mindLayout(t), NL = notesLayout(t);
  const tmp = document.createElementNS(SVGNS, 'svg'); tmp.setAttribute('class', 'exp');
  // con gli schemi delle strutture interne aperti
  tmp.innerHTML = `<g>${treeMarkup(t, L, NL, false, true)}</g>`; document.body.appendChild(tmp);
  try {
    const g = tmp.firstChild, bb = g.getBBox(); if (!bb.width) return null;
    const x = Math.floor(bb.x - XPAD), y = Math.floor(bb.y - XPAD), w = Math.ceil(bb.width + XPAD * 2), h = Math.ceil(bb.height + XPAD * 2);
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('xmlns', SVGNS); svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.appendChild(document.createElementNS(SVGNS, 'defs'));
    const bg = document.createElementNS(SVGNS, 'rect');
    [['x', x], ['y', y], ['width', w], ['height', h]].forEach(([k, v]) => bg.setAttribute(k, v));
    bg.setAttribute('fill', toRgb(getComputedStyle(document.body).backgroundColor)); svg.appendChild(bg);
    const gc = g.cloneNode(true); inlineStyles(g, gc); svg.appendChild(gc);
    return { svg, w, h };
  } finally {
    tmp.remove();
    if (theme === undefined) delete root.dataset.theme; else root.dataset.theme = theme;
  }
}
// Instrument Sans (sottoinsieme latino) incorporato come data URL
let xfontP = null;
const blobUrl = blob => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });
function fontCss() {
  return xfontP || (xfontP = (async () => {
    const css = await (await fetch(XFONT_URL)).text();
    let blocks = css.split('@font-face').slice(1);
    const latin = blocks.filter(b => /U\+0000-00FF/i.test(b)); if (latin.length) blocks = latin;
    const files = {}; let out = '';
    for (const b of blocks) {
      const url = (b.match(/url\((https:[^)]+)\)/) || [])[1]; if (!url) continue;
      files[url] = files[url] || await blobUrl(await (await fetch(url)).blob());
      out += '@font-face' + b.replace(/\/\*[^*]*\*\//g, '').replace(url, files[url]);
    }
    if (!out) throw new Error('nessun font');
    return out;
  })().catch(e => { xfontP = null; throw e; }));
}
async function buildSvg() {
  const x = snapshotSvg(); if (!x) throw new Error('vuota');
  try { const st = document.createElementNS(SVGNS, 'style'); st.textContent = await fontCss(); x.svg.querySelector('defs').appendChild(st); x.fonts = true; }
  catch (e) { x.fonts = false; }
  x.str = new XMLSerializer().serializeToString(x.svg);
  return x;
}
async function exportImage(fmt) {
  const x = await buildSvg(), name = fileName();
  if (fmt === 'svg') {
    downloadBlob(new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + x.str], { type: 'image/svg+xml' }), name.replace(/[\\/:*?"<>|]+/g, '-') + '.svg');
    return x;
  }
  // PDF: stampa un iframe con solo il disegno; il dialogo del browser offre "Salva come PDF"
  const fr = document.createElement('iframe');
  fr.setAttribute('aria-hidden', 'true');
  fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0';
  fr.srcdoc = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(name)}</title><style>
    @page{size:A4 ${x.w >= x.h ? 'landscape' : 'portrait'};margin:10mm}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0;height:100%}svg{display:block;width:100%;height:100%}</style></head><body>${x.str}</body></html>`;
  await new Promise(ok => { fr.onload = ok; document.body.appendChild(fr); });
  const w = fr.contentWindow;
  try { await w.document.fonts.ready; } catch (e) {}
  w.addEventListener('afterprint', () => setTimeout(() => fr.remove(), 100));
  setTimeout(() => fr.isConnected && fr.remove(), 120000);
  w.focus(); w.print();
  return x;
}
