(function () {
  var input = document.getElementById('search-input');
  var list = document.getElementById('search-results');
  if (!input || !list) return;

  var MAX_RESULTS = 7;
  var MAX_PER_RULE = 2;
  var SNIPPET_LEN = 120;

  var docs = null;
  var loading = null;
  var cursor = -1;

  // Qaraqalpaq latinshasındaǵı diakritikalardı ápiwayı háriplerge aylandıradı,
  // sonda "qagiyda" dep izlegende "qaǵıyda" da tabıladı.
  // Hár bir belgi bir belgige aylanadı, sol sebepli map arqalı original
  // teksttegi ornın qaytarıp taba alamız.
  function fold(str) {
    var out = '';
    var map = [];
    for (var i = 0; i < str.length; i++) {
      var c = str[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (c === 'ı') c = 'i';
      for (var j = 0; j < c.length; j++) {
        out += c[j];
        map.push(i);
      }
    }
    return { folded: out, map: map };
  }

  function load() {
    if (docs) return Promise.resolve(docs);
    if (loading) return loading;
    loading = fetch('/search.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        docs = data.map(function (d) {
          var c = fold(d.c);
          return { u: d.u, t: d.t, s: d.s, c: d.c, cf: c.folded, cm: c.map, tf: fold(d.t).folded };
        });
        return docs;
      })
      .catch(function () { docs = []; return docs; });
    return loading;
  }

  function search(query) {
    var terms = fold(query).folded.split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    var hits = [];
    var perRule = {};

    for (var i = 0; i < docs.length; i++) {
      var doc = docs[i];
      var positions = [];
      var score = 0;
      var matchedAll = true;

      for (var t = 0; t < terms.length; t++) {
        var at = doc.cf.indexOf(terms[t]);
        var inTitle = doc.tf.indexOf(terms[t]) !== -1;
        if (at === -1 && !inTitle) { matchedAll = false; break; }
        if (at !== -1) positions.push([at, at + terms[t].length]);
        if (inTitle) score += 100;
        if (at !== -1) score += Math.max(0, 50 - at / 20);
      }
      if (!matchedAll) continue;

      var seen = perRule[doc.u] || 0;
      if (seen >= MAX_PER_RULE) continue;
      perRule[doc.u] = seen + 1;

      hits.push({ doc: doc, score: score, positions: positions });
    }

    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, MAX_RESULTS);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Birinshi sáykeslik dógereginde qısqa úzindi jasap, tabılǵan sózlerdi belgileydi.
  function snippet(hit) {
    var doc = hit.doc;
    if (!hit.positions.length) {
      return escapeHtml(doc.c.slice(0, SNIPPET_LEN)) + (doc.c.length > SNIPPET_LEN ? '…' : '');
    }

    // Folded ornların original teksttegi ornına awdaramız.
    var ranges = hit.positions.map(function (p) {
      return [doc.cm[p[0]], (doc.cm[p[1] - 1] !== undefined ? doc.cm[p[1] - 1] : doc.c.length - 1) + 1];
    }).sort(function (a, b) { return a[0] - b[0]; });

    var first = ranges[0][0];
    var start = Math.max(0, first - 40);
    var end = Math.min(doc.c.length, start + SNIPPET_LEN);

    var html = '';
    var pos = start;
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (r[1] <= pos || r[0] >= end) continue;
      html += escapeHtml(doc.c.slice(pos, Math.max(pos, r[0])));
      html += '<em>' + escapeHtml(doc.c.slice(Math.max(pos, r[0]), Math.min(r[1], end))) + '</em>';
      pos = Math.min(r[1], end);
    }
    html += escapeHtml(doc.c.slice(pos, end));

    return (start > 0 ? '…' : '') + html + (end < doc.c.length ? '…' : '');
  }

  function render(hits) {
    cursor = -1;
    if (!hits.length) {
      list.innerHTML = '';
      close();
      return;
    }
    list.innerHTML = hits.map(function (hit, i) {
      return '<li role="option" id="search-option-' + i + '">' +
        '<a href="' + escapeHtml(hit.doc.u) + '">' +
        '<h4>' + escapeHtml(hit.doc.t) + '</h4>' +
        '<p>' + snippet(hit) + '</p>' +
        '</a></li>';
    }).join('');
    open();
  }

  function open() {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    cursor = -1;
  }

  function move(delta) {
    var items = list.querySelectorAll('li');
    if (!items.length) return;
    if (cursor >= 0) items[cursor].classList.remove('selected');
    cursor += delta;
    if (cursor < 0) cursor = items.length - 1;
    if (cursor >= items.length) cursor = 0;
    items[cursor].classList.add('selected');
    input.setAttribute('aria-activedescendant', 'search-option-' + cursor);
  }

  function run() {
    var q = input.value.trim();
    if (q.length < 2) { close(); return; }
    load().then(function () { render(search(q)); });
  }

  input.addEventListener('input', run);
  input.addEventListener('focus', function () {
    load();
    if (input.value.trim().length >= 2) run();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Escape') { close(); input.blur(); }
    else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault();
      var link = list.querySelectorAll('li')[cursor].querySelector('a');
      if (link) window.location = link.href;
    }
  });

  document.addEventListener('click', function (e) {
    if (!list.contains(e.target) && e.target !== input) close();
  });

  // "s" yamasa "/" basılǵanda izlew qatarına ótiw.
  document.addEventListener('keydown', function (e) {
    if (e.target === input || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName)) return;
    if (e.key === 's' || e.key === '/') {
      e.preventDefault();
      input.focus();
    }
  });
})();
