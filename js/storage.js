// Progetti in localStorage, undo, livelli e selezione
// localStorage['officina-mappe-v3'] = { projects: [{ id, name, updated, root }], cur }
const KEY = 'officina-mappe-v3', V2 = 'officina-mappe-v2', V1 = 'officina-mappe-v1';
function mk(text, children = []) { return { id: uid(), text, children }; }

/* ---------- alberi ---------- */
// Ogni livello (mappa principale o struttura interna) è un albero con radice `tree` e, in più:
//   tree.free  = blocchi liberi (alberi senza collegamento) · tree.notes = note sulla tela
function walk(n, f, p = null, depth = 0) { f(n, p, depth); n.children.forEach(c => walk(c, f, n, depth + 1)); }
function walkAll(tree, f) { walk(tree, f); (tree.free || []).forEach(r => walk(r, f, null, 1)); }
// { n, p, list }: list = array che contiene il blocco (children del genitore o tree.free), null per la radice
function findM(tree, id) {
  let r = null;
  walkAll(tree, (n, p) => { if (n.id === id) r = { n, p, list: p ? p.children : n === tree ? null : tree.free }; });
  return r;
}
const findNote = (tree, id) => (tree.notes || []).find(x => x.id === id);

/* ---------- progetti ---------- */
const curProject = () => S.projects.find(p => p.id === S.pid);
function load() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (j && Array.isArray(j.projects) && j.projects.length) {
      S.projects = j.projects; S.pid = j.projects.some(p => p.id === j.cur) ? j.cur : j.projects[0].id; S.root = curProject().root; return;
    }
  } catch (e) {}
  // primo avvio: recupera la mappa della versione precedente (v2, oppure la mappa mentale aperta nella v1)
  let root = null;
  try { const j = JSON.parse(localStorage.getItem(V2) || 'null'); if (j && j.root) root = j.root; } catch (e) {}
  if (!root) try {
    const o = JSON.parse(localStorage.getItem(V1) || 'null');
    const minds = (o && Array.isArray(o.docs) ? o.docs : []).filter(d => d.type === 'mind' && d.data && d.data.root);
    const d = minds.find(x => x.id === o.cur) || minds[0]; if (d) root = d.data.root;
  } catch (e) {}
  if (!root) root = mk('Idea centrale', [mk('Ramo 1'), mk('Ramo 2'), mk('Ramo 3')]);
  const p = { id: uid(), name: root.text || 'Mappa', updated: Date.now(), root };
  S.projects = [p]; S.pid = p.id; S.root = root; saveNow();
}
function writeStore() {
  const p = curProject(); p.root = S.root; p.updated = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify({ projects: S.projects, cur: S.pid })); return true; }
  catch (e) { toast('Salvataggio non disponibile in questo browser'); return false; }
}
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(writeStore, 250); }
function saveNow() { clearTimeout(saveT); return writeStore(); }

/* ---------- livelli: la mappa principale e le strutture interne dei blocchi ---------- */
// albero visibile: si scende lungo S.path, ogni blocco tiene la sua struttura interna in n.sub
function curTree() {
  let t = S.root;
  for (let i = 0; i < S.path.length; i++) {
    const f = findM(t, S.path[i]);
    if (!f || !f.n.sub) { S.path = S.path.slice(0, i); break; }
    t = f.n.sub;
  }
  return t;
}
// cambia la radice del livello visibile (quando l'idea centrale viene collegata sotto un altro blocco o eliminata)
function setLevelRoot(nr) { const owner = ownerNode(); if (owner) owner.sub = nr; else S.root = nr; }
// blocco "proprietario" del livello visibile (null nella mappa principale)
function ownerNode() {
  if (!S.path.length) return null;
  let t = S.root, n = null;
  for (const id of S.path) { n = findM(t, id).n; t = n.sub; }
  return n;
}

/* ---------- selezione (blocchi e note della tela) ---------- */
function selectOnly(id) { S.sels = new Set(id ? [id] : []); S.sel = id || null; S.esel = null; }
// collegamento selezionato: si indica con l'id del blocco in cui entra
function selectEdge(id) { selectOnly(null); S.esel = id; }
function clearSel() { selectOnly(null); }
function toggleSel(id) {
  if (S.sels.has(id)) { S.sels.delete(id); if (S.sel === id) S.sel = [...S.sels].pop() || null; }
  else { S.sels.add(id); S.sel = id; }
}
function pruneSel() {
  const t = curTree(); S.sels = new Set([...S.sels].filter(id => findM(t, id) || findNote(t, id)));
  if (S.sel && !S.sels.has(S.sel)) S.sel = [...S.sels].pop() || null;
  if (S.esel) { const f = findM(t, S.esel); if (!f || !f.p) S.esel = null; }
}

/* ---------- undo ---------- */
function snapshot() { S.undo.push(JSON.stringify(S.root)); if (S.undo.length > 100) S.undo.shift(); }
function undo() {
  if (!S.undo.length) return toast('Niente da annullare');
  S.root = JSON.parse(S.undo.pop()); curTree(); pruneSel(); save(); render();
}
// ogni modifica passa da qui: snapshot per undo → modifica dell'albero visibile → salva → ridisegna
function mutate(fn) { snapshot(); fn(curTree()); save(); render(); }
