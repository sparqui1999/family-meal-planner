// Client-callable functions (api_*). They only read tables, call the pure logic, and write.
// Functions ending in an underscore are private helpers and cannot be called from the page.

// ---------- helpers ----------

function k_(x) { return Ingredients.normalize(x); }

function settings_() { return Scoring.parseSettings(Db.readAll('cfg_settings')); }

function eqName_(a, b) { return k_(a) === k_(b); }

// Dropdown lists are always shown A to Z, ignoring capitals.
function compareNames_(a, b) {
  var x = String(a).toLowerCase();
  var y = String(b).toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

function sortNames_(list) {
  return list.slice().sort(compareNames_);
}

function has_(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// Normalized names of dishes that have at least one recipe line (cached; cleared when recipes change).
function recipeDishes_() {
  return Db.derived('lib_recipe_ingredients', 'has', function () {
    var map = {};
    Db.readAll('lib_recipe_ingredients').forEach(function (l) { map[k_(l.dish)] = true; });
    return map;
  });
}

function findByName_(rows, col, name) {
  var key = k_(name);
  for (var i = 0; i < rows.length; i++) if (k_(rows[i][col]) === key) return rows[i];
  return null;
}

function strip_(row) {
  var out = {};
  Object.keys(row).forEach(function (k) { if (k !== '_row') out[k] = row[k]; });
  return out;
}

function pick_(obj, keys) {
  var out = {};
  keys.forEach(function (k) { if (obj[k] !== undefined) out[k] = obj[k]; });
  return out;
}

function groupBy_(rows, col) {
  var map = {};
  rows.forEach(function (r) { (map[k_(r[col])] = map[k_(r[col])] || []).push(r); });
  return map;
}

function numOrNull_(v) {
  if (v === '' || v == null) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
}

function isActiveStatus_(status) { return status === 'planned' || status === 'cooked'; }

function activePlanSlots_() {
  return Db.readAll('act_meal_plan').filter(function (r) { return isActiveStatus_(r.status); }).map(strip_);
}

function viewCtx_() {
  return {
    dishes: Ingredients.index(Db.readAll('lib_dishes')),
    restaurants: Ingredients.index(Db.readAll('lib_restaurants')),
    hasRecipe: recipeDishes_()
  };
}

function dishView_(name, vc) {
  if (!name) return null;
  var d = vc.dishes[k_(name)];
  return {
    name: d ? d.name : name,
    health: d ? d.healthy_score : null,
    has_recipe: !!vc.hasRecipe[k_(name)],
    servings: d ? d.servings : null,
    status: d ? d.status : ''
  };
}

function slotView_(slot, vc) {
  var out = strip_(slot);
  out.dish_info = dishView_(slot.dish, vc);
  out.sides_info = [slot.side_1, slot.side_2, slot.side_3].filter(Boolean).map(function (n) { return dishView_(n, vc); });
  out.meal_health = Health.scoreMeal(
    out.dish_info ? out.dish_info.health : null,
    out.sides_info.map(function (s) { return s.health; })
  );
  out.restaurant_info = null;
  if (slot.kind === 'restaurant') {
    var r = vc.restaurants[k_(slot.restaurant)];
    out.restaurant_info = {
      name: slot.restaurant,
      cuisine: r ? r.cuisine : '',
      address: r ? r.address : '',
      phone: r ? r.phone : '',
      notes: r ? r.notes : ''
    };
  }
  return out;
}

function defaultServings_(dishRow, s) {
  if (dishRow && Number(dishRow.servings) > 0) return Number(dishRow.servings);
  return Number(s.default_servings) > 0 ? Number(s.default_servings) : 4;
}

function planRowFor_(slot, me) {
  return {
    plan_id: slot.plan_id,
    date: slot.date,
    kind: slot.kind,
    dish: slot.dish || '',
    side_1: slot.side_1 || '',
    side_2: slot.side_2 || '',
    side_3: slot.side_3 || '',
    restaurant: slot.restaurant || '',
    servings: slot.servings === '' || slot.servings == null ? '' : Number(slot.servings),
    status: slot.status || 'planned',
    locked: !!slot.locked,
    notes: slot.notes || '',
    added_by: me.name,
    added_on: today_()
  };
}

function recalcScoreFor_(dishName, t) {
  var lines = t.lines.filter(function (l) { return eqName_(l.dish, dishName); });
  if (!lines.length) return '';
  var dish = findByName_(t.dishes, 'name', dishName);
  return Health.scoreDish(dish, lines, t.ingredientsByName, t.rules, t.settings);
}

function healthTables_() {
  return {
    dishes: Db.readAll('lib_dishes'),
    lines: Db.readAll('lib_recipe_ingredients'),
    ingredientsByName: Ingredients.index(Db.readAll('lib_ingredients')),
    rules: Db.readAll('cfg_health_rules'),
    settings: settings_()
  };
}

function recalcHealth_(dishName) {
  var t = healthTables_();
  var score = recalcScoreFor_(dishName, t);
  Db.update('lib_dishes', 'name', dishName, { healthy_score: score });
  return score;
}

function suggestCtx_(profileOverride) {
  var s = settings_();
  var seasonsBy = groupBy_(Db.readAll('lib_dish_seasons'), 'dish');
  var tagsBy = groupBy_(Db.readAll('lib_dish_tags'), 'dish');
  var dishes = Db.readAll('lib_dishes').map(function (d) {
    return {
      name: d.name, role: d.role, type: d.type, cuisine: d.cuisine, status: d.status, favorite: d.favorite,
      health_score: d.healthy_score, prep_min: d.prep_min, cook_min: d.cook_min,
      tags: (tagsBy[k_(d.name)] || []).map(function (x) { return x.tag; }),
      seasons: (seasonsBy[k_(d.name)] || []).map(function (x) { return x.season; })
    };
  });
  var history = Db.readAll('act_meal_plan').filter(function (r) { return r.status !== 'removed' && r.status !== 'replaced'; }).map(strip_);
  var profile = profileOverride || s.active_profile;
  return {
    settings: s,
    dishes: dishes,
    dishSides: Db.readAll('lib_dish_sides'),
    ratingByDish: Ratings.byItem(Db.readAll('act_dish_ratings'), 'dish'),
    ratingByRestaurant: Ratings.byItem(Db.readAll('act_restaurant_ratings'), 'restaurant'),
    history: history,
    restaurants: Db.readAll('lib_restaurants'),
    visits: Db.readAll('act_restaurant_visits'),
    varietyRules: Db.readAll('cfg_variety_rules'),
    typeWeights: Scoring.typeWeightMap(Db.readAll('cfg_type_weights'), profile),
    profile: profile,
    today: today_()
  };
}

// ---------- start-up and week view ----------

function api_bootstrap() {
  var me = requireMember_();
  var s = settings_();
  var names = function (tab) { return sortNames_(Db.readAll(tab).map(function (r) { return r.name; })); };
  return {
    me: { name: me.name, email: me.email, role: me.role },
    settings: s,
    activeProfile: s.active_profile,
    profiles: names('cfg_profiles'),
    lookups: {
      types: names('lib_dish_types'),
      cuisines: names('lib_cuisines'),
      tags: names('lib_tags'),
      aisles: sortNames_(Db.readAll('cfg_aisles').map(function (a) { return a.name; })).map(function (n) { return { name: n }; }),
      units: sortNames_(Db.readAll('cfg_units').map(function (u) { return u.unit; })),
      members: names('cfg_members'),
      ingredients: names('lib_ingredients'),
      seasons: sortNames_(Schema.SEASONS),
      cookMethods: sortNames_(Schema.tab('lib_dishes').columns[4].enum)
    },
    today: today_()
  };
}

function api_getWeek(startIso, days) {
  requireMember_();
  var s = settings_();
  var n = Number(days) > 0 ? Number(days) : (Number(s.week_view_days) || 8);
  var start = startIso || today_();
  var vc = viewCtx_();
  return PlanOps.visibleWeek(Db.readAll('act_meal_plan').map(strip_), start, n).map(function (slot) { return slotView_(slot, vc); });
}

function api_getPlan(startIso, endIso) {
  requireMember_();
  var vc = viewCtx_();
  var slots = activePlanSlots_().filter(function (sl) { return sl.date >= startIso && sl.date <= endIso; })
    .map(function (sl) { return slotView_(sl, vc); });
  return { slots: slots, queue: api_getQueue() };
}

// ---------- dishes and recipes ----------

function lastCookedMap_() {
  var today = today_();
  var map = {};
  Db.readAll('act_meal_plan').forEach(function (r) {
    if (!isActiveStatus_(r.status) || r.date > today) return;
    [r.dish, r.side_1, r.side_2, r.side_3].forEach(function (n) {
      if (!n) return;
      var key = k_(n);
      if (!map[key] || map[key] < r.date) map[key] = r.date;
    });
  });
  return map;
}

function api_listDishes(filters) {
  requireMember_();
  var f = filters || {};
  var seasonsBy = groupBy_(Db.readAll('lib_dish_seasons'), 'dish');
  var tagsBy = groupBy_(Db.readAll('lib_dish_tags'), 'dish');
  var ratings = Ratings.byItem(Db.readAll('act_dish_ratings'), 'dish');
  var last = lastCookedMap_();
  var hasRecipe = recipeDishes_();
  var q = k_(f.q || '');
  return Db.readAll('lib_dishes').filter(function (d) {
    var st = f.status || 'visible';
    if (st === 'visible' && d.status === 'retired') return false;
    if (st === 'usable' && d.status === 'retired') return false;
    if (st !== 'visible' && st !== 'usable' && st !== 'all' && d.status !== st) return false;
    if (f.role && d.role !== f.role) return false;
    if (q && k_(d.name).indexOf(q) < 0) return false;
    if (f.type && !eqName_(d.type, f.type)) return false;
    if (f.cuisine && !eqName_(d.cuisine, f.cuisine)) return false;
    if (f.favorite && !d.favorite) return false;
    var seasons = (seasonsBy[k_(d.name)] || []).map(function (x) { return x.season; });
    if (f.season && seasons.length && seasons.indexOf(f.season) < 0) return false;
    var r = ratings[k_(d.name)];
    if (f.minRating && !(r && r.avg >= Number(f.minRating))) return false;
    if (f.minHealth && !(d.healthy_score >= Number(f.minHealth))) return false;
    var minutes = (Number(d.prep_min) || 0) + (Number(d.cook_min) || 0);
    if (f.maxMinutes && minutes > Number(f.maxMinutes)) return false;
    return true;
  }).map(function (d) {
    var r = ratings[k_(d.name)];
    return {
      name: d.name, role: d.role, type: d.type, cuisine: d.cuisine, favorite: d.favorite, status: d.status,
      health: d.healthy_score, servings: d.servings,
      minutes: (Number(d.prep_min) || 0) + (Number(d.cook_min) || 0),
      rating: r ? r.avg : null, rating_count: r ? r.count : 0,
      seasons: (seasonsBy[k_(d.name)] || []).map(function (x) { return x.season; }),
      tags: (tagsBy[k_(d.name)] || []).map(function (x) { return x.tag; }),
      last_cooked: last[k_(d.name)] || '',
      has_recipe: !!hasRecipe[k_(d.name)]
    };
  }).sort(function (a, b) { return compareNames_(a.name, b.name); });
}

function api_getDish(name) {
  var me = requireMember_();
  var dish = findByName_(Db.readAll('lib_dishes'), 'name', name);
  if (!dish) throw new Error('Dish not found: ' + name);
  var lines = Db.readAll('lib_recipe_ingredients').filter(function (l) { return eqName_(l.dish, dish.name); })
    .sort(function (a, b) { return a.line_no - b.line_no; }).map(strip_);
  var steps = Db.readAll('lib_recipe_steps').filter(function (l) { return eqName_(l.dish, dish.name); })
    .sort(function (a, b) { return a.step_no - b.step_no; }).map(strip_);
  var ratingRows = Db.readAll('act_dish_ratings').filter(function (r) { return eqName_(r.dish, dish.name); });
  var rating = Ratings.average(ratingRows);
  var mine = ratingRows.filter(function (r) { return eqName_(r.member, me.name); })[0];
  var vc = viewCtx_();
  var history = Db.readAll('act_meal_plan').filter(function (r) {
    return isActiveStatus_(r.status) && [r.dish, r.side_1, r.side_2, r.side_3].some(function (n) { return n && eqName_(n, dish.name); });
  }).map(function (r) { return { date: r.date, status: r.status, kind: r.kind }; })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 20);
  return {
    dish: strip_(dish),
    seasons: Db.readAll('lib_dish_seasons').filter(function (x) { return eqName_(x.dish, dish.name); }).map(function (x) { return x.season; }),
    tags: Db.readAll('lib_dish_tags').filter(function (x) { return eqName_(x.dish, dish.name); }).map(function (x) { return x.tag; }),
    sides: Db.readAll('lib_dish_sides').filter(function (x) { return eqName_(x.main_dish, dish.name); }).map(function (x) {
      var v = dishView_(x.side_dish, vc);
      return { side_dish: x.side_dish, is_default: x.is_default, health: v ? v.health : null };
    }),
    recipe: { ingredients: lines, steps: steps },
    rating: { avg: rating.avg, count: rating.count, mine: mine ? Number(mine.stars) : null },
    comments: Db.readAll('act_dish_comments').filter(function (c) { return eqName_(c.dish, dish.name); }).map(strip_)
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }),
    history: history
  };
}

