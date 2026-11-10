// Progetti in localStorage, undo, livelli e selezione
// localStorage['officina-mappe-v3'] = { projects: [{ id, name, updated, root }], cur }
const KEY = 'officina-mappe-v3', V2 = 'officina-mappe-v2', V1 = 'officina-mappe-v1';
function mk(text, children = []) { return { id: uid(), text, children }; }

/* ---------- alberi ---------- */
// Ogni livello (mappa principale o struttura interna) è un albero con radice `tree` e, in più:
//   tree.free  = blocchi liberi (alberi senza collegamento) · tree.notes = note sulla tela
//   tree.void  = livello senza blocchi: la radice dei dati è solo un contenitore (note), non si disegna
function walk(n, f, p = null, depth = 0) { f(n, p, depth); n.children.forEach(c => walk(c, f, n, depth + 1)); }
function walkAll(tree, f) { if (!tree.void) walk(tree, f); (tree.free || []).forEach(r => walk(r, f, null, 1)); }
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
      S.projects = j.projects; S.pid = j.projects.some(p => p.id === j.cur) ? j.cur : j.projects[0].id; S.root = curProject().root;
      if (S.projects.map(p => flattenSubs(p.root)).some(Boolean)) saveNow();
      return;
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
  if (!root) root = mk('Idea primaria', [mk('Ramo 1'), mk('Ramo 2'), mk('Ramo 3')]);
  flattenSubs(root);
  const p = { id: uid(), name: root.text || 'Mappa', updated: Date.now(), root };
  S.projects = [p]; S.pid = p.id; S.root = root; saveNow();
}
function writeStore() {
  // la data cambia solo se c'è stata una modifica, non aprendo o lasciando il progetto
  const p = curProject(); p.root = S.root; if (dirty) { p.updated = Date.now(); dirty = false; }
  try { localStorage.setItem(KEY, JSON.stringify({ projects: S.projects, cur: S.pid })); return true; }
  catch (e) { toast('Salvataggio non disponibile in questo browser'); return false; }
}
let saveT, dirty = false;
function save() { dirty = true; clearTimeout(saveT); saveT = setTimeout(writeStore, 250); }
function saveNow() { clearTimeout(saveT); return writeStore(); }

/* ---------- la mappa: un solo livello ---------- */
const curTree = () => S.root;
// cambia la radice dei dati (quando viene collegata sotto un altro blocco o eliminata)
function setLevelRoot(nr) { S.root = nr; }
// Le vecchie strutture interne (n.sub, una mappa su una tela a parte) diventano rami del blocco, compressi:
// si aprono a ventaglio nella stessa mappa. Le loro posizioni erano di un'altra tela: si tolgono, e
// ensurePositions li ridispone accanto al blocco (placeNew). Se la radice interna ripeteva il blocco, sparisce
// e i suoi rami passano al blocco. I blocchi liberi interni diventano rami anche loro. true = convertito.
function flattenSubs(level) {
  const owners = []; walkAll(level, n => { if (n.sub) owners.push(n); });
  owners.forEach(n => {
    const sub = n.sub; delete n.sub;
    if (n.subOpen) n.foldPrev = true; delete n.subOpen; // l'anteprima accesa resta accesa
    flattenSubs(sub); // prima quelle annidate
    const same = sub.void || !sub.text || sub.text === n.text;
    let tops;
    if (same) tops = sub.void ? [] : sub.children;
    else { const r = { ...sub }; ['free', 'links', 'notes', 'groups', 'void', 'primary'].forEach(k => delete r[k]); tops = [r]; }
    tops = tops.concat(sub.free || []);
    tops.forEach(c => { if (c.edge) { ['po', 'pi', 'ps', 'sp'].forEach(k => delete c.edge[k]); if (!Object.keys(c.edge).length) delete c.edge; } });
    tops.forEach(c => walk(c, d => { delete d.x; delete d.y; delete d.fx; delete d.fy; delete d.dx; delete d.dy; delete d.flip; }));
    n.children.push(...tops);
    // collegamenti aggiuntivi: quelli verso la radice interna sparita passano al blocco
    (sub.links || []).forEach(x => { if (same && x.from === sub.id) x.from = n.id; if (same && x.to === sub.id) x.to = n.id; if (x.from !== x.to) (level.links = level.links || []).push(x); });
    // note interne: accanto al blocco (i gruppi interni non hanno più una tela su cui stare)
    (sub.notes || []).forEach((nt, i) => { nt.x = (n.x || 0) + 260; nt.y = (n.y || 0) + i * 50; (level.notes = level.notes || []).push(nt); });
    if (n.children.length) n.fold = true;
  });
  return owners.length > 0;
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
  const t = curTree(); S.sels = new Set([...S.sels].filter(id => findM(t, id) || findNote(t, id) || findGroup(t, id)));
  if (S.sel && !S.sels.has(S.sel)) S.sel = [...S.sels].pop() || null;
  if (S.esel && !edgeData(t, S.esel)) S.esel = null;
}

/* ---------- undo ---------- */
// ogni nuova modifica svuota la pila del "rifai"
function snapshot() { S.undo.push(JSON.stringify(S.root)); if (S.undo.length > 100) S.undo.shift(); S.redo = []; }
function undo() {
  if (!S.undo.length) return toast('Niente da annullare');
  S.redo.push(JSON.stringify(S.root));
  S.root = JSON.parse(S.undo.pop()); pruneSel(); save(); render();
}
function redo() {
  if (!S.redo.length) return toast('Niente da rifare');
  S.undo.push(JSON.stringify(S.root));
  S.root = JSON.parse(S.redo.pop()); pruneSel(); save(); render();
}
// ogni modifica passa da qui: snapshot per undo → modifica dell'albero visibile → salva → ridisegna
// su una tela vuota il primo blocco aggiunto (o incollato) diventa la radice dei dati del livello
function mutate(fn) { $('#hint').hidden = true; snapshot(); fn(curTree()); const t = curTree(); if (t.void && t.free && t.free.length) promoteRoot(t, t.free[0]); save(); render(); }
