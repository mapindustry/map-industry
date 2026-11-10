# Prompt – verifica UX/UI approfondita di Officina Mappe

Copia tutto quello che c'è sotto la linea in una nuova sessione di Claude Code aperta in questa cartella.

---

Fai una **verifica UX/UI approfondita** di Officina Mappe (editor di mappe mentali, JS vanilla, vedi `CLAUDE.md`).
Obiettivo: trovare ciò che rende l'app difficile, lenta, ambigua o brutta da usare, e proporre correzioni.
**Non modificare il codice** in questa fase: produci solo il rapporto. Le correzioni le sceglierò io, una alla volta
(il principio del progetto è "una funzione alla volta, niente pulsanti o pannelli non richiesti": le proposte devono
rispettarlo — preferisci sistemare ciò che c'è piuttosto che aggiungere).

## Come lavorare
1. Leggi `CLAUDE.md`, `index.html`, `css/styles.css` e i file in `js/` per capire modello e interazioni.
2. Avvia `python -m http.server 8765` e apri **http://127.0.0.1:8765** nel browser integrato
   (mai `localhost`: lì ci sono i dati veri). Crea un progetto di test e alla fine eliminalo.
3. Usa davvero l'app come farebbe una persona: clic, doppio clic, tasto destro, trascinamenti, tastiera.
   Fai screenshot di ogni problema visivo. Guarda la console dopo ogni gruppo di prove.
4. Prova in tema **chiaro e scuro**, a finestra larga (1920×1080), media (1280×800) e stretta (~900 px),
   e con zoom della tela molto basso e molto alto.

## Scenari da percorrere (dall'inizio alla fine)
- **Primo avvio**: tela vuota o con una sola idea. Si capisce cosa fare? Come si scopre il tasto destro,
  il doppio clic, Tab/Invio? Cosa succede se si clicca a caso?
- **Costruire una mappa di ~30 blocchi** solo con la tastiera (Tab, Invio, F2, frecce se ci sono, Canc, Ctrl+Z),
  poi solo con il mouse. Quale dei due flussi si inceppa e dove?
- **Scrittura del testo**: modifica in linea, Invio/Maiusc+Invio/Esc/Tab, testi lunghi, testo vuoto, emoji,
  incolla di testo multilinea; il blocco si ridimensiona bene? Il cursore finisce dove ci si aspetta?
- **Collegamenti**: trascinare dai pallini, collegare a un blocco lontano (con pan automatico?), ricollegare,
  staccare, collegamenti aggiuntivi, divieti (sé stesso, doppioni, doppio senso): l'utente capisce *perché*
  un collegamento non si crea? Forme (morbida/dritta/squadrata), tratti, note sui collegamenti, svincoli.
- **Pallini**: spostarli lungo il bordo, tipi ingresso/uscita/struttura, menu del pallino. Area di presa
  sufficiente? Si distinguono i tre tipi a colpo d'occhio, anche in tema chiaro e a zoom basso?
- **Rami compressi**: fold/foldOut, "+N", anteprima al passaggio, `foldPrev`, trascinare una selezione dentro
  un blocco. Si capisce cosa è nascosto e come riaprirlo?
- **Selezione multipla e spostamento**: riquadro, Maiusc/Ctrl+clic, trascinare più blocchi, gruppi
  (Ctrl+G, titolo, bordo, sciogli), note gialle della tela, etichette.
- **Menu contestuali**: ordine delle voci, raggruppamento, etichette in italiano chiaro e coerente
  (stessi verbi per le stesse azioni: "Elimina"/"Togli", "Aggiungi"/"Inserisci"…), voci troppo tecniche,
  posizionamento vicino ai bordi dello schermo, chiusura con Esc/clic fuori, uso da tastiera.
- **Barra dei menu**: nome del progetto, Progetti (apri, nuovo, file .json, elimina con doppio clic),
  Salva, Esporta SVG/PDF. Feedback (toast) chiari e non invadenti?
- **Annulla**: Ctrl+Z dopo ogni tipo di azione (anche spostamenti, pallini, gruppi, rinomina progetto).
  Esiste un "rifai"? Ci sono azioni che non si annullano o che si annullano a metà?
- **Navigazione**: pan, zoom con rotella/Ctrl, adattamento alla vista, ritrovare la mappa dopo essersi persi.
- **Salvataggio e ricarica**: ricarica la pagina dopo ogni scenario; cosa si perde (vista, selezione, stato)?
- **Esportazione**: l'SVG/PDF somiglia a quello che si vede? Font, colori del tema, rami compressi, note.

## Cosa valutare
- **Scopribilità**: senza manuale, cosa resta nascosto? (le funzioni stanno quasi tutte in tasto destro e doppio clic)
- **Feedback**: stati hover/selezione/trascinamento/destinazione del rilascio, cursori, conferme ed errori.
- **Coerenza**: stesso gesto → stesso effetto ovunque; terminologia; icone e forme.
- **Prevenzione e recupero degli errori**: eliminazioni, clic accidentali, perdita di dati.
- **Efficienza**: numero di passi per le azioni frequenti, scorciatoie mancanti o in conflitto.
- **Gerarchia visiva e leggibilità**: idea primaria e bagliore, contrasto testo/sfondo dei blocchi colorati,
  linee e pallini su sfondo chiaro e scuro, densità con molti blocchi, sovrapposizioni (etichette, "+N", note).
- **Estetica e rifinitura**: allineamenti, spaziature, raggi, ombre, coerenza tra barra, menu, toast e tela;
  animazioni o scatti; flicker durante il ridisegno.
- **Accessibilità**: contrasto (WCAG AA), focus visibile, uso da tastiera, `aria-*` nella barra e nei menu,
  dimensione minima dei bersagli.
- **Prestazioni percepite**: con 150–200 blocchi il trascinamento e lo zoom restano fluidi?
- **Rispetto delle regole di stile** in `CLAUDE.md` (solo token CSS, collegamenti neutri, pallini sempre visibili…).

## Rapporto finale
Scrivilo in italiano, nel file `verifica-ux-ui-<data>.md`, così strutturato:
1. **Sintesi** (5–10 righe): impressione generale e i 3 problemi più gravi.
2. **Problemi**, ognuno con: titolo, gravità (Bloccante / Alta / Media / Bassa), dove si presenta,
   passi per riprodurlo, cosa succede vs cosa ci si aspetta, screenshot, file e riga probabili,
   proposta di correzione (la più piccola possibile) e stima dello sforzo (S/M/L).
3. **Cose che funzionano bene** da non toccare.
4. **Elenco ordinato delle correzioni consigliate**, prima quelle a impatto alto e sforzo basso.
Distingui chiaramente i fatti osservati dalle ipotesi. Alla fine elimina il progetto di test e conferma che i dati
su `localhost` non sono stati toccati.
