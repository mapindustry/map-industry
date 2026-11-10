// Collegamento a Supabase: accesso con email e password, mappe salvate online (una riga per mappa, tabella `projects`).
// La chiave è quella PUBBLICA del progetto (anon / publishable): è fatta per stare nell'app. Le mappe sono protette
// dalle regole del database: ognuno vede e modifica solo le proprie. Mai mettere qui la chiave service_role / secret.
// Lasciandoli vuoti l'app funziona come prima: mappe nel browser o in una cartella, senza accesso.
const SB_URL = 'https://bhsdgmewasxttfughtoy.supabase.co';
const SB_KEY = 'sb_publishable_aHgnyvIOONO5WAvbHSwjsQ_QgGmzjY1';
