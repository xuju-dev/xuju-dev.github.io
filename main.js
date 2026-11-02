(function () {
  var root = document.documentElement;
  function setLang(l) {
    root.setAttribute('data-lang', l);
    root.setAttribute('lang', l);
    document.querySelectorAll('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === l));
    });
    try { localStorage.setItem('lang', l); } catch (e) {}
    if (window.__site) window.__site.renderPersonal();
  }
  var saved = null;
  try { saved = localStorage.getItem('lang'); } catch (e) {}
  var nav = (navigator.language || 'en').toLowerCase();
  setLang(saved === 'de' || saved === 'en' ? saved : (nav.indexOf('de') === 0 ? 'de' : 'en'));
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-set-lang')); });
  });

  // Theme: follows the system until the visitor picks one
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var savedTheme = null;
  try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
  function applyTheme(t) { root.setAttribute('data-theme', t); redrawSoon(); }
  applyTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : (darkQuery.matches ? 'dark' : 'light'));
  darkQuery.addEventListener('change', function (e) {
    var s = null; try { s = localStorage.getItem('theme'); } catch (err) {}
    if (!s) applyTheme(e.matches ? 'dark' : 'light');
  });
  document.getElementById('theme-toggle').addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // Hero background: animated multimodal trajectory predictions.
  // Each agent has a driven path (solid) and several possible futures (dashed),
  // drawn thicker the more likely they are.
  var canvas = document.getElementById('traj');
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, agents = [], start = 0, needRedraw = false;
  var DRAW = 2600, HOLD = 4200, FADE = 900, CYCLE = DRAW + HOLD + FADE;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function accent() { return getComputedStyle(root).getPropertyValue('--accent').trim() || '#1f4f86'; }

  function makePath(x, y, ang, curv, len, steps) {
    var pts = [], step = len / steps;
    for (var i = 0; i <= steps; i++) {
      pts.push([x, y]);
      ang += curv; x += Math.cos(ang) * step; y += Math.sin(ang) * step;
    }
    return { pts: pts, ang: ang };
  }
  function generate() {
    agents = [];
    var n = W < 600 ? 3 : 5;
    for (var i = 0; i < n; i++) {
      var x = W < 720 ? rand(W * 0.45, W * 0.8) : rand(W * 0.52, W * 0.8), y = rand(H * 0.12, H * 0.88);
      var ang = rand(-0.5, 0.5) + (Math.random() < 0.2 ? Math.PI : 0);
      var hist = makePath(x, y, ang, rand(-0.01, 0.01), rand(70, 120), 24);
      var end = hist.pts[hist.pts.length - 1];
      var k = 3 + Math.floor(Math.random() * 3), probs = [], sum = 0;
      for (var j = 0; j < k; j++) { var p = Math.random() + (j === 0 ? 1.2 : 0); probs.push(p); sum += p; }
      var futures = [];
      for (j = 0; j < k; j++) {
        futures.push({ path: makePath(end[0], end[1], hist.ang, rand(-0.045, 0.045), rand(90, 170), 30).pts, p: probs[j] / sum });
      }
      agents.push({ hist: hist.pts, futures: futures, delay: i * 180 });
    }
  }
  function strokePartial(pts, frac) {
    var last = Math.max(1, Math.floor((pts.length - 1) * frac));
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i <= last; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    return pts[last];
  }
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    var color = accent(), fade = 1;
    if (t > DRAW + HOLD) fade = 1 - (t - DRAW - HOLD) / FADE;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
    agents.forEach(function (a) {
      var local = Math.max(0, Math.min(1, (t - a.delay) / (DRAW - 800)));
      var hFrac = Math.min(1, local / 0.4), fFrac = Math.max(0, (local - 0.4) / 0.6);
      ctx.globalAlpha = 0.55 * fade; ctx.lineWidth = 2; ctx.setLineDash([]);
      var head = strokePartial(a.hist, hFrac);
      if (fFrac > 0) {
        a.futures.forEach(function (f) {
          ctx.globalAlpha = (0.15 + 0.6 * f.p) * fade; ctx.lineWidth = 0.8 + 2.4 * f.p; ctx.setLineDash([4, 5]);
          var tip = strokePartial(f.path, fFrac);
          if (fFrac === 1) { ctx.setLineDash([]); ctx.beginPath(); ctx.arc(tip[0], tip[1], 1.5 + 2 * f.p, 0, Math.PI * 2); ctx.fill(); }
        });
      }
      ctx.setLineDash([]); ctx.globalAlpha = 0.8 * fade;
      ctx.beginPath(); ctx.arc(head[0], head[1], 3.2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
  function resize() {
    var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width) return;
    if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 1) return; // size unchanged
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    generate(); start = performance.now() - DRAW * 0.75;
    if (reduceMotion) draw(DRAW);
  }
  function loop(now) {
    var t = now - start;
    if (t > CYCLE) { generate(); start = now; t = 0; }
    draw(t);
    requestAnimationFrame(loop);
  }
  function redrawSoon() { if (reduceMotion && W) draw(DRAW); }
  var resizeTimer;
  function resizeSoon() { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); }
  // Re-measure whenever the intro area changes size (photo, fonts or layout loading later),
  // so the drawing is never stretched
  if ('ResizeObserver' in window) new ResizeObserver(resizeSoon).observe(canvas);
  window.addEventListener('resize', resizeSoon);
  resize();
  if (!reduceMotion) requestAnimationFrame(loop);

  // Gallery slider: swipe, arrows, dots and arrow keys
  (function () {
    var track = document.getElementById('gallery-track');
    if (!track) return;
    var slides = track.querySelectorAll('.slide');
    var prev = document.getElementById('gallery-prev'), next = document.getElementById('gallery-next');
    var dotsBox = document.getElementById('gallery-dots'), dots = [];
    function go(i) { i = Math.max(0, Math.min(slides.length - 1, i)); track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft }); }
    function current() { return Math.round(track.scrollLeft / Math.max(1, track.clientWidth + 16)); }
    slides.forEach(function (s, i) {
      var b = document.createElement('button'); b.type = 'button';
      b.setAttribute('aria-label', 'Image ' + (i + 1));
      b.addEventListener('click', function () { go(i); });
      dotsBox.appendChild(b); dots.push(b);
    });
    function update() {
      var c = current();
      dots.forEach(function (d, i) { d.setAttribute('aria-current', String(i === c)); });
      prev.disabled = c === 0; next.disabled = c === slides.length - 1;
    }
    prev.addEventListener('click', function () { go(current() - 1); });
    next.addEventListener('click', function () { go(current() + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
    });
    var t; track.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(update, 60); }, { passive: true });
    update();
  })();

  // Collapsed sections: open them when a link (e.g. from the gallery) points inside
  function openTarget() {
    var id = location.hash.slice(1);
    var el = id && document.getElementById(id);
    var box = el && el.closest('details');
    if (box && !box.open) { box.open = true; el.scrollIntoView(); }
  }
  window.addEventListener('hashchange', openTarget);
  openTarget();
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href') === location.hash) setTimeout(openTarget, 0);
  });

  // Table of contents: built from the section headings, highlights the section in view
  (function () {
    var toc = document.getElementById('toc');
    if (!toc) return;
    var heads = Array.prototype.slice.call(document.querySelectorAll('main h2[id], .personal h2[id]'))
      .filter(function (h) { return !h.hidden; });
    var title = document.createElement('p'); title.className = 'toc-title';
    title.innerHTML = '<i lang="en">On this page</i><i lang="de">Inhalt</i>';
    toc.appendChild(title);
    var ol = document.createElement('ol'), links = {};
    heads.forEach(function (h) {
      var li = document.createElement('li'), a = document.createElement('a');
      // Link to the start of the section, not the (sticky) heading
      var target = h.closest('section') || h.closest('.personal-card') || h;
      if (!target.id) target.id = 's-' + h.id.replace(/^h-/, '');
      a.href = '#' + target.id;
      // Copy each language label as <i lang> so edit mode doesn't treat them as page text
      var labels = h.querySelectorAll('span[lang]');
      if (labels.length) {
        labels.forEach(function (sp) { var i = document.createElement('i'); i.lang = sp.lang; i.textContent = sp.textContent; a.appendChild(i); });
      } else { a.textContent = h.textContent; }
      if (h.closest('.personal')) li.className = 'toc-side';
      li.appendChild(a); ol.appendChild(li); links[h.id] = a;
    });
    toc.appendChild(ol);
    // Highlight the main section whose top has passed the upper third of the screen
    var mainHeads = heads.filter(function (h) { return !h.closest('.personal'); });
    var ticking = false;
    function update() {
      ticking = false;
      var current = mainHeads.length ? mainHeads[0].id : null;
      mainHeads.forEach(function (h) {
        var sec = h.closest('section') || h;
        if (sec.getBoundingClientRect().top < window.innerHeight * 0.35) current = h.id;
      });
      Object.keys(links).forEach(function (id) { links[id].classList.toggle('active', id === current); });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  })();

  // Logos: show a letter instead if a logo file is missing
  document.querySelectorAll('.logo img[data-fallback]').forEach(function (img) {
    function swap() {
      var t = document.createElement('span'); t.className = 'fallback';
      t.textContent = img.getAttribute('data-fallback'); img.replaceWith(t);
    }
    img.addEventListener('error', swap);
    if (img.complete && img.naturalWidth === 0) swap();
  });

  // Photo: fall back to initials if photo.jpg is missing
  var photo = document.getElementById('photo');
  if (photo) {
    var drop = function () { photo.remove(); };
    photo.addEventListener('error', drop);
    if (photo.complete && photo.naturalWidth === 0) drop();
  }

  // Email: the full address never appears in the HTML, so simple spam scrapers can't harvest it
  var emailEl = document.getElementById('email');
  var address = emailEl.getAttribute('data-u') + '@' + emailEl.getAttribute('data-d');
  var link = document.createElement('a');
  link.className = 'v'; link.id = 'email'; link.href = 'mailto:' + address; link.textContent = address;
  emailEl.replaceWith(link);

  [document.getElementById('copy-email')].forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = address;
      var done = function () {
        var de = root.getAttribute('data-lang') === 'de';
        var old = btn.innerHTML;
        btn.textContent = de ? 'Kopiert' : 'Copied';
        setTimeout(function () { btn.innerHTML = old; }, 1500);
      };
      var fallback = function () {
        var el = document.getElementById('email');
        var r = document.createRange(); r.selectNodeContents(el);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      };
      try {
        navigator.clipboard.writeText(text).then(done, fallback);
      } catch (e) { fallback(); }
    });
  });

  // Personal panel: facts come from personal.json. Empty values are hidden.
  var facts = [];
  var list = document.getElementById('personal-list');
  function lang() { return root.getAttribute('data-lang') === 'de' ? 'de' : 'en'; }
  function pick(obj) { obj = obj || {}; return (obj[lang()] || obj.en || '').trim(); }
  function renderPersonal() {
    if (window.__site.editing) return; // the editor draws its own version
    list.textContent = '';
    facts.forEach(function (f) {
      var value = pick(f.value);
      if (!value) return;
      var row = document.createElement('div'); row.className = 'fact';
      var dt = document.createElement('dt'); dt.textContent = pick(f.label);
      var dd = document.createElement('dd');
      var icon = null;
      if (f.icon && /^illustrations\/[a-z0-9-]+\.svg$/.test(f.icon)) {
        icon = document.createElement('img'); icon.src = f.icon; icon.alt = ''; icon.className = 'fact-icon';
        icon.width = 30; icon.height = 30;
      }
      if (f.link && /^https:\/\/[^\s"<>]+$/.test(f.link)) {
        var a = document.createElement('a'); a.href = f.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.className = 'fact-link';
        var label = document.createElement('span'); label.className = 'fact-text'; label.textContent = value;
        if (icon) { label.appendChild(icon); icon = null; }
        a.appendChild(label);
        var play = document.createElement('span'); play.className = 'fact-play';
        if (f.linkLabel && pick(f.linkLabel)) { play.textContent = pick(f.linkLabel); play.classList.add('no-play'); }
        else { play.textContent = lang() === 'de' ? 'Anhören' : 'Listen'; }
        a.appendChild(play); dd.appendChild(a);
      } else if (f.bullets) {
        // One bullet per line, with an optional icon per line and an inline logo for a name
        var ul = document.createElement('ul'); ul.className = 'fact-bullets';
        var safe = /^(illustrations|logos)\/[a-z0-9-]+\.(svg|png)$/;
        value.split('\n').forEach(function (line, i) {
          line = line.trim(); if (!line) return;
          var li = document.createElement('li');
          var icon = (f.icons || [])[i];
          if (icon && safe.test(icon)) {
            var ic = document.createElement('img'); ic.src = icon; ic.alt = ''; ic.className = 'bullet-icon'; ic.width = 22; ic.height = 22;
            li.appendChild(ic);
          }
          var text = document.createElement('span');
          var logo = null;
          [].concat(f.inlineLogos || [], f.inlineLogo ? [f.inlineLogo] : []).forEach(function (l) {
            if (!logo && l && l.text && safe.test(l.src || '') && line.indexOf(l.text) !== -1) logo = l;
          });
          if (logo) {
            var parts = line.split(logo.text);
            text.appendChild(document.createTextNode(parts[0]));
            var lg = document.createElement('img'); lg.src = logo.src; lg.alt = logo.text; lg.className = 'inline-logo';
            text.appendChild(lg);
            text.appendChild(document.createTextNode(parts.slice(1).join(logo.text)));
          } else { text.textContent = line; }
          li.appendChild(text); ul.appendChild(li);
        });
        dd.appendChild(ul); dd.classList.add('has-bullets');
      } else { dd.textContent = value; }
      if (icon) dd.appendChild(icon);
      row.appendChild(dt); row.appendChild(dd); list.appendChild(row);
    });
    document.querySelector('.facts-card').hidden = !list.children.length;
  }
  window.__site = {
    editing: false,
    renderPersonal: renderPersonal,
    getFacts: function () { return facts; },
    setFacts: function (f) { facts = f; },
    lang: lang
  };
  fetch('personal.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (data) { facts = Array.isArray(data) ? data : []; renderPersonal(); })
    .catch(function () { renderPersonal(); });

  // Edit mode exists only in the local preview on Julia's Mac; the public site never loads it.
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
    var ed = document.createElement('script');
    ed.src = 'tools/editor.js?v=' + Date.now();
    document.head.appendChild(ed);
  }
})();
