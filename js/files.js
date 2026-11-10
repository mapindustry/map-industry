// Progetti come file .json in una cartella scelta dall'utente (File System Access API: Edge e Chrome, anche da file://).
// - La cartella si sceglie dal menu Progetti; il suo riferimento resta in IndexedDB, così al prossimo avvio basta
//   riconfermare il permesso: il browser lo chiede al primo clic o tasto (serve un gesto dell'utente).
// - Ogni progetto è un file { app, version: 3, project: { id, name, updated, root } } (p.file = nome del file).
//   Il salvataggio resta automatico: dopo ogni modifica si scrive anche il file. Rinominare il progetto rinomina il file;
//   eliminarlo lo sposta nella sottocartella "Eliminati" (niente si perde davvero).
// - localStorage resta la copia di riserva: se la cartella non è raggiungibile si lavora lì e si riscrive dopo.
// - Il file è la versione buona: aprendo un progetto lo si rilegge, così vale anche se è cambiato altrove (OneDrive).
const FS = { dir: null, ok: false, warned: false, chain: Promise.resolve(), stamp: {} };
const fsSupported = typeof window.showDirectoryPicker === 'function';
const TRASH = 'Eliminati';

/* ---------- IndexedDB: solo il riferimento alla cartella ---------- */
function idbReq(mode, fn) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('officina-mappe-fs', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onerror = () => rej(r.error);
    r.onsuccess = () => {
      const tx = r.result.transaction('h', mode), q = fn(tx.objectStore('h'));
      tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error);
    };
  });
}
const idbGet = k => idbReq('readonly', st => st.get(k));
const idbSet = (k, v) => idbReq('readwrite', st => st.put(v, k));

/* ---------- permessi ---------- */
async function fsPerm(dir, ask) {
  if (!dir.queryPermission) return 'granted'; // cartelle interne del browser (prove)
  const o = { mode: 'readwrite' };
  let s = await dir.queryPermission(o);
  if (s === 'prompt' && ask) s = await dir.requestPermission(o);
  return s;
}

/* ---------- nomi dei file ---------- */
const safeName = n => (n || 'Senza nome').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Senza nome';
async function fsNames() { const s = new Set(); for await (const [n, h] of FS.dir.entries()) if (h.kind === 'file') s.add(n.toLowerCase()); return s; }
// nome libero nella cartella: "Nome.json", altrimenti "Nome (2).json", ...
async function freeName(name, keep) {
  const taken = await fsNames(), base = safeName(name);
  for (let i = 1; ; i++) { const n = base + (i > 1 ? ` (${i})` : '') + '.json'; if (n === keep || !taken.has(n.toLowerCase())) return n; }
}
const fileJson = p => JSON.stringify({ app: 'officina-mappe', version: 3, project: { id: p.id, name: p.name, updated: p.updated, root: p.root } }, null, 1);
// una mappa da un file: progetto salvato da qui, oppure una mappa della versione precedente
function parseProject(text) {
  let j; try { j = JSON.parse(text); } catch (e) { return null; }
  const root = j && j.project && j.project.root || j && j.root || j && j.type === 'mind' && j.data && j.data.root;
  if (!root || !Array.isArray(root.children)) return null;
  flattenSubs(root);
  return { id: (j.project && j.project.id) || null, name: (j.project && j.project.name) || j.name || root.text || 'Mappa', root };
}

/* ---------- scrittura (una alla volta, in coda) ---------- */
function fsQueue(fn) { FS.chain = FS.chain.then(fn).catch(fsFail); return FS.chain; }
function fsFail(e) {
  console.warn('cartella dei progetti:', e);
  if (!FS.warned) { FS.warned = true; toast('Non riesco a scrivere nella cartella: per ora salvo solo nel browser'); }
}
async function writeFileNow(p) {
  if (!p.file) p.file = await freeName(p.name);
  const h = await FS.dir.getFileHandle(p.file, { create: true }), w = await h.createWritable();
  await w.write(fileJson(p)); await w.close();
  FS.stamp[p.file] = (await h.getFile()).lastModified; FS.warned = false;
}
// chiamata da writeStore dopo ogni salvataggio nel browser
function fsSave(p) { if (FS.ok && p) return fsQueue(() => writeFileNow(p)); }

