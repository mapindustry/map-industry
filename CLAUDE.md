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
- **Livello** = un albero: la radice dei dati fa anche da contenitore per `free`, `links` (blocchi liberi, alberi
  senza collegamento, con `fx/fy`) e `notes` (note sulla tela `{id,x,y,text}`). `curTree()` restituisce il livello
  visibile; `setLevelRoot()` lo sostituisce quando la radice cambia (vedi `promoteRoot`).
- Blocco: il modello completo è descritto in testa a `js/mind.js`. In breve:
  - `x/y` angolo in alto a sinistra, **fisso**: collegare/staccare/ricollegare non sposta nessun blocco; trascinare
    sposta solo i selezionati (i figli restano). Posizioni mancanti: `ensurePositions` (`placeNew` per i nuovi,
    `autoLayout` una volta per le mappe vecchie con dx/dy/fx/fy).
  - `primary` = **idea primaria**, attributo scelto dall'utente (anche più blocchi). La radice dei dati del livello
    nasce primaria ma è solo un dettaglio di struttura: l'utente non vede "radici", vede blocchi.
  - `pin = { i: [[lato, pos]], o: [[lato, pos]] }` pallini sul bordo (lati l/r/t/b, pos 0–1); senza `pin` valgono
    `defaultPins` (primaria: ingresso in alto, uscite l/r; altri: ingresso l e uscita r, scambiati con `flip`).
    Un pallino si trascina lungo il bordo (`nearestBorder`, entro 16 px) o verso un altro blocco per collegare.
  - collegamenti: quello principale è il legame padre→figlio dell'albero (`edge` sul figlio: `po`, `pi`, `note`,
    `dash`, `nx`, `ny`); i **collegamenti aggiuntivi** (più ingressi per blocco) stanno in `tree.links`
    `{ id, from, to, po, pi, ... }`. `allLinks(tree)` li elenca tutti con una chiave: id del figlio o `'x:' + id`;
    `edgeData(tree, chiave)` restituisce i dati modificabili. `link()` crea il legame d'albero se il blocco d'arrivo
    è senza genitore, altrimenti un collegamento aggiuntivo; vieta sé stesso, doppioni e doppio senso.
  - `w/h`, `color`, `fs`, `bw`, `op`, `sub`, `subOpen` come prima.
- Selezione di un collegamento: `S.esel` = chiave. Eliminare il principale = `detach` (il blocco resta libero, stessa
  posizione); un aggiuntivo si toglie da `tree.links`. Appunti: `S.clip` (`cloneFresh` rinomina id e collegamenti).
- `findM(tree,id)` → `{ n, p, list }` cerca anche tra i blocchi liberi; `walkAll` li visita tutti.
- Ogni modifica passa da `mutate(fn)` (snapshot per undo → modifica del livello visibile → salva → `render()`).
- La tela è un unico `<svg id="cv">` ridisegnato per intero dentro `<g id="vp">` da `treeMarkup(tree, L, NL, live)`;
  con `live=false` produce la versione statica per anteprima ed esportazione. Testo utente sempre via `esc()`.
- Dopo un clic la tela viene ridisegnata: nei gestori di `dblclick`/`contextmenu` usa `document.elementFromPoint`.

## Stile
- Colori solo tramite token CSS in `:root` di `css/styles.css`, con varianti per tema scuro
  (`prefers-color-scheme` e `[data-theme]`). Niente colori letterali nei componenti (eccezione: i file d'icona).
- Blocchi: sfondo scuro con bordo un po' più chiaro in entrambi i temi; il colore scelto tinge sfondo e bordo.
- Note dei collegamenti: pillole chiare in corsivo (`--enote-*`), ben diverse dai blocchi e dalle note gialle della tela.
- Collegamenti sempre neutri (`--edge`), mai del colore del blocco. Pallini sempre visibili: ingresso `--anc-in`
  (bianco), uscita `--anc-out` (grigio scuro con bordo chiaro), area di presa più grande del pallino.
- Dentro una struttura interna lo sfondo usa `--canvas-inner`. Font: Instrument Sans. Logo: cerchi collegati.

## Verifica
Nessun test automatico: `python -m http.server 8765`, prova le funzioni toccate, ricarica per il salvataggio,
guarda la console. Non fare prove sui dati dell'utente (`localhost`): usa `127.0.0.1` o un progetto di test da eliminare.
