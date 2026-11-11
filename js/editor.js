// Modifica del testo sul posto (textarea sovrapposta): blocchi, etichette, note dei collegamenti, note della tela
const ed = $('#ed');
let editing = null; // { kind: 'node' | 'tag' | 'edge' | 'note' | 'group' | 'legrow' | 'legtitle' | 'cell' | 'body', id, orig }

function editorBox() {
  const v = view(), k = v.k, sx = x => v.x + x * k, sy = y => v.y + y * k, id = editing.id;
  if (editing.kind === 'node') {
    const l = S.L.get(id), f = findM(curTree(), id); if (!l || !f) return null;
    if (l.im || l.au) return mediaEditorBox(l, f, sx, sy, k); // didascalia dell'immagine, titolo dell'audio
    return { x: sx(l.x), y: sy(l.y), w: l.w * k, h: l.h * k, font: nodeFont(f.n, l.depth), fs: fsOf(f.n, l.depth), lh: l.lh, minW: 160 };
  }
  if (editing.kind === 'tag') {
    const l = S.L.get(id), f = findM(curTree(), id); if (!l || !f) return null;
    const tb = tagBox(ed.value || ' ', f.n, l), w0 = Math.max(80, tb.w + 4); // va a capo come la linguetta, cresce verso l'alto
    return { x: sx(l.x + tb.x), y: sy(l.y - 18), w: w0 * k, h: 18 * k, font: TAG_FONT, fs: 10.5, lh: TAG_LH, minW: 80, left: true, up: true };
  }
  if (editing.kind === 'edge') {
    const m = S.E.get(id); if (!m) return null;
    return { x: sx(m.x) - 90 * k, y: sy(m.y) - 12 * k, w: 180 * k, h: 24 * k, font: NOTE_FONT, fs: 11.5, lh: 14, minW: 180 };
  }
  if (editing.kind === 'legrow' || editing.kind === 'legtitle') return legendEditorBox();
  if (editing.kind === 'cell') return cellEditorBox(sx, sy, k);
  if (editing.kind === 'body') return bodyEditorBox(sx, sy, k);
  if (editing.kind === 'group') {
    const g = findGroup(curTree(), id); if (!g) return null;
    const fs = gfsOf(g), hd = gHead(g);
    return { x: sx(g.x + 8), y: sy(g.y + (hd - fs - 7) / 2), w: (g.w - 16) * k, h: (fs + 7) * k, font: gFont(g), fs, lh: fs + 5, minW: 160 };
  }
  const l = S.NL.get(id); if (!l) return null;
  const nt = findNote(curTree(), id) || {};
  return { x: sx(l.x), y: sy(l.y), w: l.w * k, h: l.h * k, font: noteFont(nt), fs: nfsOf(nt), lh: l.lh, minW: 200 };
}
function placeEditor() {
  if (!editing) return;
  const b = editorBox(); if (!b) return;
  const k = b.k || view().k; // la legenda non segue lo zoom (k = 1)
  // stile e peso (es. "italic 600 ") presi dal carattere dell'elemento, più la dimensione alla scala della vista
  ed.style.font = `${b.font.replace(/[\d.]+px.*$/, '')}${b.fs * k}px ${FB}`; ed.style.lineHeight = b.lh * k + 'px';
  const w = Math.max(b.w, b.minW * k);
  ed.style.width = w + 'px'; ed.style.left = (b.left ? b.x : b.x + (b.w - w) / 2) + 'px';
  ed.style.paddingTop = '0'; ed.style.height = 'auto';
  const h = Math.max(b.h, ed.scrollHeight);
  ed.style.top = (b.up ? b.y + b.h - h : b.y + (b.h - h) / 2) + 'px'; ed.style.height = h + 'px';
  ed.style.paddingTop = Math.max(0, (h - ed.scrollHeight) / 2) + 'px';
}
function beginEdit(kind, id, text, selectAll) {
  closeMenu(); hidePreview();
  editing = { kind, id, orig: text };
  render();
  // l'editor di un blocco prende lo sfondo del blocco: il testo in più non si confonde con i blocchi vicini
  ed.style.background = '';
  if (kind === 'node') {
    const g = vp.querySelector(`.mn[data-id="${id}"]`);
    if (g) { g.classList.add('editing'); const box = g.querySelector('.box'); if (box) ed.style.background = getComputedStyle(box).fill; }
  }
  if (kind === 'note') { const box = vp.querySelector(`[data-note="${id}"] .nbox`); if (box) ed.style.background = getComputedStyle(box).fill; } // nota colorata

  // elenchi: testo allineato a sinistra e Invio = nuova voce (Ctrl+Invio o un clic fuori per finire)
  const lst = kind === 'body' || (kind === 'node' && isList((findM(curTree(), id) || {}).n)); // anche il testo dell'espandibile
  if (editing) editing.list = lst;
  ed.className = kind + (lst ? ' list' : ''); ed.value = text; ed.hidden = false; placeEditor();
  ed.focus(); if (selectAll) ed.select(); else ed.setSelectionRange(ed.value.length, ed.value.length);
}
function startEdit(id, selectAll) {
  const f = findM(curTree(), id); if (!f || f.n.hub) return; // lo svincolo non ha testo
  selectOnly(id); beginEdit('node', id, f.n.text, selectAll);
}
function startEdgeNote(id) {
  const e = edgeData(curTree(), id); if (!e) return;
  clearSel(); beginEdit('edge', id, e.note || '', true);
}
function startNoteEdit(id) {
  const nt = findNote(curTree(), id); if (!nt) return;
  selectOnly(id); beginEdit('note', id, nt.text, true);
}
function startTagEdit(id) {
  const f = findM(curTree(), id); if (!f || f.n.hub) return;
  selectOnly(id); beginEdit('tag', id, f.n.tag || '', true);
}
function startGroupEdit(id) {
  const g = findGroup(curTree(), id); if (!g) return;
  selectOnly(id); beginEdit('group', id, g.text || '', true);
}
// elemento appena creato: con Esc sparisce (si annulla la creazione) e la selezione torna a `back`
function markFresh(back) { if (editing) { editing.fresh = true; editing.back = back || null; } }
function endEdit(commit) {
  if (!editing) return;
  const { kind, id, orig, fresh, back } = editing; editing = null; ed.hidden = true;
  // blocchi e note della tela tengono gli a capo (Maiusc+Invio); gli altri testi stanno su una riga
  const multi = kind === 'node' || kind === 'note' || kind === 'body', one = s => s.replace(/\s+/g, ' ').trim();
  const v = multi ? ed.value.split('\n').map(one).filter(Boolean).join('\n') : one(ed.value), t = curTree();
  if (!commit && fresh) {
    undo(); S.redo.pop();
    if (back && findM(curTree(), back)) selectOnly(back);
    return render();
  }
  if (commit && v !== orig) {
    if (kind === 'edge') { if (edgeData(t, id)) return setEdge(id, { note: v }); }
    else if (kind === 'legrow' || kind === 'legtitle') commitLegendEdit(kind, id, v);
    else if (kind === 'cell') commitCell(id, v);
    else if (kind === 'body') { const f = findM(t, id); if (f) { snapshot(); if (v) f.n.body = v; else delete f.n.body; save(); } }
    else if (kind === 'tag') { const f = findM(t, id); if (f) { snapshot(); if (v) f.n.tag = v; else delete f.n.tag; save(); } }
    else if (kind === 'group') { const g = findGroup(t, id); if (g) { snapshot(); g.text = v; if (v) g.w = Math.max(g.w, Math.ceil(tw(v, gFont(g))) + 28); save(); } } // titolo vuoto = gruppo senza nome; il riquadro si allarga per il titolo
    else if (kind === 'note') {
      const nt = findNote(t, id);
      if (nt) { snapshot(); if (v) nt.text = v; else { t.notes.splice(t.notes.indexOf(nt), 1); clearSel(); } save(); }
    } else {
      const f = findM(t, id);
      if (f && v) {
        snapshot();
        // blocco con l'ingresso a destra (sta a sinistra del genitore): resta fermo il bordo destro, cresce verso l'esterno
        const w0 = f.n.flip && !f.n.w && hasPos(f.n) ? sizeMap(t).get(id).w : null;
        f.n.text = v;
        if (w0 !== null) f.n.x = Math.round(f.n.x - (sizeMap(t).get(id).w - w0));
        save();
      } else if (f && (f.n.type === 'table' || isMedia(f.n))) { snapshot(); f.n.text = ''; save(); } // tabella senza titolo, immagine senza didascalia, audio col nome del file
      else if (f) toast('Testo vuoto: il blocco resta com’era');
    }
  }
  render();
}
ed.addEventListener('input', placeEditor);
ed.addEventListener('keydown', e => {
  e.stopPropagation();
  const multi = editing && (editing.kind === 'node' || editing.kind === 'note'); // solo lì Maiusc+Invio va a capo
  if (e.key === 'Enter' && editing && editing.list && !(e.ctrlKey || e.metaKey)) return; // nuova voce dell'elenco
  if (e.key === 'Enter' && !(e.shiftKey && multi)) { e.preventDefault(); endEdit(true); }
  else if (e.key === 'Escape') { e.preventDefault(); endEdit(false); }
  else if (e.key === 'Tab') {
    e.preventDefault(); const { kind, id } = editing; endEdit(true);
    if (kind === 'node') addChild(id);
    else if (kind === 'cell') nextCell(id); // cella successiva
  }
});
ed.addEventListener('blur', () => endEdit(true));
