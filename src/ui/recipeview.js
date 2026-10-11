// Kitchen recipe view: opens from a night on the schedule. Main dish first, then each side.
(function () {
  'use strict';

  var h = UI.h;
  var call = UI.call;
  var wakeLock = null;
  var timers = [];

  function requestWake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }).catch(function () { /* not allowed here */ });
      }
    } catch (e) { /* screen stays on only where the browser allows it */ }
  }

  function releaseWake() {
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ }
    wakeLock = null;
    timers.forEach(clearInterval);
    timers = [];
  }

  function timerButton(minutes) {
    var remaining = 0;
    var id = null;
    var btn = h('button', { class: 'btn small', type: 'button', text: '⏱ ' + minutes + ' min: start' });
    btn.addEventListener('click', function () {
      if (id) { clearInterval(id); id = null; btn.textContent = '⏱ ' + minutes + ' min: start'; return; }
      remaining = minutes * 60;
      id = setInterval(function () {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(id);
          id = null;
          btn.textContent = '⏱ Time is up!';
          UI.toast('Timer finished (' + minutes + ' min)');
          try { if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) { /* ignore */ }
          return;
        }
        var m = Math.floor(remaining / 60);
        var s = remaining % 60;
        btn.textContent = '⏱ ' + m + ':' + (s < 10 ? '0' : '') + s + ' (tap to stop)';
      }, 1000);
      timers.push(id);
    });
    return btn;
  }

  function ingredientText(l) {
    var text = [l.qty_text, l.unit, l.ingredient].filter(function (x) { return x !== '' && x != null; }).join(' ');
    if (l.prep_note) text += ', ' + l.prep_note;
    if (l.optional) text += ' (optional)';
    return text;
  }

  // `key` identifies the line so a tick survives a redraw (for example after changing servings).
  function checkLine(cls, content, ticks, key) {
    var box = h('input', { type: 'checkbox', checked: !!ticks[key] });
    var row = h('div', { class: cls + (ticks[key] ? ' done' : '') }, box, content);
    box.addEventListener('change', function () { ticks[key] = box.checked; row.classList.toggle('done', box.checked); });
    return row;
  }

  function renderDish(container, detail, view, rerender) {
    container.innerHTML = '';
    var dish = detail.dish;
    var lines = detail.recipe.ingredients;
    var steps = detail.recipe.steps;
    container.appendChild(h('div', { class: 'row' },
      h('strong', { text: dish.name }), UI.healthBadge(dish.healthy_score),
      dish.prep_min || dish.cook_min ? h('span', { class: 'meta', text: 'Prep ' + (dish.prep_min || 0) + ' min • Cook ' + (dish.cook_min || 0) + ' min' }) : null));
    if (dish.intro_notes) container.appendChild(h('p', { class: 'meta', text: dish.intro_notes }));

    if (!lines.length && !steps.length) {
      container.appendChild(h('div', { class: 'empty' },
        h('p', { text: 'No recipe yet.' }),
        h('button', { class: 'btn primary', text: 'Add recipe', onclick: function () { view.dialog.close(); UI.editDish(dish.name); } })));
      return;
    }

    var base = Number(dish.servings) > 0 ? Number(dish.servings) : 4;
    var servings = view.servings[dish.name] || view.slotServings || base;
    var stepper = h('div', { class: 'row no-print' },
      h('span', { text: 'Servings' }),
      h('button', { class: 'btn small', type: 'button', text: '−', onclick: function () { if (servings > 1) { view.servings[dish.name] = servings - 1; rerender(); } } }),
      h('strong', { text: String(servings) }),
      h('button', { class: 'btn small', type: 'button', text: '+', onclick: function () { view.servings[dish.name] = servings + 1; rerender(); } }),
      servings !== base ? h('span', { class: 'meta', text: '(recipe makes ' + base + ')' }) : null);
    container.appendChild(stepper);

    container.appendChild(h('h3', { text: 'Ingredients' }));
    Recipe.groupByLabel(Recipe.scaleIngredients(lines, base, servings)).forEach(function (g) {
      if (g.label) container.appendChild(h('h3', { text: g.label }));
      g.lines.forEach(function (l) {
        container.appendChild(checkLine('ing-line recipe-big', h('span', { text: ingredientText(l) }), view.ticks, 'i|' + dish.name + '|' + l.line_no));
      });
    });

    container.appendChild(h('h3', { text: 'Directions' }));
    var section = null;
    steps.forEach(function (st) {
      if (st.section_label && st.section_label !== section) {
        section = st.section_label;
        container.appendChild(h('h3', { text: section }));
      }
      var text = h('div', { class: 'grow' }, h('p', { text: st.step_no + '. ' + st.text }), st.timer_min ? timerButton(st.timer_min) : null);
      container.appendChild(checkLine('step', text, view.ticks, 's|' + dish.name + '|' + st.step_no));
    });
  }

  function restaurantDetails(slot) {
    var info = slot.restaurant_info || { name: slot.restaurant };
    var body = h('div', { class: 'recipe-big' },
      h('p', { text: info.cuisine || '' }),
      info.address ? h('p', { text: info.address }) : null,
      info.phone ? h('p', null, h('a', { href: 'tel:' + info.phone, text: info.phone })) : null,
      info.notes ? h('p', { text: 'Notes: ' + info.notes }) : null);
    UI.dialog(info.name || slot.restaurant, body, { closeLabel: 'Done' });
  }

  UI.openRecipe = function (slot) {
    if (slot.kind === 'restaurant') { restaurantDetails(slot); return; }
    var names = [slot.dish].concat([slot.side_1, slot.side_2, slot.side_3].filter(Boolean));
    var body = h('div', null, h('div', { class: 'empty', text: 'Loading recipes...' }));
    var view = { servings: {}, ticks: {}, slotServings: Number(slot.servings) || 0, dialog: null };
    view.dialog = UI.dialog(UI.dayLabel(slot.date), body, { full: true, closeLabel: 'Done', onclose: releaseWake });
    requestWake();
    Promise.all(names.map(function (n) { return call('api_getDish', n); })).then(function (dishes) {
      var current = 0;
      var tabs = h('div', { class: 'tabs' });
      var content = h('div');
      var draw = function () {
        tabs.innerHTML = '';
        dishes.forEach(function (d, i) {
          tabs.appendChild(h('button', {
            type: 'button', class: i === current ? 'on' : '',
            text: (i === 0 ? 'Main: ' : 'Side: ') + d.dish.name,
            onclick: function () { current = i; draw(); }
          }));
        });
        renderDish(content, dishes[current], view, draw);
      };
      body.innerHTML = '';
      body.appendChild(tabs);
      body.appendChild(content);
      draw();
    }).catch(function (e) { view.dialog.close(); UI.fail(e); });
  };
})();
