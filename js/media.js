// Blocchi multimediali: immagine ('img') e audio ('audio'). Il file sta dentro la mappa come data URL, così viaggia
// con il progetto (localStorage, file .json, cartella, online) senza un archivio a parte.
// - Immagine: n.img = { src, w, h } (misure in pixel dopo la riduzione); n.text = didascalia sotto (vuota = niente).
//   All'inserimento si riduce a IMG_MAX px sul lato lungo (WebP, o JPEG dove manca), tranne SVG e GIF piccole che
//   restano come sono. Larghezza di serie fino a 280 px; la maniglia cambia la larghezza, l'altezza segue le proporzioni.
// - Audio: n.audio = { src, name, dur }; n.text = titolo (vuoto = nome del file). Fino a AUDIO_MAX byte.
//   Pulsante ▶/❚❚ (data-play) e barra di avanzamento (data-seek, clic = salta lì), anche in sola lettura.
//   Si ascolta un audio alla volta (AUD); l'avanzamento si aggiorna sugli elementi della tela, senza ridisegnare.
// Sulla tela si usano indirizzi blob: (mediaUrl) per non riscrivere i dati a ogni ridisegno e non far lampeggiare le
// immagini; nell'esportazione (live = false) resta il data URL, così il file è autonomo.
const IMG_MAX = 1600, AUDIO_MAX = 3 * 1024 * 1024, MEDIA = { img: 1, audio: 1 };
const isMedia = n => !!(n && MEDIA[n.type]);

/* ---------- file ---------- */
const MEDIA_URL = new Map();
function mediaUrl(src, live) {
  if (!live || !src || !src.startsWith('data:')) return src;
  let u = MEDIA_URL.get(src);
  if (!u) {
    try {
      const i = src.indexOf(','), mime = src.slice(5, i).split(';')[0], bin = atob(src.slice(i + 1)), a = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) a[k] = bin.charCodeAt(k);
      u = URL.createObjectURL(new Blob([a], { type: mime }));
    } catch (e) { u = src; }
    MEDIA_URL.set(src, u);
  }
  return u;
}
// finestra di scelta del file (deve partire da un clic o da un tasto)
function pickFile(accept) {
  return new Promise(res => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept });
    inp.onchange = () => res(inp.files[0] || null);
    inp.addEventListener('cancel', () => res(null));
    inp.click();
  });
}
const readDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
async function readImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = new Image(); im.src = url; await im.decode();
    const w0 = im.naturalWidth || 300, h0 = im.naturalHeight || 200;
    // vettoriali e GIF animate piccole: come sono
    if (file.type === 'image/svg+xml' || (file.type === 'image/gif' && file.size < 1.5e6)) return { src: await readDataUrl(file), w: w0, h: h0 };
    const k = Math.min(1, IMG_MAX / Math.max(w0, h0)), w = Math.round(w0 * k), h = Math.round(h0 * k);
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
    c.getContext('2d').drawImage(im, 0, 0, w, h);
    let src = c.toDataURL('image/webp', 0.85);
    if (!src.startsWith('data:image/webp')) src = c.toDataURL('image/jpeg', 0.85);
    // già piccola e non ridotta: si tiene l'originale, se pesa meno
    if (k === 1 && file.size * 1.37 < src.length) src = await readDataUrl(file);
    return { src, w, h };
  } finally { URL.revokeObjectURL(url); }
}
async function readAudio(file) {
  if (file.size > AUDIO_MAX) { toast(`Audio troppo grande: al massimo ${AUDIO_MAX / 1048576} MB`); return null; }
  const src = await readDataUrl(file);
  const dur = await new Promise(res => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(isFinite(a.duration) ? a.duration : 0); a.onerror = () => res(0); a.src = mediaUrl(src, true); });
  return { src, name: file.name.replace(/\.[^.]+$/, ''), dur: Math.round(dur * 10) / 10 };
}
// chiede il file e lo legge: { img } o { audio }, oppure null (annullato, non valido)
async function chooseMedia(kind) {
  const f = await pickFile(kind === 'img' ? 'image/*' : 'audio/*'); if (!f) return null;
  try {
    if (kind === 'img') { if (!f.type.startsWith('image/')) return toast('Scegli un file d’immagine'), null; return { img: await readImage(f) }; }
    if (!f.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm)$/i.test(f.name)) return toast('Scegli un file audio'), null;
    const a = await readAudio(f); return a && { audio: a };
  } catch (e) { toast('Non riesco a leggere il file'); return null; }
}
// blocco già sulla tela: sceglie (o cambia) l'immagine o l'audio
async function pickMedia(id) {
  const f0 = findM(curTree(), id); if (!f0 || !isMedia(f0.n) || readOnly()) return;
  const m = await chooseMedia(f0.n.type); if (!m) return;
  mutate(t => {
    const f = findM(t, id); if (!f) return;
    const n = f.n; delete n.w; delete n.h; // nuove proporzioni: misure di serie
    if (m.img) n.img = m.img; else { n.audio = m.audio; if (AUD.id === id) stopAudio(); }
  });
}
// nuovo blocco dalla barra dei componenti: prima il file, poi il blocco centrato in (x, y)
async function addMediaBlock(k, x, y) {
  const m = await chooseMedia(k); if (!m) return;
  const c = Object.assign(mk(''), { type: k }, m);
  mutate(t => {
    (t.free = t.free || []).push(c);
    const sz = sizeMap(t).get(c.id) || { w: 200, h: 120 };
    c.x = Math.round(x - sz.w / 2); c.y = Math.round(y - sz.h / 2);
  });
  selectOnly(c.id); render();
}

