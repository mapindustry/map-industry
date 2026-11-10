# Map Industry (già Officina Mappe) – istruzioni per Claude Code

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
- Stato unico in `S` (`core.js`): `projects`/`pid` (progetti), `root` (radice del progetto aperto),
  `sels` (Set dei selezionati: blocchi e note), `sel` (principale), `views` (pan/zoom), `undo`,
  `L`/`NL`/`E` (layout di blocchi visibili, note, punti medi dei collegamenti), `link`, `dropOn` (blocco su cui
  si sta lasciando una struttura trascinata).
- Salvataggio: `localStorage['officina-mappe-v3'] = { projects: [{id,name,updated,root}], cur }`.
  **Cartella dei progetti** (`js/files.js`, File System Access API: Edge/Chrome, anche da file://): dal menu Progetti si
  sceglie una cartella; ogni progetto diventa un file `.json` (`p.file`, formato di "Scarica come file .json") e
  `writeStore` lo riscrive a ogni salvataggio (`fsSave`, scritture in coda). Il riferimento alla cartella sta in IndexedDB
  (`officina-mappe-fs`); all'avvio `fsInit` lo riprende e, se il permesso va riconfermato, lo chiede al primo clic o tasto.
  `fsSync` fa coincidere i progetti con i file (il file vince, tranne modifiche locali più recenti); aprire un progetto
  rilegge il file (`fsReload`); rinominare rinomina il file; eliminare lo sposta in `Eliminati/`. localStorage resta la
  copia di riserva. Per le prove si può passare a `useFolder` una cartella di `navigator.storage.getDirectory()`.
  **Schede** (`js/menubar.js`): `S.tabs` = progetti aperti (salvati come `tabs` in localStorage). Barra: Progetti, Esporta,
  poi le schede (la attiva contiene `#pName`), "+" = nuovo progetto. `switchTo` apre la scheda accanto a quella attiva e
  salva lo stato di quella lasciata in `TABST` (annulla/rifai, vista, selezione; `enterTab` lo riprende). Chiudere una
  scheda (× o tasto centrale) non elimina il progetto; aprire dal menu un progetto già aperto passa alla sua scheda.
  **Account e mappe online** (`js/config.js` + `js/cloud.js`, Supabase via fetch, nessuna libreria): con `SB_URL`/`SB_KEY`
  (chiave pubblica) compare "Accedi" nella barra (finestra `#auth`: entra, crea account, password dimenticata, nuova
  password dal link). `cloudBoot` legge la sessione (`officina-mappe-auth`) o il frammento `#access_token=…` dei link email
  prima di `load`. Con l'accesso: chiave locale `officina-mappe-cloud:<id utente>` (`storeKey`), mappe = righe di
  `projects` (owner, id, name, data {root, locked}, updated_at, deleted; regole RLS: ognuno solo le sue), `writeStore` →
  `cloudSave` (700 ms dopo, in coda), `cloudSync` all'avvio, `cloudReload` aprendo o tornando su una scheda, eliminare =
  `deleted: true`; la cartella dei progetti resta in pausa. Entrare/uscire ricarica la pagina. **Accesso obbligatorio**: con Supabase configurato e senza sessione
  `authGate` mostra solo la finestra di accesso (`body.gate` nasconde barra e tela, niente ×/Esc, tastiera fermata).
  Nome dell'utente in `user_metadata.name` (chiesto alla registrazione, `setName`), mostrato nella barra con l'iniziale.
  "Ricordami su questo dispositivo" (di serie): sessione e copia delle mappe in localStorage; senza, in sessionStorage
  (`authStore`/`mapStore`), e l'accesso finisce chiudendo il browser.
  Menu Account: nome, carica online le mappe del browser (`uploadLocal`), cambia password, esci. Per provarlo senza Supabase: finto `fetch` nella pagina.
  **Lucchetto** (`#bLock`, `p.locked` salvato con il progetto): sola lettura; `readOnly()` ferma `mutate`, annulla, editor,
  tasti e trascinamenti (che spostano la vista); restano selezione, Copia, Cerca, aprire/chiudere rami e gruppi (`S.roOk`).
  Al primo avvio migra da `v2` ({root}) o dalla mappa mentale aperta in `v1`. Le vecchie **strutture interne**
  (`n.sub`, tela separata, tolte il 2026-11-10) vengono convertite in rami compressi da `flattenSubs` al caricamento
  e all'apertura di un file .json.
- **Mappa** = un solo albero (non ci sono più livelli): la radice dei dati fa anche da contenitore per `free`,
  `links` (blocchi liberi, alberi senza collegamento, con `fx/fy`) e `notes` (note sulla tela `{id,x,y,text}`).
  `curTree()` = `S.root`; `setLevelRoot()` la sostituisce quando la radice cambia (vedi `promoteRoot`).
  La tela può restare vuota: eliminando l'ultimo blocco la radice diventa `{ void: true }` (contenitore invisibile
  che tiene le note, saltato da `walkAll`/`sizeMap`); `mutate` promuove a radice il primo blocco aggiunto.
