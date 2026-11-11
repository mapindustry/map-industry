// Barra laterale dei componenti, a destra sotto la barra dei menu: clic = aggiunge al centro della vista,
// trascinamento sulla tela = aggiunge lì dove si lascia. Si nasconde con » (resta la linguetta per riaprirla);
// la scelta si ricorda in localStorage. SIDE_OPEN, SIDE_W e viewW() stanno in core.js.
const sideEl = $('#side'), sideOpenB = $('#sideOpen'), SIDE_KEY = 'officina-mappe-side';
const sic = d => `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">${d}</svg>`;
const COMPONENTS = [
  ['Blocchi'],
  ['text', 'Blocco', sic('<rect x="2.5" y="5" width="15" height="10" rx="2.5"/><path d="M6 10H14"/>')],
  ['ul', 'Elenco puntato', sic('<circle class="f" cx="4.5" cy="5.5" r="1.2"/><circle class="f" cx="4.5" cy="10" r="1.2"/><circle class="f" cx="4.5" cy="14.5" r="1.2"/><path d="M8 5.5H17M8 10H17M8 14.5H14"/>')],
  ['ol', 'Elenco numerato', sic('<path d="M3.5 4.2 4.8 3.5V7.5M3.3 10.3Q4.8 9 5.6 10.2 5.8 11 3.3 13H6M8.5 5.5H17M8.5 11.5H17M8.5 16H14"/>')],
  ['todo', 'Lista di controllo', sic('<rect x="2.5" y="3.5" width="5" height="5" rx="1"/><path d="M3.6 6 4.8 7.2 6.6 4.8M10 6H17.5"/><rect x="2.5" y="11.5" width="5" height="5" rx="1"/><path d="M10 14H17.5"/>')],
  ['table', 'Tabella', sic('<rect x="2.5" y="4" width="15" height="12" rx="1.5"/><path d="M2.5 8H17.5M2.5 12H17.5M10 4V16"/>')],
  ['exp', 'Espandibile', sic('<path class="f" d="M3 5.5H8L5.5 8.5Z"/><path d="M10 7H17.5M5 12H17.5M5 15.5H14"/>')],
  ['Tela'],
  ['note', 'Nota', sic('<path class="nt" d="M3.5 3.5H16.5V12.5L12.5 16.5H3.5Z"/><path class="ntb" d="M3.5 3.5H16.5"/><path d="M6.5 8H13.5M6.5 11H11"/>')],
  ['group', 'Gruppo', sic('<rect x="2.5" y="3.5" width="15" height="13" rx="2" stroke-dasharray="2.5 2"/><path d="M5 7H11"/>')],
  ['legend', 'Legenda', sic('<rect x="2.5" y="3" width="15" height="14" rx="2"/><rect class="f" x="5" y="7.5" width="3" height="2" rx=".6"/><rect class="f" x="5" y="12" width="3" height="2" rx=".6"/><path d="M10 8.5H15M10 13H15"/>')]
];
$('#sideList').innerHTML = COMPONENTS.map(([k, label, ic]) => !label ? `<div class="shd">${k}</div>` :
  `<button class="sit" data-comp="${k}" title="${label}: clic per aggiungerlo al centro, oppure trascinalo sulla mappa">${ic}<span>${label}</span></button>`).join('');

function setSide(on, keep) {
  SIDE_OPEN = on; sideEl.hidden = !on; sideOpenB.hidden = on;
  document.body.classList.toggle('side', on);
  if (keep !== false) try { localStorage.setItem(SIDE_KEY, on ? '1' : '0'); } catch (e) { }
  if (curTree() && curTree().legend) renderLegend(); // la legenda sta nell'angolo della vista utile
}
$('#sideX').onclick = () => setSide(false);
sideOpenB.onclick = () => setSide(true);
{ let v = null; try { v = localStorage.getItem(SIDE_KEY); } catch (e) { }
  setSide(v ? v === '1' : innerWidth > 640, false); } // di serie aperta, tranne sui telefoni

