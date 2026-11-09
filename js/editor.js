// Modifica del testo sul posto (textarea sovrapposta): blocchi, note dei collegamenti, note della tela
const ed = $('#ed');
let editing = null; // { kind: 'node' | 'edge' | 'note', id, orig }

function editorBox() {
  const v = view(), k = v.k, sx = x => v.x + x * k, sy = y => v.y + y * k, id = editing.id;
  if (editing.kind === 'node') {
    const l = S.L.get(id), f = findM(curTree(), id); if (!l || !f) return null;
    return { x: sx(l.x), y: sy(l.y), w: l.w * k, h: l.h * k, font: nodeFont(f.n, l.depth), fs: fsOf(f.n, l.depth), lh: l.lh, minW: 160 };
  }
  if (editing.kind === 'edge') {
    const m = S.E.get(id); if (!m) return null;
    return { x: sx(m.x) - 90 * k, y: sy(m.y) - 12 * k, w: 180 * k, h: 24 * k, font: NOTE_FONT, fs: 11.5, lh: 14, minW: 180 };
  }
  const l = S.NL.get(id); if (!l) return null;
  return { x: sx(l.x), y: sy(l.y), w: l.w * k, h: l.h * k, font: CNOTE_FONT, fs: 13, lh: 18, minW: 200 };
}
function placeEditor() {
  if (!editing) return;
  const b = editorBox(); if (!b) return;
  const k = view().k;
  ed.style.font = `${b.font.split(' ')[0]} ${b.fs * k}px ${FB}`; ed.style.lineHeight = b.lh * k + 'px';
  const w = Math.max(b.w, b.minW * k);
  ed.style.width = w + 'px'; ed.style.left = b.x + (b.w - w) / 2 + 'px';
  ed.style.paddingTop = '0'; ed.style.height = 'auto';
  const h = Math.max(b.h, ed.scrollHeight);
  ed.style.top = b.y + (b.h - h) / 2 + 'px'; ed.style.height = h + 'px';
  ed.style.paddingTop = Math.max(0, (h - ed.scrollHeight) / 2) + 'px';
}
function beginEdit(kind, id, text, selectAll) {
  closeMenu(); hidePreview();
  editing = { kind, id, orig: text };
  render();
  if (kind === 'node') { const g = vp.querySelector(`.mn[data-id="${id}"]`); if (g) g.classList.add('editing'); }
  ed.className = kind; ed.value = text; ed.hidden = false; placeEditor();
  ed.focus(); if (selectAll) ed.select(); else ed.setSelectionRange(ed.value.length, ed.value.length);
}
function startEdit(id, selectAll) {
  const f = findM(curTree(), id); if (!f) return;
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
function endEdit(commit) {
  if (!editing) return;
  const { kind, id, orig } = editing; editing = null; ed.hidden = true;
  const v = ed.value.replace(/\s+/g, ' ').trim(), t = curTree();
  if (commit && v !== orig) {
    if (kind === 'edge') { if (edgeData(t, id)) return setEdge(id, { note: v }); }
    else if (kind === 'note') {
      const nt = findNote(t, id);
      if (nt) { snapshot(); if (v) nt.text = v; else { t.notes.splice(t.notes.indexOf(nt), 1); clearSel(); } save(); }
    } else {
      const f = findM(t, id);
      if (f && v) {
        snapshot(); f.n.text = v;
        // la radice di una struttura interna porta il nome del blocco che la contiene
        if (f.n === t && S.path.length) ownerNode().text = v;
        save();
      }
    }
  }
  render();
}
ed.addEventListener('input', placeEditor);
ed.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); endEdit(true); }
  else if (e.key === 'Escape') { e.preventDefault(); endEdit(false); }
  else if (e.key === 'Tab') {
    e.preventDefault(); const { kind, id } = editing; endEdit(true);
    if (kind === 'node') addChild(id);
  }
});
ed.addEventListener('blur', () => endEdit(true));
