// Cerca (Ctrl+F): campo piccolo sotto la barra, solo su richiesta. Trova blocchi (testo ed etichetta) e note della tela,
// senza badare a maiuscole e accenti. Mentre si scrive i risultati si accendono e il resto si attenua; Invio va al
// successivo (Maiusc+Invio al precedente) e apre i rami compressi che lo nascondono; Esc chiude e lascia selezionato
// l'ultimo trovato. I blocchi compressi che nascondono risultati hanno un segno (hitin).
const findEl = $('#find'), findIn = $('#findIn'), findCnt = $('#findCnt');
let FIND = null; // { q, cur } — q: testo cercato (normalizzato), cur: id del risultato attuale

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
// risultati nell'ordine di lettura (dall'alto in basso, da sinistra a destra), anche dentro i rami compressi
function findHits(tree) {
  if (!FIND || !FIND.q) return [];
  const out = [], q = FIND.q;
  walkAll(tree, n => { if (!n.hub && (norm(n.text).includes(q) || norm(n.tag).includes(q) || (n.type === 'table' && norm(tableRows(n).flat().join(' ')).includes(q)))) out.push({ id: n.id, x: n.x || 0, y: n.y || 0 }); });
  (tree.notes || []).forEach(nt => { if (norm(nt.text).includes(q)) out.push({ id: nt.id, x: nt.x, y: nt.y, note: true }); });
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}
// per treeMarkup: chi è un risultato, qual è quello attuale, quali blocchi visibili nascondono risultati
function findMarks(tree, L) {
  const hits = findHits(tree), hit = new Set(hits.map(h => h.id)), inside = new Set();
  if (hits.some(h => !h.note && !L.has(h.id))) {
    const par = new Map(); walkAll(tree, (n, p) => { if (p) par.set(n.id, p); });
    hits.forEach(h => { if (h.note || L.has(h.id)) return; let p = par.get(h.id); while (p && !L.has(p.id)) p = par.get(p.id); if (p) inside.add(p.id); });
  }
  return { on: !!(FIND && FIND.q), hit, inside, cur: FIND && FIND.cur };
}

function openFind() {
  if (!FIND) FIND = { q: '', cur: null };
  findEl.hidden = false; findIn.focus(); findIn.select();
  if (findIn.value) onFindInput();
}
function closeFind() {
  if (!FIND) return;
  FIND = null; findEl.hidden = true; findIn.blur(); cv.classList.remove('finding'); render();
}
function updateCount(hits) {
  const vis = hits.filter(h => h.note || S.L.has(h.id)).length, i = hits.findIndex(h => h.id === FIND.cur);
  findCnt.classList.toggle('none', !!FIND.q && !hits.length);
  findCnt.textContent = !FIND.q ? '' : !hits.length ? 'Nessun risultato' :
    `${i < 0 ? '–' : i + 1} di ${hits.length}${vis < hits.length ? ` · ${hits.length - vis} nei rami compressi` : ''}`;
}
// porta la vista sul risultato: al centro se è fuori schermo o troppo vicino ai bordi
function showHit(id) {
  const l = S.L.get(id) || S.NL.get(id); if (!l) return;
  const v = view(), m = 60, x1 = v.x + l.x * v.k, y1 = v.y + l.y * v.k, x2 = x1 + l.w * v.k, y2 = y1 + l.h * v.k;
  if (x1 < m || y1 < BAR_H + m || x2 > innerWidth - m || y2 > innerHeight - m) {
    v.x = innerWidth / 2 - (l.x + l.w / 2) * v.k; v.y = (innerHeight + BAR_H) / 2 - (l.y + l.h / 2) * v.k; v.fresh = false;
  }
}
// apre i rami compressi tra il blocco e la radice (un passo di annullamento)
function revealHit(id) {
  if (S.L.has(id) || S.NL.has(id)) return;
  mutate(t => {
    const par = new Map(); walkAll(t, (n, p) => { if (p) par.set(n.id, p); });
    const f = findM(t, id);
    if (!f) { (t.groups || []).forEach(g => { if (g.fold && (g.hide || []).includes(id)) { delete g.fold; delete g.hide; } }); return; } // nota
    let c = f.n, p = par.get(c.id);
    // un gruppo compresso che nasconde il risultato (o un blocco sopra di lui) si espande
    const chain = new Set([id]); for (let q = p; q; q = par.get(q.id)) chain.add(q.id);
    (t.groups || []).forEach(g => { if (g.fold && (g.hide || []).some(x => chain.has(x))) { delete g.fold; delete g.hide; } });
    while (p) {
      if (p.fold) delete p.fold;
      if (p.foldOut) { const k = pinKey(p, c); p.foldOut = p.foldOut.filter(x => x !== k); if (!p.foldOut.length) delete p.foldOut; }
      c = p; p = par.get(c.id);
    }
  });
}
function goHit(id) {
  revealHit(id); FIND.cur = id; selectOnly(id); render(); showHit(id); applyView();
  updateCount(findHits(curTree()));
}
function onFindInput() {
  FIND.q = norm(findIn.value).trim();
  cv.classList.toggle('finding', !!FIND.q);
  const hits = findHits(curTree());
  // mentre si scrive: il primo risultato visibile, senza aprire rami (lo fa Invio)
  const first = hits.find(h => h.note || S.L.has(h.id));
  FIND.cur = first ? first.id : null;
  if (first) { selectOnly(first.id); render(); showHit(first.id); applyView(); } else render();
  updateCount(hits);
}
function stepFind(dir) {
  const hits = findHits(curTree()); if (!hits.length) return;
  const i = hits.findIndex(h => h.id === FIND.cur);
  goHit(hits[i < 0 ? (dir > 0 ? 0 : hits.length - 1) : (i + dir + hits.length) % hits.length].id);
}
findIn.addEventListener('input', onFindInput);
findIn.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); findIn.select(); }
});
$('#findPrev').onclick = () => stepFind(-1);
$('#findNext').onclick = () => stepFind(1);
$('#findX').onclick = closeFind;
