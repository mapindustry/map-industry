// Avvio dell'applicazione
load();
render();
requestAnimationFrame(fit);
let userMoved = false; cv.addEventListener('pointerdown', () => userMoved = true, { once: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { render(); if (!userMoved) fit(); });
addEventListener('resize', placeEditor);
