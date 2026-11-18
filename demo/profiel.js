/* Meerdere kinderen (profielen) + voortgangslogboek voor Romeo & Giorgio.
   Staat in de <head> van elk spel en van het menu (ook in en/de/fr via een symlink), dus vóór alle spelcode.

   1. Profielen: localStorage 'rg-profielen' = [{id, naam, leeftijd (3-7), dier (img/e/<code>.webp), kleur}],
      actief kind in 'rg-actief'.
   2. Elke localStorage-sleutel wordt per kind gescheiden: getItem/setItem/removeItem krijgen stil het
      voorvoegsel 'p:<id>:'. Uitzonderingen (gedeeld voor het hele gezin): zie GLOBAAL.
      De spellen hoeven daardoor niets te weten van profielen. (key()/length/clear() zijn niet ingepakt;
      geen spel gebruikt ze.) sessionStorage blijft ongemoeid.
   3. Logboek 'rg-log' (per kind): { 'JJJJ-MM-DD': { <spel>: {v: keer geopend, r: rondes, s: sterren,
      e: eindscherm gehaald, u: niveau omhoog} } }. Taalonafhankelijk, door te kijken naar #stars .on,
      #end en de uitgesproken zin "steeds beter".
   window.RG is de API voor het menu (wisselen, beheren, weekoverzicht, "Vandaag voor jou"). */