function checkLookup_(rows, value, label) {
  if (!value) return;
  if (!findByName_(rows, 'name', value)) throw new Error(label + ' "' + value + '" is not in the list.');
}

// Only the fields that are sent are changed, so a partial save never blanks the rest.
function api_saveDish(d) {
  requireMember_();
  return Db.locked(function () { return saveDishLocked_(d); });
}

function saveDishLocked_(d) {
  var me = requireMember_();
  var name = String(d.name || '').trim();
  if (!name) throw new Error('Please enter a dish name.');
  if (has_(d, 'type')) checkLookup_(Db.readAll('lib_dish_types'), d.type, 'Type');
  if (has_(d, 'cuisine')) checkLookup_(Db.readAll('lib_cuisines'), d.cuisine, 'Cuisine');

  var orig = d.original_name ? findByName_(Db.readAll('lib_dishes'), 'name', d.original_name) : null;
  if (orig && orig.name !== name) {
    Db.applyRename('lib_dishes', orig.name, name);
  }
  var existing = findByName_(Db.readAll('lib_dishes'), 'name', name);
  if (!orig && existing) throw new Error('A dish named "' + name + '" already exists.');

  var patch = { name: name };
  if (has_(d, 'role')) patch.role = d.role === 'side' ? 'side' : 'main';
  ['type', 'cuisine', 'cook_method', 'source', 'intro_notes'].forEach(function (k) { if (has_(d, k)) patch[k] = d[k] || ''; });
  ['servings', 'prep_min', 'cook_min'].forEach(function (k) { if (has_(d, k)) patch[k] = numOrNull_(d[k]); });
  if (has_(d, 'favorite')) patch.favorite = !!d.favorite;
  if (d.status) patch.status = d.status;

  if (existing) {
    Db.update('lib_dishes', 'name', name, patch);
  } else {
    patch.role = patch.role || 'main';
    patch.status = patch.status || 'active';
    patch.favorite = !!patch.favorite;
    patch.added_by = me.name;
    patch.added_on = today_();
    Db.append('lib_dishes', patch);
  }
  var saved = findByName_(Db.readAll('lib_dishes'), 'name', name) || { name: name, role: patch.role };
  var finalName = saved.name;

  if (d.seasons) {
    Db.replaceWhere('lib_dish_seasons', 'dish', finalName, d.seasons.map(function (x) { return { dish: finalName, season: x }; }));
  }
  if (d.tags) {
    var tagRows = Db.readAll('lib_tags');
    d.tags.forEach(function (t) { checkLookup_(tagRows, t, 'Tag'); });
    Db.replaceWhere('lib_dish_tags', 'dish', finalName, d.tags.map(function (x) { return { dish: finalName, tag: x }; }));
  }
  if (d.sides && saved.role === 'main') {
    Db.replaceWhere('lib_dish_sides', 'main_dish', finalName, d.sides.filter(function (x) { return x.side_dish; }).map(function (x) {
      return { main_dish: finalName, side_dish: x.side_dish, is_default: !!x.is_default };
    }));
  }
  recalcHealth_(finalName);
  return { name: finalName };
}

