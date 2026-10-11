// Restaurants: history, ratings, comments, Suggest 5, plus the shared restaurant picker and eat-out dialog.
(function () {
  'use strict';

  var h = UI.h;
  var call = UI.call;
  var container = null;
  var listBox = null;
  var filters = { q: '', cuisine: '', favorite: false };

  function price(level) { return level ? '$$$$'.slice(0, Number(level)) : ''; }

  function badges(r) {
    return [
      r.cuisine ? h('span', { class: 'badge', text: r.cuisine }) : null,
      r.price_level ? h('span', { class: 'badge', text: price(r.price_level) }) : null,
      r.rating != null ? h('span', { class: 'badge', text: '★ ' + r.rating }) : null,
      r.favorite ? h('span', { class: 'badge', text: '♥' }) : null
    ];
  }

  function lastVisitText(r) {
    return r.last_visit ? 'Last visit ' + r.last_visit + ' • ' + r.visit_count + ' visit' + (r.visit_count === 1 ? '' : 's') : 'Never visited';
  }

  // ---------- picker (list, Suggest 5, add new) ----------

  // opts: { date, startWith: 'list' | 'suggest' } -> Promise of { name, isNew, cuisine } or null
  UI.pickRestaurant = function (opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      var done = false;
      var shown = [];
      var body = h('div');
      var dlg = null;
      var finish = function (v) { done = true; resolve(v); dlg.close(); };

      var row = function (r) {
        return h('div', { class: 'list-item', onclick: function () { finish({ name: r.name, isNew: false }); } },
          h('div', { class: 'grow' }, h('strong', { text: r.name }), h('div', { class: 'meta', text: lastVisitText(r) })), badges(r));
      };

      var newBox = function () {
        var name = h('input', { type: 'text', placeholder: 'Type a new restaurant' });
        var cuisine = UI.select(UI.state.boot.lookups.cuisines, '', null, 'Cuisine');
        return h('div', { class: 'card' }, h('div', { class: 'meta', text: 'Not on the list?' }),
          h('div', { class: 'row' }, h('div', { class: 'grow' }, name), h('div', null, cuisine),
            h('button', { class: 'btn primary', text: 'Use it', onclick: function () {
              if (!name.value.trim()) return;
              finish({ name: name.value.trim(), isNew: true, cuisine: cuisine.value });
            } })));
      };

      var drawList = function () {
        body.innerHTML = '';
        var list = h('div');
        var all = [];
        var search = h('input', { type: 'text', placeholder: 'Search restaurants', oninput: function () { paint(); } });
        var paint = function () {
          var q = search.value.trim().toLowerCase();
          list.innerHTML = '';
          var rows = all.filter(function (r) { return !q || r.name.toLowerCase().indexOf(q) >= 0; });
          if (!rows.length) list.appendChild(h('div', { class: 'empty', text: all.length ? 'No match.' : 'No restaurants yet. Add one below.' }));
          rows.forEach(function (r) { list.appendChild(row(r)); });
        };
        body.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow' }, search),
          h('button', { class: 'btn primary', text: 'Suggest 5', onclick: function () { shown = []; drawSuggest(); } })));
        body.appendChild(list);
        body.appendChild(newBox());
        call('api_listRestaurants').then(function (rows) { all = rows; paint(); }).catch(UI.fail);
      };

      var drawSuggest = function () {
        call('api_suggestRestaurants', o.date || UI.state.today, shown).then(function (res) {
          body.innerHTML = '';
          if (!res.restaurants.length) {
            body.appendChild(h('div', { class: 'empty', text: shown.length ? "That's every restaurant. Add a new one below." : 'No restaurants to suggest yet. Add one below.' }));
          } else {
            body.appendChild(h('h3', { text: 'How about one of these?' }));
            res.restaurants.forEach(function (r) { shown.push(r.name); body.appendChild(row(r)); });
          }
          body.appendChild(h('div', { class: 'row' },
            res.exhausted ? null : h('button', { class: 'btn', text: 'Show 5 more', onclick: drawSuggest }),
            h('button', { class: 'btn', text: 'Back to the list', onclick: drawList })));
          body.appendChild(newBox());
        }).catch(UI.fail);
      };

      dlg = UI.dialog('Pick a restaurant', body, { wide: true, onclose: function () { if (!done) resolve(null); } });
      if (o.startWith === 'suggest') drawSuggest(); else drawList();
    });
  };

  // ---------- eat-out dialog ----------

  // opts: { date, restaurant: {name,isNew,cuisine}, onDone }
  UI.eatOutDialog = function (opts) {
    var o = opts || {};
    var st = { date: o.date || UI.state.today, restaurant: o.restaurant || null, occupied: null, action: 'queue', moveTo: '', ifOccupied: 'swap' };
    var chosen = h('div', { class: 'meta', text: st.restaurant ? st.restaurant.name : 'No restaurant chosen yet' });
    var originalBox = h('div');

    var drawOriginal = function () {
      originalBox.innerHTML = '';
      if (!st.occupied) return;
      var what = st.occupied.kind === 'restaurant' ? st.occupied.restaurant : st.occupied.dish;
      originalBox.appendChild(h('div', { class: 'banner' }, 'Already planned that night: ' + what + '. What should happen to it?'));
      [['queue', 'Save it for next week'], ['move', 'Move it to another day'], ['delete', 'Remove it']].forEach(function (a) {
        originalBox.appendChild(h('label', { class: 'check' }, h('input', { type: 'radio', name: 'orig', checked: st.action === a[0], onchange: function () { st.action = a[0]; drawOriginal(); } }), a[1]));
        originalBox.appendChild(h('br'));
      });
      if (st.action === 'move') {
        if (!st.moveTo) st.moveTo = Dates.addDays(st.date, 1);
        originalBox.appendChild(UI.field('Move it to', h('input', { type: 'date', value: st.moveTo, onchange: function (e) { st.moveTo = e.target.value; } })));
        originalBox.appendChild(UI.field('If that day already has a meal', UI.select([
          { value: 'swap', label: 'Swap with it' }, { value: 'shift', label: 'Push the other meals one day later' },
          { value: 'queue_existing', label: 'Save that meal for next week' }, { value: 'delete_existing', label: 'Remove that meal' }
        ], st.ifOccupied, function (e) { st.ifOccupied = e.target.value; })));
      }
    };

    var checkOccupied = function () {
      call('api_getPlan', st.date, st.date).then(function (r) { st.occupied = r.slots[0] || null; drawOriginal(); }).catch(UI.fail);
    };

    var dateIn = h('input', { type: 'date', value: st.date, onchange: function (e) { st.date = e.target.value; st.moveTo = ''; checkOccupied(); } });
    var body = h('div', null, UI.field('Night', dateIn),
      h('button', { class: 'btn', text: 'Choose restaurant...', onclick: function () {
        UI.pickRestaurant({ date: st.date, startWith: 'suggest' }).then(function (p) {
          if (p) { st.restaurant = p; chosen.textContent = p.name + (p.isNew ? ' (new)' : ''); }
        });
      } }), chosen, originalBox);
    UI.dialog('Eat out', body, { actions: [{ label: 'Plan it', primary: true, onclick: function (d) {
      if (!st.restaurant) { UI.toast('Choose a restaurant first.', true); return; }
      if (!st.date) { UI.toast('Pick a night.', true); return; }
      var ref = st.restaurant.isNew ? { new_name: st.restaurant.name, cuisine: st.restaurant.cuisine } : { name: st.restaurant.name };
      var action = null;
      if (st.occupied) {
        action = { type: st.action };
        if (st.action === 'move') { action.to = st.moveTo; action.ifOccupied = st.ifOccupied; }
      }
      call('api_eatOut', st.date, ref, action).then(function (r) {
        d.close();
        if (r.notes && r.notes.length) UI.toast(r.notes.join(' '));
        UI.toast('Eating at ' + r.restaurant + ' on ' + UI.dayLabel(st.date));
        if (o.onDone) o.onDone();
      }).catch(UI.fail);
    } }] });
    checkOccupied();
  };

  // ---------- list ----------

  function render(c) {
    container = c;
    showList();
  }

  function showList() {
    container.innerHTML = '';
    var reload = function () { loadList(); };
    container.appendChild(h('div', { class: 'row between' }, h('h2', { text: 'Restaurants' }),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', text: 'Suggest 5', onclick: function () {
          UI.pickRestaurant({ date: UI.state.today, startWith: 'suggest' }).then(function (p) {
            if (p) UI.eatOutDialog({ restaurant: p, date: UI.state.today, onDone: function () { UI.show('week'); } });
          });
        } }),
        h('button', { class: 'btn', text: 'Add restaurant', onclick: function () { openForm(null); } }))));
    container.appendChild(h('div', { class: 'card' },
      h('input', { type: 'text', placeholder: 'Search restaurants', value: filters.q, oninput: function (e) { filters.q = e.target.value; reload(); } }),
      h('div', { class: 'grid2' }, UI.select(UI.state.boot.lookups.cuisines, filters.cuisine, function (e) { filters.cuisine = e.target.value; reload(); }, 'Any cuisine')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: filters.favorite, onchange: function (e) { filters.favorite = e.target.checked; reload(); } }), 'Favorites')));
    listBox = h('div', { class: 'card' });
    container.appendChild(listBox);
    loadList();
  }

  function loadList() {
    return call('api_listRestaurants').then(function (rows) {
      if (!listBox) return;
      var q = filters.q.trim().toLowerCase();
      rows = rows.filter(function (r) {
        return (!q || r.name.toLowerCase().indexOf(q) >= 0) && (!filters.cuisine || r.cuisine === filters.cuisine) && (!filters.favorite || r.favorite);
      });
      listBox.innerHTML = '';
      if (!rows.length) { listBox.appendChild(h('div', { class: 'empty', text: 'No restaurants yet. Use "Add restaurant".' })); return; }
      rows.forEach(function (r) {
        listBox.appendChild(h('div', { class: 'list-item', onclick: function () { showDetail(r.name); } },
          h('div', { class: 'grow' }, h('strong', { text: r.name }), h('div', { class: 'meta', text: lastVisitText(r) })), badges(r)));
      });
    }).catch(UI.fail);
  }

  // ---------- detail ----------

  function showDetail(name) {
    call('api_getRestaurant', name).then(drawDetail).catch(UI.fail);
  }

  function drawDetail(d) {
    var r = d.restaurant;
    var refresh = function () { showDetail(r.name); };
    container.innerHTML = '';
    container.appendChild(h('button', { class: 'btn small', text: '← All restaurants', onclick: showList }));
    container.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', { text: r.name }),
        h('button', { class: 'btn', text: r.favorite ? '♥ Favorite' : '♡ Make favorite', onclick: function () {
          call('api_setFavorite', 'restaurant', r.name, !r.favorite).then(refresh).catch(UI.fail);
        } })),
      h('div', { class: 'meta', text: [r.cuisine, price(r.price_level), r.address].filter(Boolean).join(' • ') }),
      r.phone ? h('div', null, h('a', { href: 'tel:' + r.phone, text: r.phone })) : null,
      r.notes ? h('p', { text: 'Notes: ' + r.notes }) : null,
      h('div', { class: 'row' }, h('span', { text: 'Your rating' }),
        UI.stars(d.rating.mine, function (n) { call('api_rate', 'restaurant', r.name, n).then(refresh).catch(UI.fail); }),
        h('span', { class: 'meta', text: d.rating.count ? 'Average ' + d.rating.avg + ' from ' + d.rating.count : 'Not rated yet' })),
      h('div', { class: 'row no-print' },
        h('button', { class: 'btn primary', text: 'Eat here...', onclick: function () {
          UI.eatOutDialog({ restaurant: { name: r.name, isNew: false }, date: UI.state.today, onDone: function () { UI.show('week'); } });
        } }),
        h('button', { class: 'btn', text: 'Edit', onclick: function () { openForm(d); } }),
        h('button', { class: 'btn', text: 'Rename', onclick: function () {
          UI.promptBox('Rename restaurant', 'New name', r.name).then(function (n) {
            if (!n || n === r.name) return null;
            return call('api_renameItem', 'lib_restaurants', r.name, n).then(function (res) {
              UI.toast('Renamed in ' + res.count + ' place' + (res.count === 1 ? '' : 's'));
              showDetail(n);
            });
          }).catch(UI.fail);
        } }))));

    container.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Visits' }),
      d.visits.length ? d.visits.map(function (v) { return h('div', { text: UI.longDate(v) }); }) : h('div', { class: 'meta', text: 'No visits yet.' })));

    var box = h('textarea', { placeholder: 'Add a comment' });
    var cc = h('div', { class: 'card' }, h('h3', { text: 'Comments' }));
    if (!d.comments.length) cc.appendChild(h('div', { class: 'meta', text: 'No comments yet.' }));
    d.comments.forEach(function (c) { cc.appendChild(h('p', null, h('strong', { text: c.member + ' ' }), h('span', { class: 'meta', text: c.date }), h('br'), c.text)); });
    cc.appendChild(box);
    cc.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn primary', text: 'Add comment', onclick: function () {
      call('api_addComment', 'restaurant', r.name, box.value).then(refresh).catch(UI.fail);
    } })));
    container.appendChild(cc);
  }

  // ---------- add / edit ----------

  function openForm(detail) {
    var r = detail ? detail.restaurant : { name: '', cuisine: '', price_level: '', address: '', phone: '', notes: '', favorite: false, status: 'active' };
    var f = { original_name: detail ? r.name : '', name: r.name, cuisine: r.cuisine, price_level: r.price_level, address: r.address, phone: r.phone, notes: r.notes, status: r.status, favorite: r.favorite };
    var text = function (key, label) { return UI.field(label, h('input', { type: 'text', value: f[key], oninput: function (e) { f[key] = e.target.value; } })); };
    container.innerHTML = '';
    container.appendChild(h('button', { class: 'btn small', text: '← Cancel', onclick: function () { if (detail) showDetail(r.name); else showList(); } }));
    container.appendChild(h('h2', { text: detail ? 'Edit ' + r.name : 'Add a restaurant' }));
    container.appendChild(h('div', { class: 'card' }, text('name', 'Restaurant name'),
      h('div', { class: 'grid2' },
        UI.field('Cuisine', UI.select(UI.state.boot.lookups.cuisines, f.cuisine, function (e) { f.cuisine = e.target.value; }, '')),
        UI.field('Price', UI.select([{ value: '1', label: '$' }, { value: '2', label: '$$' }, { value: '3', label: '$$$' }, { value: '4', label: '$$$$' }], f.price_level, function (e) { f.price_level = e.target.value; }, '')),
        UI.field('Status', UI.select(['active', 'retired'], f.status, function (e) { f.status = e.target.value; }))),
      text('address', 'Address'), text('phone', 'Phone'),
      UI.field('Notes (what to order...)', h('textarea', { value: f.notes, oninput: function (e) { f.notes = e.target.value; } }))));
    container.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn primary', text: 'Save restaurant', onclick: function () {
      if (!f.name.trim()) { UI.toast('Please enter a restaurant name.', true); return; }
      call('api_saveRestaurant', f).then(function (res) { UI.toast('Saved ' + res.name); showDetail(res.name); }).catch(UI.fail);
    } })));
  }

  UI.screens.restaurants = { render: render, refresh: function () { if (listBox && listBox.isConnected) loadList(); } };
})();
