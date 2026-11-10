// Barra dei menu: nome del progetto, Progetti, Salva, Esporta
const pName = $('#pName');
const fmtDate = t => new Date(t).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function renderBar() {
  const p = curProject(); if (!p) return;
  if (document.activeElement !== pName) pName.value = p.name;
}
pName.addEventListener('input', () => { curProject().name = pName.value; save(); });
pName.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); pName.blur(); } });
pName.addEventListener('blur', () => { if (!pName.value.trim()) { curProject().name = 'Senza nome'; renderBar(); save(); } });

/* ---------- menu a tendina ---------- */
function toggleDrop(id, build) {
  const m = $('#' + id), open = m.hidden;
  closeDrops(); if (!open) return;
  m.innerHTML = build(); m.hidden = false; $('[aria-controls="' + id + '"]').setAttribute('aria-expanded', 'true');
}
function closeDrops() { document.querySelectorAll('.ddm').forEach(m => { m.hidden = true; }); document.querySelectorAll('[aria-controls]').forEach(b => b.setAttribute('aria-expanded', 'false')); }
document.addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('.dd'))) closeDrops(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.ddm:not([hidden])')) { closeDrops(); e.stopImmediatePropagation(); } }, true);

$('#bProj').onclick = () => toggleDrop('mProj', () => {
  const list = [...S.projects].sort((a, b) => b.updated - a.updated);
  return `<div class="mhead">Apri un progetto</div>` + list.map(p =>
    `<button class="it${p.id === S.pid ? ' on' : ''}" data-open="${p.id}"><b>${esc(p.name || 'Senza nome')}</b><span>${fmtDate(p.updated)}</span></button>`).join('') +
    SEP + item('pnew', 'Nuovo progetto') + item('pfile', 'Apri file .json…') + item('pdown', 'Salva come file .json') +
    (S.projects.length > 1 ? SEP + item('pdel', 'Elimina questo progetto', ' dng') : '');
});
$('#mProj').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) { closeDrops(); return openProject(o.dataset.open); }
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
  if (a === 'pdel') { // due clic per confermare
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Clic di nuovo per eliminare'; return; }
    closeDrops(); return deleteProject();
  }
  closeDrops();
  if (a === 'pnew') newProject();
  else if (a === 'pfile') $('#fileIn').click();
  else if (a === 'pdown') downloadProject();
});
$('#bSave').onclick = () => saveProject();
$('#bExp').onclick = () => toggleDrop('mExp', () => `<div class="mhead">Esporta il livello visibile</div>` +
  `<button class="it" data-x="svg"><b>Immagine SVG</b><span>Vettoriale, si apre ovunque</span></button>` +
  `<button class="it" data-x="pdf"><b>PDF</b><span>Dalla finestra di stampa: “Salva come PDF”</span></button>`);
$('#mExp').addEventListener('click', async e => {
  const b = e.target.closest('[data-x]'); if (!b) return; closeDrops();
  try { const r = await exportImage(b.dataset.x); if (!r.fonts) toast('Font non incorporato (sei offline?): il testo userà un carattere di sistema'); else if (b.dataset.x === 'svg') toast('SVG scaricato'); }
  catch (err) { toast(err && err.message === 'vuota' ? 'Niente da esportare' : 'Esportazione non riuscita'); }
});

/* ---------- progetti ---------- */
function saveProject() { if (saveNow()) toast('Progetto salvato'); }
function switchTo(id) {
  if (editing) endEdit(true);
  saveNow(); S.pid = id; S.root = curProject().root;
  S.undo = []; S.views = {}; clearSel(); render(); fit(); saveNow();
}
function openProject(id) { if (id !== S.pid) { switchTo(id); toast('Aperto: ' + curProject().name); } }
function newProject() {
  const p = { id: uid(), name: 'Nuovo progetto', updated: Date.now(), root: mk('Idea primaria') };
  S.projects.push(p); switchTo(p.id); pName.focus(); pName.select();
}
function deleteProject() {
  const i = S.projects.findIndex(p => p.id === S.pid), name = curProject().name;
  S.projects.splice(i, 1); S.pid = S.projects[0].id; S.root = curProject().root;
  S.undo = []; S.views = {}; clearSel(); render(); fit(); saveNow(); toast('Eliminato: ' + name);
}
const fileName = () => (curProject().name || 'mappa').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'mappa';
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function downloadProject() {
  saveNow();
  const p = curProject();
  downloadBlob(new Blob([JSON.stringify({ app: 'officina-mappe', version: 3, project: p }, null, 2)], { type: 'application/json' }), fileName() + '.json');
}
$('#fileIn').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let j; try { j = JSON.parse(r.result); } catch (err) { return toast('Il file non è un JSON valido'); }
    // accetta un progetto salvato da qui, oppure una mappa della versione precedente
    const root = j && j.project && j.project.root || j && j.root || j && j.type === 'mind' && j.data && j.data.root;
    if (!root || !Array.isArray(root.children)) return toast('Nel file non c’è una mappa riconosciuta');
    flattenSubs(root); // file con strutture interne: diventano rami compressi
    const p = { id: uid(), name: (j.project && j.project.name) || j.name || root.text || 'Mappa importata', updated: Date.now(), root };
    S.projects.push(p); switchTo(p.id); toast('Aperto: ' + p.name);
  };
  r.readAsText(f);
});
