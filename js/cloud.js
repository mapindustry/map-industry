// Account e mappe online (Supabase, chiamato con fetch: nessuna libreria). Configurazione in js/config.js.
// - Accesso: email e password (crea un account, entra, password dimenticata, esci). La sessione ('officina-mappe-auth')
//   si rinnova da sola. "Ricordami su questo dispositivo" (di serie): sta in localStorage e resta tra un'apertura e
//   l'altra; senza, sta in sessionStorage (anche la copia delle mappe) e finisce chiudendo il browser. I link delle email (conferma, nuova password) tornano all'app con i
//   dati nel frammento #access_token=…, letti all'avvio.
// - Con l'accesso le mappe sono le righe della tabella `projects` dell'utente: { owner, id, name, data: { root,
//   locked }, updated_at, deleted }. Ogni salvataggio scrive anche online (poco dopo l'ultima modifica, in coda).
//   La copia nel browser resta (chiave separata per utente, così su un PC condiviso non si mescolano), serve anche
//   senza connessione: al ritorno si riscrive. Eliminare = deleted: true (recuperabile da Supabase).
// - Entrare o uscire ricarica l'app: con l'accesso si lavora sulle mappe dell'account (la cartella dei progetti resta
//   in pausa). Con Supabase configurato l'accesso è obbligatorio: senza, l'app mostra solo la finestra di accesso
//   (body.gate nasconde barra e tela, niente × né Esc). Le mappe restano comunque protette dalle regole del database.
const CL = { session: null, chain: Promise.resolve(), warned: false, timer: null, pending: null };
const cloudOn = () => !!(SB_URL && SB_KEY);
const AUTH = 'officina-mappe-auth';
const appUrl = () => location.origin + location.pathname;

/* ---------- sessione ---------- */
// i dati dell'utente stanno nel token (JWT): id (sub) ed email, senza chiedere al server
function jwtUser(tok) {
  try { const j = JSON.parse(decodeURIComponent(escape(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))); const m = j.user_metadata || {}; return { id: j.sub, email: j.email || '', name: m.name || m.full_name || '' }; }
  catch (e) { return null; }
}
// dove sta la sessione (e la copia delle mappe dell'account): ricordata = localStorage, altrimenti sessionStorage
const authStore = () => CL.session && CL.session.remember === false ? sessionStorage : localStorage;
function keepSession() { try { authStore().setItem(AUTH, JSON.stringify(CL.session)); } catch (e) {} }
function setSession(s, remember) {
  if (!s || !s.access_token) { CL.session = null; try { localStorage.removeItem(AUTH); sessionStorage.removeItem(AUTH); } catch (e) {} return; }
  if (remember === undefined) remember = !CL.session || CL.session.remember !== false; // rinnovo: resta com'era
  const user = jwtUser(s.access_token) || s.user, keep = CL.session && CL.session.user.id === user.id ? CL.session.user.name : '';
  CL.session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (+s.expires_in || 3600), user: { id: user.id, email: user.email, name: user.name || keep || '' }, remember };
  keepSession();
}
// all'avvio, prima di caricare le mappe: sessione salvata, oppure arrivata da un link email (#access_token=…)
let authReturn = null; // 'signup' | 'recovery' | 'magiclink' …: per dire all'utente cosa è successo
function cloudBoot() {
  if (!cloudOn()) return;
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('access_token')) {
    setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in') });
    authReturn = h.get('type') || 'login';
    history.replaceState(null, '', appUrl());
  } else if (h.get('error_description')) {
    authReturn = 'error:' + h.get('error_description').replace(/\+/g, ' ');
    history.replaceState(null, '', appUrl());
  } else {
    try { const s = JSON.parse(sessionStorage.getItem(AUTH) || localStorage.getItem(AUTH) || 'null'); if (s && s.access_token && s.user) CL.session = s; } catch (e) {}
  }
}
// chiave di localStorage: le mappe del browser, oppure la copia locale delle mappe dell'account
const storeKey = () => CL.session ? 'officina-mappe-cloud:' + CL.session.user.id : KEY;