- Stile: Copia/Incolla stile in cima alla sezione Stile dei menu del blocco e del collegamento (`styleItems`; niente scorciatoie): `copyStyle`/`pasteStyle`, `S.style = { kind: 'node'|'edge'|'group', data }`
  con i valori come si vedono (blocco: colore, fs, fw, bw, op; collegamento: shape, line, lw, gap, op). Si incolla solo
  sullo stesso tipo; su tutti i blocchi selezionati. Testo, posizione, dimensione, pallini e note non si copiano.
- Maiusc + trascina: la selezione scorre su un binario orizzontale o verticale (lo spostamento maggiore), con una
  linea guida (`S.rail`, `.rail`); Maiusc + clic aggiunge o toglie dalla selezione (deciso al rilascio).
- Disponi (menu del blocco con più blocchi o note selezionati): allinea in colonna (sinistra/centro/destra) o in riga
  (alto/centro/basso) sul riquadro della selezione; con tre o più, stessa distanza in orizzontale/verticale (spazio vuoto
  uguale, minimo 24 px). `arrangeSelected(op)`, un passo di annullamento; i rami compressi seguono il blocco.
- Legenda (`js/legend.js`, `tree.legend = { corner, text, items: [{ id, kind, s, text }] }`): riquadro fermo in un angolo
  dello schermo (`corner` tl/tr/bl/br, di serie br; `<g id="lg">` fuori da #vp, non segue pan e zoom; `legendPos`,
  trascinata si aggancia all'angolo più vicino, o Angolo nel menu). Nell'esportazione va accanto alla mappa. Una riga
  per stile (campione disegnato da `legendSample` + descrizione). "Inserisci in legenda" nei menu di blocco, collegamento,
  gruppo e nota (`addToLegend`: copia dello stile al momento, niente doppioni, apre subito la descrizione; Esc la toglie).
  Selezione con id `LEG`; doppio clic su riga = descrizione, altrove = titolo (editor
  `legrow`/`legtitle`); tasto destro = sposta su/giù, togli, rinomina, elimina; Canc la elimina. Va nell'esportazione;
  `promoteRoot`/`emptyLevel` la portano con sé.
- Gruppi (`tree.groups`, `{ id, x, y, w, h, text }`): riquadri con titolo disegnati sotto a tutto. Nessun elenco di
  membri: contiene ciò che vi sta tutto dentro (`within`), e `dragMovers` lo porta con sé. Si prendono dal titolo o
  dal bordo; l'interno lascia passare i clic. Raggruppa (menu o Ctrl+G), Sciogli = toglie solo il riquadro. Il titolo può essere vuoto
  (gruppo senza nome; `gTitle`: senza il campo `text` vale "Gruppo").
  - contenuto: `groupItems(t, g)` (usa `S.L.full`/`S.NL.full`, cioè anche gli elementi nascosti dai gruppi compressi; un
    gruppo interno conta per il riquadro visibile, `gRect`: compresso basta la barra). `dragMovers` porta con un gruppo
    anche ciò che nascondono i gruppi compressi al suo interno;
  - stile (`groupMenuHtml`, `setGroupStyle`, valori di serie in `GDEF` tolti dai dati): `color`, `line` (`GLINE`), `bw`,
    `fo` (opacità dello sfondo), `tfs`/`tfw`/`ti` (titolo, `ti` = corsivo; la barra `gHead` cresce con lui), `ta: 'c'`; copia/incolla stile;
  - Adatta al contenuto (`fitGroup`), Seleziona il contenuto, Blocca (`lock`: `lockedSet` ferma trascinamenti e Disponi,
    niente maniglia; lucchetto nella barra);
  - Comprimi (`toggleGroupFold`): `fold` + `hide` = id presi al momento; resta la barra (`gRect`) con "+N"
    (`data-gfold`: clic espande, passaggio = contenuto in trasparenza, `showGroupPreview`). `mindLayout`/`notesLayout`
    tolgono i nascosti (`groupHidden`) e tengono tutto in `.full`; i collegamenti verso i nascosti arrivano alla barra
    (`L.px`). Cerca (`revealHit`) espande il gruppo che nasconde il risultato.
- Blocco: il modello completo è descritto in testa a `js/mind.js`. In breve:
  - `x/y` angolo in alto a sinistra, **fisso**: collegare/staccare/ricollegare non sposta nessun blocco; trascinare
    sposta solo i selezionati (i figli restano). Posizioni mancanti: `ensurePositions` (`placeNew` per i nuovi,
    `autoLayout` una volta per le mappe vecchie con dx/dy/fx/fy).
  - `primary` = **idea primaria**, attributo scelto dall'utente (anche più blocchi). La radice dei dati del livello
    nasce primaria ma è solo un dettaglio di struttura: l'utente non vede "radici", vede blocchi.
  - `pin = { i: [[lato, pos]], o: [[lato, pos]] }` pallini sul bordo (lati l/r/t/b, pos 0–1); senza `pin` valgono
    `defaultPins` (primaria: ingresso in alto, uscite l/r; altri: ingresso l e uscita r, scambiati con `flip`).
    Un pallino si trascina lungo il bordo (`nearestBorder`, entro 16 px) o verso un altro blocco per collegare.
    Terzo tipo `s` = **struttura** (rombo `--anc-str`): collega il blocco alle sue parti, non a un passo di processo.
    Ogni tipo può avere zero pallini (blocco con solo ingressi, solo uscite, nessuno); senza pallino la linea arriva
    sul lato rivolto all'altro blocco (`facePin`). Clic su un pallino = menu: tipo, duplica, elimina (`editPin`, che
    riassegna gli indici dei collegamenti attaccati).
  - Rami compressi: `fold` (tutti i rami) o `foldOut` (`['o:1','s:0']`, solo i rami che partono da quei pallini,
    dal menu del pallino). `mindLayout` toglie da `L` i discendenti (`foldedSet`/`isFoldedChild`), quindi non si
    disegnano né loro né i loro collegamenti; "+N" (sull'angolo, o accanto al pallino) per riaprirli, al passaggio
    anteprima in trasparenza sulla tela, dove starebbero da aperti (`showPreview` → `<g id="ghost">` sotto ai blocchi). Lo schema in piccolo sotto il blocco (`foldPrev`) è stato tolto il 2026-11-10: `flattenSubs` lo cancella dai dati vecchi. Trascinando il blocco i rami nascosti
    lo seguono. Una selezione trascinata e lasciata sopra un blocco vi entra compressa (`foldInto`).
    I rami nuovi o riaperti senza posizione vanno oltre la colonna dei fratelli del genitore (`placeNew`).
  - `tag` = etichetta (sigla o nota breve) su una linguetta sopra il bordo (`tagLeft` evita i pallini in alto);
    doppio clic per scriverla. Le idee primarie hanno un bagliore dietro (`.glow`, `--glow`).
  - collegamenti: quello principale è il legame padre→figlio dell'albero (`edge` sul figlio: `po`, `pi`, `note`,
    `shape` (vuoto = morbida, `'st'` dritta, `'sq'` squadrata), `line` (`solid`/`dash`/`dot`, vedi `lineOf`: di serie
    puntini per la struttura e continuo per il resto; `dash: true` è il formato vecchio), `lw` (spessore, `lwOf`),
    `gap` (distanza tra puntini/trattini, `gapOf`, di serie 5), `op` (opacità della linea, `eopOf`; `edgeStyle` li applica),
    `nx`, `ny`; `str` + `sp`
    per un collegamento di struttura);
    i **collegamenti aggiuntivi** (più ingressi per blocco) stanno in `tree.links`
    `{ id, from, to, po, pi, ... }`. `allLinks(tree)` li elenca tutti con una chiave: id del figlio o `'x:' + id`;
    `edgeData(tree, chiave)` restituisce i dati modificabili. `link()` crea il legame d'albero se il blocco d'arrivo
    è senza genitore, altrimenti un collegamento aggiuntivo; vieta sé stesso, doppioni e doppio senso.
  - `hub` = **svincolo**: blocco-punto senza testo (`HUB` px), tappa di un collegamento (menu del collegamento →
    Inserisci uno svincolo, `insertOnLink(key, true)`); pallini visibili solo al passaggio o con la selezione.
  - `type` (`js/blocks.js`, Tipo nel menu del blocco): di serie testo; `ul`/`ol` elenchi, `todo` lista di controllo
    (`done` = testi delle voci spuntate, clic sulla casella `data-chk`), `table` (`table.rows`, prima riga = intestazione,
    `text` = titolo, anche vuoto). Misure in `listSize`/`tableSize` (chiamate da `sizeMap`), disegno in
    `listMarkup`/`tableMarkup`. Elenchi: ogni riga del testo è una voce, mentre si scrive Invio = nuova voce (Ctrl+Invio
    o clic fuori per finire). Tabella: doppio clic su una cella (editor `cell`, id `blocco|riga|colonna`), Tab = cella
    successiva (dall'ultima aggiunge una riga); Righe/Colonne nel menu, tasto destro su una cella = elimina riga/colonna;
    niente maniglia di ridimensionamento. Cerca trova anche il testo delle celle.
    `exp` = espandibile: titolo (`text`) con freccina (`data-xtog`, `toggleExp`, anche in sola lettura), aperto (`open`)
    mostra il testo `body` più piccolo (`expSize`/`expMarkup`); doppio clic sotto il titolo = editor `body` (Invio a capo).
  - `w/h`, `color`, `fs`, `fw` (peso del carattere, `fwOf`), `it` (corsivo, in `nodeFont`), `bw`, `op`. Nel menu la dimensione si può anche scrivere.
  - Eliminare un blocco toglie **solo quel blocco** (`removeSelected`): i suoi rami passano al genitore con la stessa
    uscita (A → X → B diventa A → B) o, senza genitore, restano liberi dove sono.
- Selezione di un collegamento: `S.esel` = chiave. Eliminare il principale = `detach` (il blocco resta libero, stessa
  posizione); un aggiuntivo si toglie da `tree.links`. Appunti: `S.clip` (`cloneFresh` rinomina id e collegamenti).
- `findM(tree,id)` → `{ n, p, list }` cerca anche tra i blocchi liberi; `walkAll` li visita tutti.
- Ogni modifica passa da `mutate(fn)` (snapshot per undo → modifica della mappa → salva → `render()`).
  Annulla = Ctrl+Z (`S.undo`), rifai = Ctrl+Maiusc+Z o Ctrl+Y (`S.redo`, svuotata da ogni nuovo `snapshot`).
- Rifiniture dell'interazione (verifica UX del 2026-11-10, vedi `verifica-ux-ui-2026-11-10.md`):
  - una selezione trascinata entra in un blocco solo dopo una sosta sopra di lui (`DROP_WAIT`), non al semplice passaggio;
  - il testo di blocchi e note tiene gli a capo (Maiusc+Invio; `wrap` divide per `\n`); un blocco con `flip` cresce
    verso l'esterno (resta fermo il bordo destro, `endEdit`); Esc su un elemento appena creato lo toglie (`markFresh`);
  - frecce = selezione al blocco vicino (`moveSel`); Ctrl+V sul blocco appena copiato incolla libero, non dentro
    (`S.clip.src`); "Seleziona il ramo" e "Adatta alla vista" nei menu; forma e tratto lasciano aperto il menu;
  - menu del blocco: colore, azioni, Elimina, poi Stile e Pallini in fondo; la riga di aiuto sparisce alla prima modifica;
- Menu (riordinati il 2026-11-10): ogni menu del tasto destro apre con il titolo dell'oggetto (`title()` → `.mtitle`),
  poi le azioni con la scorciatoia a destra (`item(a, etichetta, classe, scorciatoia, spiegazione)` → `<kbd>`/`<small>`),
  Elimina, e in fondo le sezioni di stile (`head()` → `.mhead`). Le scelte attive hanno la spunta (`.on`).
  Pallini = contatori −/+ (`pinsHtml`, `data-st="pin"`); forma e tratto del collegamento = pulsanti con disegno (`seg`).
  Tutto ciò che si regola lascia aperto il menu. Barra: Progetti (azioni, recenti, Elimina) ed Esporta; niente pulsante
  Salva (il salvataggio è automatico, Ctrl+S salva subito).
  - la data del progetto cambia solo con una modifica (`dirty`); il bagliore non va nell'esportazione.
- Cerca (Ctrl+F, `js/find.js`): campo `#find` sotto la barra, solo su richiesta. Trova blocchi (testo, etichetta) e note
  della tela, senza maiuscole né accenti (`norm`); `FIND = { q, cur }`. `findMarks` dà a `treeMarkup` le classi `hit`/`cur`
  e `hitin` (blocco compresso che nasconde risultati); `#cv.finding` attenua il resto. Scrivendo va al primo risultato
  visibile; Invio/Maiusc+Invio scorrono tutti e `revealHit` apre i rami compressi (un passo di annullamento). Esc chiude.
- La tela è un unico `<svg id="cv">` ridisegnato per intero dentro `<g id="vp">` da `treeMarkup(tree, L, NL, live)`;
  con `live=false` produce la versione statica per anteprima ed esportazione. Testo utente sempre via `esc()`.
- Dopo un clic la tela viene ridisegnata: l'elemento premuto sparisce prima del rilascio, quindi i browser recenti non
  mandano `click`/`dblclick` sulla tela. Il doppio clic lo riconosce `endPointer` (due rilasci senza trascinamento entro
  450 ms e 8 px → `onDouble`); lì e in `contextmenu` usa `document.elementFromPoint`, e per le celle `cellAt` (posizione).
- Anteprima dei link (WhatsApp ecc.): `og.png` 1200×630 e tag `og:` in `index.html` con indirizzi completi.

## Stile
- Colori solo tramite token CSS in `:root` di `css/styles.css`, con varianti per tema scuro
  (`prefers-color-scheme` e `[data-theme]`). Niente colori letterali nei componenti (eccezione: i file d'icona).
- Blocchi: sfondo scuro con bordo un po' più chiaro in entrambi i temi; il colore scelto tinge sfondo e bordo.
- Note dei collegamenti: pillole chiare in corsivo (`--enote-*`), ben diverse dai blocchi e dalle note gialle della tela.
- Collegamenti sempre neutri (`--edge`), mai del colore del blocco. Pallini sempre visibili: ingresso `--anc-in`
  (bianco), uscita `--anc-out` (grigio scuro con bordo chiaro), area di presa più grande del pallino.
- Font: Instrument Sans. Logo: cerchi collegati.

## Verifica
Nessun test automatico: `python -m http.server 8765`, prova le funzioni toccate, ricarica per il salvataggio,
guarda la console. Non fare prove sui dati dell'utente (`localhost`): usa `127.0.0.1` o un progetto di test da eliminare.
