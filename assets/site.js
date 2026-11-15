(function () {
  var RG = window.RG || {};
  var store = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var params = new URLSearchParams(location.search);

  // 1. Taal: eerste bezoek aan de NL-hoofdpagina met een andere browsertaal → doorsturen.
  var chosen = store('rg-lang');
  if (!chosen && RG.lang === 'nl' && location.pathname === '/' && !params.has('stay')) {
    var nav = (navigator.languages || [navigator.language || 'nl']).map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
    var first = nav.find(function (l) { return RG.paths[l]; });
    if (first && first !== 'nl') { location.replace(RG.paths[first] + location.search); return; }
  }
  document.querySelectorAll('.js-lang').forEach(function (sel) {
    sel.addEventListener('change', function () {
      var target = sel.value;
      var lang = Object.keys(RG.paths).find(function (k) { return target.indexOf(RG.paths[k]) === 0 && RG.paths[k] !== '/'; }) || 'nl';
      store('rg-lang', lang);
      location.href = target;
    });
  });

  // 2. Meta-pixel, alleen na toestemming.
  var pixelOn = false;
  function loadPixel() {
    if (!RG.pixel || pixelOn) return;
    pixelOn = true;
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', RG.pixel);
    window.fbq('track', 'PageView');
  }
  function track(ev, data) { if (pixelOn && window.fbq) window.fbq('track', ev, data || {}); }
  var consent = document.querySelector('.consent');
  if (RG.pixel && consent) {
    var c = store('rg-consent');
    if (c === 'yes') loadPixel();
    else if (c !== 'no') consent.hidden = false;
    consent.querySelector('.js-consent-yes').addEventListener('click', function () { store('rg-consent', 'yes'); consent.hidden = true; loadPixel(); });
    consent.querySelector('.js-consent-no').addEventListener('click', function () { store('rg-consent', 'no'); consent.hidden = true; });
  }

  // 3. App Store-links: campagne meegeven (ct, max 40 tekens).
  var camp = params.get('utm_campaign') || params.get('utm_content') || params.get('utm_source') || '';
  if (camp) store('rg-ct', camp.slice(0, 40));
  var ct = store('rg-ct') || 'website';
  if (RG.appStoreId) {
    document.querySelectorAll('.js-store').forEach(function (a) {
      var u = 'https://apps.apple.com/app/id' + RG.appStoreId + '?mt=8&ct=' + encodeURIComponent(ct) + (RG.pt ? '&pt=' + encodeURIComponent(RG.pt) : '');
      a.href = u;
    });
  }
  document.querySelectorAll('.js-store').forEach(function (a) {
    a.addEventListener('click', function () { track('Lead', { content_name: 'appstore', content_category: a.dataset.where || '' }); });
  });

  // 4. Binnenkort-formulier.
  document.querySelectorAll('form.soon').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var mail = f.querySelector('input[type=email]').value.trim();
      if (!mail) return;
      track('Lead', { content_name: 'waitlist', content_category: f.dataset.where || '' });
      var done = function () { f.classList.add('done'); f.querySelector('.soon-thanks').hidden = false; };
      if (f.getAttribute('action')) {
        var body = new FormData(f);
        body.append('campaign', ct);
        fetch(f.getAttribute('action'), { method: 'POST', body: body, headers: { Accept: 'application/json' } }).then(done, done);
      } else {
        location.href = 'mailto:' + f.dataset.mail + '?subject=' + encodeURIComponent(f.dataset.subject) + '&body=' + encodeURIComponent(mail);
        done();
      }
    });
  });

  // 5. Video's pas laden als ze in beeld komen.
  var vids = document.querySelectorAll('video[data-src]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) {
          if (!v.src) v.src = v.dataset.src;
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else if (v.src) v.pause();
      });
    }, { rootMargin: '120px' });
    vids.forEach(function (v) { io.observe(v); });

    // 6. Vaste knop onderaan na de hero; ViewContent bij de prijzen.
    var sticky = document.querySelector('.sticky');
    var hero = document.querySelector('.hero');
    var end = document.querySelector('.end');
    if (sticky && hero) {
      sticky.hidden = false;
      var heroGone = false, endIn = false, ctaIn = new Set();
      var upd = function () { sticky.classList.toggle('show', heroGone && !endIn && ctaIn.size === 0); };
      new IntersectionObserver(function (e) { heroGone = !e[0].isIntersecting; upd(); }).observe(hero);
      if (end) new IntersectionObserver(function (e) { endIn = e[0].isIntersecting; upd(); }).observe(end);
      var co = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) ctaIn.add(e.target); else ctaIn.delete(e.target); }); upd(); });
      document.querySelectorAll('main .cta-wrap, main form.soon').forEach(function (el) { co.observe(el); });
    }
    var prices = document.getElementById('prijzen');
    if (prices) {
      var seen = false;
      new IntersectionObserver(function (e) { if (e[0].isIntersecting && !seen) { seen = true; track('ViewContent', { content_name: 'prices' }); } }, { threshold: .3 }).observe(prices);
    }
  } else {
    vids.forEach(function (v) { v.src = v.dataset.src; });
  }
})();

// Demo-spel pas laden na een tik (scheelt laadtijd, en geluid mag pas na een tik).
document.querySelectorAll('.demo-start').forEach(function (b) {
  b.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.src = b.dataset.src; f.title = b.querySelector('.demo-title').textContent;
    f.setAttribute('allow', 'autoplay');
    b.replaceWith(f);
    if (window.fbq) window.fbq('trackCustom', 'DemoStart');
  });
});

// Cadeaukaart live bijwerken + printen.
(function () {
  var card = document.getElementById('giftcard');
  if (!card) return;
  var $ = function (id) { return document.getElementById(id); };
  function upd() {
    var n = $('g-name').value.trim(), f = $('g-from').value.trim(), m = $('g-msg').value.trim();
    $('gc-name').textContent = (n || card.dataset.kid) + '!';
    $('gc-msg').textContent = m;
    $('gc-from').textContent = f;
    $('gc-from-wrap').hidden = !f;
  }
  ['g-name', 'g-from', 'g-msg'].forEach(function (id) { $(id).addEventListener('input', upd); });
  var q = new URLSearchParams(location.search);
  if (q.get('naam')) $('g-name').value = q.get('naam').slice(0, 24);
  if (q.get('van')) $('g-from').value = q.get('van').slice(0, 40);
  if (q.get('tekst')) $('g-msg').value = q.get('tekst').slice(0, 140);
  upd();
  document.querySelector('.js-print').addEventListener('click', function () { if (window.fbq) window.fbq('trackCustom', 'GiftCardPrint'); window.print(); });
})();

// Kleurplaat-downloads meten.
document.querySelectorAll('.js-kp').forEach(function (a) {
  a.addEventListener('click', function () { if (window.fbq) window.fbq('trackCustom', 'ColouringDownload', { page: a.dataset.kp }); });
});