function api_saveRecipe(dishName, recipe) {
  requireMember_();
  var dish = findByName_(Db.readAll('lib_dishes'), 'name', dishName);
  if (!dish) throw new Error('Dish not found: ' + dishName);
  var units = Db.readAll('cfg_units');
  var known = Db.readAll('lib_ingredients');
  var created = [];
  var lines = [];
  (recipe.ingredients || []).forEach(function (l) {
    var nm = String(l.ingredient || l.name || '').trim();
    if (!nm) return;
    var ing = Ingredients.match(nm, known.concat(created));
    if (!ing) {
      ing = { name: nm, aisle: '', health_tag: '', default_unit: '', is_staple: false };
      created.push(ing);
    }
    var qtyText = String(l.qty_text == null ? '' : l.qty_text).trim();
    var qty = numOrNull_(l.qty);
    if (qty === null) qty = Units.parseQty(qtyText).qty;
    var unit = l.unit ? (Units.normalizeUnit(l.unit, units) || String(l.unit).trim().toLowerCase()) : '';
    lines.push({
      dish: dish.name, line_no: lines.length + 1, ingredient: ing.name, group_label: l.group_label || '',
      qty_text: qtyText, qty: qty, unit: unit, prep_note: l.prep_note || '', optional: !!l.optional
    });
  });
  var steps = (recipe.steps || []).filter(function (st) { return String(st.text || '').trim(); }).map(function (st, i) {
    return { dish: dish.name, step_no: i + 1, section_label: st.section_label || '', text: String(st.text).trim(), timer_min: numOrNull_(st.timer_min) };
  });
  if (created.length) Db.appendMany('lib_ingredients', created);
  Db.replaceWhere('lib_recipe_ingredients', 'dish', dish.name, lines);
  Db.replaceWhere('lib_recipe_steps', 'dish', dish.name, steps);

  // Only the dish fields that the recipe actually mentions are changed.
  var patch = {};
  ['servings', 'prep_min', 'cook_min'].forEach(function (k) { if (has_(recipe, k)) patch[k] = numOrNull_(recipe[k]); });
  if (has_(recipe, 'intro_notes')) patch.intro_notes = recipe.intro_notes || '';
  if (dish.status === 'idea' && lines.length) patch.status = 'active';
  if (Object.keys(patch).length) Db.update('lib_dishes', 'name', dish.name, patch);
  recalcHealth_(dish.name);
  return { ingredients: lines.length, steps: steps.length, new_ingredients: created.map(function (c) { return c.name; }) };
}

function api_parseRecipeText(text) {
  requireMember_();
  return RecipeParser.parseRecipeText(text, Db.readAll('cfg_units'));
}

function api_retireDish(name) {
  requireMember_();
  Db.update('lib_dishes', 'name', name, { status: 'retired' });
  return true;
}

function api_recalculateHealth() {
  requireMember_();
  var t = healthTables_();
  var changed = 0;
  t.dishes.forEach(function (d) {
    var score = recalcScoreFor_(d.name, t);
    if (String(score) !== String(d.healthy_score == null ? '' : d.healthy_score)) {
      Db.update('lib_dishes', 'name', d.name, { healthy_score: score });
      changed += 1;
    }
  });
  return { changed: changed };
}

// ---------- favorites, ratings, comments, renames ----------