/* ---------- immagine ---------- */
// a ogni ridisegno un <image> nuovo resterebbe vuoto finché il browser non lo decodifica (lampeggia, e durante un
// trascinamento non si vede affatto): si rimettono al loro posto gli elementi di prima con la stessa immagine
function takeImages() {
  const m = new Map();
  vp.querySelectorAll('image.bimg').forEach(el => { const h = el.getAttribute('href'); (m.get(h) || m.set(h, []).get(h)).push(el); });
  return m;
}
function keepImages(m) {
  if (!m.size) return;
  vp.querySelectorAll('image.bimg').forEach(el => {
    const old = (m.get(el.getAttribute('href')) || []).pop(); if (!old) return;
    ['x', 'y', 'width', 'height'].forEach(a => old.setAttribute(a, el.getAttribute(a)));
    el.replaceWith(old);
  });
}
const IMG_P = 6;
function imgSize(n, lv, fs, font, lh) {
  const I = n.img, P = IMG_P;
  const w = Math.round(n.w || (I ? Math.min(280, Math.max(80, I.w + P * 2)) : 220));
  const iw = w - P * 2, ih = I ? Math.max(8, Math.round(iw * I.h / I.w)) : 120;
  const lines = n.text ? wrap(n.text, iw - 8, font, 3) : [], capH = lines.length ? lines.length * lh + 10 : 0;
  return { lines, lh, w, h: P * 2 + ih + capH, im: { iw, ih, capH } };
}
function imgMarkup(n, l, live, fsSt) {
  const M = l.im, P = IMG_P;
  let s = n.img ? `<image class="bimg" href="${esc(mediaUrl(n.img.src, live))}" x="${P}" y="${P}" width="${M.iw}" height="${M.ih}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect class="mph" x="${P}" y="${P}" width="${M.iw}" height="${M.ih}" rx="5"/>` +
      `<path class="mphi" d="M${l.w / 2 - 16},${P + M.ih / 2 + 4} l9,-11 7,8 5,-5 11,13 Z M${l.w / 2 + 8},${P + M.ih / 2 - 12} m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0"/>` +
      (live ? `<text class="mpht" x="${l.w / 2}" y="${P + M.ih / 2 + 24}" text-anchor="middle">Doppio clic: scegli un’immagine</text>` : '');
  s += l.lines.map((t, i) => `<text x="${l.w / 2}" y="${P + M.ih + 5 + (i + 0.76) * l.lh}" text-anchor="middle"${fsSt}>${esc(t)}</text>`).join('');
  return s;
}

