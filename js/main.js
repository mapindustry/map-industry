// Avvio dell'applicazione
load();
render();
fsInit(); // cartella dei progetti, se scelta in passato
requestAnimationFrame(fit);
let userMoved = false; cv.addEventListener('pointerdown', () => userMoved = true, { once: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { render(); if (!userMoved) fit(); });
addEventListener('resize', placeEditor);