function entityTabs_(entity) {
  if (entity === 'dish') return { master: 'lib_dishes', ratings: 'act_dish_ratings', comments: 'act_dish_comments', field: 'dish' };
  if (entity === 'restaurant') return { master: 'lib_restaurants', ratings: 'act_restaurant_ratings', comments: 'act_restaurant_comments', field: 'restaurant' };
  throw new Error('Unknown item type.');
}

function api_setFavorite(entity, name, value) {
  requireMember_();
  Db.update(entityTabs_(entity).master, 'name', name, { favorite: !!value });
  return true;
}

function api_rate(entity, name, stars) {
  var me = requireMember_();
  var n = Math.round(Number(stars));
  if (!(n >= 1 && n <= 5)) throw new Error('Ratings are 1 to 5 stars.');
  var t = entityTabs_(entity);
  var match = {};
  match[t.field] = name;
  match.member = me.name;
  var updated = Db.updateWhere(t.ratings, match, { stars: String(n), date: today_() });
  if (!updated) {
    var row = { member: me.name, stars: String(n), date: today_() };
    row[t.field] = name;
    Db.append(t.ratings, row);
  }
  return { stars: n };
}

function api_addComment(entity, name, text) {
  var me = requireMember_();
  var t = entityTabs_(entity);
  var body = String(text || '').trim();
  if (!body) throw new Error('Please write a comment first.');
  if (body.length > 1000) throw new Error('Comments are limited to 1000 characters.');
  var row = { member: me.name, text: body, date: today_() };
  row[t.field] = name;
  Db.append(t.comments, row);
  return true;
}

var RENAMEABLE_ = ['lib_dishes', 'lib_restaurants', 'lib_ingredients', 'lib_dish_types', 'lib_cuisines', 'lib_tags', 'cfg_aisles', 'cfg_members', 'cfg_profiles'];

// Names also live inside two saved JSON cells (unsaved plan drafts and "needed for" notes on shopping lines).
function renameInJson_(tab, oldName, newName) {
  var count = 0;
  var slotFields = tab === 'lib_dishes' ? ['dish', 'side_1', 'side_2', 'side_3', 'new_dish_name'] : ['restaurant', 'new_restaurant_name'];
  Db.readAll('act_plan_drafts').forEach(function (row) {
    var slots = row.draft_json && row.draft_json.slots;
    if (!slots) return;
    var changed = false;
    slots.forEach(function (sl) {
      slotFields.forEach(function (f) {
        if (sl[f] && eqName_(sl[f], oldName)) { sl[f] = newName; changed = true; count += 1; }
      });
    });
    if (changed) Db.updateWhere('act_plan_drafts', { member: row.member, week_start: row.week_start }, { draft_json: row.draft_json });
  });
  if (tab === 'lib_dishes') {
    var updates = [];
    Db.readAll('act_shopping_items').forEach(function (it) {
      var sources = Array.isArray(it.source_dishes) ? it.source_dishes : [];
      var changed = false;
      sources.forEach(function (src) { if (src.dish && eqName_(src.dish, oldName)) { src.dish = newName; changed = true; count += 1; } });
      if (changed) updates.push({ key: it.item_id, patch: { source_dishes: sources } });
    });
    Db.updateMany('act_shopping_items', 'item_id', updates);
  }
  return count;
}

function api_renameItem(tab, oldName, newName) {
  requireMember_();
  if (RENAMEABLE_.indexOf(tab) < 0) throw new Error('That kind of item cannot be renamed here.');
  return Db.locked(function () {
    var target = String(newName == null ? '' : newName).trim();
    var count = Db.applyRename(tab, oldName, target);
    if (tab === 'lib_dishes' || tab === 'lib_restaurants') count += renameInJson_(tab, oldName, target);
    if (tab === 'cfg_profiles' && eqName_(settings_().active_profile, oldName)) {
      Db.update('cfg_settings', 'key', 'active_profile', { value: target });
    }
    return { count: count };
  });
}

function api_checkLinks() {
  requireMember_();
  var tables = {};
  Schema.tabs.forEach(function (t) { if (t.group !== 'system') tables[t.tab] = Db.readAll(t.tab); });
  var orphans = References.findOrphans(tables, Schema);
  return { total: orphans.length, items: orphans.slice(0, 100) };
}

// ---------- restaurants ----------

function restaurantStats_() {
  var today = today_();
  var visits = {};
  Db.readAll('act_restaurant_visits').forEach(function (v) { (visits[k_(v.restaurant)] = visits[k_(v.restaurant)] || []).push(v.date); });
  Db.readAll('act_meal_plan').forEach(function (r) {
    if (r.kind === 'restaurant' && isActiveStatus_(r.status) && r.date <= today) {
      (visits[k_(r.restaurant)] = visits[k_(r.restaurant)] || []).push(r.date);
    }
  });
  var out = {};
  Object.keys(visits).forEach(function (key) {
    var uniq = {};
    visits[key].forEach(function (dt) { uniq[dt] = true; });
    var dates = Object.keys(uniq).sort();
    out[key] = { count: dates.length, last: dates[dates.length - 1], dates: dates.reverse() };
  });
  return out;
}

function restaurantSummary_(r, ratings, stats) {
  var rt = ratings[k_(r.name)];
  var st = stats[k_(r.name)];
  return {
    name: r.name, cuisine: r.cuisine, price_level: r.price_level, favorite: r.favorite, status: r.status,
    rating: rt ? rt.avg : null, rating_count: rt ? rt.count : 0,
    last_visit: st ? st.last : '', visit_count: st ? st.count : 0
  };
}

function api_listRestaurants() {
  requireMember_();
  var ratings = Ratings.byItem(Db.readAll('act_restaurant_ratings'), 'restaurant');
  var stats = restaurantStats_();
  return Db.readAll('lib_restaurants').filter(function (r) { return r.status !== 'retired'; })
    .map(function (r) { return restaurantSummary_(r, ratings, stats); })
    .sort(function (a, b) { return compareNames_(a.name, b.name); });
}

function api_getRestaurant(name) {
  var me = requireMember_();
  var r = findByName_(Db.readAll('lib_restaurants'), 'name', name);
  if (!r) throw new Error('Restaurant not found: ' + name);
  var ratingRows = Db.readAll('act_restaurant_ratings').filter(function (x) { return eqName_(x.restaurant, r.name); });
  var rating = Ratings.average(ratingRows);
  var mine = ratingRows.filter(function (x) { return eqName_(x.member, me.name); })[0];
  var st = restaurantStats_()[k_(r.name)];
  return {
    restaurant: strip_(r),
    rating: { avg: rating.avg, count: rating.count, mine: mine ? Number(mine.stars) : null },
    comments: Db.readAll('act_restaurant_comments').filter(function (c) { return eqName_(c.restaurant, r.name); }).map(strip_)
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }),
    visits: st ? st.dates.slice(0, 30) : []
  };
}

