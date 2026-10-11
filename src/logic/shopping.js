// Shopping list: build from the plan, merge with what is already ticked, sort, format.
var Shopping = (function () {
  'use strict';

  function Units_() { return (typeof module !== 'undefined' && module.exports) ? require('./units') : Units; }
  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function k_(n) { return Ingredients_().normalize(n); }
  function round4_(n) { return Math.round(n * 10000) / 10000; }
  function copy_(o) { var c = {}; Object.keys(o).forEach(function (k) { c[k] = o[k]; }); return c; }
  function flagsOf_(it) { return Array.isArray(it.flags) ? it.flags.slice() : []; }

  function dedupeSources_(list) {
    var seen = {};
    return list.filter(function (s) {
      var key = s.date + '|' + s.dish;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  // ctx: { dishesByName, recipeLinesByDish, ingredientsByName (all keyed by normalized name),
  //        units, runningLowIngredients, defaultServings }
  function buildList(planSlots, ctx) {
    var units = ctx.units || [];
    var byIng = {};
    var order = [];
    var missing = [];

    (planSlots || []).forEach(function (slot) {
      if (slot.kind !== 'home' || slot.status !== 'planned') return;
      [slot.dish, slot.side_1, slot.side_2, slot.side_3].forEach(function (dishName) {
        if (!dishName || !String(dishName).trim()) return;
        var dk = k_(dishName);
        var dish = ctx.dishesByName ? ctx.dishesByName[dk] : null;
        var lines = (ctx.recipeLinesByDish && ctx.recipeLinesByDish[dk]) || [];
        if (!lines.length) {
          missing.push({ date: slot.date, dish: dishName });
          return;
        }
        var base = dish && Number(dish.servings) > 0 ? Number(dish.servings) : (Number(ctx.defaultServings) > 0 ? Number(ctx.defaultServings) : 4);
        var target = Number(slot.servings) > 0 ? Number(slot.servings) : base;
        var factor = target / base;
        lines.forEach(function (line) {
          if (line.optional) return;
          var key = k_(line.ingredient);
          if (!key) return;
          if (!byIng[key]) { byIng[key] = []; order.push(key); }
          byIng[key].push({
            qty: line.qty == null || line.qty === '' ? null : Number(line.qty) * factor,
            unit: line.unit || '',
            name: line.ingredient,
            source: { date: slot.date, dish: dishName }
          });
        });
      });
    });

    var items = [];
    order.forEach(function (key) {
      var entries = byIng[key];
      var ing = ctx.ingredientsByName ? ctx.ingredientsByName[key] : null;
      var display = ing ? ing.name : entries[0].name;
      var buckets = [];
      var nullSources = [];
      entries.forEach(function (e) {
        if (e.qty == null) { nullSources.push(e.source); return; }
        for (var i = 0; i < buckets.length; i++) {
          var c = Units_().combine({ qty: buckets[i].qty, unit: buckets[i].unit }, { qty: e.qty, unit: e.unit }, units);
          if (c) {
            buckets[i].qty = c.qty;
            buckets[i].sources.push(e.source);
            return;
          }
        }
        buckets.push({ qty: e.qty, unit: e.unit, sources: [e.source] });
      });
      if (!buckets.length) buckets.push({ qty: null, unit: '', sources: nullSources });
      else buckets[0].sources = buckets[0].sources.concat(nullSources);
      buckets.forEach(function (b) {
        items.push({
          ingredient: display,
          name: display,
          qty: b.qty == null ? null : round4_(b.qty),
          unit: b.unit,
          aisle: ing && ing.aisle ? ing.aisle : '',
          have_it: !!(ing && (ing.is_staple === true || String(ing.is_staple).toUpperCase() === 'TRUE')),
          in_cart: false,
          source_dishes: dedupeSources_(b.sources),
          flags: buckets.length > 1 ? ['unit_mismatch'] : [],
          is_manual: false
        });
      });
    });

    var lowSeen = {};
    (ctx.runningLowIngredients || []).forEach(function (name) {
      var key = k_(name);
      if (!key || lowSeen[key]) return;
      lowSeen[key] = true;
      var existing = items.filter(function (i) { return k_(i.ingredient) === key; });
      if (existing.length) {
        existing.forEach(function (i) {
          i.have_it = false;
          if (i.flags.indexOf('running_low') < 0) i.flags.push('running_low');
        });
      } else {
        var ing = ctx.ingredientsByName ? ctx.ingredientsByName[key] : null;
        var nm = ing ? ing.name : name;
        items.push({
          ingredient: nm, name: nm, qty: null, unit: '', aisle: ing && ing.aisle ? ing.aisle : '',
          have_it: false, in_cart: false, source_dishes: [], flags: ['running_low'], is_manual: false
        });
      }
    });

    return { items: items, missingRecipes: missing };
  }

  function key_(it) {
    return it.is_manual ? 'm|' + k_(it.name) : 'i|' + k_(it.ingredient) + '|' + String(it.unit || '').toLowerCase();
  }

  // Existing have_it / in_cart win. Manual items are always kept.
  // Items already in the cart that are no longer needed are kept and flagged.
  function mergeWithExisting(newItems, existingItems) {
    var existingByKey = {};
    (existingItems || []).forEach(function (e) { existingByKey[key_(e)] = e; });
    var used = {};
    var items = [];
    var changes = { added: [], removed: [], changed: [] };

    (newItems || []).forEach(function (n) {
      var item = copy_(n);
      item.flags = flagsOf_(n);
      var k = key_(n);
      var e = existingByKey[k];
      if (e) {
        used[k] = true;
        item.have_it = e.have_it === true || String(e.have_it).toUpperCase() === 'TRUE';
        item.in_cart = e.in_cart === true || String(e.in_cart).toUpperCase() === 'TRUE';
        if (e.item_id) item.item_id = e.item_id;
        // An aisle picked "just for this list" stays; a blank one takes the ingredient's current default.
        if (e.aisle) item.aisle = e.aisle;
        // Newly marked "running low" must reach the list even if the item was ticked as already in the house.
        if (item.flags.indexOf('running_low') >= 0 && flagsOf_(e).indexOf('running_low') < 0) {
          item.have_it = false;
          item.in_cart = false;
        }
        var a = e.qty == null || e.qty === '' ? null : Number(e.qty);
        var b = n.qty == null ? null : Number(n.qty);
        if ((a === null) !== (b === null) || (a !== null && Math.abs(a - b) > 1e-6)) {
          changes.changed.push({ name: n.name, from: a, to: b });
        }
      } else {
        changes.added.push({ name: n.name, qty: n.qty, unit: n.unit });
      }
      items.push(item);
    });

    (existingItems || []).forEach(function (e) {
      var k = key_(e);
      if (used[k]) return;
      used[k] = true;
      var keep = copy_(e);
      keep.flags = flagsOf_(e);
      if (e.is_manual === true || String(e.is_manual).toUpperCase() === 'TRUE') {
        items.push(keep);
        return;
      }
      changes.removed.push({ name: e.name });
      if (e.in_cart === true || String(e.in_cart).toUpperCase() === 'TRUE') {
        if (keep.flags.indexOf('no_longer_needed') < 0) keep.flags.push('no_longer_needed');
        items.push(keep);
      }
    });

    return { items: items, changes: changes };
  }

  // Uncategorized first, then aisle sort_order, then name.
  function sortByAisle(items, aisles) {
    var order = {};
    (aisles || []).forEach(function (a) { order[String(a.name).trim().toLowerCase()] = Number(a.sort_order); });
    function rank(it) {
      var key = String(it.aisle || '').trim().toLowerCase();
      return key && order[key] != null ? order[key] : -1;
    }
    return (items || []).slice().sort(function (a, b) {
      var d = rank(a) - rank(b);
      if (d !== 0) return d;
      return String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : String(a.name).toLowerCase() > String(b.name).toLowerCase() ? 1 : 0;
    });
  }

  function qtyLabel_(it) {
    var q = it.qty == null ? '' : Units_().formatQty(it.qty);
    var u = it.unit && it.unit !== 'each' ? it.unit : '';
    return (q + ' ' + u).trim();
  }

  function groups_(items, aisles, includeHave) {
    var list = sortByAisle(items, aisles).filter(function (i) { return includeHave || !i.have_it; });
    var groups = [];
    var by = {};
    list.forEach(function (i) {
      var name = i.aisle || 'Uncategorized';
      if (!by[name]) { by[name] = { aisle: name, items: [] }; groups.push(by[name]); }
      by[name].items.push(i);
    });
    return groups;
  }

  function formatText(items, aisles, opts) {
    var includeHave = !!(opts && opts.includeHave);
    return groups_(items, aisles, includeHave).map(function (g) {
      var lines = g.items.map(function (i) {
        return ((i.have_it ? '[x] ' : '[ ] ') + (qtyLabel_(i) + ' ' + i.name).trim());
      });
      return '== ' + g.aisle + ' ==\n' + lines.join('\n');
    }).join('\n\n');
  }

  function esc_(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatHtml(items, aisles, opts) {
    var includeHave = !!(opts && opts.includeHave);
    return groups_(items, aisles, includeHave).map(function (g) {
      var lis = g.items.map(function (i) {
        return '<li>' + (i.have_it ? '&#9745; ' : '&#9744; ') + esc_((qtyLabel_(i) + ' ' + i.name).trim()) + '</li>';
      });
      return '<h3>' + esc_(g.aisle) + '</h3><ul style="list-style:none;padding-left:0">' + lis.join('') + '</ul>';
    }).join('');
  }

  return {
    buildList: buildList,
    mergeWithExisting: mergeWithExisting,
    sortByAisle: sortByAisle,
    formatText: formatText,
    formatHtml: formatHtml
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Shopping; }
