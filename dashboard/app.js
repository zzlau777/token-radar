// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan, plus the live-token and set-aside views. No network: every
// byte it shows is in data.js. The page recomputes each row from the snapshot figures and checks
// the number board.json carries, so the page's code and the board's data are visibly the same
// arithmetic. Hash links share a view: #detail=<slug>, #tab=live, #cat=<category>.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  var model = DATA.model;
  var state = { q: '', category: 'all', chain: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    return n === null || n === undefined || !isFinite(n) ? 'n/a' : n.toFixed(2) + 'x';
  }
  // The model in one function: TVL times the category's comparables multiple, times growth,
  // maturity and chain breadth. The page checks it against the row's own implied value.
  function impliedOf(row) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var breadth = 1 + model.breadth_per_chain * Math.min(Math.max(row.chains.length - 1, 0), model.breadth_max_chains);
    return Math.max(1, Math.round(row.tvl_usd * row.multiple * growthMult * maturity * breadth));
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function parseHash() {
    state.selected = null;
    state.tab = 'board';
    state.category = 'all';
    state.q = '';
    var h = window.location.hash.replace(/^#/, '');
    var parts = h ? h.split('&') : [];
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      var k = decodeURIComponent(kv[0] || '');
      var v = decodeURIComponent(kv[1] || '');
      if (k === 'detail') state.selected = v || null;
      else if (k === 'tab' && (v === 'board' || v === 'live' || v === 'excluded')) state.tab = v;
      else if (k === 'cat') state.category = v || 'all';
      else if (k === 'q') state.q = v || '';
    }
  }
  function setHash() {
    var bits = [];
    if (state.selected) bits.push('detail=' + encodeURIComponent(state.selected));
    if (state.tab !== 'board') bits.push('tab=' + state.tab);
    if (state.category !== 'all') bits.push('cat=' + encodeURIComponent(state.category));
    if (state.q) bits.push('q=' + encodeURIComponent(state.q));
    var h = bits.length ? '#' + bits.join('&') : '';
    if (window.location.hash !== h) {
      if (h) history.replaceState(null, '', h);
      else window.location.hash = '';
    }
  }

  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { if (r.category) seen[r.category] = true; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    DATA.rows.forEach(function (r) { r.chains.forEach(function (c) { seen[c] = true; }); });
    return Object.keys(seen).sort();
  }

  function boardRows() {
    var rows = DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if ((r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      var d = 0;
      if (key === 'implied') d = a.implied_value_usd - b.implied_value_usd;
      else if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'growth') d = (a.change_7d || 0) - (b.change_7d || 0);
      else if (key === 'age') d = (a.age_days || 0) - (b.age_days || 0);
      else if (key === 'name') d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      if (d === 0) d = a.slug < b.slug ? -1 : 1;
      return d * state.dir;
    });
    return rows;
  }

  function sortTh(label, key, cls) {
    var th = el('th', { class: cls || '' }, label + (state.sort === key ? (state.dir === -1 ? ' ▼' : ' ▲') : ''));
    th.addEventListener('click', function () {
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
      render();
    });
    return th;
  }

  function renderTable() {
    var wrap = el('div');
    if (state.tab === 'board') {
      var rows = boardRows();
      var maxImplied = DATA.rows.length ? DATA.rows[0].implied_value_usd : 1;
      var table = el('table');
      var thead = el('thead');
      var hr = el('tr');
      hr.appendChild(sortTh('#', 'implied', 'num'));
      hr.appendChild(sortTh('Protocol', 'name'));
      hr.appendChild(el('th', null, 'Chains'));
      hr.appendChild(sortTh('TVL', 'tvl', 'num'));
      hr.appendChild(sortTh('7d', 'growth', 'num'));
      hr.appendChild(sortTh('Age', 'age', 'num'));
      hr.appendChild(el('th', { class: 'num' }, 'Multiple'));
      hr.appendChild(sortTh('Implied value', 'implied', 'num'));
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el('tbody');
      rows.forEach(function (r) {
        var tr = el('tr');
        if (state.selected === r.slug) tr.className = 'sel';
        tr.appendChild(el('td', { class: 'num rank' }, String(r.rank)));
        var nameTd = el('td');
        nameTd.appendChild(el('span', { class: 'name' }, r.name));
        nameTd.appendChild(el('span', { class: 'sub' }, r.slug + (r.category ? ' · ' + r.category : '')));
        tr.appendChild(nameTd);
        tr.appendChild(el('td', null, r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '')));
        tr.appendChild(el('td', { class: 'num' }, fmtUsd(r.tvl_usd)));
        var g = el('td', { class: 'num ' + ((r.change_7d || 0) >= 0 ? 'up' : 'down') }, fmtPct(r.change_7d));
        tr.appendChild(g);
        tr.appendChild(el('td', { class: 'num' }, fmtAge(r.age_days)));
        tr.appendChild(el('td', { class: 'num' }, fmtMult(r.multiple)));
        var vTd = el('td', { class: 'num' });
        vTd.appendChild(el('div', { class: 'val' }, fmtUsd(r.implied_value_usd)));
        var bar = el('div', { class: 'bar' });
        bar.appendChild(el('i'));
        bar.firstChild.style.width = Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100)) + '%';
        vTd.appendChild(bar);
        tr.appendChild(vTd);
        tr.addEventListener('click', function () { state.selected = r.slug; setHash(); render(); });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      if (!rows.length) wrap.appendChild(el('div', { class: 'empty' }, 'No protocols match this filter.'));
      else wrap.appendChild(table);
      var count = el('div', { class: 'count' }, rows.length + ' of ' + DATA.rows.length + ' rows');
      wrap.appendChild(count);
    } else if (state.tab === 'live') {
      var live = DATA.live.slice().sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
      var lt = el('table');
      var lh = el('thead');
      var lr = el('tr');
      ['Protocol', 'Category', 'Chains', 'TVL', 'Market cap', 'Mcap / TVL', '7d'].forEach(function (h, i) {
        lr.appendChild(el('th', { class: i >= 3 ? 'num' : '' }, h));
      });
      lh.appendChild(lr);
      lt.appendChild(lh);
      var lb = el('tbody');
      live.forEach(function (p) {
        var tr = el('tr');
        tr.appendChild(el('td', null, p.name));
        tr.appendChild(el('td', null, p.category || '—'));
        tr.appendChild(el('td', null, p.chains.slice(0, 3).join(', ')));
        tr.appendChild(el('td', { class: 'num' }, fmtUsd(p.tvl_usd)));
        tr.appendChild(el('td', { class: 'num' }, fmtUsd(p.mcap_usd)));
        tr.appendChild(el('td', { class: 'num' }, p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : 'n/a'));
        tr.appendChild(el('td', { class: 'num ' + ((p.change_7d || 0) >= 0 ? 'up' : 'down') }, fmtPct(p.change_7d)));
        lb.appendChild(tr);
      });
      lt.appendChild(lb);
      wrap.appendChild(lt);
      wrap.appendChild(el('p', { class: 'meta' }, 'These tokens already trade, so the board shows the market\u2019s own value for them — never a model\u2019s. Their market-cap-per-TVL is what prices the pre-token board.'));
    } else {
      var ex = DATA.excluded;
      var et = el('table');
      var eh = el('thead');
      var er = el('tr');
      ['Protocol', 'Category', 'TVL', 'Why it is set aside'].forEach(function (h, i) {
        er.appendChild(el('th', { class: i === 2 ? 'num' : '' }, h));
      });
      eh.appendChild(er);
      et.appendChild(eh);
      var eb = el('tbody');
      ex.forEach(function (p) {
        var tr = el('tr');
        tr.appendChild(el('td', null, p.name));
        tr.appendChild(el('td', null, p.category || '—'));
        tr.appendChild(el('td', { class: 'num' }, fmtUsd(p.tvl_usd)));
        tr.appendChild(el('td', null, p.reason));
        eb.appendChild(tr);
      });
      et.appendChild(eb);
      wrap.appendChild(et);
      wrap.appendChild(el('p', { class: 'meta' }, ex.length + ' pre-token protocols are set aside: a wrapped, staked or bridged product of a token that already trades is not a token that does not exist yet.'));
    }
    return wrap;
  }

  function splitStep(s) {
    var ci = s.lastIndexOf(' Cost: ');
    var ti = s.lastIndexOf(' Time: ');
    if (ci < 0 || ti < 0 || ti < ci) return { text: s, cost: '' };
    var text = s.slice(0, ci);
    var cost = s.slice(ci + 7, ti);
    var time = s.slice(ti + 7).replace(/\.$/, '');
    return { text: text, cost: 'Cost: ' + cost + ' · Time: ' + time };
  }

  function renderDrawer() {
    if (!state.selected) return null;
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
    if (!row) return null;
    var d = el('div', { class: 'drawer' });
    var close = el('button', { class: 'close', 'aria-label': 'Close' }, '✕');
    close.addEventListener('click', function () { state.selected = null; setHash(); render(); });
    d.appendChild(close);
    d.appendChild(el('h2', null, row.name));
    d.appendChild(el('p', { class: 'meta' }, 'Rank #' + row.rank + ' · ' + row.slug + (row.category ? ' · ' + row.category : '') + ' · ' + row.chains.join(', ')));
    var kv = el('div', { class: 'kv' });
    var cells = [
      ['Implied value', fmtUsd(row.implied_value_usd)],
      ['TVL', fmtUsd(row.tvl_usd)],
      ['7-day TVL', fmtPct(row.change_7d)],
      ['Tracked since', row.listed_at ? row.listed_at + ' (' + fmtAge(row.age_days) + ')' : 'unknown'],
      ['Comparables multiple', fmtMult(row.multiple)],
      ['Token', 'records no token'],
    ];
    cells.forEach(function (c) {
      var cell = el('div');
      cell.appendChild(el('span', null, c[0]));
      cell.appendChild(el('b', null, c[1]));
      kv.appendChild(cell);
    });
    d.appendChild(kv);
    var recomputed = impliedOf(row);
    var box = el('div', { class: 'modelbox' });
    box.appendChild(el('div', null, 'TVL  ' + fmtUsd(row.tvl_usd)));
    box.appendChild(el('div', null, '× multiple  ' + row.multiple.toFixed(2) + 'x  (' + (row.category || 'no category') + ' median, shrunk to global)'));
    box.appendChild(el('div', null, '× growth  ' + row.growth_multiplier.toFixed(2) + 'x  (' + fmtPct(row.change_7d) + ' over 7d)'));
    box.appendChild(el('div', null, '× maturity  ' + row.maturity_multiplier.toFixed(2) + 'x  (' + fmtAge(row.age_days) + ' with no token)'));
    box.appendChild(el('div', null, '× breadth  ' + row.breadth_multiplier.toFixed(2) + 'x  (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')'));
    var res = el('div', { class: 'res' }, '= implied value  ' + fmtUsd(row.implied_value_usd) + (recomputed === row.implied_value_usd ? '  ✓ recomputed in this page' : ''));
    box.appendChild(res);
    d.appendChild(box);
    d.appendChild(el('h3', null, 'Farm plan — six steps'));
    var ol = el('ol', { class: 'steps' });
    // Farm steps live in board.json; the page re-derives them from the row's own record.
    var steps = farmStepsFor(row);
    steps.forEach(function (s) {
      var p = splitStep(s);
      var li = el('li', null, p.text);
      if (p.cost) li.appendChild(el('span', { class: 'cost' }, p.cost));
      ol.appendChild(li);
    });
    d.appendChild(ol);
    d.appendChild(el('p', { class: 'meta' }, 'A plan is a starting point, not a promise: a protocol may never issue a token, and farming costs gas whether or not one comes.'));
    return d;
  }

  // The farm plan, as board.json carries it for this row: the drawer shows the same steps the
  // board ranks on, never a second derivation of them.
  function farmStepsFor(row) {
    return row.farm_steps || [];
  }

  function renderModel() {
    var sec = el('section', { class: 'model' });
    sec.appendChild(el('h3', null, 'How the value is priced — model radar-2'));
    var p1 = el('p', null, 'A protocol\u2019s implied value is what its token would be worth if the market priced it the way it prices the live tokens in its own category. The multiple is the category\u2019s median market-cap-per-TVL among protocols whose token already trades, shrunk toward the global median when the category has few live names, and clamped to 0.05x–2.00x. Then growth, maturity and chain breadth adjust it:');
    sec.appendChild(p1);
    var formula = el('p', null, '');
    formula.appendChild(el('code', null, 'implied = TVL × category multiple × (1 + clamp(7d, −50%, +100%) × 0.6) × (0.7 + min(age, 1460d) / 1460 × 0.3) × (1 + 0.02 × min(chains − 1, 5))'));
    sec.appendChild(formula);
    var p2 = el('p', null, 'Global median multiple ' + DATA.global_multiple.toFixed(2) + 'x across ' + DATA.multiples.reduce(function (n, m) { return n + m.live_count; }, 0) + ' live protocols. The table names the multiple each category got:');
    sec.appendChild(p2);
    var t = el('table');
    var th = el('thead');
    var tr = el('tr');
    ['Category', 'Live names', 'Multiple'].forEach(function (h, i) { tr.appendChild(el('th', { class: i > 0 ? 'num' : '' }, h)); });
    th.appendChild(tr);
    t.appendChild(th);
    var tb = el('tbody');
    DATA.multiples.slice(0, 12).forEach(function (m) {
      var r = el('tr');
      r.appendChild(el('td', null, m.category || '(no category)'));
      r.appendChild(el('td', { class: 'num' }, String(m.live_count)));
      r.appendChild(el('td', { class: 'num' }, m.multiple.toFixed(2) + 'x'));
      tb.appendChild(r);
    });
    t.appendChild(tb);
    sec.appendChild(t);
    sec.appendChild(el('p', { class: 'meta' }, 'No name is special-cased: the same function scores every row. “Records no token” means the snapshot carries no token for it — never that it has none.'));
    return sec;
  }

  function render() {
    app.setAttribute('aria-busy', 'false');
    app.textContent = '';
    var head = el('header');
    head.appendChild(el('h1', { html: 'Token Radar <span class="gold">— the launches that have not happened yet</span>' }));
    head.appendChild(el('p', { class: 'lede' }, 'Every protocol in the snapshot that records no token, ranked by what its launch would be worth if the market priced it like the live tokens in its own category — with the steps to farm each one.'));
    head.appendChild(el('p', { class: 'meta' }, 'Snapshot ' + DATA.as_of + ' · ' + DATA.source + ' · floor $' + DATA.floor_usd.toLocaleString('en-US')));
    app.appendChild(head);

    var stats = el('div', { class: 'stats' });
    var top = DATA.rows.length ? DATA.rows[0] : null;
    [
      [String(DATA.watchlist_size), 'protocols on the watchlist'],
      [String(DATA.board_size), 'rows on the board (' + DATA.early_size + ' found below the floor)'],
      [DATA.global_multiple.toFixed(2) + 'x', 'global median market-cap-per-TVL'],
      [top ? fmtUsd(top.implied_value_usd) : '—', 'top implied value' + (top ? ' — ' + top.name : '')],
    ].forEach(function (s) {
      var d = el('div', { class: 'stat' });
      d.appendChild(el('b', null, s[0]));
      d.appendChild(el('span', null, s[1]));
      stats.appendChild(d);
    });
    app.appendChild(stats);

    var tabs = el('div', { class: 'tabs' });
    [['board', 'Pre-token board (' + DATA.board_size + ')'], ['live', 'Already trading (' + DATA.live_size + ')'], ['excluded', 'Set aside (' + DATA.excluded_size + ')']].forEach(function (t) {
      var b = el('button', { class: 'tab', 'aria-selected': state.tab === t[0] ? 'true' : 'false' }, t[1]);
      b.addEventListener('click', function () { state.tab = t[0]; state.selected = null; setHash(); render(); });
      tabs.appendChild(b);
    });
    app.appendChild(tabs);

    if (state.tab === 'board') {
      var controls = el('div', { class: 'controls' });
      var q = el('input', { type: 'search', placeholder: 'Search name, slug or category…', value: state.q });
      q.addEventListener('input', function () { state.q = q.value; setHash(); render(); });
      controls.appendChild(q);
      var cat = el('select', { 'aria-label': 'Category' });
      cat.appendChild(el('option', { value: 'all' }, 'All categories'));
      categories().forEach(function (c) { cat.appendChild(el('option', { value: c }, c)); });
      cat.value = state.category;
      cat.addEventListener('change', function () { state.category = cat.value; setHash(); render(); });
      controls.appendChild(cat);
      var ch = el('select', { 'aria-label': 'Chain' });
      ch.appendChild(el('option', { value: 'all' }, 'All chains'));
      chains().forEach(function (c) { ch.appendChild(el('option', { value: c }, c)); });
      ch.value = state.chain;
      ch.addEventListener('change', function () { state.chain = ch.value; setHash(); render(); });
      controls.appendChild(ch);
      var sort = el('select', { 'aria-label': 'Sort by' });
      [['implied', 'Sort: implied value'], ['tvl', 'Sort: TVL'], ['growth', 'Sort: 7-day growth'], ['age', 'Sort: age'], ['name', 'Sort: name']].forEach(function (o) {
        sort.appendChild(el('option', { value: o[0] }, o[1]));
      });
      sort.value = state.sort;
      sort.addEventListener('change', function () { state.sort = sort.value; state.dir = sort.value === 'name' ? 1 : -1; render(); });
      controls.appendChild(sort);
      app.appendChild(controls);
    }

    app.appendChild(renderTable());
    var drawer = renderDrawer();
    if (drawer) app.appendChild(drawer);
    if (state.tab === 'board') app.appendChild(renderModel());
    var foot = el('footer', null, 'Built from a sealed DefiLlama snapshot of ' + DATA.as_of + '. Implied values are this radar\u2019s own claim, never a prediction that a token will launch or what it will trade at. Farming costs gas whether or not a token ever comes.');
    app.appendChild(foot);
  }

  parseHash();
  window.addEventListener('hashchange', function () { parseHash(); render(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.selected) { state.selected = null; setHash(); render(); }
  });
  render();
})();