function api_saveRestaurant(r) {
  requireMember_();
  return Db.locked(function () { return saveRestaurantLocked_(r); });
}

function saveRestaurantLocked_(r) {
  var name = String(r.name || '').trim();
  if (!name) throw new Error('Please enter a restaurant name.');
  if (has_(r, 'cuisine')) checkLookup_(Db.readAll('lib_cuisines'), r.cuisine, 'Cuisine');
  var orig = r.original_name ? findByName_(Db.readAll('lib_restaurants'), 'name', r.original_name) : null;
  if (orig && orig.name !== name) Db.applyRename('lib_restaurants', orig.name, name);
  var existing = findByName_(Db.readAll('lib_restaurants'), 'name', name);
  if (!orig && existing) throw new Error('A restaurant named "' + name + '" already exists.');

  var patch = { name: name };
  ['cuisine', 'address', 'phone', 'notes'].forEach(function (k) { if (has_(r, k)) patch[k] = r[k] || ''; });
  if (has_(r, 'price_level')) patch.price_level = r.price_level ? String(r.price_level) : '';
  if (has_(r, 'favorite')) patch.favorite = !!r.favorite;
  if (r.status) patch.status = r.status;
  if (existing) {
    Db.update('lib_restaurants', 'name', name, patch);
  } else {
    patch.status = patch.status || 'active';
    patch.favorite = !!patch.favorite;
    Db.append('lib_restaurants', patch);
  }
  return { name: name };
}

function api_suggestRestaurants(date, excludeNames) {
  requireMember_();
  var ctx = suggestCtx_();
  var res = Suggest.suggestRestaurants({ date: date || today_(), excludeNames: excludeNames || [], profile: ctx.profile }, ctx, Math.random);
  var ratings = ctx.ratingByRestaurant;
  var stats = restaurantStats_();
  return {
    exhausted: res.exhausted,
    restaurants: res.restaurants.map(function (p) {
      var r = findByName_(ctx.restaurants, 'name', p.name);
      var sum = restaurantSummary_(r, ratings, stats);
      sum.score = p.score;
      return sum;
    })
  };
}

// ---------- planning: manual picks, moves, eating out ----------

function describeSlot_(slot, ctx) {
  if (slot.kind === 'restaurant') {
    var r = findByName_(ctx.restaurants, 'name', slot.restaurant);
    return { date: slot.date, kind: 'restaurant', type: '', cuisine: r ? r.cuisine : '', tags: [] };
  }
  var d = findByName_(ctx.dishes, 'name', slot.dish);
  return { date: slot.date, kind: 'home', type: d ? d.type : '', cuisine: d ? d.cuisine : '', tags: d ? d.tags : [] };
}

function varietyWarnings_(slot, ctx) {
  var others = ctx.history.filter(function (h) { return h.date !== slot.date; }).map(function (h) { return describeSlot_(h, ctx); });
  var rules = Variety.activeRules(ctx.varietyRules, ctx.profile);
  return Variety.check(others, describeSlot_(slot, ctx), rules, ctx.settings).map(function (v) { return v.message; });
}

// Turns a client slot into a validated slot with real names. Creates new ideas/restaurants unless dryRun.
function resolveSlot_(input, me, s, dryRun) {
  if (!Dates.isValid(input.date)) throw new Error('Pick a valid date.');
  var kind = input.kind === 'restaurant' ? 'restaurant' : 'home';
  var slot = {
    plan_id: input.plan_id, date: input.date, kind: kind, dish: '', side_1: '', side_2: '', side_3: '', restaurant: '',
    servings: input.servings, status: input.status || 'planned', locked: input.locked === undefined ? true : !!input.locked,
    notes: input.notes || ''
  };
  if (kind === 'home') {
    var dishName = String(input.dish || input.new_dish_name || '').trim();
    if (!dishName) throw new Error('Choose a dish.');
    var dishes = Db.readAll('lib_dishes');
    var dish = findByName_(dishes, 'name', dishName);
    if (!dish) {
      if (!input.new_dish_name) throw new Error('"' + dishName + '" is not in the dish list.');
      if (!dryRun) {
        Db.append('lib_dishes', { name: dishName, role: 'main', status: input.new_dish_status || 'idea', favorite: false, added_by: me.name, added_on: today_() });
        dish = findByName_(Db.readAll('lib_dishes'), 'name', dishName);
      }
    }
    slot.dish = dish ? dish.name : dishName;
    ['side_1', 'side_2', 'side_3'].forEach(function (f) {
      var n = String(input[f] || '').trim();
      if (!n) return;
      var sd = findByName_(dishes, 'name', n);
      if (!sd) throw new Error('Side "' + n + '" is not in the dish list.');
      slot[f] = sd.name;
    });
    slot.servings = Number(input.servings) > 0 ? Number(input.servings) : defaultServings_(dish, s);
  } else {
    var restName = String(input.restaurant || input.new_restaurant_name || '').trim();
    if (!restName) throw new Error('Choose a restaurant.');
    var rest = findByName_(Db.readAll('lib_restaurants'), 'name', restName);
    if (!rest) {
      if (!input.new_restaurant_name) throw new Error('"' + restName + '" is not in the restaurant list.');
      if (!dryRun) Db.append('lib_restaurants', { name: restName, cuisine: '', status: 'active', favorite: false });
    }
    slot.restaurant = rest ? rest.name : restName;
    slot.servings = Number(input.servings) > 0 ? Number(input.servings) : (Number(s.default_servings) || 4);
  }
  return slot;
}

var PLAN_FIELDS_ = ['date', 'kind', 'dish', 'side_1', 'side_2', 'side_3', 'restaurant', 'servings', 'status', 'locked', 'notes'];

function sameSlot_(a, b) {
  return PLAN_FIELDS_.every(function (f) { return String(a[f] == null ? '' : a[f]) === String(b[f] == null ? '' : b[f]); });
}

function nextWeekStart_(s) {
  return Dates.addDays(Dates.startOfWeek(today_(), s.first_day_of_week), 7);
}