/* ---------- chiamate ---------- */
async function refreshSession() {
  if (!CL.session || !CL.session.refresh_token) return false;
  try {
    const r = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: CL.session.refresh_token }) });
    if (!r.ok) return false;
    setSession(await r.json()); return true;
  } catch (e) { return false; }
}
async function sb(path, { method = 'GET', body, headers = {}, auth = true, keepalive = false } = {}) {
  if (auth && CL.session && CL.session.expires_at - Date.now() / 1000 < 60) await refreshSession();
  const h = () => ({ apikey: SB_KEY, 'Content-Type': 'application/json', ...(auth && CL.session ? { Authorization: 'Bearer ' + CL.session.access_token } : {}), ...headers });
  const opt = () => ({ method, headers: h(), body: body === undefined ? undefined : JSON.stringify(body), keepalive });
  let r = await fetch(SB_URL + path, opt());
  if (r.status === 401 && auth && await refreshSession()) r = await fetch(SB_URL + path, opt());
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) { const err = new Error(authMsg(j, r.status)); err.status = r.status; throw err; }
  return j;
}
// messaggi di Supabase in italiano
function authMsg(j, status) {
  const m = String(j && (j.msg || j.error_description || j.message || j.error) || '').toLowerCase();
  if (m.includes('invalid login')) return 'Email o password sbagliate';
  if (m.includes('not confirmed')) return 'Email non ancora confermata: apri il link che ti abbiamo mandato';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Esiste già un account con questa email: accedi';
  if (m.includes('password') && (m.includes('6') || m.includes('short') || m.includes('weak'))) return 'Password troppo debole: almeno 6 caratteri';
  if (m.includes('signup') && m.includes('disabled') || m.includes('signups not allowed')) return 'Le registrazioni sono chiuse: chiedi un invito';
  if (m.includes('rate limit') || status === 429) return 'Troppi tentativi: riprova tra qualche minuto';
  if (m.includes('email') && m.includes('invalid')) return 'Email non valida';
  if (status === 401 || status === 403) return 'Accesso scaduto: entra di nuovo';
  return m ? 'Errore: ' + m : 'Connessione non riuscita';
}