(function (root) {
  'use strict';
  const GLOBAAL = new Set(['teltaal-lang', 'teltaal-intro', 'rg-profielen', 'rg-actief']);
  const DIEREN = ['1f436', '1f431', '1f430', '1f43b', '1f98a', '1f438', '1f981', '1f42d', '1f418', '1f422', '1f98b', '1f989', '1f986', '1f42c'];
  const KLEUREN = ['#FFD84D', '#FF9F8A', '#F7A8D0', '#B9A4F0', '#8EC9F5', '#8FD9B6', '#C6E37A', '#FFC078'];
  const BEWAAR_DAGEN = 70;

  let ls = null;
  try { ls = root.localStorage; } catch (e) { ls = null; }
  const SP = typeof Storage !== 'undefined' ? Storage.prototype : null;
  if (!ls || !SP) { root.RG = null; return; }
  if (SP.__rgProfiel) return; // al ingepakt (dubbel geladen)
  const O = { get: SP.getItem, set: SP.setItem, del: SP.removeItem, key: SP.key };
  const rget = k => { try { return O.get.call(ls, k); } catch (e) { return null; } };
  const rset = (k, v) => { try { O.set.call(ls, k, v); } catch (e) {} };
  const rdel = k => { try { O.del.call(ls, k); } catch (e) {} };
  const rkeys = () => { const a = []; try { for (let i = 0; i < ls.length; i++) a.push(O.key.call(ls, i)); } catch (e) {} return a; };
  const json = (s, d) => { try { const v = JSON.parse(s); return v == null ? d : v; } catch (e) { return d; } };

  // ---------- profielen ----------
  const nieuwId = () => 'k' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  const leeftijd = n => Math.min(7, Math.max(3, Math.round(+n) || 4));
  function lees() { const a = json(rget('rg-profielen'), []); return Array.isArray(a) ? a.filter(p => p && p.id) : []; }
  function schrijf(a) { rset('rg-profielen', JSON.stringify(a)); }

  // Eerste keer: stil een eerste profiel maken en bestaande sleutels overnemen.
  let profielen = lees();
  if (!profielen.length) {
    const id = 'k1';
    const naam = String(rget('teltaal-naam') || '').trim().slice(0, 20);
    profielen = [{ id, naam, leeftijd: 4, dier: DIEREN[0], kleur: KLEUREN[0] }];
    for (const k of rkeys()) {
      if (k == null || GLOBAAL.has(k) || k.startsWith('p:')) continue;
      const v = rget(k); if (v != null) rset('p:' + id + ':' + k, v); rdel(k);
    }
    schrijf(profielen); rset('rg-actief', id);
  }
  let actief = rget('rg-actief');
  if (!profielen.some(p => p.id === actief)) { actief = profielen[0].id; rset('rg-actief', actief); }

  const pre = (id, k) => 'p:' + id + ':' + k;
  const map = k => { k = String(k); return GLOBAAL.has(k) ? k : pre(actief, k); };
  SP.getItem = function (k) { return this === ls ? O.get.call(this, map(k)) : O.get.apply(this, arguments); };
  SP.setItem = function (k, v) { return this === ls ? O.set.call(this, map(k), v) : O.set.apply(this, arguments); };
  SP.removeItem = function (k) { return this === ls ? O.del.call(this, map(k)) : O.del.apply(this, arguments); };
  Object.defineProperty(SP, '__rgProfiel', { value: true });

  // ---------- datums ----------
  const pad = n => (n < 10 ? '0' : '') + n;
  const dagKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const plusDagen = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const maandag = d => plusDagen(d, -((d.getDay() + 6) % 7));
  let nu = () => new Date();

  // ---------- logboek ----------
  const logVan = id => { const l = json(rget(pre(id, 'rg-log')), {}); return l && typeof l === 'object' ? l : {}; };
  function noteer(spel, veld, n) {
    if (!spel || !n) return;
    const l = logVan(actief), d = dagKey(nu());
    const dag = l[d] || (l[d] = {}); const s = dag[spel] || (dag[spel] = {});
    s[veld] = (s[veld] || 0) + n;
    const grens = dagKey(plusDagen(nu(), -BEWAAR_DAGEN));
    for (const k of Object.keys(l)) if (k < grens) delete l[k];
    rset(pre(actief, 'rg-log'), JSON.stringify(l));
  }

  // Samenvatting van één week (ma t/m zo). terug = 0 deze week, 1 vorige week.
  // wereldVan(spel) geeft 'reken' / 'taal' / 'wereld' (of iets anders/undefined).
  function week(id, terug, wereldVan) {
    const l = logVan(id), start = plusDagen(maandag(nu()), -7 * (terug || 0));
    const uit = { dagen: 0, rondes: 0, sterren: 0, klaar: 0, niveaus: 0, keer: 0, top: [], perWereld: {}, van: dagKey(start), tot: dagKey(plusDagen(start, 6)) };
    const perSpel = {};
    for (let i = 0; i < 7; i++) {
      const dag = l[dagKey(plusDagen(start, i))]; if (!dag) continue;
      let iets = false;
      for (const [spel, s] of Object.entries(dag)) {
        const r = s.r || 0, v = s.v || 0;
        if (r || v) iets = true;
        uit.rondes += r; uit.sterren += s.s || 0; uit.klaar += s.e || 0; uit.niveaus += s.u || 0; uit.keer += v;
        const a = Math.max(r, v); // spellen zonder sterren tellen per keer openen
        perSpel[spel] = (perSpel[spel] || 0) + a;
        const w = wereldVan ? wereldVan(spel) : null;
        if (w) uit.perWereld[w] = (uit.perWereld[w] || 0) + a;
      }
      if (iets) uit.dagen++;
    }
    uit.top = Object.entries(perSpel).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3);
    return uit;
  }

  // Hoe vaak een spel de afgelopen 7 dagen (incl. vandaag) is geopend.
  function recent(id, dagen) {
    const l = logVan(id), uit = {};
    for (let i = 0; i < (dagen || 7); i++) {
      const dag = l[dagKey(plusDagen(nu(), -i))]; if (!dag) continue;
      for (const [spel, s] of Object.entries(dag)) uit[spel] = (uit[spel] || 0) + (s.v || 0) + (s.v ? 0 : (s.r ? 1 : 0));
    }
    return uit;
  }

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  /* "Vandaag voor jou": per wereld één spel.
     spellen: [{spel, wereld, van, tot, mag}] (mag = speelbaar zonder slotje). Kiest op leeftijd, wat deze week
     het minst geopend is, en wisselt per dag (vaste uitkomst voor dezelfde dag, hetzelfde kind en dezelfde lijst).
     Als niets in een wereld speelbaar is, komt er toch een spel uit (dat dan een slotje krijgt). */
  function kies(spellen, opt) {
    opt = opt || {};
    const id = opt.id || actief, p = profielen.find(x => x.id === id) || {};
    const age = leeftijd(opt.leeftijd != null ? opt.leeftijd : p.leeftijd);
    const dag = dagKey(opt.datum || nu()), gespeeld = opt.gespeeld || recent(id, 7);
    const gisteren = new Set(opt.gisteren || []);
    const uit = {}, werelden = [];
    for (const s of spellen) if (!werelden.includes(s.wereld)) werelden.push(s.wereld);
    for (const w of werelden) {
      const lijst = spellen.filter(s => s.wereld === w);
      const speelbaar = lijst.filter(s => s.mag !== false);
      const pool = speelbaar.length ? speelbaar : lijst;
      let pas = pool.filter(s => age >= s.van && age <= s.tot);
      if (pas.length < 2) pas = pool.filter(s => age >= s.van - 1 && age <= s.tot + 1);
      if (!pas.length) pas = pool;
      const score = s => (gespeeld[s.spel] || 0) * 10 + (gisteren.has(s.spel) && pas.length > 1 ? 5 : 0);
      pas = pas.slice().sort((a, b) => score(a) - score(b) || hash(dag + id + a.spel) - hash(dag + id + b.spel));
      uit[w] = pas[0] ? pas[0].spel : null;
    }
    return uit;
  }

  // ---------- API ----------
  const RG = {
    GLOBAAL, DIEREN, KLEUREN,
    profielen: () => lees(),
    actief: () => lees().find(p => p.id === actief) || lees()[0],
    actiefId: () => actief,
    kies: id => { if (lees().some(p => p.id === id)) { actief = id; rset('rg-actief', id); return true; } return false; },
    voegToe: function (d) {
      d = d || {}; const a = lees(), id = nieuwId();
      const p = { id, naam: String(d.naam || '').trim().slice(0, 20), leeftijd: leeftijd(d.leeftijd),
        dier: DIEREN.includes(d.dier) ? d.dier : DIEREN[a.length % DIEREN.length], kleur: d.kleur || KLEUREN[a.length % KLEUREN.length] };
      a.push(p); schrijf(a); profielen = a;
      if (p.naam) rset(pre(id, 'teltaal-naam'), p.naam);
      return p;
    },
    wijzig: function (id, d) {
      const a = lees(), p = a.find(x => x.id === id); if (!p) return null;
      if (d.naam != null) { p.naam = String(d.naam).trim().slice(0, 20); if (p.naam) rset(pre(id, 'teltaal-naam'), p.naam); }
      if (d.leeftijd != null) p.leeftijd = leeftijd(d.leeftijd);
      if (d.dier && DIEREN.includes(d.dier)) p.dier = d.dier;
      if (d.kleur) p.kleur = d.kleur;
      schrijf(a); profielen = a; return p;
    },
    verwijder: function (id) { // het laatste kind blijft altijd bestaan
      const a = lees(); if (a.length < 2 || !a.some(p => p.id === id)) return false;
      const rest = a.filter(p => p.id !== id); schrijf(rest); profielen = rest;
      for (const k of rkeys()) if (k && k.startsWith('p:' + id + ':')) rdel(k);
      if (actief === id) { actief = rest[0].id; rset('rg-actief', actief); }
      return true;
    },
    log: id => logVan(id || actief),
    noteer, week, recent, voorstel: kies, dagKey, vandaag: () => dagKey(nu()),
    _klok: f => { nu = f; } // alleen voor tests
  };
  root.RG = RG;

  // ---------- meten in het spel (taalonafhankelijk) ----------
  if (typeof document === 'undefined' || !root.location) return;
  const spel = (root.location.pathname.split('/').pop() || '').replace(/\.html?$/i, '');
  if (!spel || spel === 'index' || spel === 'stickers' || spel === 'ikkan') return;
  const UP = /steeds beter|getting better|immer besser|tu progresses/i;
  function start() {
    noteer(spel, 'v', 1);
    const stars = document.getElementById('stars'), end = document.getElementById('end');
    if (stars) {
      let last = stars.querySelectorAll('.on').length;
      new MutationObserver(() => {
        const n = stars.querySelectorAll('.on').length;
        if (n > last) { noteer(spel, 'r', n - last); noteer(spel, 's', n - last); }
        last = n;
      }).observe(stars, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    if (end) {
      let open = !end.hidden;
      new MutationObserver(() => { const o = !end.hidden; if (o && !open) noteer(spel, 'e', 1); open = o; })
        .observe(end, { attributes: true, attributeFilter: ['hidden'] });
    }
    if (typeof root.say === 'function') {
      const orig = root.say;
      root.say = function (text) { if (UP.test(String(text))) noteer(spel, 'u', 1); return orig.apply(this, arguments); };
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);

/* Huisstijl Romeo & Giorgio (brandboek: huisstijl/brandboek.html): merkkleuren over alle spellen heen.
   Wordt na de eigen stijl van de pagina gezet, zodat deze waarden winnen. */
(function () {
  const css = ':root{--ink:#13306B;--hl:#FFC629;--brand-blauw:#1E5BD8;--brand-geel:#FFC629;--brand-oranje:#F47B20;--brand-navy:#13306B}'
    + '.play{background:#F47B20!important;box-shadow:0 6px 0 #B9560E!important;color:#fff!important}';
  const add = () => { const s = document.createElement('style'); s.id = 'rg-huisstijl'; s.textContent = css; document.head.appendChild(s); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
