// Barra dei menu: Progetti, Esporta, poi le schede dei progetti aperti (il salvataggio è automatico; Ctrl+S salva subito)
const pName = $('#pName');
const fmtDate = t => new Date(t).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

function renderBar() { if (curProject()) { renderTabs(); renderLock(); } }
// lucchetto: la mappa aperta diventa di sola lettura (p.locked, salvato con il progetto e uguale in ogni scheda)
const bLock = $('#bLock');
function renderLock() {
  const on = !!curProject().locked;
  bLock.classList.toggle('on', on); bLock.setAttribute('aria-pressed', on);
  bLock.querySelector('.ll').textContent = on ? 'Sola lettura' : 'Modifica';
  bLock.title = on ? 'Mappa bloccata: clic per tornare a modificarla' : 'Blocca le modifiche: la mappa si può solo guardare';
  pName.readOnly = on; document.body.classList.toggle('ro', on);
}
function toggleLock() {
  if (editing) endEdit(true);
  const p = curProject(); if (p.locked) delete p.locked; else p.locked = true;
  closeMenu(); renderLock(); saveNow(); render(); toast(p.locked ? 'Mappa bloccata: puoi solo guardarla' : 'Mappa sbloccata: puoi modificarla');
}
bLock.onclick = toggleLock;

/* ---------- account (se Supabase è configurato in js/config.js) ---------- */
function renderAccount() {
  $('#accWrap').hidden = !cloudOn();
  const n = userName();
  $('#bAcc').innerHTML = CL.session ? `<span class="avatar" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span><span class="uname">${esc(n)}</span> ▾` : 'Accedi';
  $('#bAcc').title = CL.session ? 'Account: ' + CL.session.user.email : 'Entra o crea un account per avere le mappe online';
}
$('#bAcc').onclick = () => {
  if (!CL.session) return openAuth('in');
  toggleDrop('mAcc', () => {
    const n = localProjects().length;
    return title(esc(userName()), esc(CL.session.user.email)) +
      item('accname', CL.session.user.name ? 'Cambia nome' : 'Scrivi il tuo nome') +
      (n ? item('accup', 'Carica online le mappe di questo browser', '', String(n), 'Le mappe fatte senza accesso entrano nel tuo account') + SEP : '') +
      item('accpw', 'Cambia password') + SEP + item('accout', 'Esci', '', '', 'Le mappe restano nel tuo account');
  });
};
$('#mAcc').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return; closeDrops();
  if (b.dataset.a === 'accup') uploadLocal();
  else if (b.dataset.a === 'accpw') openAuth('newpass');
  else if (b.dataset.a === 'accname') openAuth('name');
  else if (b.dataset.a === 'accout') signOut();
});