// con il clic (centro della vista) il componente non va sopra a quello che c'è: scende finché trova posto
function freeSpot(x, y, w, h) {
  const boxes = [...S.L.values(), ...S.NL.values()], hit = (yy) => boxes.some(l => x - w / 2 < l.x + l.w + 16 && x + w / 2 > l.x - 16 && yy - h / 2 < l.y + l.h + 16 && yy + h / 2 > l.y - 16);
  for (let i = 0; i < 40 && hit(y); i++) y += 24;
  return y;
}
// aggiunge il componente k con il centro nel punto (x, y) della tela; per la legenda conta solo l'angolo
function addComponent(k, x, y, corner, avoid) {
  if (avoid && k !== 'legend') y = freeSpot(x, y, k === 'group' ? 280 : 160, k === 'group' ? 180 : 60);
  if (readOnly()) return toast('Mappa bloccata: sbloccala per aggiungere componenti');
  if (editing) endEdit(true);
  if (k === 'note') return addCanvasNote(x - 70, y - 30);
  if (k === 'group') {
    const g = { id: uid(), x: Math.round(x - 140), y: Math.round(y - 90), w: 280, h: 180, text: 'Gruppo' };
    mutate(t => (t.groups = t.groups || []).push(g));
    selectOnly(g.id); render(); startGroupEdit(g.id); markFresh(); return;
  }
  if (k === 'legend') {
    if (curTree().legend) { selectOnly(LEG); render(); return toast('La mappa ha già una legenda'); }
    mutate(t => { t.legend = { corner: corner || 'br', text: 'Legenda', items: [] }; });
    selectOnly(LEG); render(); startLegendTitle(); markFresh(); return;
  }
  const c = mk({ text: 'Nuovo blocco', ul: 'Prima voce', ol: 'Prima voce', todo: 'Prima cosa da fare', table: '', exp: 'Titolo' }[k]);
  if (k !== 'text') c.type = k;
  if (k === 'table') c.table = { rows: [['Colonna 1', 'Colonna 2'], ['', '']] };
  if (k === 'exp') c.open = true;
  mutate(t => {
    (t.free = t.free || []).push(c);
    const sz = sizeMap(t).get(c.id) || { w: 120, h: 30 }; // centrato nel punto scelto
    c.x = Math.round(x - sz.w / 2); c.y = Math.round(y - sz.h / 2);
  });
  selectOnly(c.id); render();
  if (k !== 'table') { startEdit(c.id, true); markFresh(); } // la tabella si scrive cella per cella (doppio clic)
}

// clic o trascinamento da una voce della barra
let SDRAG = null;
const sideGhost = Object.assign(document.createElement('div'), { className: 'sghost', hidden: true });
document.body.appendChild(sideGhost);
sideEl.addEventListener('pointerdown', e => {
  const b = e.target.closest('[data-comp]'); if (!b || e.button !== 0) return;
  SDRAG = { k: b.dataset.comp, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, b };
  b.setPointerCapture(e.pointerId);
});
sideEl.addEventListener('pointermove', e => {
  if (!SDRAG || e.pointerId !== SDRAG.id) return;
  if (!SDRAG.moved && Math.hypot(e.clientX - SDRAG.x, e.clientY - SDRAG.y) < 6) return;
  if (!SDRAG.moved) { SDRAG.moved = true; sideGhost.innerHTML = SDRAG.b.innerHTML; sideGhost.hidden = false; document.body.classList.add('sdrag'); }
  sideGhost.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`;
  sideGhost.classList.toggle('no', !overCanvas(e.clientX, e.clientY));
});
const overCanvas = (cx, cy) => { const el = document.elementFromPoint(cx, cy); return !!el && !!el.closest('#cv') && !(el.closest('#lg')); };
function sideDragEnd(e, cancel) {
  if (!SDRAG || e.pointerId !== SDRAG.id) return;
  const d = SDRAG; SDRAG = null; sideGhost.hidden = true; document.body.classList.remove('sdrag');
  if (cancel) return;
  if (!d.moved) { // clic: al centro della vista utile
    const p = toSvg(viewW() / 2, (innerHeight + BAR_H) / 2);
    return addComponent(d.k, p.x, p.y, null, true);
  }
  if (!overCanvas(e.clientX, e.clientY)) return;
  const p = toSvg(e.clientX, e.clientY);
  addComponent(d.k, p.x, p.y, nearestCorner(e.clientX, e.clientY, { w: 200, h: 60 }));
}
sideEl.addEventListener('pointerup', e => sideDragEnd(e));
sideEl.addEventListener('pointercancel', e => sideDragEnd(e, true));
// tastiera: Invio o Spazio sulla voce = clic (il pointerup non arriva)
sideEl.addEventListener('click', e => {
  const b = e.target.closest('[data-comp]'); if (!b || e.detail) return;
  const p = toSvg(viewW() / 2, (innerHeight + BAR_H) / 2); addComponent(b.dataset.comp, p.x, p.y, null, true);
});
