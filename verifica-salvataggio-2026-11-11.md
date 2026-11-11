# Verifica del salvataggio – 2026-11-11

Il modo d'uso normale è con l'accesso: Supabase è configurato e l'accesso è obbligatorio.
Ogni modifica va subito nel browser (250 ms dopo) e online (700 ms dopo). Con la cartella (senza accesso)
va anche nel file .json.

## Lacune principali (da sistemare per prime)

1. **Non si vede mai se il progetto è salvato.** Manca uno stato visibile tipo "Salvato" / "Salvataggio…" /
   "Non salvato online". Il pulsante Salva dice sempre "Progetto salvato" anche se il salvataggio online non è
   ancora partito (parte 700 ms dopo) o non è riuscito: dice solo che la copia è stata scritta nel browser.
2. **Nessun avviso alla chiusura.** Manca `beforeunload`: si può chiudere la pagina (o il browser) mentre c'è un
   salvataggio in attesa o dopo un errore, e nessuno avvisa. Questo vale per un progetto nuovo come per uno già esistente.
3. **Gli errori online si vedono una volta sola e poi spariscono.** `cloudFail` mostra un avviso per 2 secondi,
   solo al primo errore (`CL.warned`). Poi niente. Non riprova da solo: riprova solo "alla prossima modifica".
   Se la sessione scade e non si rinnova, compare un avviso e poi si lavora senza saperlo nel solo browser.
4. **Cambiando scheda, le ultime modifiche online della mappa lasciata si perdono.** `cloudSave` tiene una sola
   mappa in attesa (`CL.pending`): `switchTo` salva la mappa lasciata, poi `enterTab` salva quella nuova e la
   sostituisce. La mappa lasciata resta aggiornata solo nel browser e va online solo al prossimo avvio
   (`cloudSync`). Se si chiude il browser senza "Ricordami" (copia in sessionStorage), quella modifica è persa.
   Inoltre a ogni cambio di scheda si rimanda online la mappa aperta anche se non è cambiata.
5. **La chiusura della pagina non salva in modo affidabile.**
   - `pagehide` manda online con `keepalive`, ma i browser rifiutano i `keepalive` sopra 64 KB: le mappe con
     immagini o audio (data URL) non passano, e l'errore non si vede.
   - Non scrive la copia del browser in attesa (i 250 ms di `save`) e non chiude l'editor aperto: il testo che si
     sta scrivendo in un blocco si perde se si chiude la pagina.

## Lacune secondarie

6. **Due finestre dell'app aperte insieme si sovrascrivono.** `writeStore` riscrive tutto l'elenco dei progetti:
   un progetto creato in una finestra può sparire dall'altra. Online vince l'ultimo che scrive, senza avviso
   (nessun controllo su `updated_at` quando si salva). La mappa si rilegge solo aprendo o cambiando scheda.
7. **Nessuna cronologia delle versioni.** Annulla/rifai vive solo in memoria (si perde ricaricando). Online la riga
   viene sovrascritta: se una mappa si rovina (o la sovrascrive un altro dispositivo) non si torna indietro.
   C'è solo il file .json da scaricare a mano.
8. **Eliminare una mappa senza connessione:** se `cloudDelete` non riesce, al prossimo avvio la mappa ricompare.
   Non è grave, ma l'utente non capisce perché.
9. **Gli avvisi durano 2 secondi** (`toast`): sono troppo brevi per i messaggi importanti, come "non riesco a salvare"
   o "accesso scaduto".
10. **Senza "Ricordami"** la copia del browser sta in sessionStorage: se anche il salvataggio online non è riuscito,
    chiudendo il browser si perde tutto quello che non era salvato. Oggi l'utente non può saperlo (vedi 1–3).

## Proposta di intervento (in ordine)

1. **Stato del salvataggio nella barra**, accanto a Salva: "Salvato" / "Salvataggio…" / "Non salvato" (in evidenza,
   con il motivo al passaggio del mouse). Il pulsante Salva aspetta la risposta del server prima di dire "salvato".
2. **Avviso alla chiusura** (`beforeunload`) quando c'è qualcosa non ancora online (o non scritto nel file).
3. **Una coda per ogni mappa** al posto di `CL.pending` singolo (corregge il punto 4), e niente invio se la mappa
   non è cambiata.
4. **Nuovi tentativi automatici** dopo un errore (per esempio dopo 5 s, 15 s, 60 s, e quando torna la connessione),
   e avviso fisso finché il problema resta.
5. **Uscita dalla pagina:** chiudere l'editor e scrivere subito la copia del browser; per le mappe grandi affidarsi
   all'avviso del punto 2 invece che a `keepalive`.
6. In seguito: controllo dei conflitti (`updated_at` atteso), sincronizzazione tra finestre (evento `storage`),
   versioni salvate (per esempio un'istantanea al giorno per mappa, con "Ripristina").

## Altre richieste da fare

- **Collegare un gruppo ai blocchi.** Oggi i collegamenti uniscono solo blocchi (e svincoli). Serve poter tirare un
  collegamento da un gruppo a un blocco, e da un blocco a un gruppo, come se il gruppo fosse un blocco: con i pallini
  sul bordo del riquadro (o sulla barra del titolo quando il gruppo è compresso).