/* ---------- schede: i progetti aperti ---------- */
// S.tabs = id dei progetti aperti, in ordine (salvati con i progetti). La scheda attiva contiene il campo del nome
// (#pName, spostato dentro di lei); le altre mostrano il nome. Ogni scheda tiene annulla/rifai, vista e selezione
// mentre si lavora su un'altra (TABST). Si ridisegnano solo quando cambiano, e mai mentre si scrive il nome.
const tabsEl = $('#tabs'), TABST = new Map(); let tabsSig = '';
const sizeName = () => { pName.style.width = clamp(Math.ceil(tw(pName.value || 'Senza nome', `600 14px ${FB}`)) + 20, 70, 220) + 'px'; };
function renderTabs() {
  if (document.activeElement === pName) return;
  const name = id => (S.projects.find(p => p.id === id) || {}).name || 'Senza nome';
  const sig = S.pid + '|' + S.tabs.map(id => id + ':' + name(id)).join('|');
  pName.value = curProject().name; sizeName();
  if (sig === tabsSig && tabsEl.contains(pName)) return;
  tabsSig = sig;
  tabsEl.innerHTML = S.tabs.map(id => {
    const on = id === S.pid, n = esc(name(id));
    return `<div class="tab${on ? ' on' : ''}" data-tab="${id}" role="tab" aria-selected="${on}" title="${n}">` +
      (on ? '<span class="tslot"></span>' : `<span class="tname">${n}</span>`) +
      (S.tabs.length > 1 ? `<button class="tx" data-tclose="${id}" aria-label="Chiudi la scheda ${n}" title="Chiudi la scheda (il progetto resta salvato)">×</button>` : '') + `</div>`;
  }).join('');
  tabsEl.querySelector('.tslot').replaceWith(pName);
  const act = tabsEl.querySelector('.tab.on'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
tabsEl.addEventListener('click', e => {
  const x = e.target.closest('[data-tclose]'); if (x) return closeTab(x.dataset.tclose);
  const t = e.target.closest('[data-tab]'); if (t && t.dataset.tab !== S.pid) openProject(t.dataset.tab, true);
});
tabsEl.addEventListener('auxclick', e => { const t = e.target.closest('[data-tab]'); if (e.button === 1 && t) { e.preventDefault(); closeTab(t.dataset.tab); } }); // tasto centrale
$('#tAdd').onclick = () => newProject();
// chiudere una scheda non elimina niente: il progetto resta nel menu Progetti
function closeTab(id) {
  if (S.tabs.length < 2 || !S.tabs.includes(id)) return;
  if (editing) endEdit(true);
  if (id === S.pid) { const i = S.tabs.indexOf(id); switchTo(S.tabs[i + 1] || S.tabs[i - 1]); }
  S.tabs = S.tabs.filter(x => x !== id); TABST.delete(id); saveNow(); renderTabs();
}
pName.addEventListener('input', () => { curProject().name = pName.value; sizeName(); save(); });
pName.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); pName.blur(); } });
pName.addEventListener('blur', () => { if (!pName.value.trim()) { curProject().name = 'Senza nome'; save(); } fsRename(curProject()); renderTabs(); }); // il file prende il nuovo nome

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
  // azioni prima, poi i progetti dal più recente (l'elenco può essere lungo), Elimina in fondo
  const list = [...S.projects].sort((a, b) => b.updated - a.updated);
  // cartella dei progetti: da scegliere, da riconnettere (permesso da riconfermare) o in uso
  const dirItems = !fsSupported || CL.session ? '' : !FS.dir ? item('pdir', 'Salva i progetti in una cartella…', '', '', 'Ogni progetto diventa un file .json, salvato da solo')
    : !FS.ok ? item('pdirok', `Riconnetti la cartella «${esc(FS.dir.name)}»`, '', '', 'Il browser chiede di confermare il permesso')
    : item('pdir', 'Cambia cartella…', '', '', `Ora: «${esc(FS.dir.name)}»`);
  return item('pnew', 'Nuovo progetto') + item('pfile', 'Apri file .json…') + item('pdown', 'Scarica come file .json') +
    (dirItems ? SEP + dirItems : '') + SEP +
    head(CL.session ? 'Le tue mappe online' : FS.ok ? `Progetti in «${esc(FS.dir.name)}»` : 'Progetti recenti') + list.map(p =>
      `<button class="it${p.id === S.pid ? ' on' : ''}" data-open="${p.id}" role="menuitem"><span class="l">${esc(p.name || 'Senza nome')}</span><small>${fmtDate(p.updated)}${S.tabs.includes(p.id) && p.id !== S.pid ? ' · aperto in una scheda' : ''}</small></button>`).join('') +
    (S.projects.length > 1 ? SEP + item('pdel', 'Elimina il progetto aperto', ' dng', '', FS.ok ? `Il file va nella sottocartella «${TRASH}»` : '') : '');
});
$('#mProj').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'); if (o) { closeDrops(); return openProject(o.dataset.open); }
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
  if (a === 'pdel') { // due clic per confermare
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.querySelector('.l').textContent = FS.ok ? 'Clic di nuovo per eliminare' : 'Clic di nuovo per eliminare (non si può annullare)'; return; }
    closeDrops(); return deleteProject();
  }
  closeDrops();
  if (a === 'pnew') newProject();
  else if (a === 'pfile') $('#fileIn').click();
  else if (a === 'pdown') downloadProject();
  else if (a === 'pdir') chooseFolder();
  else if (a === 'pdirok') reconnectFolder();
});
$('#bExp').onclick = () => toggleDrop('mExp', () => head('Esporta la mappa') +
  `<button class="it" data-x="svg" role="menuitem"><span class="l">Immagine SVG</span><small>Vettoriale, si apre ovunque</small></button>` +
  `<button class="it" data-x="pdf" role="menuitem"><span class="l">PDF</span><small>Dalla finestra di stampa: “Salva come PDF”</small></button>`);
