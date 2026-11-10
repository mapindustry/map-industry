# Map Industry

Editor di **mappe mentali** nel browser: la tela a schermo intero e, sopra, una barra dei menu sottile.
Si costruisce una funzione alla volta.

## Avvio

- **Collegamento sul desktop** “Officina Mappe”: apre `index.html` in una finestra a sé (Edge in modalità app).
- Oppure doppio clic su `index.html`. Nessuna build, nessuna dipendenza.
- Per sviluppare: `python -m http.server 8765` (configurato in `.claude/launch.json`).

I progetti si salvano da soli nel `localStorage` del browser (chiave `officina-mappe-v3`).
Attenzione: ogni indirizzo ha il suo salvataggio (`file://…`, `localhost:8765`, `127.0.0.1:8765` sono separati).
Per spostare un progetto: **Progetti → Salva come file .json**, poi **Progetti → Apri file .json…**.

## Barra dei menu

- **Nome del progetto** (modificabile) · **Progetti** (apri, nuovo, salva/apri file .json, elimina)
- **Salva** (anche Ctrl+S) · **Esporta** il livello visibile in **SVG** o **PDF** (dalla finestra di stampa)

## Comandi sulla tela

| Azione | Come |
|---|---|
| Seleziona | clic sul blocco · Shift/Ctrl + clic aggiunge o toglie · trascina sullo sfondo per il riquadro |
| Scrivi | doppio clic sul blocco, oppure F2 · Invio conferma, Esc annulla |
| Ramo figlio / fratello | Tab / Invio |
| Sposta blocchi e note | trascinali: si sposta solo ciò che è selezionato, i figli restano dove sono |
| Ridimensiona | quadratino sul lato esterno del blocco selezionato |
| Collega | trascina da un'**uscita** (pallino grigio scuro) a un **ingresso** (pallino bianco), o al contrario; rilasciare sul blocco vale come il suo pallino più vicino |
| Più ingressi | collega pure un blocco che ha già un genitore: si aggiunge un collegamento, non si sostituisce |
| Sposta un pallino | trascinalo lungo il bordo del suo blocco (scorre sui quattro lati) |
| Aggiungi/togli pallini | tasto destro sul blocco → Pallini: aggiungi un ingresso/un'uscita, togli, scambia i lati, posizione standard |
| Idea primaria | tasto destro → Imposta come idea primaria (anche su più blocchi): blocco marcato, ingresso in alto e due uscite |
| Stacca | trascina l'ingresso nel vuoto, oppure tasto destro → Stacca |
| Nota su un collegamento | doppio clic sul collegamento · trascina la nota per spostarla |
| Blocco intermedio | tasto destro sul collegamento → Inserisci un blocco intermedio |
| Elimina un collegamento | clic sul collegamento + Canc, oppure tasto destro → Elimina collegamento (il blocco resta, libero) |
| Duplica | tasto destro → Duplica · Ctrl+D · Alt + trascina (sposti la copia) |
| Copia / incolla | Ctrl+C / Ctrl+V (dentro il blocco selezionato, altrimenti libero dove c'è il mouse) |
| Opzioni | tasto destro: sul blocco (colore, stile testo/bordo/opacità, struttura interna, stacca, elimina), sul collegamento (nota, linea continua/tratteggiata), sulla tela (aggiungi blocco, aggiungi nota) |
| Struttura interna | tasto destro → Crea/Apri · i blocchi che ne hanno una sembrano una pila, con l'icona a griglia · passa sull'icona per l'anteprima, clic per entrare · Esc o il percorso in alto per tornare |
| Schema sulla tela | tasto destro → Mostra anteprima struttura interna: lo schema resta sotto il blocco (anche nelle esportazioni); clic per entrare |
| Sposta la vista | rotellina, Spazio + trascina, tasto centrale |
| Zoom | Ctrl/⌘ + rotellina |
| Annulla | Ctrl/⌘ + Z |

I blocchi restano dove li metti: collegare, staccare o ricollegare cambia solo la linea, che resta agganciata
ai pallini scelti anche se giri un blocco attorno a un altro. La disposizione automatica vale solo per i blocchi
nuovi (Tab, Invio, incolla) e per convertire una volta le mappe vecchie.
Non si collegano un blocco a sé stesso, due volte gli stessi blocchi o in doppio senso (A→B e B→A).


## Struttura

```
index.html          tela SVG, barra dei menu, editor, ordine degli script
icon.svg, icon.ico  icona dell'app (scheda del browser e collegamento sul desktop)
css/styles.css      token di colore (tema chiaro/scuro) e stili
js/core.js          utilità, stato globale S, misurazione testo, toast
js/storage.js       progetti, migrazione da v1/v2, alberi, livelli, selezione, undo
js/view.js          pan e zoom (una vista per livello)
js/mind.js          layout, disegno, operazioni su blocchi/collegamenti/note, struttura interna, anteprima
js/editor.js        modifica del testo sul posto (blocchi, note dei collegamenti, note della tela)
js/interactions.js  mouse, touch, tastiera
js/menu.js          menu del tasto destro
js/menubar.js       barra dei menu: progetti, salvataggio, file .json
js/export.js        esportazione SVG e PDF
js/main.js          avvio
```

La versione precedente (roadmap, processi…) è in `officina-mappe-backup-2026-11-09`, accanto a questa cartella.
