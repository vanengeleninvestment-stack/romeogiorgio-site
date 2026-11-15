/* Feestanimaties met de echte Romeo en Giorgio (video's in img/feest/).
   Taalonafhankelijk: kijkt naar de sterren (#stars .on) en naar het eindscherm (#end).
   Kort filmpje na 2, 4 en 6 sterren (in een kaartje links, over Romeo heen); groot filmpje bij het eindscherm. */
(function () {
  const stars = document.getElementById('stars'), end = document.getElementById('end');
  if (!stars) return;
  const base = (document.querySelector('script[src$="feest.js"]').getAttribute('src') || '').replace('feest.js', '');
  const src = n => base + 'img/feest/' + n + '.mp4';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = document.createElement('style');
  css.textContent = '.feest{position:fixed;z-index:9;left:max(14px,env(safe-area-inset-left,0px));bottom:150px;width:min(300px,30vw);aspect-ratio:1;border-radius:28px;overflow:hidden;background:#fff;'
    + 'box-shadow:0 18px 40px -14px rgba(34,50,74,.45),0 0 0 6px #fff;pointer-events:none;opacity:0;transform:scale(.6) rotate(-6deg);transition:opacity .25s,transform .45s cubic-bezier(.34,1.56,.64,1)}'
    + '.feest.on{opacity:1;transform:none}.feest video{width:100%;height:100%;object-fit:cover;display:block}'
    + '.feest.groot{left:50%;top:50%;bottom:auto;width:min(420px,46vw);transform:translate(-50%,-60%) scale(.6);z-index:12}'
    + '.feest.groot.on{transform:translate(-50%,-60%)}';
  document.head.appendChild(css);
  const box = document.createElement('div'); box.className = 'feest';
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
  box.appendChild(v); document.body.appendChild(box);
  let busy = false, last = 0, hideT, lastExtra = 0;
  // Stickerboek (stickers.html): elk gezien filmpje bijhouden als sticker.
  function sticker(name) {
    try { const s = JSON.parse(localStorage.getItem('rg-stickers') || '{}'), e = s[name] || { eerst: new Date().toISOString().slice(0, 10), keer: 0 };
      e.keer++; s[name] = e; localStorage.setItem('rg-stickers', JSON.stringify(s)); } catch (e) {}
  }
  function play(name, big, then) {
    if (reduce) return;
    sticker(name);
    clearTimeout(hideT);
    box.classList.toggle('groot', !!big);
    v.src = src(name); v.currentTime = 0;
    const p = v.play(); if (p && p.catch) p.catch(() => {});
    box.classList.add('on'); busy = true;
    const stop = () => { box.classList.remove('on'); busy = false; };
    v.onended = () => { if (then) { play(then, big); return; } hideT = setTimeout(stop, big ? 1200 : 200); };
    hideT = setTimeout(stop, big ? 9000 : 6500);
  }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // Per mijlpaal een willekeurig filmpje (Giorgio doet steeds een ander kunstje).
  const AT = { 2: ['goed', 'pootje', 'opzitten'], 4: ['highfive', 'draai', 'bal'], 6: ['top', 'rollen'] };
  // Spellen met een eigen filmpje: dat komt bij 6 sterren.
  const page = (location.pathname.split('/').pop() || '').replace('.html', '');
  const EIGEN = { tellen: ['appels', 'tot100', 'stippen', 'dobbelsteen', 'sommetjes', 'verstoppen', 'meer', 'winkeltje'],
    eten: ['eten', 'groeien', 'fruit', 'restaurant'], sport: ['sport', 'lichaam'], verkeer: ['verkeer', 'veilig'],
    tanden: ['tanden'], reizen: ['landen', 'engels'] };
  for (const [clip, list] of Object.entries(EIGEN)) if (list.includes(page)) AT[6] = [clip];
  const endOpen = () => end && !end.hidden;
  new MutationObserver(() => {
    const n = stars.querySelectorAll('.on').length;
    if (n > last && AT[n] && !endOpen()) play(pick(AT[n]));
    last = n;
  }).observe(stars, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  // Eindscherm: eerst een dansje, dan gaan Romeo en Giorgio slapen.
  if (end) new MutationObserver(() => { if (!end.hidden) setTimeout(() => play('klaar', true, 'slapen'), 400); })
    .observe(end, { attributes: true, attributeFilter: ['hidden'] });
  // Kleine extra's, hoogstens eens per 30 seconden: fout (bijna), hulp (samen), niveau omhoog (hoepel).
  function extra(name) { const t = Date.now(); if (busy || endOpen() || t - lastExtra < 30000) return; lastExtra = t; play(name); }
  new MutationObserver(ms => {
    for (const m of ms) {
      const c = m.target.classList; if (!c) continue;
      const was = m.oldValue || '';
      if (c.contains('shake') && !/\bshake\b/.test(was) && Math.random() < 0.5) { extra('bijna'); break; }
      if (c.contains('pulse') && !/\bpulse\b/.test(was)) { extra('samen'); break; }
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  const UP = /steeds beter|getting better|immer besser|tu progresses/i;
  if (typeof window.say === 'function') {
    const orig = window.say;
    window.say = function (text) { if (UP.test(String(text))) { lastExtra = 0; setTimeout(() => extra('hoepel'), 300); } return orig.apply(this, arguments); };
  }
  // Vooraf laden zodat het filmpje meteen start.
  ['goed', 'highfive', 'top', 'klaar', 'slapen', 'bijna', 'samen', 'hoepel', ...new Set(Object.values(AT).flat())].forEach(n => { const l = document.createElement('link'); l.rel = 'prefetch'; l.href = src(n); document.head.appendChild(l); });
})();
