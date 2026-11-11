// Blocco collegato a un altro progetto (n.ref = id del progetto): una linguetta sotto il bordo, in basso a destra, con il
// nome della mappa collegata (letto da S.projects a ogni disegno, quindi segue le rinomine). Clic sulla linguetta =
// apre quel progetto in una scheda (openProject; anche in sola lettura, è un modo di girare tra le mappe). Progetto
// eliminato o non trovato: linguetta spenta. Dal menu del blocco: Collega a un progetto (elenco dentro il menu,
// REF_OPEN), Apri, Togli il collegamento.
const REF_FONT = `600 10.5px ${FB}`, REF_MAXT = 150;
let REF_OPEN = false; // elenco dei progetti aperto nel menu del blocco
const refProject = n => n && n.ref ? S.projects.find(p => p.id === n.ref) || null : null;

// linguetta: a destra, evitando i pallini sul lato in basso e la maniglia di ridimensionamento
function refMarkup(n, l, live) {
  if (!n.ref || n.hub) return '';
  const p = refProject(n), name = p ? p.name || 'Senza nome' : 'Mappa non trovata';
  const t = ell(name, REF_MAXT, REF_FONT), w = Math.ceil(tw(t, REF_FONT)) + 28;
  let x = l.w - 14 - w;
  const P = pinsOf(n);
  [...P.i, ...P.o, ...P.s].filter(q => q[0] === 'b').map(q => q[1] * l.w).sort((a, b) => b - a)
    .forEach(px => { if (px > x - 8 && px < x + w + 8) x = px - 10 - w; });
  x = Math.max(4, x);
  const tip = p ? `Apri la mappa «${esc(name)}»` : 'La mappa collegata non c’è più';
  // icona: due anelli di catena
  const ix = x + 7, iy = l.h + 4.5;
  return `<g class="pref${p ? '' : ' gone'}"${live ? ` data-ref="1"` : ''}>${live ? `<title>${tip}</title>` : ''}` +
    `<rect x="${x}" y="${l.h}" width="${w}" height="17" rx="5"/>` +
    `<path class="pic" d="M${ix + 4},${iy + 5.5} l-1.2,1.2 a2.3,2.3 0 0,1 -3.3,-3.3 l1.8,-1.8 a2.3,2.3 0 0,1 3.3,0 M${ix + 5},${iy + 2.5} l1.2,-1.2 a2.3,2.3 0 0,1 3.3,3.3 l-1.8,1.8 a2.3,2.3 0 0,1 -3.3,0"/>` +
    `<text x="${x + 21}" y="${l.h + 12.5}">${esc(t)}</text></g>`;
}
function openRef(id) {
  const f = findM(curTree(), id), p = f && refProject(f.n);
  if (!p) return toast('La mappa collegata non c’è più: scegline un’altra dal menu del blocco');
  if (p.id === S.pid) return toast('È già questa mappa');
  openProject(p.id);
}
function setRef(id, pid) {
  mutate(t => { const f = findM(t, id); if (!f) return; if (pid) f.n.ref = pid; else delete f.n.ref; });
}
// voci del menu del blocco (un solo blocco selezionato)
function refMenuHtml(n) {
  const p = refProject(n), others = [...S.projects].filter(x => x.id !== S.pid).sort((a, b) => b.updated - a.updated);
  let h = '';
  if (n.ref) h += item('refgo', p ? `Apri «${esc(ell(p.name || 'Senza nome', 180, `500 13px ${FB}`))}»` : 'Mappa collegata non trovata', p ? '' : ' off', '', p ? 'Clic sulla linguetta del blocco' : '');
  h += `<button class="it pload${REF_OPEN ? ' open' : ''}" data-a="refpick" role="menuitem" aria-expanded="${REF_OPEN}"><span class="l">${n.ref ? 'Cambia mappa collegata' : 'Collega a un’altra mappa'}</span><kbd>${others.length} ${REF_OPEN ? '▴' : '▾'}</kbd></button>`;
  if (REF_OPEN) h += `<div class="plist">` + (others.length ? others.map(x =>
    `<button class="it${x.id === n.ref ? ' on' : ''}" data-refp="${x.id}" role="menuitem"><span class="l">${esc(x.name || 'Senza nome')}</span><small>${fmtDate(x.updated)}</small></button>`).join('')
    : `<p class="pnone">Non ci sono altri progetti</p>`) + `</div>`;
  if (n.ref) h += item('refdel', 'Togli il collegamento alla mappa');
  return h + SEP;
}