// Writes whatever PlanOps changed: moved dates, removed rows, new rows, and queued meals.
function persistPlanDiff_(before, result, me, s) {
  var beforeById = {};
  before.forEach(function (b) { beforeById[b.plan_id] = b; });
  var ids = Db.column('act_meal_plan', 'plan_id');
  var fresh = [];
  var updates = [];
  result.plan.forEach(function (a) {
    var b = a.plan_id ? beforeById[a.plan_id] : null;
    if (b) {
      if (a.date !== b.date || a.status !== b.status) updates.push({ key: a.plan_id, patch: { date: a.date, status: a.status } });
    } else {
      var id = Ids.next('P', ids);
      ids.push(id);
      a.plan_id = id;
      fresh.push(planRowFor_(a, me));
    }
  });
  Db.updateMany('act_meal_plan', 'plan_id', updates);
  Db.appendMany('act_meal_plan', fresh);
  var qIds = Db.column('act_queue', 'queue_id');
  var queueRows = [];
  (result.queued || []).forEach(function (q) {
    if (!q.dish) return;
    var id = Ids.next('Q', qIds);
    qIds.push(id);
    queueRows.push({ dish: q.dish, reason: 'moved', target_week: nextWeekStart_(s), status: 'open', added_on: today_(), queue_id: id });
  });
  Db.appendMany('act_queue', queueRows);
}

function api_setSlot(input) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return setSlotLocked_(input); });
}

function setSlotLocked_(input) {
  var me = requireMember_();
  var s = settings_();
  var dry = !!input.dry_run;
  var slot = resolveSlot_(input, me, s, dry);
  var warnings = varietyWarnings_(slot, suggestCtx_());
  if (dry) return { warnings: warnings };

  var target = activePlanSlots_().filter(function (sl) { return sl.date === slot.date; })[0];
  var id;
  if (target) {
    id = target.plan_id;
    var patch = pick_(slot, PLAN_FIELDS_);
    patch.status = target.status;
    Db.update('act_meal_plan', 'plan_id', id, patch);
  } else {
    id = Ids.next('P', Db.column('act_meal_plan', 'plan_id'));
    slot.plan_id = id;
    Db.append('act_meal_plan', planRowFor_(slot, me));
  }
  var saved = Db.readAll('act_meal_plan').filter(function (r) { return r.plan_id === id; })[0];
  return { slot: slotView_(saved, viewCtx_()), warnings: warnings };
}

function api_removeSlot(planId) {
  requireMember_();
  Db.update('act_meal_plan', 'plan_id', planId, { status: 'removed' });
  return true;
}

function api_moveSlot(planId, toDate, ifOccupied) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return moveSlotLocked_(planId, toDate, ifOccupied); });
}

function moveSlotLocked_(planId, toDate, ifOccupied) {
  var me = requireMember_();
  var s = settings_();
  if (!Dates.isValid(toDate)) throw new Error('Pick a valid date.');
  var plan = activePlanSlots_();
  var row = plan.filter(function (p) { return p.plan_id === planId; })[0];
  if (!row) throw new Error('That meal is no longer on the plan.');
  var result = PlanOps.moveToDay(plan, row.date, toDate, { ifOccupied: ifOccupied || 'swap' });
  persistPlanDiff_(plan, result, me, s);
  return { notes: result.notes };
}

function api_swapDays(a, b) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return swapDaysLocked_(a, b); });
}

function swapDaysLocked_(a, b) {
  var me = requireMember_();
  var s = settings_();
  if (!Dates.isValid(a) || !Dates.isValid(b)) throw new Error('Pick valid dates.');
  var plan = activePlanSlots_();
  persistPlanDiff_(plan, { plan: PlanOps.swapDays(plan, a, b), queued: [] }, me, s);
  return true;
}

// restaurantRef: { name } or { new_name, cuisine }
// originalAction: { type: 'move', to, ifOccupied } | { type: 'queue' } | { type: 'delete' }
function api_eatOut(date, restaurantRef, originalAction) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return eatOutLocked_(date, restaurantRef, originalAction); });
}

function eatOutLocked_(date, restaurantRef, originalAction) {
  var me = requireMember_();
  var s = settings_();
  if (!Dates.isValid(date)) throw new Error('Pick a valid date.');
  var ref = restaurantRef || {};
  var name = String(ref.name || ref.new_name || '').trim();
  if (!name) throw new Error('Choose a restaurant.');
  var rest = findByName_(Db.readAll('lib_restaurants'), 'name', name);
  if (!rest) {
    if (!ref.new_name) throw new Error('"' + name + '" is not in the restaurant list.');
    Db.append('lib_restaurants', { name: name, cuisine: ref.cuisine || '', status: 'active', favorite: false });
    rest = { name: name };
  }
  var plan = activePlanSlots_();
  var slot = { restaurant: rest.name, servings: Number(s.default_servings) || 4, notes: ref.notes || '', status: 'planned', locked: true };
  var result = PlanOps.eatOut(plan, date, slot, originalAction);
  persistPlanDiff_(plan, result, me, s);
  return { notes: result.notes, restaurant: rest.name };
}

function api_markCooked(planId) {
  requireMember_();
  var row = Db.readAll('act_meal_plan').filter(function (r) { return r.plan_id === planId; })[0];
  if (!row) throw new Error('That meal is no longer on the plan.');
  Db.update('act_meal_plan', 'plan_id', planId, { status: 'cooked' });
  if (row.kind === 'restaurant') {
    var seen = Db.readAll('act_restaurant_visits').some(function (v) { return eqName_(v.restaurant, row.restaurant) && v.date === row.date; });
    if (!seen) Db.append('act_restaurant_visits', { restaurant: row.restaurant, date: row.date });
  }
  return true;
}

// entry: { date, kind, dish | new_dish_name | restaurant | new_restaurant_name }
function api_logPastMeal(entry) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return logPastMealLocked_(entry); });
}

function logPastMealLocked_(entry) {
  var me = requireMember_();
  var s = settings_();
  if (!Dates.isValid(entry.date)) throw new Error('Pick a valid date.');
  if (entry.date > today_()) throw new Error('Log meals from today or earlier. Use the plan for future days.');
  if (activePlanSlots_().some(function (sl) { return sl.date === entry.date; })) {
    throw new Error('Something is already on the plan for that day.');
  }
  var input = {};
  Object.keys(entry).forEach(function (k) { input[k] = entry[k]; });
  input.status = 'cooked';
  input.locked = true;
  input.new_dish_status = 'active';
  var slot = resolveSlot_(input, me, s, false);
  slot.plan_id = Ids.next('P', Db.column('act_meal_plan', 'plan_id'));
  Db.append('act_meal_plan', planRowFor_(slot, me));
  if (slot.kind === 'restaurant') Db.append('act_restaurant_visits', { restaurant: slot.restaurant, date: slot.date });
  return { plan_id: slot.plan_id };
}

// ---------- suggestions ----------

