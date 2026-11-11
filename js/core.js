// Utilità condivise, stato globale e misurazione del testo
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FB = '"Instrument Sans", "Segoe UI", system-ui, sans-serif';

// root: albero della mappa
// sels: blocchi selezionati · sel: blocco "principale" (ultimo cliccato, usato da Tab/Invio/F2)
// views: pan/zoom della mappa · L: layout calcolato dei blocchi visibili
// projects/pid: progetti salvati e quello aperto · link: collegamento che si sta trascinando
// E: punti medi dei collegamenti (per le note) · NL: layout delle note sulla tela
const S = { projects: [], pid: null, root: null, sel: null, sels: new Set(), esel: null, views: {}, undo: [], redo: [], L: null, E: null, NL: null, link: null, clip: null, dropOn: null, rail: null, style: null, legDrag: null, tabs: [] };
const BAR_H = 48; // altezza della barra dei menu
// barra laterale dei componenti (js/sidebar.js): quando è aperta la vista utile finisce prima
const SIDE_W = 184; let SIDE_OPEN = false;
const viewW = () => innerWidth - (SIDE_OPEN && !document.body.classList.contains('gate') ? SIDE_W : 0);
const cv = $('#cv'), vp = $('#vp');

/* ---------- misurazione del testo ---------- */
const mctx = document.createElement('canvas').getContext('2d');
function tw(t, font) { mctx.font = font; return mctx.measureText(t).width; }
function ell(t, maxW, font) {
  t = String(t || '');
  if (tw(t, font) <= maxW) return t;
  while (t.length > 1 && tw(t + '…', font) > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
function wrap(t, maxW, font, maxLines = 4) {
  // gli a capo scritti dall'utente (Maiusc+Invio) restano: ogni paragrafo va a capo per conto suo
  const lines = [];
  String(t || '').split('\n').forEach(par => {
    let cur = '';
    for (const w of par.split(/\s+/).filter(Boolean)) {
      const test = cur ? cur + ' ' + w : w;
      if (!cur || tw(test, font) <= maxW) cur = test; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
  });
  if (!lines.length) return [''];
  const out = lines.map(l => ell(l, maxW, font));
  if (out.length > maxLines) { const k = out.slice(0, maxLines); k[maxLines - 1] = ell(k[maxLines - 1] + '…', maxW, font); return k; }
  return out;
}
let toastT;
let roT = 0; // avviso della sola lettura: uno ogni tanto
function roToast() { if (Date.now() - roT > 2500) { roT = Date.now(); toast('Mappa bloccata: clic sul lucchetto in alto per modificarla'); } }
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2000); }
