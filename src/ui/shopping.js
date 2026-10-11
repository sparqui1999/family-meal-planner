// Shopping: list for the week, grouped by store aisle, with Have it / In cart ticks, email, copy and print.
(function () {
  'use strict';

  var h = UI.h;
  var call = UI.call;
  var container = null;
  var weekStart = null;
  var data = null;
  var dismissedChanges = false;

  function boot() { return UI.state.boot; }

  function render(c) {
    container = c;
    if (!weekStart) weekStart = Dates.startOfWeek(UI.state.today, boot().settings.shopping_week_start_day);
    load();
  }

  function load() {
    return call('api_getShoppingList', weekStart).then(function (r) {
      data = r;
      draw();
    }).catch(UI.fail);
  }

  function qtyText(it) {
    var q = it.qty == null ? '' : Units.formatQty(it.qty);
    var u = it.unit && it.unit !== 'each' ? it.unit : '';
    return (q + ' ' + u).trim();
  }

  function toggle(it, field, value) {
    it[field] = value;
    var fn = field === 'have_it' ? 'api_setHaveIt' : 'api_setInCart';
    call(fn, it.item_id, value).then(draw).catch(function (e) { it[field] = !value; draw(); UI.fail(e); });
  }

  function aisleDialog(it) {
    var sel = UI.select(data.aisles, it.aisle, null, 'No aisle');
    var apply = function (d, always) {
      call('api_setItemAisle', it.item_id, sel.value, always).then(function () { d.close(); load(); }).catch(UI.fail);
    };
    UI.dialog('Which aisle is ' + it.name + ' in?', UI.field('Aisle', sel), {
      actions: [
        { label: 'Just this list', onclick: function (d) { apply(d, false); } },
        { label: it.ingredient ? 'Always' : 'Save', primary: true, onclick: function (d) { apply(d, !!it.ingredient); } }
      ]
    });
  }

  function itemRow(it, inHaveSection) {
    var sources = (it.source_dishes || []).map(function (s) { return s.dish + ' (' + UI.dayLabel(s.date).replace(/^(Today|Tomorrow), /, '') + ')'; }).join(', ');
    var flags = Array.isArray(it.flags) ? it.flags : [];
    var note = [];
    if (flags.indexOf('running_low') >= 0) note.push('running low');
    if (flags.indexOf('unit_mismatch') >= 0) note.push('also listed in another unit');
    if (flags.indexOf('no_longer_needed') >= 0) note.push('no longer needed for the plan');
    return h('div', { class: 'item' + (it.in_cart ? ' carted' : '') },
      inHaveSection ? null : h('label', { class: 'check', 'aria-label': 'In cart' },
        h('input', { type: 'checkbox', checked: it.in_cart, onchange: function (e) { toggle(it, 'in_cart', e.target.checked); } })),
      h('div', { class: 'name' }, h('span', { text: (qtyText(it) + ' ' + it.name).trim() }),
        sources ? h('small', { text: sources }) : null,
        note.length ? h('small', { text: note.join(' • ') }) : null),
      !it.aisle ? h('span', { class: 'badge warn', text: 'Needs an aisle' }) : null,
      h('button', { class: 'btn small no-print', text: 'Aisle', onclick: function () { aisleDialog(it); } }),
      h('label', { class: 'check no-print' },
        h('input', { type: 'checkbox', checked: it.have_it, onchange: function (e) { toggle(it, 'have_it', e.target.checked); } }), 'Have it'));
  }

  function changesBanner() {
    var c = data.changes;
    if (dismissedChanges || !(c.added.length || c.removed.length || c.changed.length)) return null;
    var parts = [];
    if (c.added.length) parts.push('New: ' + c.added.map(function (x) { return x.name; }).join(', '));
    if (c.removed.length) parts.push('Removed: ' + c.removed.map(function (x) { return x.name; }).join(', '));
    if (c.changed.length) parts.push('Amount changed: ' + c.changed.map(function (x) { return x.name; }).join(', '));
    return h('div', { class: 'banner row between' }, h('span', { text: parts.join('  •  ') }),
      h('button', { class: 'btn small', text: 'OK', onclick: function () { dismissedChanges = true; draw(); } }));
  }

  function shiftWeek(delta) {
    weekStart = Dates.addDays(weekStart, delta);
    dismissedChanges = false;
    load();
  }

  function draw() {
    container.innerHTML = '';
    var thisWeek = Dates.startOfWeek(UI.state.today, boot().settings.shopping_week_start_day);
    container.appendChild(h('div', { class: 'row between' }, h('h2', { text: 'Shopping list' }),
      h('div', { class: 'row no-print' },
        h('button', { class: 'btn small', text: '◀', 'aria-label': 'Earlier week', onclick: function () { shiftWeek(-7); } }),
        h('strong', { text: (weekStart === thisWeek ? 'This week' : weekStart === Dates.addDays(thisWeek, 7) ? 'Next week' : 'Week of ' + weekStart) }),
        h('button', { class: 'btn small', text: '▶', 'aria-label': 'Later week', onclick: function () { shiftWeek(7); } }))));
    container.appendChild(h('div', { class: 'meta', text: UI.longDate(data.week_start) + ' to ' + UI.longDate(data.week_end) + ' • ' + boot().settings.store_name }));

    container.appendChild(h('div', { class: 'row no-print' },
      h('button', { class: 'btn primary', text: 'Email list', onclick: emailDialog }),
      h('button', { class: 'btn', text: 'Copy as text', onclick: copyDialog }),
      h('button', { class: 'btn', text: 'Print', onclick: function () { window.print(); } }),
      h('button', { class: 'btn', text: 'Add an item', onclick: addDialog }),
      h('button', { class: 'btn', text: 'Running low', onclick: lowDialog }),
      h('button', { class: 'btn', text: 'Refresh', onclick: load })));

    var banner = changesBanner();
    if (banner) container.appendChild(banner);
    if (data.missingRecipes.length) {
      container.appendChild(h('div', { class: 'banner', text: 'No recipe yet, so nothing was added for: ' +
        data.missingRecipes.map(function (m) { return m.dish; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') }));
    }

    var need = data.items.filter(function (i) { return !i.have_it; });
    var have = data.items.filter(function (i) { return i.have_it; });
    if (!data.items.length) {
      container.appendChild(h('div', { class: 'empty', text: 'Nothing to buy yet. Plan some dinners for this week, or add an item.' }));
    }
    var groups = [];
    var byName = {};
    need.forEach(function (i) {
      var name = i.aisle || 'Needs an aisle';
      if (!byName[name]) { byName[name] = { name: name, items: [] }; groups.push(byName[name]); }
      byName[name].items.push(i);
    });
    groups.forEach(function (g) {
      container.appendChild(h('div', { class: 'aisle' }, h('h3', { text: g.name }), g.items.map(function (i) { return itemRow(i, false); })));
    });
    if (need.length && !groups.length) container.appendChild(h('div', { class: 'empty', text: 'Everything is ticked off.' }));
    if (have.length) {
      container.appendChild(h('details', { class: 'no-print' }, h('summary', { text: 'Already have (' + have.length + ')' }),
        have.map(function (i) { return itemRow(i, true); })));
    }
  }

  function emailDialog() {
    var to = h('input', { type: 'text', value: boot().me.email || '', placeholder: 'name@example.com, other@example.com' });
    var all = h('input', { type: 'checkbox' });
    UI.dialog('Email the shopping list', h('div', null,
      UI.field('Send to (separate addresses with commas)', to),
      h('label', { class: 'check' }, all, 'Include items I already have')), {
      actions: [{ label: 'Send', primary: true, onclick: function (d) {
        var list = to.value.split(/[,;\s]+/).filter(Boolean);
        call('api_emailList', weekStart, list, all.checked).then(function (r) {
          d.close();
          UI.toast('Sent to ' + r.sent + ' address' + (r.sent === 1 ? '' : 'es'));
        }).catch(UI.fail);
      } }]
    });
  }

  function copyDialog() {
    call('api_getListText', weekStart, false).then(function (text) {
      var area = h('textarea', { readonly: true, rows: '14', value: text });
      UI.dialog('Shopping list as text', h('div', null, area), {
        actions: [{ label: 'Copy', primary: true, onclick: function () {
          area.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
          UI.toast(ok ? 'Copied' : 'Select the text and copy it by hand.', !ok);
        } }]
      });
      setTimeout(function () { area.select(); }, 50);
    }).catch(UI.fail);
  }

  function addDialog() {
    var name = h('input', { type: 'text', placeholder: 'e.g. paper towels' });
    var qty = h('input', { type: 'text', placeholder: 'Amount (optional)' });
    var unit = h('input', { type: 'text', list: 'dl-shop-units', placeholder: 'Unit (optional)' });
    var aisle = UI.select(data.aisles, '', null, 'Choose an aisle');
    var units = h('datalist', { id: 'dl-shop-units' }, boot().lookups.units.map(function (u) { return h('option', { value: u }); }));
    UI.dialog('Add an item', h('div', null, UI.field('Item', name), h('div', { class: 'grid2' }, UI.field('Amount', qty), UI.field('Unit', unit)), UI.field('Aisle', aisle), units), {
      actions: [{ label: 'Add', primary: true, onclick: function (d) {
        call('api_addManualItem', weekStart, name.value, qty.value, unit.value, aisle.value).then(function () { d.close(); load(); }).catch(UI.fail);
      } }]
    });
    setTimeout(function () { name.focus(); }, 50);
  }

  function lowDialog() {
    var ing = h('input', { type: 'text', list: 'dl-low', placeholder: 'Start typing an ingredient' });
    var list = h('datalist', { id: 'dl-low' }, boot().lookups.ingredients.map(function (u) { return h('option', { value: u }); }));
    UI.dialog('Running low', h('div', null, h('p', { class: 'meta', text: 'It goes on the list until you tick it as picked up.' }), UI.field('Ingredient', ing), list), {
      actions: [{ label: 'Add to list', primary: true, onclick: function (d) {
        call('api_markRunningLow', ing.value).then(function (r) {
          d.close();
          if (boot().lookups.ingredients.indexOf(r.ingredient) < 0) boot().lookups.ingredients.push(r.ingredient);
          load();
        }).catch(UI.fail);
      } }]
    });
  }

  UI.screens.shopping = { render: render, refresh: load };
})();
