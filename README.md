# Officina Mappe

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
| Sposta blocchi e note | trascinali |
| Ridimensiona | quadratino sul lato esterno del blocco selezionato |
| Collega diversamente | pallino **bianco** (ingresso) su un altro blocco = riattacca lì · nel vuoto = stacca |
| | pallino **grigio** (uscita) su un altro blocco = quel blocco si collega qui |
| Nota su un collegamento | doppio clic sul collegamento |
| Opzioni | tasto destro: sul blocco (colore, stile testo/bordo/opacità, struttura interna, stacca, elimina), sul collegamento (nota, linea continua/tratteggiata), sulla tela (aggiungi blocco, aggiungi nota) |
| Struttura interna | tasto destro → Crea/Apri · passa sull'icona a griglia per l'anteprima, clic per entrare · Esc o il percorso in alto per tornare |
| Sposta la vista | rotellina, Spazio + trascina, tasto centrale |
| Zoom | Ctrl/⌘ + rotellina |
| Annulla | Ctrl/⌘ + Z |

Ogni blocco ha un solo ingresso: ricollegarlo lo sposta. Non si può collegare un blocco sotto uno dei suoi rami.
Anche l'idea centrale si può collegare sotto un altro blocco o eliminare, se sulla tela resta un altro blocco.

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