/* ---------- audio ---------- */
const AU_X = 52; // il testo comincia dopo il pulsante
const fmtTime = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function audioSize(n, lv, fs, font, lh) {
  const w = Math.round(n.w || 250), title = n.text || (n.audio ? n.audio.name : '') || 'Audio';
  const lines = wrap(title, w - AU_X - 12, font, 2), h = Math.max(54, 12 + lines.length * lh + 30);
  return { lines, lh, w, h, au: { barY: h - 22, barW: w - AU_X - 14 } };
}
function audioMarkup(n, l, live, fsSt) {
  const A = l.au, cy = l.h / 2, on = live && AUD.id === n.id && AUD.el, playing = on && !AUD.el.paused;
  const dur = (on && isFinite(AUD.el.duration) && AUD.el.duration) || (n.audio && n.audio.dur) || 0, cur = on ? AUD.el.currentTime : 0;
  const ico = playing ? `M${19},${cy - 6} v12 M${27},${cy - 6} v12` : `M${19},${cy - 7} L${30},${cy} L${19},${cy + 7} Z`;
  let s = `<g class="aplay${n.audio ? '' : ' off'}${playing ? ' on' : ''}"${live && n.audio ? ' data-play="1"' : ''}>${live && n.audio ? `<title>${playing ? 'Pausa' : 'Ascolta'}</title>` : ''}` +
    `<circle class="abtn" cx="24" cy="${cy}" r="15"/><path class="aico${playing ? ' pz' : ''}" d="${ico}"/></g>`;
  s += l.lines.map((t, i) => `<text class="litem" x="${AU_X}" y="${10 + (i + 0.76) * l.lh}"${fsSt}>${esc(t)}</text>`).join('');
  if (n.audio) {
    const fr = dur ? Math.min(1, cur / dur) : 0;
    s += `<g class="aseek"${live ? ' data-seek="1"' : ''}>${live ? `<rect class="ahit" x="${AU_X - 4}" y="${A.barY - 7}" width="${A.barW + 8}" height="16"/>` : ''}` +
      `<rect class="abar" x="${AU_X}" y="${A.barY}" width="${A.barW}" height="3" rx="1.5"/><rect class="aprog" x="${AU_X}" y="${A.barY}" width="${A.barW * fr}" height="3" rx="1.5"/></g>` +
      `<text class="atime" x="${AU_X}" y="${A.barY + 15}">${on ? fmtTime(cur) + ' / ' : ''}${fmtTime(dur)}</text>`;
  } else if (live) s += `<text class="mpht" x="${AU_X}" y="${A.barY + 8}">Doppio clic: scegli un audio</text>`;
  return s;
}
// riproduzione: un audio alla volta
const AUD = { id: null, el: null, raf: 0 };
function stopAudio() {
  if (AUD.el) { AUD.el.pause(); AUD.el.onplay = AUD.el.onpause = AUD.el.onended = null; }
  cancelAnimationFrame(AUD.raf); AUD.id = AUD.el = null;
}
function playAudio(id, frac) {
  const f = findM(curTree(), id); if (!f || !f.n.audio) return;
  if (AUD.id !== id) {
    stopAudio();
    const el = new Audio(mediaUrl(f.n.audio.src, true));
    AUD.id = id; AUD.el = el;
    el.onplay = () => { render(); audioTick(); };
    el.onpause = () => render();
    el.onended = () => { el.currentTime = 0; render(); };
    el.onerror = () => { toast('Non riesco a riprodurre questo audio'); stopAudio(); render(); };
  }
  const el = AUD.el;
  if (frac != null) { const go = () => { if (isFinite(el.duration)) el.currentTime = frac * el.duration; }; if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', go, { once: true }); if (el.paused) el.play().catch(() => {}); else audioTick(); return; }
  if (el.paused) el.play().catch(() => {}); else el.pause();
}
// clic sulla barra: salta a quel punto (e fa partire l'audio)
function seekAudio(id, p) {
  const l = S.L.get(id); if (!l || !l.au) return;
  playAudio(id, Math.min(1, Math.max(0, (p.x - l.x - AU_X) / l.au.barW)));
}
// avanzamento: aggiorna barra e tempo sulla tela, senza ridisegnare
function audioTick() {
  cancelAnimationFrame(AUD.raf);
  const el = AUD.el; if (!el) return;
  const l = S.L.get(AUD.id), g = vp.querySelector(`.mn[data-id="${AUD.id}"]`);
  if (!findM(curTree(), AUD.id)) { stopAudio(); return; } // blocco eliminato o progetto cambiato
  if (g && l && l.au) {
    const f = findM(curTree(), AUD.id), dur = (isFinite(el.duration) && el.duration) || (f.n.audio && f.n.audio.dur) || 0, pr = g.querySelector('.aprog'), tm = g.querySelector('.atime');
    if (pr) pr.setAttribute('width', dur ? l.au.barW * Math.min(1, el.currentTime / dur) : 0);
    if (tm) tm.textContent = `${fmtTime(el.currentTime)} / ${fmtTime(dur)}`;
  }
  if (!el.paused) AUD.raf = requestAnimationFrame(audioTick);
}

/* ---------- editor della didascalia / del titolo ---------- */
function mediaEditorBox(l, f, sx, sy, k) {
  const font = nodeFont(f.n, l.depth), fs = fsOf(f.n, l.depth);
  if (l.im) {
    const y = IMG_P + l.im.ih + 2, h = Math.max(l.im.capH, l.lh + 10);
    return { x: sx(l.x + IMG_P), y: sy(l.y + y), w: l.im.iw * k, h: h * k, font, fs, lh: l.lh, minW: 160 };
  }
  return { x: sx(l.x + AU_X - 3), y: sy(l.y + 6), w: (l.w - AU_X - 6) * k, h: (l.lines.length * l.lh + 8) * k, font, fs, lh: l.lh, minW: 160, left: true };
}