/* ---------- lettura della cartella ---------- */
// i progetti diventano i file della cartella. Quelli del browser senza file (nuovi, o di prima della cartella)
// vengono scritti; quelli il cui file è sparito dalla cartella escono dall'elenco (il file resta la versione buona).
async function fsSync(migrate) {
  const found = [];
  for await (const [name, h] of FS.dir.entries()) {
    if (h.kind !== 'file' || !/\.json$/i.test(name)) continue;
    const f = await h.getFile(), pr = parseProject(await f.text()); if (!pr) continue;
    found.push({ ...pr, file: name, time: f.lastModified });
  }
  const byFile = new Map(found.map(x => [x.file, x])), keep = [];
  S.projects.forEach(p => {
    const x = (p.file && byFile.get(p.file)) || found.find(y => y.id && y.id === p.id && !keep.some(k => k.file === y.file));
    if (x) { byFile.delete(x.file); keep.push(mergeFile(p, x)); }
    else if (!p.file || migrate || p.id === S.pid) { delete p.file; keep.push(p); } // da scrivere nella cartella
  });
  byFile.forEach(x => keep.push({ id: x.id && !keep.some(k => k.id === x.id) ? x.id : uid(), name: x.name, updated: x.time, root: x.root, file: x.file }));
  S.projects = keep;
  if (!S.projects.some(p => p.id === S.pid)) { S.pid = [...S.projects].sort((a, b) => b.updated - a.updated)[0].id; S.root = curProject().root; S.undo = []; S.redo = []; }
  S.tabs = S.tabs.filter(id => S.projects.some(p => p.id === id)); if (!S.tabs.includes(S.pid)) S.tabs.push(S.pid);
  for (const p of S.projects) if (!p.file || p.newer) { delete p.newer; await writeFileNow(p); }
  saveNow(); render();
}
// il file vince sulla copia del browser, tranne per il progetto aperto con modifiche non ancora scritte
function mergeFile(p, x) {
  FS.stamp[x.file] = x.time; p.file = x.file;
  const local = p.id === S.pid && dirty;
  if (!local && x.time > (p.updated || 0) - 1000) {
    p.root = x.root; p.name = x.name; p.updated = x.time;
    if (p.id === S.pid) { S.root = p.root; S.undo = []; S.redo = []; pruneSel(); }
  } else p.newer = true; // la copia del browser è più recente (modifiche fatte prima di riconnettere): si riscrive il file
  return p;
}
// rilegge il file di un progetto prima di aprirlo (se è cambiato altrove)
async function fsReload(p) {
  if (!FS.ok || !p.file) return;
  try {
    const h = await FS.dir.getFileHandle(p.file), f = await h.getFile();
    if (FS.stamp[p.file] && f.lastModified <= FS.stamp[p.file]) return;
    const pr = parseProject(await f.text()); if (!pr) return;
    p.root = pr.root; p.name = pr.name; p.updated = f.lastModified; FS.stamp[p.file] = f.lastModified;
  } catch (e) { /* file sparito: resta la copia del browser, verrà riscritto */ delete p.file; }
}

/* ---------- azioni dal menu ---------- */
async function chooseFolder() {
  if (!fsSupported) return toast('Questo browser non può salvare in una cartella: usa Edge o Chrome');
  let dir; try { dir = await window.showDirectoryPicker({ id: 'officina-mappe', mode: 'readwrite', startIn: 'documents' }); } catch (e) { return; } // annullato
  await useFolder(dir, true);
}
async function useFolder(dir, migrate) {
  if (await fsPerm(dir, true) !== 'granted') return toast('Senza il permesso di scrittura i progetti restano nel browser');
  FS.dir = dir; FS.ok = true; FS.warned = false;
  try { await idbSet('dir', dir); } catch (e) { /* la cartella andrà riscelta al prossimo avvio */ }
  if (migrate) S.projects.forEach(p => { delete p.file; }); // cartella nuova: ci finiscono tutti i progetti
  try { await fsSync(migrate); toast(`Progetti salvati nella cartella «${dir.name}»`); }
  catch (e) { FS.ok = false; fsFail(e); }
}
async function reconnectFolder() {
  if (!FS.dir) return chooseFolder();
  if (await fsPerm(FS.dir, true) !== 'granted') return toast('Permesso negato: i progetti restano nel browser');
  FS.ok = true; try { await fsSync(false); toast(`Cartella «${FS.dir.name}» riconnessa`); } catch (e) { FS.ok = false; fsFail(e); }
}
// rinomina: nuovo nome del file uguale al nome del progetto (il vecchio file si toglie dopo aver scritto il nuovo)
function fsRename(p) {
  if (!FS.ok || !p.file) return;
  return fsQueue(async () => {
    const old = p.file, want = await freeName(p.name, old); if (want === old) return;
    p.file = want; await writeFileNow(p);
    try { await FS.dir.removeEntry(old); } catch (e) { /* già sparito */ }
  });
}
// eliminare un progetto sposta il suo file in "Eliminati" (copia, poi tolto dalla cartella)
function fsTrash(p) {
  if (!FS.ok || !p.file) return;
  return fsQueue(async () => {
    const bin = await FS.dir.getDirectoryHandle(TRASH, { create: true });
    const h = await bin.getFileHandle(p.file.replace(/\.json$/i, '') + ` (${new Date().toISOString().slice(0, 10)}).json`, { create: true });
    const w = await h.createWritable(); await w.write(fileJson(p)); await w.close();
    await FS.dir.removeEntry(p.file);
  });
}

/* ---------- avvio ---------- */
// cartella già scelta: se il permesso c'è si legge subito, altrimenti si chiede al primo clic o tasto
async function fsInit() {
  if (!fsSupported) return;
  let dir; try { dir = await idbGet('dir'); } catch (e) { return; }
  if (!dir) return;
  FS.dir = dir;
  if (await fsPerm(dir, false) === 'granted') { FS.ok = true; try { await fsSync(false); } catch (e) { FS.ok = false; fsFail(e); } return; }
  const ask = () => { removeEventListener('pointerdown', ask, true); removeEventListener('keydown', ask, true); reconnectFolder(); };
  addEventListener('pointerdown', ask, true); addEventListener('keydown', ask, true);
}
