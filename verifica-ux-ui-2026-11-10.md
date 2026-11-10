# Verifica UX/UI – Officina Mappe – 10 novembre 2026

Prove fatte nel browser integrato su `http://127.0.0.1:8765`, con un progetto di test poi eliminato.
Finestra 1024×768 (più 900×700 e 600×700), tema scuro e chiaro. Nessuna modifica al codice.

**Non provato:** finestra 1920×1080 (il pannello non la raggiunge), finestra di stampa del PDF, scaricamento
reale del file SVG (ho controllato l'SVG generato, non il file), touch, zoom con rotellina dal vivo, incolla di
testo su più righe. Gli screenshot li ho guardati durante le prove ma non sono allegati al file.

> **Aggiornamento, stesso giorno:** corretti A1–A4, M1–M9 e B1–B6, B8. Non toccati: B7 (frecce sui collegamenti)
> e B9 (clic sul pallino), che sono scelte di aspetto e di gesto. Di M8 resta che Tab sulla tela non porta alla barra.

## 1. Sintesi

L'app è solida: nessun errore in console in tutta la sessione, salvataggio e ricarica affidabili, ridisegno
veloce (circa 10 ms con 164 blocchi), aspetto curato e coerente in entrambi i temi. I messaggi sui collegamenti
vietati sono chiari e dicono il perché.

I punti deboli sono nelle rifiniture dell'interazione, non nella struttura. I tre più gravi:

1. **La conferma di eliminazione del progetto è invisibile**: dopo il primo clic il testo "Clic di nuovo per
   eliminare" non si legge, e il secondo clic cancella il progetto senza possibilità di annullare.
2. **Ctrl+Maiusc+Z annulla un'altra volta invece di rifare**, e un "rifai" non esiste: chi lo preme per
   tornare avanti perde un secondo passo.
3. **I blocchi a sinistra dell'idea primaria crescono verso il genitore** quando si scrive: finiscono sopra
   il genitore e la linea fa un ricciolo. Capita già con la prima mappa creata da tastiera.

## 2. Problemi

Gravità: Bloccante / Alta / Media / Bassa. Sforzo: S (minuti) / M (un'ora o due) / L (di più).
"Fatto" = osservato nelle prove; "Ipotesi" = dedotto dal codice.

### Alta

**A1 · Conferma di eliminazione del progetto illeggibile** — Fatto
- Dove: barra → Progetti → Elimina questo progetto.
- Passi: clic su "Elimina questo progetto" e lasciare il mouse lì.
- Succede: la riga diventa scura con testo scuro (colore `rgb(21,29,36)` su `rgb(31,43,52)`): sembra vuota.
  Ci si aspetta: riga rossa con "Clic di nuovo per eliminare".
- Causa: `.menu button.it:hover` e `:focus-visible` vincono su `.menu button.armed` (`css/styles.css:181` e `:186`).
- Correzione: rendere `.armed` più specifico (`.menu button.it.armed`, anche in hover/focus). Sforzo S.

**A2 · Ctrl+Maiusc+Z annulla ancora; manca il rifai** — Fatto
- Passi: fare due azioni, Ctrl+Z, poi Ctrl+Maiusc+Z. Si torna indietro di due passi. Ctrl+Y non fa nulla.
- Causa: `js/interactions.js:189` non guarda `shiftKey`.
- Correzione minima: ignorare Ctrl+Maiusc+Z (S). Correzione completa: pila "rifai" accanto a `S.undo` (M).

**A3 · I blocchi a sinistra crescono verso il genitore** — Fatto
- Passi: Tab sull'idea primaria (il ramo nasce a sinistra), Tab ancora, scrivere un testo lungo, Invio.
- Succede: il blocco si allarga a destra, sopra il genitore; la linea esce e torna indietro a ricciolo.
  Si vede anche nell'anteprima dei rami compressi.
- Causa: `placeNew` fissa `x` con la larghezza di "Nuova idea" (`js/mind.js:111`); poi `x` resta fermo.
- Correzione: alla conferma del testo, se il blocco ha `flip` (ingresso a destra), spostare `x` della
  differenza di larghezza così resta fermo il bordo destro. Sforzo S/M.

**A4 · Compressione accidentale trascinando un blocco su un vicino** — Fatto
- Passi: trascinare "Marketing" di 44 px verso il basso, sopra "Vendite" (per riordinare).
- Succede: Marketing sparisce dentro Vendite come ramo compresso. Il messaggio con "Ctrl+Z per annullare" c'è
  ed è utile, ma dura 2 secondi.
- Causa: basta che il puntatore sia dentro l'altro blocco al rilascio (`js/interactions.js:89-94`).
- Correzione: far scattare la destinazione solo dopo una breve sosta sul blocco (per esempio 400 ms) oppure
  solo con un tasto premuto. Sforzo S/M.

### Media

**M1 · Menu del blocco troppo lungo** — Fatto
- Il menu è alto 939 px: a 768 px di schermo scorre, e Duplica, Copia, Raggruppa ed **Elimina** restano sotto
  la piega. Le frecce su/giù non spostano la selezione (solo Tab); nessun `role="menuitem"`.
- Dove: `js/menu.js:17-55`, `:208`.
- Correzione: portare in alto le azioni frequenti (Rinomina, Aggiungi ramo, Duplica, Elimina) e lasciare Stile e
  Pallini dopo; la sezione Pallini ha 6–8 voci che esistono già nel menu del pallino. Frecce nel menu: S.

**M2 · Testo dei blocchi: a capo perso, troncamento, editor sovrapposto** — Fatto
- Maiusc+Invio mostra una nuova riga mentre si scrive, ma alla conferma diventa uno spazio (`js/editor.js:70`).
- Oltre 4 righe il testo viene troncato con "…" (`js/mind.js:56-57`): per leggerlo bisogna ridimensionare a mano.
- L'editor ha sfondo trasparente e mostra tutto il testo: le righe in più si sovrappongono ai blocchi vicini
  (`css/styles.css:153-154`).
- Correzione: sfondo del blocco nell'editor (S); togliere Maiusc+Invio o conservare gli a capo (S/M);
  titolo al passaggio con il testo intero per i blocchi troncati (S).

**M3 · Nessun modo di ritrovare la mappa** — Fatto
- "Adatta alla vista" avviene solo all'avvio e al cambio di progetto (`js/view.js:9`). Stringendo la finestra a
  600 px un blocco resta fuori schermo e non c'è comando per ricentrare; non c'è indicazione dello zoom.
- Con mappe larghe l'adattamento si ferma a 25%: la mappa di prova da 164 blocchi usciva dai due lati.
- Correzione: una voce "Adatta alla vista" nel menu della tela vuota (che oggi ha solo due voci). Sforzo S.

**M4 · Ctrl+C e Ctrl+V incollano la copia dentro l'originale** — Fatto
- Passi: clic su un blocco, Ctrl+C, Ctrl+V. La copia diventa figlia del blocco copiato ("Marketing > Marketing").
- Causa: con un blocco selezionato l'incolla va sempre "dentro" (`js/mind.js:665`), e dopo la copia il
  blocco è ancora selezionato.
- Correzione: se il blocco selezionato è quello appena copiato, incollare accanto (come Duplica). Sforzo S.

**M5 · Spostando un blocco i suoi rami restano fermi** — Fatto (scelta di progetto, da riconsiderare)
- Trascinando "Prodotto" i tre figli restano dov'erano e le linee si incrociano. Per spostare un ramo bisogna
  selezionarlo tutto con il riquadro. Solo i rami compressi seguono il blocco.
- Correzione possibile senza cambiare la regola: una voce "Seleziona il ramo" nel menu del blocco. Sforzo S.

**M6 · Contrasti sotto soglia** — Fatto (misurati dai token)
- Tema chiaro: collegamenti sulla tela 2,3:1 (minimo 3:1); riga di aiuto in basso 3,4:1 (minimo 4,5:1).
- Tema scuro: bordo dei blocchi sulla tela 2,1:1 e sfondo del blocco quasi uguale alla tela (1,1:1): i blocchi
  senza colore si reggono solo sul bordo.
- Tutto il testo dei blocchi, delle note e dei menu supera 4,5:1 in entrambi i temi.
- Correzione: scurire `--edge` nel tema chiaro e schiarire `--node-border` nel tema scuro (`css/styles.css:9`, `:28`). S.

**M7 · Esportazione: il bagliore diventa una cornice azzurra** — Fatto
- Nell'SVG generato l'alone dell'idea primaria è un rettangolo pieno al 55%, senza sfocatura: `inlineStyles`
  non copia `filter` (`js/export.js:22-30`).
- Correzione: togliere il rettangolo `.glow` dall'esportazione oppure copiarne il filtro. Sforzo S.
- Il resto dell'esportazione corrisponde alla tela (tema chiaro, font incorporato, 166 KB).

**M8 · Uso da tastiera e lettori di schermo** — Fatto / Ipotesi
- Fatto: Tab sulla tela è sempre catturato (seleziona o crea un ramo, `js/interactions.js:209-212`), quindi la
  barra dei menu non si raggiunge da tastiera. Le frecce non spostano la selezione tra i blocchi.
- Ipotesi (dal codice): i messaggi a comparsa non hanno `aria-live` (`index.html:30`).
- Correzione: frecce per passare al blocco vicino (M); `aria-live="polite"` sul toast (S).

**M9 · Riga di aiuto fissa** — Fatto
- La riga in basso non si può chiudere, a 900 px passa sopra i blocchi, e i messaggi a comparsa le si
  sovrappongono. Non cita Tab, Invio, F2 e Ctrl+rotellina, che sono le scorciatoie più utili.
- Correzione: nasconderla dopo la prima modifica o darle uno sfondo; aggiornare il testo. Sforzo S.

### Bassa

- **B1** · "1 blocchi compressi in «Vendite»": manca il singolare (`js/mind.js:724`). S.
- **B2** · Titolo del gruppo troncato ("Area commerci…") perché il riquadro prende la larghezza dei blocchi e
  non si allarga per il titolo (`js/mind.js:759`). S.
- **B3** · Esc su un blocco appena creato lascia un blocco "Nuova idea"; confermare un testo vuoto non fa nulla
  e non lo dice (`js/editor.js:79-84`). S.
- **B4** · Il primo ramo dell'idea primaria nasce a sinistra (prima uscita di serie, `js/mind.js:193`): di
  solito ci si aspetta la destra. S.
- **B5** · La data di un progetto cambia solo aprendolo e lasciandolo (`js/storage.js:45`), quindi l'ordine
  "più recenti" non riflette le modifiche. Dopo un'eliminazione si apre il primo dell'elenco, non l'ultimo usato. S.
- **B6** · I menu si aprono sopra l'oggetto (il menu del pallino copre il blocco); Forma e Tratto chiudono il
  menu a ogni scelta, mentre lo spessore lo lascia aperto. S.
- **B7** · La direzione dei collegamenti si capisce solo dal colore dei pallini (bianco/grigio): nessuna freccia. M.
- **B8** · Eliminare un progetto non si può annullare e non offre di salvarlo prima come file. S.
- **B9** · Ipotesi: un clic semplice su un pallino apre il menu; mirando al bordo del blocco può capitare per errore.

## 3. Cose che funzionano bene (da non toccare)

- Flusso da tastiera Tab / Invio / F2: veloce e naturale, il testo nuovo è già selezionato.
- Messaggi sui collegamenti: "Esiste già il collegamento opposto", "Un'uscita va collegata a un ingresso",
  "Rilascia sull'ingresso di un blocco per collegarlo".
- Posizioni fisse: collegare, staccare, comprimere e riaprire non sposta nulla.
- Rami compressi: "+N", pila dietro il blocco, anteprima al passaggio e schema sotto il blocco sono chiari.
- Menu del collegamento: breve, ordinato, con il collegamento evidenziato mentre è aperto.
- Aspetto: idea primaria con bagliore, tre tipi di pallino distinguibili, note gialle e pillole dei collegamenti
  ben diverse dai blocchi, tema chiaro e scuro coerenti.
- Salvataggio automatico e ricarica: progetto, blocchi, gruppi, note ed etichette tornano identici.
- Prestazioni: nessun rallentamento percepibile con 164 blocchi.

## 4. Correzioni consigliate, in ordine

| # | Correzione | Gravità | Sforzo |
|---|---|---|---|
| 1 | A1 – conferma di eliminazione leggibile | Alta | S |
| 2 | A2 – Ctrl+Maiusc+Z non deve annullare (poi: rifai) | Alta | S (M) |
| 3 | A3 – blocchi a sinistra: tenere fermo il bordo destro | Alta | S/M |
| 4 | A4 – compressione solo dopo una sosta sul blocco | Alta | S/M |
| 5 | M4 – incolla accanto, non dentro l'originale | Media | S |
| 6 | M3 – "Adatta alla vista" nel menu della tela | Media | S |
| 7 | M2 – sfondo dell'editor e a capo | Media | S |
| 8 | M7 – bagliore nell'esportazione | Media | S |
| 9 | M6 – due token di contrasto | Media | S |
| 10 | M1 – riordinare il menu del blocco, frecce | Media | M |
| 11 | M9, B1–B6 – rifiniture | Bassa | S |
| 12 | M5, M8, B7 – decisioni di progetto | Media | M |

## Dati

- Il progetto di test "TEST-UX (da eliminare)" è stato eliminato. Alla fine ho rimesso il salvataggio di
  `127.0.0.1:8765` esattamente com'era all'inizio (stessa stringa, 9136 caratteri): i progetti "SECAP PRO" e
  "Altro progetto" presenti lì non sono stati modificati.
- `localhost` non è mai stato aperto.
- Nel salvataggio di `127.0.0.1` c'è anche una chiave `officina-mappe-v3-copia` che non ho creato io: l'ho lasciata.
