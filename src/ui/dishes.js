// Dishes: browse, detail, add/edit (with pasted recipes), log a past meal, and the shared dish picker.
(function () {
  'use strict';

  var h = UI.h;
  var call = UI.call;
  var container = null;
  var listBox = null;
  var filters = { q: '', role: 'main', type: '', season: '', favorite: false, status: 'visible', minRating: '', minHealth: '', maxMinutes: '' };

  function lookups() { return UI.state.boot.lookups; }

  function badgesFor(r) {
    return [
      r.type ? h('span', { class: 'badge', text: r.type }) : null,
      UI.healthBadge(r.health),
      r.rating != null ? h('span', { class: 'badge', text: '★ ' + r.rating }) : null,
      r.favorite ? h('span', { class: 'badge', text: '♥ Favorite' }) : null,
      r.status === 'idea' ? h('span', { class: 'badge warn', text: 'Idea' }) : null,
      r.status === 'retired' ? h('span', { class: 'badge', text: 'Retired' }) : null,
      !r.has_recipe ? h('span', { class: 'badge', text: 'No recipe' }) : null
    ];
  }

  UI.defaultSides = function (name) {
    return call('api_getDish', name).then(function (d) {
      return d.sides.filter(function (x) { return x.is_default; }).slice(0, 3).map(function (x) { return x.side_dish; });
    }).catch(function () { return []; });
  };

  // ---------- picker ----------

  UI.pickDish = function (opts) {
    var o = opts || {};
    return new Promise(function (resolve) {
      var f = { q: '', type: '', favorite: false, role: o.role || 'main', status: 'usable' };
      var done = false;
      var list = h('div');
      var finish = function (value) { done = true; resolve(value); dlg.close(); };
      var load = function () {
        call('api_listDishes', f).then(function (rows) {
          list.innerHTML = '';
          if (!rows.length) list.appendChild(h('div', { class: 'empty', text: 'No dishes match.' }));
          rows.forEach(function (r) {
            list.appendChild(h('div', { class: 'list-item', onclick: function () { finish({ name: r.name, isNew: false }); } },
              h('div', { class: 'grow' }, h('strong', { text: r.name }),
                h('div', { class: 'meta', text: r.last_cooked ? 'Last made ' + r.last_cooked : 'Not made yet' })),
              badgesFor(r)));
          });
        }).catch(UI.fail);
      };
      var search = h('input', { type: 'text', placeholder: 'Search by name', oninput: function (e) { f.q = e.target.value; load(); } });
      var typeSel = UI.select(lookups().types, '', function (e) { f.type = e.target.value; load(); }, 'Any type');
      var fav = h('input', { type: 'checkbox', onchange: function (e) { f.favorite = e.target.checked; load(); } });
      var idea = h('input', { type: 'text', placeholder: 'Or type a new dish idea' });
      var body = h('div', null,
        h('div', { class: 'grid2' }, search, typeSel, h('label', { class: 'check' }, fav, 'Favorites only')),
        list,
        h('div', { class: 'row' }, h('div', { class: 'grow' }, idea),
          h('button', { class: 'btn primary', text: 'Use this idea', onclick: function () {
            var name = idea.value.trim();
            if (!name) return;
            finish({ name: name, isNew: true });
          } })));
      var dlg = UI.dialog(o.title || 'Pick a dish', body, { wide: true, onclose: function () { if (!done) resolve(null); } });
      load();
      setTimeout(function () { search.focus(); }, 50);
    });
  };

  // ---------- list ----------

  function render(c) {
    container = c;
    showList();
  }

  function showList() {
    container.innerHTML = '';
    var lk = lookups();
    var reload = function () { loadList(); };
    container.appendChild(h('div', { class: 'row between' },
      h('h2', { text: 'Dishes' }),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', text: 'Add dish', onclick: function () { openForm(null); } }),
        h('button', { class: 'btn', text: 'Log a past meal', onclick: logPastMeal }))));
    var search = h('input', { type: 'text', placeholder: 'Search dishes', value: filters.q, oninput: function (e) { filters.q = e.target.value; reload(); } });
    var role = UI.select([{ value: 'main', label: 'Main dishes' }, { value: 'side', label: 'Side dishes' }], filters.role, function (e) { filters.role = e.target.value; reload(); }, 'Mains and sides');
    var type = UI.select(lk.types, filters.type, function (e) { filters.type = e.target.value; reload(); }, 'Any type');
    var season = UI.select(lk.seasons, filters.season, function (e) { filters.season = e.target.value; reload(); }, 'Any season');
    var rating = UI.select([{ value: '3', label: '3★ and up' }, { value: '4', label: '4★ and up' }], filters.minRating, function (e) { filters.minRating = e.target.value; reload(); }, 'Any rating');
    var health = UI.select([{ value: '6', label: 'Health 6+' }, { value: '8', label: 'Health 8+' }], filters.minHealth, function (e) { filters.minHealth = e.target.value; reload(); }, 'Any health');
    var time = UI.select([{ value: '30', label: '30 min or less' }, { value: '45', label: '45 min or less' }, { value: '60', label: '60 min or less' }], filters.maxMinutes, function (e) { filters.maxMinutes = e.target.value; reload(); }, 'Any time');
    var fav = h('input', { type: 'checkbox', checked: filters.favorite, onchange: function (e) { filters.favorite = e.target.checked; reload(); } });
    var ideas = h('input', { type: 'checkbox', checked: filters.status === 'idea', onchange: function (e) { filters.status = e.target.checked ? 'idea' : 'visible'; reload(); } });
    container.appendChild(h('div', { class: 'card' }, search,
      h('div', { class: 'grid2' }, role, type, season, rating, health, time),
      h('label', { class: 'check' }, fav, 'Favorites'), h('label', { class: 'check' }, ideas, 'Ideas only')));
    listBox = h('div', { class: 'card' });
    container.appendChild(listBox);
    container.appendChild(h('div', { class: 'row no-print' },
      h('button', { class: 'btn small', text: 'Recalculate healthy scores', onclick: function () {
        call('api_recalculateHealth').then(function (r) {
          UI.toast(r.changed ? r.changed + ' dish score' + (r.changed === 1 ? '' : 's') + ' updated' : 'All healthy scores are already up to date');
          loadList();
        }).catch(UI.fail);
      } }),
      h('span', { class: 'meta', text: 'Use after changing points in cfg_health_rules.' })));
    loadList();
  }

  function loadList() {
    return call('api_listDishes', filters).then(function (rows) {
      if (!listBox) return;
      listBox.innerHTML = '';
      if (!rows.length) {
        listBox.appendChild(h('div', { class: 'empty', text: 'No dishes yet. Use "Add dish" to enter your first one.' }));
        return;
      }
      rows.forEach(function (r) {
        listBox.appendChild(h('div', { class: 'list-item', onclick: function () { showDetail(r.name); } },
          h('div', { class: 'grow' }, h('strong', { text: r.name }),
            h('div', { class: 'meta', text: (r.last_cooked ? 'Last made ' + r.last_cooked : 'Not made yet') + (r.minutes ? ' • ' + r.minutes + ' min' : '') })),
          badgesFor(r)));
      });
    }).catch(UI.fail);
  }

  // ---------- detail ----------

  function showDetail(name) {
    call('api_getDish', name).then(drawDetail).catch(UI.fail);
  }

  function ingredientText(l) {
    var text = [l.qty_text, l.unit, l.ingredient].filter(function (x) { return x !== '' && x != null; }).join(' ');
    if (l.prep_note) text += ', ' + l.prep_note;
    if (l.optional) text += ' (optional)';
    return text;
  }

  function drawDetail(d) {
    container.innerHTML = '';
    var dish = d.dish;
    var refresh = function () { showDetail(dish.name); };
    container.appendChild(h('button', { class: 'btn small', text: '← All dishes', onclick: showList }));

    var meta = [dish.role === 'side' ? 'Side dish' : 'Main dish', dish.type, dish.cuisine,
      dish.servings ? 'Serves ' + dish.servings : '', (dish.prep_min || dish.cook_min) ? 'Prep ' + (dish.prep_min || 0) + ' • Cook ' + (dish.cook_min || 0) + ' min' : '',
      dish.source ? 'From ' + dish.source : ''].filter(Boolean).join(' • ');
    container.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', { text: dish.name }),
        h('button', { class: 'btn', text: dish.favorite ? '♥ Favorite' : '♡ Make favorite', onclick: function () {
          call('api_setFavorite', 'dish', dish.name, !dish.favorite).then(refresh).catch(UI.fail);
        } })),
      h('div', { class: 'meta', text: meta }),
      h('div', { class: 'row' }, UI.healthBadge(dish.healthy_score),
        dish.status !== 'active' ? h('span', { class: 'badge warn', text: dish.status }) : null,
        d.seasons.map(function (s) { return h('span', { class: 'badge', text: s }); }),
        d.tags.map(function (t) { return h('span', { class: 'badge', text: '#' + t }); })),
      h('div', { class: 'row' }, h('span', { text: 'Your rating' }),
        UI.stars(d.rating.mine, function (n) { call('api_rate', 'dish', dish.name, n).then(refresh).catch(UI.fail); }),
        h('span', { class: 'meta', text: d.rating.count ? 'Average ' + d.rating.avg + ' from ' + d.rating.count : 'Not rated yet' })),
      h('div', { class: 'row no-print' },
        h('button', { class: 'btn', text: 'Edit', onclick: function () { openForm(d); } }),
        h('button', { class: 'btn', text: 'Rename', onclick: function () {
          UI.promptBox('Rename dish', 'New name', dish.name).then(function (n) {
            if (!n || n === dish.name) return null;
            return call('api_renameItem', 'lib_dishes', dish.name, n).then(function (r) {
              UI.toast('Renamed in ' + r.count + ' place' + (r.count === 1 ? '' : 's'));
              showDetail(n);
            });
          }).catch(UI.fail);
        } }),
        dish.status !== 'retired' ? h('button', { class: 'btn danger', text: 'Retire', onclick: function () {
          UI.confirmBox('Retire "' + dish.name + '"? It stays in your history but is no longer suggested.', 'Retire').then(function (ok) {
            if (ok) call('api_retireDish', dish.name).then(refresh).catch(UI.fail);
          });
        } }) : null)));

    if (d.sides.length) {
      container.appendChild(h('div', { class: 'card' }, h('h3', { text: 'Goes well with' }),
        d.sides.map(function (s) { return h('div', { text: s.side_dish + (s.is_default ? ' (usual side)' : '') }); })));
    }

    var rc = h('div', { class: 'card' }, h('h3', { text: 'Recipe' }));
    if (dish.intro_notes) rc.appendChild(h('p', { class: 'meta', text: dish.intro_notes }));
    if (!d.recipe.ingredients.length && !d.recipe.steps.length) {
      rc.appendChild(h('div', { class: 'empty', text: 'No recipe yet. Use Edit to add one.' }));
    } else {
      Recipe.groupByLabel(d.recipe.ingredients).forEach(function (g) {
        if (g.label) rc.appendChild(h('h3', { text: g.label }));
        g.lines.forEach(function (l) { rc.appendChild(h('div', { text: '• ' + ingredientText(l) })); });
      });
      if (d.recipe.steps.length) rc.appendChild(h('h3', { text: 'Directions' }));
      var section = null;
      d.recipe.steps.forEach(function (st) {
        if (st.section_label && st.section_label !== section) { section = st.section_label; rc.appendChild(h('h3', { text: section })); }
        rc.appendChild(h('p', { text: st.step_no + '. ' + st.text + (st.timer_min ? ' (' + st.timer_min + ' min)' : '') }));
      });
    }
    container.appendChild(rc);

    var box = h('textarea', { placeholder: 'Add a comment' });
    var cc = h('div', { class: 'card' }, h('h3', { text: 'Comments' }));
    if (!d.comments.length) cc.appendChild(h('div', { class: 'meta', text: 'No comments yet.' }));
    d.comments.forEach(function (c) { cc.appendChild(h('p', null, h('strong', { text: c.member + ' ' }), h('span', { class: 'meta', text: c.date }), h('br'), c.text)); });
    cc.appendChild(box);
    cc.appendChild(h('div', { class: 'actions' }, h('button', { class: 'btn primary', text: 'Add comment', onclick: function () {
      call('api_addComment', 'dish', dish.name, box.value).then(refresh).catch(UI.fail);
    } })));
    container.appendChild(cc);

    container.appendChild(h('div', { class: 'card' }, h('h3', { text: 'History' }),
      d.history.length ? d.history.map(function (x) { return h('div', { text: UI.longDate(x.date) + (x.status === 'cooked' ? ' ✓' : '') }); })
        : h('div', { class: 'meta', text: 'Not on the plan yet.' })));
  }

  // ---------- add / edit form ----------

  function emptyForm() {
    return { original_name: '', name: '', role: 'main', type: '', cuisine: '', cook_method: '', servings: '', prep_min: '', cook_min: '',
      source: '', intro_notes: '', status: 'idea', favorite: false, seasons: [], tags: [], sides: [], ingredients: [], steps: [], paste: '', warnings: [] };
  }

  function formFromDetail(d) {
    var dish = d.dish;
    return {
      original_name: dish.name, name: dish.name, role: dish.role, type: dish.type, cuisine: dish.cuisine, cook_method: dish.cook_method,
      servings: dish.servings == null ? '' : dish.servings, prep_min: dish.prep_min == null ? '' : dish.prep_min,
      cook_min: dish.cook_min == null ? '' : dish.cook_min, source: dish.source, intro_notes: dish.intro_notes, status: dish.status,
      favorite: dish.favorite, seasons: d.seasons.slice(), tags: d.tags.slice(),
      sides: d.sides.map(function (s) { return { side_dish: s.side_dish, is_default: s.is_default }; }),
      ingredients: d.recipe.ingredients.map(function (l) {
        return { qty_text: l.qty_text, unit: l.unit, ingredient: l.ingredient, prep_note: l.prep_note, group_label: l.group_label, optional: l.optional };
      }),
      steps: d.recipe.steps.map(function (st) { return { section_label: st.section_label, text: st.text, timer_min: st.timer_min == null ? '' : st.timer_min }; }),
      paste: '', warnings: []
    };
  }

  UI.editDish = function (name) {
    UI.show('dishes');
    call('api_getDish', name).then(function (d) { openForm(d); }).catch(UI.fail);
  };

  function openForm(detail) {
    var f = detail ? formFromDetail(detail) : emptyForm();
    call('api_listDishes', { role: 'side', status: 'usable' }).then(function (sides) {
      drawForm(f, sides.map(function (s) { return s.name; }));
    }).catch(UI.fail);
  }

  function text(f, key, label, type) {
    return UI.field(label, h('input', { type: type || 'text', value: f[key] == null ? '' : f[key], oninput: function (e) { f[key] = e.target.value; } }));
  }

  function drawForm(f, sideNames) {
    var lk = lookups();
    var redraw = function () { drawForm(f, sideNames); };
    container.innerHTML = '';
    container.appendChild(h('button', { class: 'btn small', text: '← Cancel', onclick: function () { if (f.original_name) showDetail(f.original_name); else showList(); } }));
    container.appendChild(h('h2', { text: f.original_name ? 'Edit ' + f.original_name : 'Add a dish' }));

    var basics = h('div', { class: 'card' },
      text(f, 'name', 'Dish name'),
      h('div', { class: 'grid2' },
        UI.field('Main or side', UI.select([{ value: 'main', label: 'Main dish' }, { value: 'side', label: 'Side dish' }], f.role, function (e) { f.role = e.target.value; redraw(); })),
        UI.field('Type', UI.select(lk.types, f.type, function (e) { f.type = e.target.value; }, '')),
        UI.field('Cuisine', UI.select(lk.cuisines, f.cuisine, function (e) { f.cuisine = e.target.value; }, '')),
        UI.field('How it is cooked', UI.select(lk.cookMethods, f.cook_method, function (e) { f.cook_method = e.target.value; }, '')),
        text(f, 'servings', 'Servings the recipe makes', 'number'),
        text(f, 'prep_min', 'Prep minutes', 'number'),
        text(f, 'cook_min', 'Cook minutes', 'number'),
        UI.field('Status', UI.select([{ value: 'idea', label: 'Idea (not tried yet)' }, { value: 'active', label: 'Active' }, { value: 'retired', label: 'Retired' }], f.status, function (e) { f.status = e.target.value; }))),
      text(f, 'source', 'Where the recipe came from'),
      UI.field('Tips and notes', h('textarea', { value: f.intro_notes, oninput: function (e) { f.intro_notes = e.target.value; } })),
      h('div', { class: 'meta', text: 'Seasons (leave all unticked for year-round)' }),
      lk.seasons.map(function (s) {
        return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: f.seasons.indexOf(s) >= 0, onchange: function (e) {
          f.seasons = f.seasons.filter(function (x) { return x !== s; });
          if (e.target.checked) f.seasons.push(s);
        } }), s);
      }),
      lk.tags.length ? h('div', { class: 'meta', text: 'Tags' }) : null,
      lk.tags.map(function (t) {
        return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: f.tags.indexOf(t) >= 0, onchange: function (e) {
          f.tags = f.tags.filter(function (x) { return x !== t; });
          if (e.target.checked) f.tags.push(t);
        } }), t);
      }));
    container.appendChild(basics);

    if (f.role === 'main') {
      var sidesCard = h('div', { class: 'card' }, h('h3', { text: 'Side dishes that go with it' }));
      f.sides.forEach(function (s, i) {
        sidesCard.appendChild(h('div', { class: 'row' },
          h('div', { class: 'grow' }, UI.select(sideNames, s.side_dish, function (e) { s.side_dish = e.target.value; }, 'Choose a side')),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.is_default, onchange: function (e) { s.is_default = e.target.checked; } }), 'Usual side'),
          h('button', { class: 'btn small danger', type: 'button', text: 'Remove', onclick: function () { f.sides.splice(i, 1); redraw(); } })));
      });
      sidesCard.appendChild(h('button', { class: 'btn small', type: 'button', text: 'Add a side', onclick: function () { f.sides.push({ side_dish: '', is_default: true }); redraw(); } }));
      if (!sideNames.length) sidesCard.appendChild(h('div', { class: 'meta', text: 'No side dishes exist yet. Add a dish with "Side dish" selected first.' }));
      container.appendChild(sidesCard);
    }

    var paste = h('textarea', { placeholder: 'Paste a whole recipe here: title, Ingredients, Directions...', value: f.paste, oninput: function (e) { f.paste = e.target.value; } });
    var pasteCard = h('div', { class: 'card' }, h('h3', { text: 'Paste a recipe' }), paste,
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', text: 'Read pasted recipe', onclick: function () {
        call('api_parseRecipeText', f.paste).then(function (r) {
          if (r.title && !f.name) f.name = r.title;
          if (r.servings != null) f.servings = r.servings;
          if (r.prep_min != null) f.prep_min = r.prep_min;
          if (r.cook_min != null) f.cook_min = r.cook_min;
          if (r.ingredients.length) {
            f.ingredients = r.ingredients.map(function (l) {
              return { qty_text: l.qty_text, unit: l.unit, ingredient: l.name, prep_note: l.prep_note, group_label: l.group_label, optional: l.optional };
            });
          }
          if (r.steps.length) {
            f.steps = r.steps.map(function (st) { return { section_label: st.section_label, text: st.text, timer_min: st.timer_min == null ? '' : st.timer_min }; });
          }
          f.warnings = r.warnings;
          redraw();
        }).catch(UI.fail);
      } })));
    if (f.warnings.length) {
      pasteCard.appendChild(h('div', { class: 'banner' }, h('strong', { text: 'Please check:' }), f.warnings.map(function (w) { return h('div', { text: '• ' + w }); })));
    }
    container.appendChild(pasteCard);

    var listUnits = h('datalist', { id: 'dl-units' }, lk.units.map(function (u) { return h('option', { value: u }); }));
    var listIngs = h('datalist', { id: 'dl-ings' }, lk.ingredients.map(function (u) { return h('option', { value: u }); }));
    var ingCard = h('div', { class: 'card' }, h('h3', { text: 'Ingredients' }), listUnits, listIngs,
      h('div', { class: 'meta', text: 'Amount, unit, ingredient, note. Leave the amount blank for things like "salt, to taste".' }));
    f.ingredients.forEach(function (l, i) {
      ingCard.appendChild(h('div', { class: 'edit-row' },
        h('input', { type: 'text', placeholder: 'Amount', value: l.qty_text, oninput: function (e) { l.qty_text = e.target.value; } }),
        h('input', { type: 'text', placeholder: 'Unit', list: 'dl-units', value: l.unit, oninput: function (e) { l.unit = e.target.value; } }),
        h('input', { type: 'text', placeholder: 'Ingredient', list: 'dl-ings', value: l.ingredient, oninput: function (e) { l.ingredient = e.target.value; } }),
        h('input', { type: 'text', placeholder: 'Note (chopped...)', value: l.prep_note, oninput: function (e) { l.prep_note = e.target.value; } }),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: l.optional, onchange: function (e) { l.optional = e.target.checked; } }), 'Optional'),
        h('button', { class: 'btn small danger', type: 'button', text: '✕', 'aria-label': 'Remove', onclick: function () { f.ingredients.splice(i, 1); redraw(); } })));
      ingCard.appendChild(h('input', { type: 'text', placeholder: 'Group heading (optional), e.g. For the sauce', value: l.group_label, oninput: function (e) { l.group_label = e.target.value; } }));
    });
    ingCard.appendChild(h('button', { class: 'btn small', type: 'button', text: 'Add ingredient', onclick: function () {
      f.ingredients.push({ qty_text: '', unit: '', ingredient: '', prep_note: '', group_label: '', optional: false }); redraw();
    } }));
    container.appendChild(ingCard);

    var stepCard = h('div', { class: 'card' }, h('h3', { text: 'Directions' }));
    f.steps.forEach(function (st, i) {
      stepCard.appendChild(h('div', { class: 'step-row' },
        h('div', null,
          h('input', { type: 'text', placeholder: 'Section heading (optional)', value: st.section_label, oninput: function (e) { st.section_label = e.target.value; } }),
          h('textarea', { placeholder: 'Step ' + (i + 1), value: st.text, oninput: function (e) { st.text = e.target.value; } })),
        h('input', { type: 'number', placeholder: 'Timer min', value: st.timer_min, oninput: function (e) { st.timer_min = e.target.value; } }),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', type: 'button', text: '↑', onclick: function () { if (i > 0) { f.steps.splice(i - 1, 0, f.steps.splice(i, 1)[0]); redraw(); } } }),
          h('button', { class: 'btn small', type: 'button', text: '↓', onclick: function () { if (i < f.steps.length - 1) { f.steps.splice(i + 1, 0, f.steps.splice(i, 1)[0]); redraw(); } } }),
          h('button', { class: 'btn small danger', type: 'button', text: '✕', 'aria-label': 'Remove', onclick: function () { f.steps.splice(i, 1); redraw(); } }))));
    });
    stepCard.appendChild(h('button', { class: 'btn small', type: 'button', text: 'Add step', onclick: function () {
      f.steps.push({ section_label: '', text: '', timer_min: '' }); redraw();
    } }));
    container.appendChild(stepCard);

    container.appendChild(h('div', { class: 'actions' },
      h('button', { class: 'btn primary', text: 'Save dish', onclick: function () { save(f); } })));
  }

  function save(f) {
    if (!f.name.trim()) { UI.toast('Please enter a dish name.', true); return; }
    var payload = {
      original_name: f.original_name, name: f.name.trim(), role: f.role, type: f.type, cuisine: f.cuisine, cook_method: f.cook_method,
      servings: f.servings, prep_min: f.prep_min, cook_min: f.cook_min, source: f.source, intro_notes: f.intro_notes,
      status: f.status, seasons: f.seasons, tags: f.tags, favorite: f.favorite
    };
    if (f.role === 'main') payload.sides = f.sides;
    var hasRecipe = f.ingredients.some(function (l) { return l.ingredient.trim(); }) || f.steps.some(function (s) { return s.text.trim(); });
    call('api_saveDish', payload).then(function (res) {
      if (!hasRecipe && !f.original_name) return res;
      return call('api_saveRecipe', res.name, {
        servings: f.servings, prep_min: f.prep_min, cook_min: f.cook_min, intro_notes: f.intro_notes,
        ingredients: f.ingredients, steps: f.steps
      }).then(function (r) {
        if (r.new_ingredients.length) UI.toast('New ingredients added: ' + r.new_ingredients.join(', ') + '. Set their store aisle on the shopping list.');
        return res;
      });
    }).then(function (res) {
      UI.toast('Saved ' + res.name);
      showDetail(res.name);
    }).catch(UI.fail);
  }

  // ---------- log a past meal ----------

  function logPastMeal() {
    var entry = { kind: 'home', name: '', isNew: false };
    var date = h('input', { type: 'date', max: UI.state.today, value: Dates.addDays(UI.state.today, -1) });
    var chosen = h('div', { class: 'meta', text: 'Nothing chosen yet' });
    var kindRow = h('div', { class: 'row' });
    var drawKind = function () {
      kindRow.innerHTML = '';
      [['home', 'Cooked at home'], ['restaurant', 'Ate out']].forEach(function (k) {
        kindRow.appendChild(h('label', { class: 'check' }, h('input', { type: 'radio', name: 'pastkind', checked: entry.kind === k[0], onchange: function () {
          entry.kind = k[0]; entry.name = ''; chosen.textContent = 'Nothing chosen yet';
        } }), k[1]));
      });
    };
    drawKind();
    var body = h('div', null, UI.field('Date', date), kindRow,
      h('button', { class: 'btn', text: 'Choose...', onclick: function () {
        var picker = entry.kind === 'home' ? UI.pickDish({ role: 'main', title: 'Which dish?' }) : UI.pickRestaurant({ date: date.value });
        picker.then(function (p) {
          if (!p) return;
          entry.name = p.name; entry.isNew = p.isNew;
          chosen.textContent = p.name + (p.isNew ? ' (new)' : '');
        });
      } }), chosen);
    UI.dialog('Log a past meal', body, { actions: [{ label: 'Save', primary: true, onclick: function (d) {
      if (!entry.name || !date.value) { UI.toast('Pick a date and a ' + (entry.kind === 'home' ? 'dish' : 'restaurant') + '.', true); return; }
      var payload = { date: date.value, kind: entry.kind };
      if (entry.kind === 'home') { if (entry.isNew) payload.new_dish_name = entry.name; else payload.dish = entry.name; }
      else if (entry.isNew) payload.new_restaurant_name = entry.name; else payload.restaurant = entry.name;
      call('api_logPastMeal', payload).then(function () { d.close(); UI.toast('Meal logged'); loadList(); }).catch(UI.fail);
    } }] });
  }

  UI.screens.dishes = { render: render, refresh: function () { if (listBox && listBox.isConnected) loadList(); } };
})();
