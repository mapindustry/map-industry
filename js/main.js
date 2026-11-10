// Avvio dell'applicazione
cloudBoot(); // sessione dell'account (o link arrivato per email): decide quali mappe caricare
load();
render();
if (CL.session) cloudInit(); else fsInit(); // mappe dell'account, oppure cartella dei progetti se scelta in passato
renderAccount();
requestAnimationFrame(fit);
let userMoved = false; cv.addEventListener('pointerdown', () => userMoved = true, { once: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { render(); if (!userMoved) fit(); });
addEventListener('resize', placeEditor);
