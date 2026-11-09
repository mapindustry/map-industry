# Officina Mappe – istruzioni per Claude Code

Editor di **sole mappe mentali**, app web statica in JavaScript "vanilla", senza build e senza dipendenze.
Interfaccia e testi in **italiano**.

## Principio
L'utente ha scelto di ripartire da zero (2026-11-09): tela a schermo intero, una barra dei menu sottile
(richiesta esplicitamente), il resto con tasto destro, doppio clic e trascinamenti. Si aggiunge **una funzione
alla volta**, su richiesta: non aggiungere pulsanti, pannelli o funzioni non richiesti.
La versione precedente (roadmap, processi, pannello) è in `../officina-mappe-backup-2026-11-09`.

## Architettura
- Gli script in `js/` sono **script classici** (non moduli ES) caricati in ordine da `index.html`:
  condividono le dichiarazioni di primo livello. Così l'app funziona anche da `file://` (il collegamento sul
  desktop apre `file:///…/index.html` con `msedge --app`). Se aggiungi un file, inseriscilo nell'ordine giusto.
  Evita nomi globali duplicati e classi CSS uguali tra elementi HTML e SVG (è già successo con `.box`).
- Stato unico in `S` (`core.js`): `projects`/`pid` (progetti), `root` (radice del progetto aperto), `path`
  (strutture interne aperte), `sels` (Set dei selezionati: blocchi e note), `sel` (principale), `views`
  (pan/zoom per livello), `undo`, `L`/`NL`/`E` (layout di blocchi, note, punti medi dei collegamenti), `link`.
- Salvataggio: `localStorage['officina-mappe-v3'] = { projects: [{id,name,updated,root}], cur }`.
  Al primo avvio migra da `v2` ({root}) o dalla mappa mentale aperta in `v1`.
- **Livello** = un albero: la radice (idea centrale) fa anche da contenitore per `free` (blocchi liberi, alberi
  senza collegamento, con `fx/fy`) e `notes` (note sulla tela `{id,x,y,text}`). `curTree()` restituisce il livello
  visibile; `setLevelRoot()` lo sostituisce quando la radice cambia (vedi `promoteRoot`).
- Blocco: `{ id, text, children[], dx?, dy?, w?, h?, color?, fs?, bw?, op?, sub?, edge?, fx?, fy? }`
  - `dx/dy` spostamento manuale (somma su tutto il sotto-albero) · `w/h` dimensione a mano
  - `color` indice 0–5 dei token `--c0…--c5` · `fs` testo px · `bw` spessore bordo · `op` opacità del riquadro
  - `sub` struttura interna (un altro livello) · `edge = { note?, dash?, nx?, ny? }` del collegamento che **entra**
    nel blocco (`nx/ny` = spostamento della nota rispetto al centro della linea)
- Selezione di un collegamento: `S.esel` = id del blocco in cui entra (`selectEdge`). Eliminare un collegamento =
  `detach` del blocco (resta libero). Appunti: `S.clip` (copie senza id validi: `cloneFresh` assegna id nuovi a ogni incolla).
- Collegamenti: ogni blocco ha un solo ingresso (struttura ad albero). `reparent` sposta, vieta i cicli;
  l'idea centrale non ha limiti speciali (può andare sotto un blocco libero, o essere eliminata se ne resta un altro).
- `findM(tree,id)` → `{ n, p, list }` cerca anche tra i blocchi liberi; `walkAll` li visita tutti.
- Ogni modifica passa da `mutate(fn)` (snapshot per undo → modifica del livello visibile → salva → `render()`).
- La tela è un unico `<svg id="cv">` ridisegnato per intero dentro `<g id="vp">` da `treeMarkup(tree, L, NL, live)`;
  con `live=false` produce la versione statica per anteprima ed esportazione. Testo utente sempre via `esc()`.
- Dopo un clic la tela viene ridisegnata: nei gestori di `dblclick`/`contextmenu` usa `document.elementFromPoint`.

## Stile
- Colori solo tramite token CSS in `:root` di `css/styles.css`, con varianti per tema scuro
  (`prefers-color-scheme` e `[data-theme]`). Niente colori letterali nei componenti (eccezione: i file d'icona).
- Blocchi: sfondo scuro con bordo un po' più chiaro in entrambi i temi; il colore scelto tinge sfondo e bordo.
- Collegamenti sempre neutri (`--edge`), mai del colore del blocco. Pallini: ingresso `--anc-in` (quasi bianco),
  uscita `--anc-out` (grigio chiaro), piccoli, con area di presa più grande.
- Dentro una struttura interna lo sfondo usa `--canvas-inner`. Font: Instrument Sans. Logo: cerchi collegati.

## Verifica
Nessun test automatico: `python -m http.server 8765`, prova le funzioni toccate, ricarica per il salvataggio,
guarda la console. Non fare prove sui dati dell'utente (`localhost`): usa `127.0.0.1` o un progetto di test da eliminare.
