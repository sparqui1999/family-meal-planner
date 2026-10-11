// Plan: a two-week draft grid. Suggest fills open days, picks are kept by locking them.
// The draft auto-saves per person and is restored when you come back; "Save plan" makes it official.
(function () {
  'use strict';

  var h = UI.h;
  var call = UI.call;
  var GRID_DAYS = 14;
  var SLOT_FIELDS = ['plan_id', 'date', 'kind', 'dish', 'side_1', 'side_2', 'side_3', 'restaurant', 'servings', 'status', 'locked', 'notes', 'new_dish_name', 'new_restaurant_name'];
  var container = null;
  var P = null;
  var statusEl = null;

  function settings() { return UI.state.boot.settings; }
  function planDays() { return Number(settings().plan_days) || 7; }

  function render(c) {
    container = c;
    if (P) { draw(); return; }
    var base = Dates.startOfWeek(UI.state.today, settings().first_day_of_week);
    load(Dates.addDays(base, 7));
  }

  function clientSlot(s) {
    var out = {};
    SLOT_FIELDS.forEach(function (k) { out[k] = s[k] == null ? '' : s[k]; });
    out.locked = s.locked === true || String(s.locked).toUpperCase() === 'TRUE';
    out._health = s.meal_health != null ? s.meal_health : null;
    return out;
  }

  function cleanSlots() {
    return P.dates.map(function (d) { return P.slots[d]; }).filter(Boolean).map(function (s) {
      var o = {};
      SLOT_FIELDS.forEach(function (k) { if (s[k] !== undefined && s[k] !== '') o[k] = s[k]; });
      o.locked = !!s.locked;
      return o;
    });
  }

  function load(start) {
    var end = Dates.addDays(start, GRID_DAYS - 1);
    return Promise.all([call('api_getPlan', start, end), call('api_getDraft', start)]).then(function (res) {
      var saved = res[0];
      var draft = res[1];
      P = { weekStart: start, dates: Dates.range(start, GRID_DAYS), slots: {}, suggestedOn: {}, usedQueue: [], seen: {}, queue: saved.queue, restored: null, dirty: false, timer: null };
      (draft ? draft.slots : saved.slots).forEach(function (s) { P.slots[s.date] = clientSlot(s); });
      if (draft) {
        P.suggestedOn = (draft.meta && draft.meta.suggested) || {};
        P.usedQueue = (draft.meta && draft.meta.usedQueue) || [];
        P.restored = draft.updated_on;
        if (draft.dropped && draft.dropped.length) UI.toast(draft.dropped.length + ' draft meal(s) were dropped because the dish or restaurant no longer exists.');
      }
      draw();
    }).catch(UI.fail);
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function markDirty() {
    P.dirty = true;
    setStatus('Saving draft...');
    clearTimeout(P.timer);
    P.timer = setTimeout(saveDraftNow, 1500);
  }

  function saveDraftNow() {
    clearTimeout(P.timer);
    P.timer = null;
    return call('api_saveDraft', P.weekStart, cleanSlots(), { suggested: P.suggestedOn, usedQueue: P.usedQueue }).then(function () {
      var d = new Date();
      setStatus('Draft saved ' + d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2) + ' (only you can see it until you press Save plan)');
    }).catch(function (e) { setStatus('Draft not saved: ' + e.message); });
  }

  function newSlot(date, fields) {
    var prev = P.slots[date];
    var s = { plan_id: prev ? prev.plan_id : '', date: date, kind: 'home', dish: '', side_1: '', side_2: '', side_3: '', restaurant: '',
      servings: '', status: 'planned', locked: true, notes: '', new_dish_name: '', new_restaurant_name: '', _health: null };
    Object.keys(fields).forEach(function (k) { s[k] = fields[k]; });
    return s;
  }

  function pickDishFor(date) {
    UI.pickDish({ role: 'main', title: 'Pick dinner for ' + UI.dayLabel(date) }).then(function (p) {
      if (!p) return null;
      return (p.isNew ? Promise.resolve([]) : UI.defaultSides(p.name)).then(function (sides) {
        P.slots[date] = newSlot(date, {
          dish: p.name, new_dish_name: p.isNew ? p.name : '', side_1: sides[0] || '', side_2: sides[1] || '', side_3: sides[2] || ''
        });
        delete P.suggestedOn[date];
        var probe = { date: date, kind: 'home', dry_run: true };
        if (p.isNew) probe.new_dish_name = p.name; else probe.dish = p.name;
        return call('api_setSlot', probe).then(function (r) {
          if (r.warnings && r.warnings.length) UI.toast('Heads-up: ' + r.warnings.join(' • '));
        }).catch(function () { /* the heads-up is optional */ });
      }).then(function () { markDirty(); draw(); });
    }).catch(UI.fail);
  }

  function pickRestaurantFor(date) {
    UI.pickRestaurant({ date: date, startWith: 'suggest' }).then(function (p) {
      if (!p) return;
      P.slots[date] = newSlot(date, { kind: 'restaurant', restaurant: p.name, new_restaurant_name: p.isNew ? p.name : '' });
      delete P.suggestedOn[date];
      markDirty();
      draw();
    }).catch(UI.fail);
  }

  function detailsDialog(s) {
    var servings = h('input', { type: 'number', min: '1', value: s.servings || '' });
    var notes = h('input', { type: 'text', value: s.notes || '' });
    var sides = [s.side_1, s.side_2, s.side_3];
    var sideBox = h('div');
    var drawSides = function () {
      sideBox.innerHTML = '';
      sides.forEach(function (name, i) {
        sideBox.appendChild(h('div', { class: 'row' },
          h('div', { class: 'grow', text: name || 'No side ' + (i + 1) }),
          h('button', { class: 'btn small', text: name ? 'Change' : 'Choose', onclick: function () {
            UI.pickDish({ role: 'side', title: 'Pick a side' }).then(function (p) { if (p && !p.isNew) { sides[i] = p.name; drawSides(); } });
          } }),
          name ? h('button', { class: 'btn small danger', text: 'Remove', onclick: function () { sides[i] = ''; drawSides(); } }) : null));
      });
    };
    drawSides();
    UI.dialog('Details for ' + UI.dayLabel(s.date), h('div', null,
      UI.field('Servings to cook (blank = the recipe\'s servings)', servings), UI.field('Notes', notes), h('h3', { text: 'Side dishes' }), sideBox), {
      actions: [{ label: 'Save', primary: true, onclick: function (d) {
        s.servings = servings.value ? Number(servings.value) : '';
        s.notes = notes.value;
        s.side_1 = sides[0] || ''; s.side_2 = sides[1] || ''; s.side_3 = sides[2] || '';
        markDirty();
        d.close();
        draw();
      } }]
    });
  }

  function suggest() {
    var inRange = P.dates.slice(0, planDays());
    var open = [];
    var kept = [];
    P.dates.forEach(function (d) {
      var s = P.slots[d];
      var ok = inRange.indexOf(d) >= 0;
      if (!s) { if (ok) open.push(d); return; }
      if (s.kind === 'home' && !s.locked && ok) { open.push(d); return; }
      kept.push(s);
    });
    if (!open.length) { UI.toast('Every day is filled or locked. Unlock or clear a day to get new suggestions.'); return; }
    var exclude = Object.keys(P.seen);
    open.forEach(function (d) { if (P.slots[d] && P.slots[d].dish) exclude.push(P.slots[d].dish); });
    var lockedPayload = kept.map(function (s) { return { date: s.date, kind: s.kind, dish: s.dish, restaurant: s.restaurant, status: 'planned' }; });
    call('api_suggestMeals', open, exclude, lockedPayload, P.dates).then(function (res) {
      if (!res.suggestions.length && Object.keys(P.seen).length) {
        P.seen = {};
        UI.toast('You have seen every dish that fits. Starting over: press Suggest meals again.');
        return;
      }
      res.suggestions.forEach(function (sg) {
        P.slots[sg.date] = newSlot(sg.date, { dish: sg.dish, side_1: sg.sides[0] || '', side_2: sg.sides[1] || '', side_3: sg.sides[2] || '', locked: false, _health: sg.health });
        P.suggestedOn[sg.date] = true;
        P.seen[sg.dish] = true;
      });
      if (res.unfilled.length) {
        UI.toast(res.unfilled.map(function (u) { return UI.dayLabel(u.date) + ': ' + u.reason; }).join(' • '));
      }
      markDirty();
      draw();
    }).catch(UI.fail);
  }

  function clearSuggestions() {
    P.dates.forEach(function (d) {
      var s = P.slots[d];
      if (s && s.kind === 'home' && !s.locked) { delete P.slots[d]; delete P.suggestedOn[d]; }
    });
    markDirty();
    draw();
  }

  function savePlan() {
    clearTimeout(P.timer);
    P.timer = null;
    call('api_savePlan', P.weekStart, cleanSlots(), GRID_DAYS).then(function (res) {
      var used = P.usedQueue.slice();
      return Promise.all(used.map(function (id) { return call('api_queueRemove', id).catch(function () { return null; }); })).then(function () { return res; });
    }).then(function (res) {
      UI.toast('Plan saved (' + res.saved + ' night' + (res.saved === 1 ? '' : 's') + ')');
      return load(P.weekStart);
    }).catch(UI.fail);
  }

  function changeWeek(delta) {
    var target = Dates.addDays(P.weekStart, delta);
    var go = function () { P = null; load(target); };
    if (P.timer) saveDraftNow().then(go); else go();
  }

  function dayRow(date, idx) {
    var s = P.slots[date];
    var dim = idx >= planDays();
    var node = h('div', { class: 'card' + (dim ? ' dim' : '') }, h('div', { class: 'day', text: UI.dayLabel(date) + (dim ? ' (outside this plan)' : '') }));
    if (!s) {
      node.appendChild(h('div', { class: 'row' },
        h('button', { class: 'btn', text: 'Pick dish', onclick: function () { pickDishFor(date); } }),
        h('button', { class: 'btn', text: 'Eat out', onclick: function () { pickRestaurantFor(date); } })));
      return node;
    }
    var isRest = s.kind === 'restaurant';
    node.appendChild(h('div', { class: 'meal-main', text: isRest ? '🍽 ' + s.restaurant : s.dish }));
    if (!isRest) {
      var sides = [s.side_1, s.side_2, s.side_3].filter(Boolean);
      if (sides.length) node.appendChild(h('div', { class: 'sides', text: 'with ' + sides.join(' • ') }));
    }
    node.appendChild(h('div', { class: 'row' },
      P.suggestedOn[date] && !s.locked ? h('span', { class: 'badge warn', text: 'Suggested' }) : null,
      s.locked ? h('span', { class: 'badge', text: '🔒 Kept' }) : null,
      !isRest ? UI.healthBadge(s._health, 'Meal health') : null,
      s.new_dish_name ? h('span', { class: 'badge warn', text: 'New idea' }) : null));
    node.appendChild(h('div', { class: 'row' },
      isRest ? null : h('button', { class: 'btn small', text: s.locked ? 'Unlock' : 'Keep', onclick: function () { s.locked = !s.locked; delete P.suggestedOn[date]; markDirty(); draw(); } }),
      h('button', { class: 'btn small', text: isRest ? 'Change restaurant' : 'Change dish', onclick: function () { if (isRest) pickRestaurantFor(date); else pickDishFor(date); } }),
      isRest ? null : h('button', { class: 'btn small', text: 'Sides & servings', onclick: function () { detailsDialog(s); } }),
      isRest ? null : h('button', { class: 'btn small', text: 'Eat out instead', onclick: function () { pickRestaurantFor(date); } }),
      h('button', { class: 'btn small danger', text: 'Clear', onclick: function () { delete P.slots[date]; delete P.suggestedOn[date]; markDirty(); draw(); } })));
    return node;
  }

  function queueCard() {
    var items = P.queue.filter(function (q) { return P.usedQueue.indexOf(q.queue_id) < 0; });
    if (!items.length) return null;
    var emptyDates = P.dates.filter(function (d) { return !P.slots[d]; });
    var card = h('div', { class: 'card' }, h('h3', { text: 'Saved for later' }));
    items.forEach(function (q) {
      var sel = UI.select(emptyDates.map(function (d) { return { value: d, label: UI.dayLabel(d) }; }), emptyDates[0] || '', null);
      card.appendChild(h('div', { class: 'row' }, h('div', { class: 'grow', text: q.dish }), sel,
        h('button', { class: 'btn small', text: 'Put on this day', disabled: !emptyDates.length, onclick: function () {
          if (!sel.value) return;
          UI.defaultSides(q.dish).then(function (sides) {
            P.slots[sel.value] = newSlot(sel.value, { dish: q.dish, side_1: sides[0] || '', side_2: sides[1] || '', side_3: sides[2] || '' });
            P.usedQueue.push(q.queue_id);
            markDirty();
            draw();
          });
        } })));
    });
    return card;
  }

  function draw() {
    container.innerHTML = '';
    var weekLabel = 'Week of ' + UI.longDate(P.weekStart);
    container.appendChild(h('div', { class: 'row between' }, h('h2', { text: 'Plan' }),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', text: '◀ Earlier', onclick: function () { changeWeek(-7); } }),
        h('strong', { text: weekLabel }),
        h('button', { class: 'btn small', text: 'Later ▶', onclick: function () { changeWeek(7); } }))));

    var profile = UI.select(UI.state.boot.profiles, UI.state.boot.activeProfile, function (e) {
      call('api_setProfile', e.target.value).then(function (r) {
        UI.state.boot.activeProfile = r.activeProfile;
        document.getElementById('who').textContent = UI.state.boot.me.name + (r.activeProfile !== 'Normal' ? ' • ' + r.activeProfile : '');
        UI.toast('Budget mode: ' + r.activeProfile);
      }).catch(UI.fail);
    });
    statusEl = h('div', { class: 'meta', text: P.dirty ? 'Draft not saved yet' : '' });
    container.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('label', { class: 'field grow' }, h('span', { text: 'Budget mode' }), profile),
        h('button', { class: 'btn primary', text: 'Suggest meals', onclick: suggest }),
        h('button', { class: 'btn', text: 'Clear suggestions', onclick: clearSuggestions }),
        h('button', { class: 'btn primary', text: 'Save plan', onclick: savePlan })),
      statusEl));

    if (P.restored) {
      container.appendChild(h('div', { class: 'banner row between' },
        h('span', { text: 'Restored your unsaved draft from ' + String(P.restored).replace('T', ' ') + '.' }),
        h('button', { class: 'btn small', text: 'Discard draft', onclick: function () {
          UI.confirmBox('Throw away your draft and go back to the saved plan?', 'Discard').then(function (ok) {
            if (ok) call('api_clearDraft', P.weekStart).then(function () { load(P.weekStart); }).catch(UI.fail);
          });
        } })));
    }

    P.dates.forEach(function (d, i) { container.appendChild(dayRow(d, i)); });
    var q = queueCard();
    if (q) container.appendChild(q);
  }

  window.addEventListener('beforeunload', function (e) {
    if (P && P.timer) { e.preventDefault(); e.returnValue = ''; }
  });

  UI.screens.plan = { render: render };
})();