function api_suggestMeals(openDates, excludeDishes, lockedSlots, windowDates) {
  requireMember_();
  var dates = (openDates || []).filter(function (d) { return Dates.isValid(d); }).slice(0, 31);
  var ctx = suggestCtx_();
  if (windowDates && windowDates.length) {
    var win = {};
    windowDates.forEach(function (d) { win[d] = true; });
    ctx.history = ctx.history.filter(function (h) { return !win[h.date]; });
  }
  var result = Suggest.suggestMeals(
    { openDates: dates, lockedSlots: lockedSlots || [], excludeDishes: excludeDishes || [], profile: ctx.profile },
    ctx, Math.random
  );
  result.suggestions = result.suggestions.map(function (sg) {
    var d = findByName_(ctx.dishes, 'name', sg.dish) || {};
    sg.health = d.health_score == null ? null : d.health_score;
    sg.type = d.type || '';
    sg.minutes = (Number(d.prep_min) || 0) + (Number(d.cook_min) || 0);
    sg.status = d.status || '';
    return sg;
  });
  return result;
}

// ---------- queue, profile, drafts ----------

function api_getQueue() {
  requireMember_();
  return Db.readAll('act_queue').filter(function (q) { return q.status === 'open'; }).map(strip_);
}

function api_queueToDay(queueId, date) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return queueToDayLocked_(queueId, date); });
}

function queueToDayLocked_(queueId, date) {
  var me = requireMember_();
  var s = settings_();
  var q = Db.readAll('act_queue').filter(function (x) { return x.queue_id === queueId; })[0];
  if (!q) throw new Error('That queued meal was not found.');
  if (!Dates.isValid(date)) throw new Error('Pick a valid date.');
  if (activePlanSlots_().some(function (sl) { return sl.date === date; })) throw new Error('Something is already planned on that day.');
  var slot = resolveSlot_({ date: date, kind: 'home', dish: q.dish }, me, s, false);
  slot.plan_id = Ids.next('P', Db.column('act_meal_plan', 'plan_id'));
  Db.append('act_meal_plan', planRowFor_(slot, me));
  Db.update('act_queue', 'queue_id', queueId, { status: 'used' });
  return { plan_id: slot.plan_id };
}

function api_queueRemove(queueId) {
  requireMember_();
  Db.update('act_queue', 'queue_id', queueId, { status: 'removed' });
  return true;
}

function api_setProfile(name) {
  requireMember_();
  if (!findByName_(Db.readAll('cfg_profiles'), 'name', name)) throw new Error('Unknown budget profile: ' + name);
  Db.update('cfg_settings', 'key', 'active_profile', { value: name });
  return { activeProfile: name };
}

function api_savePlan(weekStart, slots, days) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return savePlanLocked_(weekStart, slots, days); });
}

function savePlanLocked_(weekStart, slots, days) {
  var me = requireMember_();
  var s = settings_();
  if (!Dates.isValid(weekStart)) throw new Error('Pick a valid week.');
  var windowDates = Dates.range(weekStart, Number(days) > 0 ? Number(days) : 14);
  var inWin = {};
  windowDates.forEach(function (d) { inWin[d] = true; });

  var seen = {};
  var resolved = (slots || []).map(function (input) {
    if (!inWin[input.date]) throw new Error('A meal falls outside the week being saved (' + input.date + ').');
    if (seen[input.date]) throw new Error('There are two meals on ' + input.date + '.');
    seen[input.date] = true;
    var r = resolveSlot_(input, me, s, false);
    r.plan_id = input.plan_id;
    r.status = input.status === 'cooked' ? 'cooked' : 'planned';
    return r;
  });

  var allRows = Db.readAll('act_meal_plan');
  var byId = {};
  allRows.forEach(function (r) { byId[r.plan_id] = r; });
  var keep = {};
  resolved.forEach(function (r) { if (r.plan_id && byId[r.plan_id]) keep[r.plan_id] = true; });

  var updates = [];
  allRows.forEach(function (e) {
    if (isActiveStatus_(e.status) && inWin[e.date] && !keep[e.plan_id]) {
      updates.push({ key: e.plan_id, patch: { status: 'removed' } });
    }
  });

  var ids = Db.column('act_meal_plan', 'plan_id');
  var fresh = [];
  resolved.forEach(function (r) {
    if (r.plan_id && byId[r.plan_id]) {
      if (!sameSlot_(r, byId[r.plan_id])) updates.push({ key: r.plan_id, patch: pick_(r, PLAN_FIELDS_) });
    } else {
      r.plan_id = Ids.next('P', ids);
      ids.push(r.plan_id);
      fresh.push(planRowFor_(r, me));
    }
  });
  Db.updateMany('act_meal_plan', 'plan_id', updates);
  Db.appendMany('act_meal_plan', fresh);
  Db.deleteWhere('act_plan_drafts', { member: me.name, week_start: weekStart });
  return { saved: resolved.length };
}

function api_getDraft(weekStart) {
  var me = requireMember_();
  var row = Db.readAll('act_plan_drafts').filter(function (r) { return eqName_(r.member, me.name) && r.week_start === weekStart; })[0];
  if (!row || !row.draft_json) return null;
  var draft = row.draft_json;
  var checked = PlanOps.validateDraft(
    draft.slots || [],
    Db.readAll('lib_dishes').map(function (d) { return d.name; }),
    Db.readAll('lib_restaurants').map(function (r) { return r.name; })
  );
  return { slots: checked.slots, meta: draft.meta || {}, dropped: checked.dropped, updated_on: row.updated_on };
}

function api_saveDraft(weekStart, slots, meta) {
  var me = requireMember_();
  if (!Dates.isValid(weekStart)) throw new Error('Pick a valid week.');
  var row = { member: me.name, week_start: weekStart, draft_json: { slots: slots || [], meta: meta || {} }, updated_on: nowStamp_() };
  var changed = Db.updateWhere('act_plan_drafts', { member: me.name, week_start: weekStart }, row);
  if (!changed) Db.append('act_plan_drafts', row);
  return { updated_on: row.updated_on };
}

function api_clearDraft(weekStart) {
  var me = requireMember_();
  Db.deleteWhere('act_plan_drafts', { member: me.name, week_start: weekStart });
  return true;
}

// ---------- shopping ----------

function listItemsFor_(weekStart) {
  return Db.readAll('act_shopping_items').filter(function (i) { return i.week_start === weekStart; });
}

function itemSignature_(items) {
  return items.map(function (i) {
    return [String(i.ingredient || i.name).toLowerCase(), i.unit || '', i.qty == null ? '' : i.qty, i.aisle || '',
      JSON.stringify(i.source_dishes || []), JSON.stringify(Array.isArray(i.flags) ? i.flags : [])].join('|');
  }).sort().join('\n');
}

function api_getShoppingList(weekStart) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return getShoppingListLocked_(weekStart); });
}