/* ---------- account ---------- */
async function signIn(email, password, remember = true) {
  setSession(await sb('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false }), remember);
  location.reload();
}
// con la conferma via email attiva (di serie in Supabase) l'account vale dopo il clic sul link
async function signUp(email, password, name) {
  const j = await sb('/auth/v1/signup?redirect_to=' + encodeURIComponent(appUrl()), { method: 'POST', body: { email, password, data: { name } }, auth: false });
  if (j && j.access_token) { setSession(j); location.reload(); return 'in'; }
  return 'confirm';
}
async function recoverPassword(email) { await sb('/auth/v1/recover?redirect_to=' + encodeURIComponent(appUrl()), { method: 'POST', body: { email }, auth: false }); }
async function setNewPassword(password) { await sb('/auth/v1/user', { method: 'PUT', body: { password } }); }
// nome mostrato nella barra: sta nei dati dell'utente su Supabase (user_metadata.name)
async function setName(name) {
  await sb('/auth/v1/user', { method: 'PUT', body: { data: { name } } });
  CL.session.user.name = name; keepSession();
  renderAccount();
}
const userName = () => CL.session ? CL.session.user.name || CL.session.user.email.split('@')[0] : '';
async function signOut() {
  await cloudFlush();
  try { await sb('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* esce comunque */ }
  try { sessionStorage.removeItem(storeKey()); } catch (e) {} // copia delle mappe di un accesso non ricordato
  setSession(null); location.reload();
}

/* ---------- mappe online ---------- */
const rowOf = p => ({ owner: CL.session.user.id, id: p.id, name: p.name || 'Senza nome', data: { root: p.root, locked: !!p.locked }, updated_at: new Date(p.updated || Date.now()).toISOString(), deleted: false });
function cloudFail(e) {
  console.warn('mappe online:', e);
  if (e && e.status === 401) { toast('Accesso scaduto: entra di nuovo dal menu Account'); return; }
  if (!CL.warned) { CL.warned = true; toast('Non riesco a salvare online: per ora salvo nel browser e riprovo alla prossima modifica'); }
}
function cloudQueue(fn) { CL.chain = CL.chain.then(fn).then(() => { CL.warned = false; }).catch(cloudFail); return CL.chain; }
// chiamata da writeStore: la mappa aperta va online poco dopo l'ultima modifica
function cloudSave(p) {
  if (!CL.session || !p) return;
  CL.pending = p; clearTimeout(CL.timer);
  CL.timer = setTimeout(() => { const q = CL.pending; CL.pending = null; cloudQueue(() => sb('/rest/v1/projects?on_conflict=owner,id', { method: 'POST', body: rowOf(q), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } })); }, 700);
}
// scrive subito ciò che è in attesa (prima di uscire, di cambiare account o di chiudere la pagina)
function cloudFlush(keepalive) {
  if (!CL.session || !CL.pending) return CL.chain;
  clearTimeout(CL.timer); const q = CL.pending; CL.pending = null;
  return cloudQueue(() => sb('/rest/v1/projects?on_conflict=owner,id', { method: 'POST', body: rowOf(q), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, keepalive }));
}
addEventListener('pagehide', () => cloudFlush(true));
function cloudUpsert(list) {
  return sb('/rest/v1/projects?on_conflict=owner,id', { method: 'POST', body: list.map(rowOf), headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
}
function cloudDelete(p) {
  if (!CL.session || !p) return;
  if (CL.pending && CL.pending.id === p.id) { clearTimeout(CL.timer); CL.pending = null; }
  return cloudQueue(() => sb(`/rest/v1/projects?id=eq.${encodeURIComponent(p.id)}`, { method: 'PATCH', body: { deleted: true }, headers: { Prefer: 'return=minimal' } }));
}
// le mappe dell'account diventano l'elenco dei progetti; la copia del browser più recente (modifiche fatte senza
// connessione) torna online
async function cloudSync() {
  const rows = await sb('/rest/v1/projects?select=id,name,data,updated_at&deleted=is.false&order=updated_at.desc');
  const byId = new Map(rows.map(r => [r.id, r])), keep = [], push = [];
  S.projects.forEach(p => {
    const r = byId.get(p.id);
    if (!r) { if (p.cloud) return; push.push(p); keep.push(p); return; } // sparita online (eliminata altrove) / nuova qui
    byId.delete(p.id);
    const t = Date.parse(r.updated_at);
    if (t >= (p.updated || 0) - 1000 && !(p.id === S.pid && dirty)) {
      p.root = r.data.root; p.name = r.name; p.updated = t; if (r.data.locked) p.locked = true; else delete p.locked;
      if (p.id === S.pid) { S.root = p.root; S.undo = []; S.redo = []; pruneSel(); }
    } else push.push(p);
    p.cloud = true; keep.push(p);
  });
  byId.forEach(r => keep.push({ id: r.id, name: r.name, updated: Date.parse(r.updated_at), root: r.data.root, cloud: true, ...(r.data.locked ? { locked: true } : {}) }));
  keep.forEach(p => flattenSubs(p.root));
  if (!keep.length) keep.push({ id: uid(), name: 'Prima mappa', updated: Date.now(), root: mk('Idea primaria') });
  S.projects = keep;
  if (!S.projects.some(p => p.id === S.pid)) { S.pid = S.projects[0].id; S.root = curProject().root; S.undo = []; S.redo = []; }
  S.tabs = S.tabs.filter(id => S.projects.some(p => p.id === id)); if (!S.tabs.includes(S.pid)) S.tabs.push(S.pid);
  if (push.length) await cloudUpsert(push);
  S.projects.forEach(p => { p.cloud = true; });
  saveNow(); render();
}
// prima di aprire una mappa la si rilegge (può essere cambiata da un altro dispositivo)
async function cloudReload(p) {
  if (!CL.session || !p.cloud) return false;
  try {
    const [r] = await sb(`/rest/v1/projects?select=name,data,updated_at&id=eq.${encodeURIComponent(p.id)}`);
    if (!r) return false; const t = Date.parse(r.updated_at); if (t <= (p.updated || 0)) return false;
    p.root = r.data.root; flattenSubs(p.root); p.name = r.name; p.updated = t; if (r.data.locked) p.locked = true; else delete p.locked;
    return true;
  } catch (e) { return false; /* senza connessione: resta la copia del browser */ }
}
// mappe del browser (senza accesso) da portare nell'account
function localProjects() { try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && Array.isArray(j.projects) ? j.projects : []; } catch (e) { return []; } }
async function uploadLocal() {
  const list = localProjects(); if (!list.length) return toast('Nel browser non ci sono mappe da caricare');
  try { await cloudUpsert(list); await cloudSync(); toast(list.length === 1 ? 'Caricata online 1 mappa' : `Caricate online ${list.length} mappe`); }
  catch (e) { cloudFail(e); }
}
async function cloudInit() {
  if (authReturn === 'recovery') openAuth('newpass');
  else if (authReturn && authReturn.startsWith('error:')) toast('Link non valido o scaduto: ' + authReturn.slice(6));
  else if (authReturn) toast('Accesso fatto: benvenuto ' + CL.session.user.email);
  try { await cloudSync(); } catch (e) { cloudFail(e); }
}

/* ---------- finestra di accesso ---------- */
// modi: 'in' (entra), 'up' (crea un account), 'forgot' (password dimenticata), 'newpass' (nuova password dal link),
// 'name' (il proprio nome)
const authEl = $('#auth');
const gated = () => document.body.classList.contains('gate');
function openAuth(mode = 'in') {
  closeDrops(); closeMenu();
  const T = { in: ['Entra in Map Industry', 'Entra'], up: ['Crea un account', 'Crea l’account'], forgot: ['Password dimenticata', 'Mandami il link'], newpass: ['Nuova password', 'Salva la password'], name: ['Il tuo nome', 'Salva'] }[mode];
  authEl.innerHTML = `<form class="authbox" novalidate>${gated() ? '<div class="abrand">Map Industry</div>' : '<button type="button" class="ax" aria-label="Chiudi">×</button>'}<h2>${T[0]}</h2>` +
    (mode === 'up' || mode === 'name' ? `<label>Nome<input name="uname" type="text" autocomplete="name" maxlength="60" value="${mode === 'name' && CL.session ? esc(CL.session.user.name || '') : ''}" required></label>` : '') +
    (mode === 'newpass' || mode === 'name' ? '' : `<label>Email<input name="email" type="email" autocomplete="email" required></label>`) +
    (mode === 'name' ? '<p class="amsg">Si vede in alto a destra.</p>' : mode === 'forgot' ? '<p class="amsg">Ti mandiamo un link per scegliere una password nuova.</p>' :
      `<label>Password<input name="password" type="password" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}" minlength="6" required></label>`) +
    (mode === 'up' ? '<p class="amsg">Almeno 6 caratteri. Ti mandiamo un’email per confermare l’indirizzo.</p>' : '') +
    (mode === 'in' ? '<label class="arem"><input name="remember" type="checkbox" checked> Ricordami su questo dispositivo</label>' : '') +
    `<p class="aerr" role="alert" hidden></p><button class="ago" type="submit">${T[1]}</button>` +
    (mode === 'in' ? '<p class="alinks"><a href="#" data-m="up">Crea un account</a> · <a href="#" data-m="forgot">Password dimenticata?</a></p>' :
      mode === 'newpass' || mode === 'name' ? '' : '<p class="alinks"><a href="#" data-m="in">Hai già un account? Entra</a></p>') + `</form>`;
  authEl.hidden = false; authEl.dataset.mode = mode;
  const f = authEl.querySelector('input'); if (f) f.focus();
}
const closeAuth = () => { if (gated()) return; authEl.hidden = true; authEl.innerHTML = ''; }; // con l'accesso obbligatorio non si chiude
authEl.addEventListener('click', e => {
  if (e.target === authEl || e.target.closest('.ax')) return closeAuth();
  const m = e.target.closest('[data-m]'); if (m) { e.preventDefault(); openAuth(m.dataset.m); }
});
authEl.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closeAuth(); });
authEl.addEventListener('submit', async e => {
  e.preventDefault();
  const fm = e.target, mode = authEl.dataset.mode, err = fm.querySelector('.aerr'), go = fm.querySelector('.ago');
  const email = fm.email ? fm.email.value.trim() : '', pw = fm.password ? fm.password.value : '', nm = fm.uname ? fm.uname.value.replace(/\s+/g, ' ').trim() : '';
  if (fm.uname && !nm) { err.textContent = 'Scrivi il tuo nome'; err.hidden = false; return; }
  const fail = t => { err.textContent = t; err.hidden = false; go.disabled = false; };
  if (fm.email && !/^\S+@\S+\.\S+$/.test(email)) return fail('Scrivi un indirizzo email valido');
  if (fm.password && pw.length < 6) return fail('La password deve avere almeno 6 caratteri');
  go.disabled = true; err.hidden = true;
  try {
    if (mode === 'in') await signIn(email, pw, fm.remember.checked);
    else if (mode === 'name') { await setName(nm); closeAuth(); toast('Nome salvato'); }
    else if (mode === 'up') { if (await signUp(email, pw, nm) === 'confirm') doneMsg(fm, `Abbiamo mandato un link a <b>${esc(email)}</b>: aprilo per confermare l’account, poi torni qui già dentro.`); }
    else if (mode === 'forgot') { await recoverPassword(email); doneMsg(fm, `Se esiste un account per <b>${esc(email)}</b>, ti è arrivato un link per scegliere la password nuova.`); }
    else { await setNewPassword(pw); closeAuth(); toast('Password cambiata'); }
  } catch (x) { fail(x.message || 'Connessione non riuscita'); }
});
// messaggio finale (email mandata): con l'accesso obbligatorio si torna alla finestra di accesso, altrimenti si chiude
function doneMsg(fm, html) {
  fm.innerHTML = (gated() ? '<div class="abrand">Map Industry</div>' : '<button type="button" class="ax" aria-label="Chiudi">×</button>') +
    `<h2>Controlla l’email</h2><p class="amsg">${html}</p>` + (gated() ? '<p class="alinks"><a href="#" data-m="in">Torna all’accesso</a></p>' : '');
}
// accesso obbligatorio: se Supabase è configurato e non c'è sessione, si vede solo la finestra di accesso
function authGate() {
  if (!cloudOn() || CL.session) return false;
  document.body.classList.add('gate'); openAuth('in');
  if (authReturn && authReturn.startsWith('error:')) { const e = authEl.querySelector('.aerr'); e.textContent = 'Link non valido o scaduto: ' + authReturn.slice(6); e.hidden = false; }
  return true;
}
// dietro la finestra di accesso la tastiera non arriva alla mappa
addEventListener('keydown', e => { if (gated() && !authEl.contains(e.target)) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
