// "This Week": today plus the next days that have something scheduled.
(function () {
  'use strict';

  var h = UI.h;
  var call = UI.call;
  var container = null;
  var slots = [];
  var loadedAt = '';

  function render(c) {
    container = c;
    load();
  }

  function load() {
    var days = Number(UI.state.boot.settings.week_view_days) || 8;
    return call('api_getWeek', UI.state.today, days).then(function (res) {
      slots = res;
      var d = new Date();
      loadedAt = d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
      draw();
    }).catch(UI.fail);
  }

  function warn(res) {
    if (res && res.warnings && res.warnings.length) UI.toast('Heads-up: ' + res.warnings.join(' • '));
  }

  function moveTo(s, date, mode, dlg) {
    call('api_moveSlot', s.plan_id, date, mode).then(function (r) {
      if (r.notes && r.notes.length) UI.toast(r.notes.join(' '));
      if (dlg) dlg.close();
      load();
    }).catch(UI.fail);
  }

  function moveDialog(s) {
    var date = h('input', { type: 'date', value: s.date });
    var mode = 'swap';
    var options = [
      ['swap', "Swap with that day's meal"],
      ['shift', 'Insert it there and push the other meals one day later'],
      ['queue_existing', "Replace that day's meal and save it for next week"],
      ['delete_existing', "Replace that day's meal and remove it"]
    ];
    var radios = h('div', { class: 'card' }, h('div', { class: 'meta', text: 'If that day already has a meal:' }));
    options.forEach(function (o) {
      var r = h('input', { type: 'radio', name: 'occupied', value: o[0], checked: o[0] === mode, onchange: function () { mode = o[0]; } });
      radios.appendChild(h('label', { class: 'check' }, r, o[1]));
      radios.appendChild(h('br'));
    });
    var body = h('div', null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', text: '← A day earlier', onclick: function () { moveTo(s, Dates.addDays(s.date, -1), 'swap', dlg); } }),
        h('button', { class: 'btn', text: 'A day later →', onclick: function () { moveTo(s, Dates.addDays(s.date, 1), 'swap', dlg); } })),
      UI.field('Or move it to', date), radios);
    var dlg = UI.dialog('Move ' + (s.dish || s.restaurant), body, {
      actions: [{ label: 'Move', primary: true, onclick: function (d) { if (!date.value) return; moveTo(s, date.value, mode, d); } }]
    });
  }

  function changeDish(s) {
    UI.pickDish({ role: 'main', title: 'Change dinner for ' + UI.dayLabel(s.date) }).then(function (pick) {
      if (!pick) return null;
      return (pick.isNew ? Promise.resolve([]) : UI.defaultSides(pick.name)).then(function (sides) {
        var input = { date: s.date, kind: 'home', side_1: sides[0] || '', side_2: sides[1] || '', side_3: sides[2] || '' };
        if (pick.isNew) input.new_dish_name = pick.name; else input.dish = pick.name;
        return call('api_setSlot', input);
      });
    }).then(function (res) { if (res) { warn(res); load(); } }).catch(UI.fail);
  }

  function changeRestaurant(s) {
    UI.pickRestaurant({ date: s.date }).then(function (pick) {
      if (!pick) return null;
      var input = { date: s.date, kind: 'restaurant' };
      if (pick.isNew) input.new_restaurant_name = pick.name; else input.restaurant = pick.name;
      return call('api_setSlot', input);
    }).then(function (res) { if (res) { warn(res); load(); } }).catch(UI.fail);
  }

  function card(s) {
    var isRest = s.kind === 'restaurant';
    var main;
    var sub = null;
    if (isRest) {
      var info = s.restaurant_info || {};
      main = h('div', { class: 'meal-main', text: '🍽 ' + s.restaurant });
      sub = h('div', { class: 'meta', text: ['Eating out', info.cuisine, info.phone].filter(Boolean).join(' • ') });
    } else {
      main = h('div', { class: 'meal-main', text: s.dish });
      var sides = (s.sides_info || []).map(function (x) { return x.name; });
      if (sides.length) sub = h('div', { class: 'sides', text: 'with ' + sides.join(' • ') });
    }
    var health = null;
    if (!isRest) {
      var parts = [s.dish_info].concat(s.sides_info || []).filter(function (x) { return x && x.health != null; })
        .map(function (x) { return x.name + ' ' + x.health; });
      health = h('div', { class: 'row' }, UI.healthBadge(s.meal_health, 'Meal health'),
        parts.length > 1 ? h('span', { class: 'meta', text: parts.join(' • ') }) : null,
        s.dish_info && s.dish_info.status === 'idea' ? h('span', { class: 'badge warn', text: 'New idea' }) : null);
    }
    var buttons = h('div', { class: 'row no-print' },
      h('button', { class: 'btn primary', text: isRest ? 'Details' : 'Recipe', onclick: function () { UI.openRecipe(s); } }),
      h('button', { class: 'btn', text: 'Move', onclick: function () { moveDialog(s); } }),
      h('button', { class: 'btn', text: isRest ? 'Change restaurant' : 'Eat out', onclick: function () {
        if (isRest) changeRestaurant(s); else UI.eatOutDialog({ date: s.date, onDone: load });
      } }),
      isRest ? null : h('button', { class: 'btn', text: 'Change dish', onclick: function () { changeDish(s); } }),
      s.status === 'cooked'
        ? h('span', { class: 'badge good', text: '✓ Done' })
        : h('button', { class: 'btn', text: isRest ? 'Ate here' : 'Cooked it', onclick: function () {
          call('api_markCooked', s.plan_id).then(load).catch(UI.fail);
        } }));

    var node = h('div', { class: 'card' + (s.date === UI.state.today ? ' today' : ''), draggable: 'true' },
      h('div', { class: 'day', text: UI.dayLabel(s.date) }), main, sub, health, buttons);
    node.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', s.plan_id); });
    node.addEventListener('dragover', function (e) { e.preventDefault(); });
    node.addEventListener('drop', function (e) {
      e.preventDefault();
      var id = e.dataTransfer.getData('text/plain');
      if (id && id !== s.plan_id) moveTo({ plan_id: id }, s.date, 'swap', null);
    });
    return node;
  }

  function draw() {
    container.innerHTML = '';
    container.appendChild(h('div', { class: 'row between' },
      h('h2', { text: 'This week' }),
      h('div', { class: 'row no-print' },
        h('span', { class: 'meta', text: 'Updated ' + loadedAt }),
        h('button', { class: 'btn small', text: 'Refresh', onclick: load }))));
    if (!slots.length) {
      container.appendChild(h('div', { class: 'empty' },
        h('p', { text: 'Nothing is scheduled yet.' }),
        h('button', { class: 'btn primary', text: 'Plan the week', onclick: function () { UI.show('plan'); } })));
      return;
    }
    slots.forEach(function (s) { container.appendChild(card(s)); });
  }

  UI.screens.week = { render: render, refresh: load };
})();