function getShoppingListLocked_(weekStart) {
  requireMember_();
  var s = settings_();
  var ws = weekStart || Dates.startOfWeek(today_(), s.shopping_week_start_day);
  if (!Dates.isValid(ws)) throw new Error('Pick a valid week.');
  var end = Dates.addDays(ws, 6);
  var slots = activePlanSlots_().filter(function (sl) { return sl.date >= ws && sl.date <= end; });

  var linesBy = groupBy_(Db.readAll('lib_recipe_ingredients'), 'dish');
  Object.keys(linesBy).forEach(function (key) { linesBy[key].sort(function (a, b) { return a.line_no - b.line_no; }); });
  var ingredientsByName = Ingredients.index(Db.readAll('lib_ingredients'));
  var built = Shopping.buildList(slots, {
    dishesByName: Ingredients.index(Db.readAll('lib_dishes')),
    recipeLinesByDish: linesBy,
    ingredientsByName: ingredientsByName,
    units: Db.readAll('cfg_units'),
    runningLowIngredients: Db.readAll('act_running_low').filter(function (r) { return !r.cleared; }).map(function (r) { return r.ingredient; }),
    defaultServings: s.default_servings
  });

  var existing = listItemsFor_(ws);
  var merged = Shopping.mergeWithExisting(built.items, existing);
  var allIds = Db.column('act_shopping_items', 'item_id');
  var missingId = false;
  merged.items.forEach(function (i) {
    i.week_start = ws;
    if (!i.item_id) {
      i.item_id = Ids.next('I', allIds);
      allIds.push(i.item_id);
      missingId = true;
    }
  });
  if (missingId || itemSignature_(existing) !== itemSignature_(merged.items) || existing.length !== merged.items.length) {
    Db.replaceWhere('act_shopping_items', 'week_start', ws, merged.items);
  }

  var aisles = Db.readAll('cfg_aisles');
  return {
    week_start: ws,
    week_end: end,
    items: Shopping.sortByAisle(merged.items, aisles).map(strip_),
    changes: existing.length ? merged.changes : { added: [], removed: [], changed: [] },
    missingRecipes: built.missingRecipes,
    aisles: sortNames_(aisles.map(function (a) { return a.name; }))
  };
}

function api_setHaveIt(itemId, value) {
  requireMember_();
  Db.update('act_shopping_items', 'item_id', itemId, { have_it: !!value });
  return true;
}

function api_setInCart(itemId, value) {
  requireMember_();
  var item = Db.readAll('act_shopping_items').filter(function (i) { return i.item_id === itemId; })[0];
  if (!item) throw new Error('That item is no longer on the list.');
  Db.update('act_shopping_items', 'item_id', itemId, { in_cart: !!value });
  if (value && item.ingredient) {
    Db.updateWhere('act_running_low', { ingredient: item.ingredient, cleared: false }, { cleared: true });
  }
  return true;
}

function api_addManualItem(weekStart, name, qty, unit, aisle) {
  // Ids are chosen and saved while holding the lock, so two people cannot get the same id.
  requireMember_();
  return Db.locked(function () { return addManualItemLocked_(weekStart, name, qty, unit, aisle); });
}

function addManualItemLocked_(weekStart, name, qty, unit, aisle) {
  requireMember_();
  var nm = String(name || '').trim();
  if (!nm) throw new Error('Please type the item name.');
  if (!Dates.isValid(weekStart)) throw new Error('Pick a valid week.');
  var q = typeof qty === 'string' ? Units.parseQty(qty).qty : numOrNull_(qty);
  var id = Ids.next('I', Db.column('act_shopping_items', 'item_id'));
  Db.append('act_shopping_items', {
    week_start: weekStart, ingredient: '', name: nm, qty: q, unit: unit || '', aisle: aisle || '',
    have_it: false, in_cart: false, source_dishes: [], flags: [], is_manual: true, item_id: id
  });
  return { item_id: id };
}

function api_setItemAisle(itemId, aisle, makeDefault) {
  requireMember_();
  if (aisle) checkLookup_(Db.readAll('cfg_aisles'), aisle, 'Aisle');
  var item = Db.readAll('act_shopping_items').filter(function (i) { return i.item_id === itemId; })[0];
  if (!item) throw new Error('That item is no longer on the list.');
  if (item.ingredient) {
    Db.updateWhere('act_shopping_items', { week_start: item.week_start, ingredient: item.ingredient }, { aisle: aisle || '' });
    if (makeDefault) Db.update('lib_ingredients', 'name', item.ingredient, { aisle: aisle || '' });
  } else {
    Db.update('act_shopping_items', 'item_id', itemId, { aisle: aisle || '' });
  }
  return true;
}

function api_markRunningLow(ingredient) {
  var me = requireMember_();
  var nm = String(ingredient || '').trim();
  if (!nm) throw new Error('Choose an ingredient.');
  var ing = findByName_(Db.readAll('lib_ingredients'), 'name', nm);
  if (!ing) {
    Db.append('lib_ingredients', { name: nm, aisle: '', health_tag: '', default_unit: '', is_staple: false });
    ing = { name: nm };
  }
  var already = Db.readAll('act_running_low').some(function (r) { return !r.cleared && eqName_(r.ingredient, ing.name); });
  if (!already) Db.append('act_running_low', { ingredient: ing.name, member: me.name, date: today_(), cleared: false });
  return { ingredient: ing.name };
}

function listForExport_(weekStart) {
  var ws = weekStart || Dates.startOfWeek(today_(), settings_().shopping_week_start_day);
  return { ws: ws, items: listItemsFor_(ws), aisles: Db.readAll('cfg_aisles') };
}

function api_getListText(weekStart, includeHave) {
  requireMember_();
  var l = listForExport_(weekStart);
  return Shopping.formatText(l.items, l.aisles, { includeHave: !!includeHave });
}

function api_emailList(weekStart, toEmails, includeHave) {
  var me = requireMember_();
  var list = (toEmails || []).map(function (e) { return String(e).trim(); }).filter(Boolean);
  if (!list.length) throw new Error('Type at least one email address.');
  if (list.length > 10) throw new Error('You can email up to 10 people at a time.');
  list.forEach(function (e) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('"' + e + '" does not look like an email address.');
  });
  var l = listForExport_(weekStart);
  var opts = { includeHave: !!includeHave };
  try {
    MailApp.sendEmail({
      to: list.join(','),
      subject: 'Shopping list - week of ' + l.ws,
      body: Shopping.formatText(l.items, l.aisles, opts),
      htmlBody: Shopping.formatHtml(l.items, l.aisles, opts)
    });
  } catch (e) {
    if (/quota|limit|too many times/i.test(String(e.message))) throw new Error('The daily email limit has been reached. Try again tomorrow, or use Copy text.');
    throw new Error('The email could not be sent: ' + e.message);
  }
  return { sent: list.length, from: me.email };
}