$('#mExp').addEventListener('click', async e => {
  const b = e.target.closest('[data-x]'); if (!b) return; closeDrops();
  try { const r = await exportImage(b.dataset.x); if (!r.fonts) toast('Font non incorporato (sei offline?): il testo userà un carattere di sistema'); else if (b.dataset.x === 'svg') toast('SVG scaricato'); }
  catch (err) { toast(err && err.message === 'vuota' ? 'Niente da esportare' : 'Esportazione non riuscita'); }
});

/* ---------- progetti ---------- */
function saveProject() { if (saveNow()) toast(FS.ok ? `Progetto salvato in «${FS.dir.name}»` : 'Progetto salvato'); }
// passa a un progetto: se non è aperto gli si apre una scheda accanto a quella attiva
function switchTo(id) {
  if (editing) endEdit(true);
  saveNow();
  if (S.pid !== id && S.projects.some(p => p.id === S.pid)) TABST.set(S.pid, { undo: S.undo, redo: S.redo, views: S.views, sels: S.sels, sel: S.sel });
  if (!S.tabs.includes(id)) S.tabs.splice(S.tabs.indexOf(S.pid) + 1, 0, id);
  enterTab(id);
}
// entra nella scheda: riprende annulla/rifai, vista e selezione se ci si era già stati, altrimenti parte da zero
function enterTab(id) {
  S.pid = id; S.root = curProject().root; S.esel = null;
  const st = TABST.get(id); TABST.delete(id);
  if (st) { S.undo = st.undo; S.redo = st.redo; S.views = st.views; S.sels = st.sels; S.sel = st.sel; pruneSel(); render(); }
  else { S.undo = []; S.redo = []; S.views = {}; clearSel(); render(); fit(); }
  saveNow();
}
// dal menu Progetti: se è già aperto si passa alla sua scheda, altrimenti si rilegge il file (può essere cambiato
// altrove, per esempio con OneDrive) e si apre in una scheda nuova
// online si rilegge anche una scheda già aperta (un altro dispositivo può averla cambiata): se è cambiata,
// il suo annulla/rifai non vale più
async function openProject(id, quiet) {
  if (id === S.pid) return;
  const p = S.projects.find(x => x.id === id); if (!p) return;
  if (!S.tabs.includes(id)) await fsReload(p);
  if (await cloudReload(p)) TABST.delete(id);
  switchTo(id); if (!quiet) toast('Aperto: ' + curProject().name);
}
function newProject() {
  const p = { id: uid(), name: 'Nuovo progetto', updated: Date.now(), root: mk('Idea primaria') };
  S.projects.push(p); switchTo(p.id); pName.focus(); pName.select();
}
function deleteProject() {
  const id = S.pid, i = S.projects.findIndex(p => p.id === id), name = curProject().name, ti = S.tabs.indexOf(id);
  const gone = S.projects.splice(i, 1)[0]; if (CL.session) cloudDelete(gone); else fsTrash(gone); // online: segnata come eliminata; cartella: il file va in "Eliminati"
  S.tabs = S.tabs.filter(x => x !== id); TABST.delete(id);
  // si passa alla scheda vicina o, se non ce ne sono, al progetto più recente (la sua mappa, non quella eliminata)
  const next = S.tabs[Math.min(Math.max(ti, 0), S.tabs.length - 1)] || [...S.projects].sort((a, b) => b.updated - a.updated)[0].id;
  if (!S.tabs.includes(next)) S.tabs.push(next);
  enterTab(next); toast('Eliminato: ' + name);
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
