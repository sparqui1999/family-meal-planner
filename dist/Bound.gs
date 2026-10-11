// ===== src/data/schema.js =====
// The spreadsheet design: one Google Sheet, many prefixed tabs. Names are the keys.
// Column options: key (unique name column), ref (tab whose names this column holds),
// list (sys_lists dropdown source), enum (fixed choices), internal (app-only id, last column),
// protect (warn before hand edits; the app writes this column).
var Schema = (function () {
  'use strict';

  var COLORS = { library: '#4285f4', activity: '#34a853', config: '#fa7b17', system: '#9e9e9e' };
  var SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'];
  var HEALTH_TAGS = ['leafy_veg', 'vegetable', 'fruit', 'legume', 'whole_grain', 'fish', 'lean_protein', 'neutral',
    'refined_carb', 'dairy_rich', 'red_meat', 'processed_meat', 'fried', 'added_sugar'];
  var COOK_METHODS = ['grilled', 'baked', 'roasted', 'steamed', 'boiled', 'sauteed', 'fried', 'slow-cooked', 'raw'];

  function c(name, type, desc, opts) {
    var col = { name: name, type: type, desc: desc || '' };
    if (opts) Object.keys(opts).forEach(function (k) { col[k] = opts[k]; });
    return col;
  }
  function str(n, d, o) { return c(n, 'string', d, o); }
  function num(n, d, o) { return c(n, 'number', d, o); }
  function bool(n, d, o) { return c(n, 'boolean', d, o); }
  function date(n, d, o) { return c(n, 'date', d, o); }
  function json(n, d, o) { return c(n, 'json', d, o); }
  function tab(name, group, desc, columns) { return { tab: name, group: group, color: COLORS[group], desc: desc, columns: columns }; }

  var tabs = [
    // ---- Config ----
    tab('cfg_members', 'config', 'Who can use the app. Add family members here, then share the sheet with them.', [
      str('name', 'Name shown in the app', { key: true }),
      str('email', 'Google account email'),
      str('role', 'admin or member', { enum: ['admin', 'member'] })
    ]),
    tab('cfg_profiles', 'config', 'Budget profiles (Normal, Tight budget, ...). The active one is set in the app.', [
      str('name', 'Profile name', { key: true })
    ]),
    tab('cfg_aisles', 'config', 'Store aisles in walking order. sort_order controls the shopping list order.', [
      str('name', 'Aisle name', { key: true }),
      str('store', 'Store name'),
      num('sort_order', 'Lower numbers come first')
    ]),
    tab('cfg_health_rules', 'config', 'Points that drive the automatic healthy score.', [
      str('kind', 'ingredient or method', { enum: ['ingredient', 'method'] }),
      str('key', 'Health tag or cooking method'),
      num('points', 'Positive = healthier, negative = less healthy')
    ]),
    tab('cfg_settings', 'config', 'App settings. Change the value column.', [
      str('key', 'Setting name', { key: true }),
      str('value', 'Setting value')
    ]),
    tab('cfg_units', 'config', 'Units and how they convert. Count units never convert into each other.', [
      str('unit', 'Standard unit', { key: true }),
      str('family', 'volume, weight or count', { enum: ['volume', 'weight', 'count'] }),
      num('to_base', 'Size in the base unit (tsp, g, each)'),
      str('aliases', 'Other spellings, comma separated')
    ]),
    tab('cfg_variety_rules', 'config', 'Limits that keep the week varied. Untick active to switch a rule off.', [
      str('rule', 'A readable label', { key: true }),
      bool('active', 'Rule is on'),
      str('profile', 'Only for this budget profile (blank = always)', { ref: 'cfg_profiles' }),
      str('match_by', 'What the rule looks at', { enum: ['type', 'cuisine', 'tag'] }),
      str('match_value', 'A type, cuisine or tag name, or * for each one separately', { list: 'match_values' }),
      num('limit', 'Maximum per week (blank = no limit)'),
      bool('consecutive', 'Not on back-to-back days'),
      str('days', 'Which days the rule counts', { enum: ['all', 'weekdays', 'weekends'] }),
      str('applies_to', 'Home dinners, restaurants or both', { enum: ['home', 'restaurant', 'both'] }),
      str('note', 'Why the rule exists')
    ]),
    tab('cfg_type_weights', 'config', 'Makes a dish type more or less likely to be suggested in a budget profile.', [
      str('profile', 'Budget profile', { ref: 'cfg_profiles' }),
      str('type', 'Dish type', { ref: 'lib_dish_types' }),
      num('multiplier', '1 = normal, 0.5 = half as likely, 2 = twice as likely')
    ]),

    // ---- Library ----
    tab('lib_dishes', 'library', 'Every main dish and side dish.', [
      str('name', 'Dish name (unique)', { key: true }),
      str('role', 'main or side', { enum: ['main', 'side'] }),
      str('type', 'Dish type', { ref: 'lib_dish_types' }),
      str('cuisine', 'Cuisine', { ref: 'lib_cuisines' }),
      str('cook_method', 'How it is cooked (affects the healthy score)', { enum: COOK_METHODS }),
      num('servings', 'People the recipe feeds'),
      num('prep_min', 'Prep minutes'),
      num('cook_min', 'Cook minutes'),
      str('source', 'Where the recipe came from'),
      str('intro_notes', 'Tips shown with the recipe'),
      num('healthy_score', 'Set automatically (1-10). Do not edit.', { protect: true }),
      bool('favorite', 'Family favorite'),
      str('status', 'idea, active or retired', { enum: ['idea', 'active', 'retired'] }),
      str('added_by', 'Who added it', { ref: 'cfg_members' }),
      date('added_on', 'Date added')
    ]),
    tab('lib_dish_types', 'library', 'Dish types: Pasta, Chicken, Beef, ...', [
      str('name', 'Type name', { key: true }), num('sort', 'Display order')
    ]),
    tab('lib_cuisines', 'library', 'Cuisines, used for dishes and restaurants.', [
      str('name', 'Cuisine name', { key: true })
    ]),
    tab('lib_tags', 'library', 'Free-form labels: Quick, Grill, Crockpot, Kid-friendly, ...', [
      str('name', 'Tag name', { key: true })
    ]),
    tab('lib_dish_seasons', 'library', 'Seasons a dish suits. A dish with no rows suits all year.', [
      str('dish', 'Dish', { ref: 'lib_dishes', list: 'all_dishes' }),
      str('season', 'Season', { enum: SEASONS })
    ]),
    tab('lib_dish_tags', 'library', 'Tags on each dish.', [
      str('dish', 'Dish', { ref: 'lib_dishes', list: 'all_dishes' }),
      str('tag', 'Tag', { ref: 'lib_tags' })
    ]),
    tab('lib_dish_sides', 'library', 'Which sides go with which main dish.', [
      str('main_dish', 'Main dish', { ref: 'lib_dishes', list: 'main_dishes' }),
      str('side_dish', 'Side dish', { ref: 'lib_dishes', list: 'side_dishes' }),
      bool('is_default', 'Suggested automatically with this main')
    ]),
    tab('lib_ingredients', 'library', 'Every ingredient, its store aisle and health tag.', [
      str('name', 'Ingredient name (unique)', { key: true }),
      str('aisle', 'Store aisle', { ref: 'cfg_aisles' }),
      str('health_tag', 'Health tag', { enum: HEALTH_TAGS }),
      str('default_unit', 'Usual unit', { ref: 'cfg_units' }),
      bool('is_staple', 'Usually already in the house')
    ]),
    tab('lib_recipe_ingredients', 'library', 'The ingredient lines of each recipe.', [
      str('dish', 'Dish', { ref: 'lib_dishes', list: 'all_dishes' }),
      num('line_no', 'Order in the recipe'),
      str('ingredient', 'Ingredient', { ref: 'lib_ingredients' }),
      str('group_label', 'Group heading, e.g. For the sauce'),
      str('qty_text', 'Quantity as written, e.g. 1½'),
      num('qty', 'Quantity as a number (used for scaling)'),
      str('unit', 'Unit', { ref: 'cfg_units' }),
      str('prep_note', 'e.g. chopped, sifted'),
      bool('optional', 'Optional ingredient')
    ]),
    tab('lib_recipe_steps', 'library', 'The cooking steps of each recipe.', [
      str('dish', 'Dish', { ref: 'lib_dishes', list: 'all_dishes' }),
      num('step_no', 'Step number'),
      str('section_label', 'Section heading'),
      str('text', 'The step'),
      num('timer_min', 'Timer minutes (blank = none)')
    ]),
    tab('lib_restaurants', 'library', 'Restaurants you eat at.', [
      str('name', 'Restaurant name (unique)', { key: true }),
      str('cuisine', 'Cuisine', { ref: 'lib_cuisines' }),
      str('price_level', '1 (cheap) to 4 (expensive)', { enum: ['1', '2', '3', '4'] }),
      str('address', 'Address'),
      str('phone', 'Phone'),
      str('notes', 'e.g. order the carne asada'),
      bool('favorite', 'Family favorite'),
      str('status', 'active or retired', { enum: ['active', 'retired'] })
    ]),

    // ---- Activity ----
    tab('act_meal_plan', 'activity', 'One row per planned (or past) dinner. The grey plan_id column is for the app.', [
      date('date', 'Date'),
      str('kind', 'home or restaurant', { enum: ['home', 'restaurant'] }),
      str('dish', 'Main dish', { ref: 'lib_dishes', list: 'main_dishes' }),
      str('side_1', 'Side dish', { ref: 'lib_dishes', list: 'side_dishes' }),
      str('side_2', 'Side dish', { ref: 'lib_dishes', list: 'side_dishes' }),
      str('side_3', 'Side dish', { ref: 'lib_dishes', list: 'side_dishes' }),
      str('restaurant', 'Restaurant', { ref: 'lib_restaurants', list: 'active_restaurants' }),
      num('servings', 'People being fed'),
      str('status', 'planned, cooked, replaced or removed', { enum: ['planned', 'cooked', 'replaced', 'removed'] }),
      bool('locked', 'Kept by hand (Suggest will not change it)'),
      str('notes', 'Notes'),
      str('added_by', 'Who added it', { ref: 'cfg_members' }),
      date('added_on', 'Date added'),
      str('plan_id', 'Internal id. Do not edit.', { internal: true })
    ]),
    tab('act_queue', 'activity', 'Meals set aside for later.', [
      str('dish', 'Dish', { ref: 'lib_dishes', list: 'main_dishes' }),
      str('reason', 'moved or idea', { enum: ['moved', 'idea'] }),
      date('target_week', 'Week it should come back'),
      str('status', 'open, used or removed', { enum: ['open', 'used', 'removed'] }),
      date('added_on', 'Date added'),
      str('queue_id', 'Internal id. Do not edit.', { internal: true })
    ]),
    tab('act_dish_ratings', 'activity', 'Star ratings of dishes, one per person.', [
      str('dish', 'Dish', { ref: 'lib_dishes', list: 'all_dishes' }),
      str('member', 'Who rated', { ref: 'cfg_members' }),
      str('stars', '1 to 5', { enum: ['1', '2', '3', '4', '5'] }),
      date('date', 'Date')
    ]),
    tab('act_restaurant_ratings', 'activity', 'Star ratings of restaurants, one per person.', [
      str('restaurant', 'Restaurant', { ref: 'lib_restaurants' }),
      str('member', 'Who rated', { ref: 'cfg_members' }),
      str('stars', '1 to 5', { enum: ['1', '2', '3', '4', '5'] }),
      date('date', 'Date')
    ]),
    tab('act_dish_comments', 'activity', 'Comments on dishes.', [
      str('dish', 'Dish', { ref: 'lib_dishes', list: 'all_dishes' }),
      str('member', 'Who wrote it', { ref: 'cfg_members' }),
      str('text', 'Comment'),
      date('date', 'Date')
    ]),
    tab('act_restaurant_comments', 'activity', 'Comments on restaurants.', [
      str('restaurant', 'Restaurant', { ref: 'lib_restaurants' }),
      str('member', 'Who wrote it', { ref: 'cfg_members' }),
      str('text', 'Comment'),
      date('date', 'Date')
    ]),
    tab('act_restaurant_visits', 'activity', 'Every time you ate at a restaurant.', [
      str('restaurant', 'Restaurant', { ref: 'lib_restaurants' }),
      date('date', 'Date')
    ]),
    tab('act_shopping_items', 'activity', 'Shopping list lines. A list is all lines with the same week_start.', [
      date('week_start', 'First day of the shopping week'),
      str('ingredient', 'Ingredient (blank for items typed by hand)', { ref: 'lib_ingredients' }),
      str('name', 'Name shown on the list'),
      num('qty', 'Quantity'),
      str('unit', 'Unit', { ref: 'cfg_units' }),
      str('aisle', 'Store aisle', { ref: 'cfg_aisles' }),
      bool('have_it', 'Already have it at home'),
      bool('in_cart', 'Picked up in the store'),
      json('source_dishes', 'Dishes that need this item'),
      json('flags', 'Notes such as running_low'),
      bool('is_manual', 'Typed in by hand'),
      str('item_id', 'Internal id. Do not edit.', { internal: true })
    ]),
    tab('act_running_low', 'activity', 'Ingredients marked as running low until bought.', [
      str('ingredient', 'Ingredient', { ref: 'lib_ingredients' }),
      str('member', 'Who marked it', { ref: 'cfg_members' }),
      date('date', 'Date'),
      bool('cleared', 'Bought')
    ]),
    tab('act_plan_drafts', 'activity', 'Unsaved plan drafts, one per person per week. Safe to delete.', [
      str('member', 'Whose draft', { ref: 'cfg_members' }),
      date('week_start', 'First day of the planned week'),
      json('draft_json', 'The draft'),
      str('updated_on', 'Last saved')
    ]),

    // ---- System ----
    tab('sys_lists', 'system', 'Hidden dropdown lists built by formulas. Do not edit.', [])
  ];

  function tabDef(name) {
    for (var i = 0; i < tabs.length; i++) if (tabs[i].tab === name) return tabs[i];
    return null;
  }

  function keyColumn(name) {
    var t = tabDef(name);
    if (!t) return null;
    for (var i = 0; i < t.columns.length; i++) if (t.columns[i].key) return t.columns[i].name;
    return null;
  }

  // 0 -> 'A', 25 -> 'Z', 26 -> 'AA'
  function letter(index) {
    var n = index + 1;
    var s = '';
    while (n > 0) {
      var rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function columnIndex(tabName, columnName) {
    var t = tabDef(tabName);
    if (!t) return -1;
    for (var i = 0; i < t.columns.length; i++) if (t.columns[i].name === columnName) return i;
    return -1;
  }

  return {
    tabs: tabs,
    COLORS: COLORS,
    SEASONS: SEASONS,
    HEALTH_TAGS: HEALTH_TAGS,
    tab: tabDef,
    keyColumn: keyColumn,
    columnIndex: columnIndex,
    letter: letter
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Schema; }

// ===== src/logic/references.js =====
// Name-reference integrity: rename cascades, orphan detection, duplicate names.
// Used by BOTH the web app and the sheet-bound script.
// `tables` = { tabName: [rowObject, ...] }; `schema` = Schema (has .tabs).
var References = (function () {
  'use strict';

  function eq_(a, b) {
    return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
  }

  function tabDef_(schema, tab) {
    for (var i = 0; i < schema.tabs.length; i++) {
      if (schema.tabs[i].tab === tab) return schema.tabs[i];
    }
    return null;
  }

  function keyColumn_(schema, tab) {
    var def = tabDef_(schema, tab);
    if (!def) return null;
    for (var i = 0; i < def.columns.length; i++) {
      if (def.columns[i].key) return def.columns[i].name;
    }
    return null;
  }

  // Every column (in any tab) whose values are names from `tab`.
  function referencingColumns(schema, tab) {
    var out = [];
    schema.tabs.forEach(function (t) {
      t.columns.forEach(function (c) {
        if (c.ref === tab) out.push({ tab: t.tab, column: c.name });
      });
    });
    return out;
  }

  // Returns { tables: newTables, count } with oldName replaced by newName in the key cell
  // and in every referencing column. Throws if newName already belongs to another row.
  function applyRename(tables, schema, tab, oldName, newName) {
    var keyCol = keyColumn_(schema, tab);
    if (!keyCol) throw new Error('Tab ' + tab + ' has no name column');
    var target = String(newName == null ? '' : newName).trim();
    if (!target) throw new Error('The new name cannot be empty');
    var rows = tables[tab] || [];
    var found = false;
    rows.forEach(function (r) {
      if (eq_(r[keyCol], oldName)) found = true;
      else if (eq_(r[keyCol], target)) throw new Error('"' + target + '" already exists');
    });
    if (!found) throw new Error('"' + oldName + '" was not found');

    var out = {};
    Object.keys(tables).forEach(function (t) { out[t] = tables[t]; });
    var count = 0;

    function replaceIn(tabName, column) {
      var list = out[tabName];
      if (!list) return;
      out[tabName] = list.map(function (r) {
        if (!eq_(r[column], oldName)) return r;
        var copy = {};
        Object.keys(r).forEach(function (k) { copy[k] = r[k]; });
        copy[column] = target;
        count += 1;
        return copy;
      });
    }

    replaceIn(tab, keyCol);
    referencingColumns(schema, tab).forEach(function (rc) { replaceIn(rc.tab, rc.column); });
    return { tables: out, count: count };
  }

  // Non-blank reference values that match no row of the referenced tab.
  // `row` is the sheet row number (header = row 1); uses row._row when the caller supplies it.
  function findOrphans(tables, schema) {
    var orphans = [];
    schema.tabs.forEach(function (t) {
      if (t.group === 'system') return;
      var rows = tables[t.tab] || [];
      t.columns.forEach(function (c) {
        if (!c.ref || c.internal || c.enum) return;
        var keyCol = keyColumn_(schema, c.ref);
        if (!keyCol) return;
        var valid = {};
        (tables[c.ref] || []).forEach(function (r) { valid[String(r[keyCol]).trim().toLowerCase()] = true; });
        rows.forEach(function (r, i) {
          var v = r[c.name];
          if (v == null || String(v).trim() === '') return;
          if (!valid[String(v).trim().toLowerCase()]) {
            orphans.push({ tab: t.tab, row: r._row || i + 2, column: c.name, value: v });
          }
        });
      });
    });
    return orphans;
  }

  function isDuplicateName(rows, nameColumn, name, exceptRowIndex) {
    for (var i = 0; i < rows.length; i++) {
      if (i === exceptRowIndex) continue;
      if (eq_(rows[i][nameColumn], name)) return true;
    }
    return false;
  }

  return {
    referencingColumns: referencingColumns,
    applyRename: applyRename,
    findOrphans: findOrphans,
    isDuplicateName: isDuplicateName
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = References; }

// ===== src/bound/bound.js =====
// Script bound to the planner spreadsheet (Extensions > Apps Script).
// Gives the sheet a "Meal Planner" menu, keeps links intact when names are edited by hand,
// and backs the sheet up on demand. Only the spreadsheet owner can run the backup.
// Uses the globals Schema and References (included above this file in dist/Bound.gs).

var BACKUP_FOLDER = 'Meal Planner Backups';
var BACKUP_PREFIX = 'Meal Planner backup ';
var BACKUP_KEEP = 8;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Meal Planner')
    .addItem('Back up now', 'backupNow')
    .addItem('Check links', 'checkLinks')
    .addToUi();
}

function toast_(message, seconds) {
  SpreadsheetApp.getActive().toast(message, 'Meal Planner', seconds || 6);
}

function sameName_(a, b) {
  return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
}

function headerIndex_(sheet, name) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol) return -1;
  var head = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return head.indexOf(name);
}

// Replaces oldName with newName in every column that refers to `tab`. Returns the number of cells changed.
function cascadeRename_(tab, oldName, newName) {
  var ss = SpreadsheetApp.getActive();
  var total = 0;
  References.referencingColumns(Schema, tab).forEach(function (rc) {
    var sheet = ss.getSheetByName(rc.tab);
    if (!sheet || sheet.getLastRow() < 2) return;
    var idx = headerIndex_(sheet, rc.column);
    if (idx < 0) return;
    var range = sheet.getRange(2, idx + 1, sheet.getLastRow() - 1, 1);
    var count = 0;
    var out = range.getValues().map(function (r) {
      if (sameName_(r[0], oldName)) { count += 1; return [newName]; }
      return r;
    });
    if (count) { range.setValues(out); total += count; }
  });
  if (tab === 'cfg_profiles') {
    var settings = ss.getSheetByName('cfg_settings');
    if (settings && settings.getLastRow() >= 2) {
      var kIdx = headerIndex_(settings, 'key');
      var vIdx = headerIndex_(settings, 'value');
      var rows = settings.getRange(2, 1, settings.getLastRow() - 1, settings.getLastColumn()).getValues();
      rows.forEach(function (r, i) {
        if (r[kIdx] === 'active_profile' && sameName_(r[vIdx], oldName)) {
          settings.getRange(i + 2, vIdx + 1).setValue(newName);
          total += 1;
        }
      });
    }
  }
  return total;
}

// Simple trigger: fires when a person edits the sheet by hand.
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var def = Schema.tab(sheet.getName());
    if (!def || def.group === 'system') return;
    var firstRow = e.range.getRow();
    if (firstRow + e.range.getNumRows() - 1 < 2) return;

    var keyName = Schema.keyColumn(def.tab);
    if (!keyName) return;
    var keyCol = headerIndex_(sheet, keyName) + 1;
    if (keyCol < 1) return;
    var c1 = e.range.getColumn();
    var c2 = c1 + e.range.getNumColumns() - 1;
    if (keyCol < c1 || keyCol > c2) return;

    if (e.range.getNumRows() > 1 || e.range.getNumColumns() > 1) {
      toast_('Several names were changed at once, so links were not updated. Run Meal Planner > Check links.', 10);
      return;
    }
    var oldName = e.oldValue;
    var newName = String(e.value == null ? '' : e.value).trim();
    if (oldName === undefined || oldName === '') return; // a brand-new name has nothing pointing at it
    if (newName === '') {
      toast_('A name was deleted. Anything that used it now has a broken link. Run Meal Planner > Check links.', 10);
      return;
    }
    if (sameName_(oldName, newName) && String(oldName) === newName) return;

    var names = sheet.getRange(2, keyCol, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    var dupes = names.filter(function (r) { return sameName_(r[0], newName); }).length;
    if (dupes > 1) {
      e.range.setValue(oldName);
      toast_('"' + newName + '" already exists, so the name was changed back to "' + oldName + '".', 8);
      return;
    }
    var count = cascadeRename_(def.tab, String(oldName), newName);
    toast_('Renamed "' + oldName + '" to "' + newName + '" in ' + count + ' place' + (count === 1 ? '' : 's') + '.');
  } catch (err) {
    try { toast_('Could not update links: ' + err.message, 10); } catch (ignore) { /* nothing more to do */ }
  }
}

function readTable_(tab) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(tab);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var head = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    var blank = true;
    head.forEach(function (h, j) {
      if (h === '') return;
      row[h] = values[i][j];
      if (values[i][j] !== '' && values[i][j] !== false) blank = false;
    });
    if (blank) continue;
    row._row = i + 1;
    rows.push(row);
  }
  return rows;
}

function checkLinks() {
  var ui = SpreadsheetApp.getUi();
  var tables = {};
  Schema.tabs.forEach(function (t) { if (t.group !== 'system') tables[t.tab] = readTable_(t.tab); });
  var orphans = References.findOrphans(tables, Schema);
  if (!orphans.length) {
    ui.alert('Check links', 'All links are good. Nothing points at a name that does not exist.', ui.ButtonSet.OK);
    return;
  }
  var lines = orphans.slice(0, 20).map(function (o) { return o.tab + ', row ' + o.row + ', ' + o.column + ': "' + o.value + '"'; });
  var more = orphans.length > 20 ? '\n...and ' + (orphans.length - 20) + ' more.' : '';
  ui.alert('Check links', orphans.length + ' link(s) point at a name that no longer exists:\n\n' + lines.join('\n') + more +
    '\n\nFix each one by choosing a name from the dropdown, or by adding the missing item.', ui.ButtonSet.OK);
}

function backupNow() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive();
  var file = DriveApp.getFileById(ss.getId());
  var owner = file.getOwner();
  var me = Session.getActiveUser().getEmail();
  if (!owner || String(owner.getEmail()).toLowerCase() !== String(me).toLowerCase()) {
    ui.alert('Back up now', 'Only the owner of this spreadsheet can run a backup.', ui.ButtonSet.OK);
    return;
  }
  var folders = DriveApp.getFoldersByName(BACKUP_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER);
  var stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH-mm');
  file.makeCopy(BACKUP_PREFIX + stamp, folder);

  var backups = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(BACKUP_PREFIX) === 0) backups.push(f);
  }
  backups.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  backups.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });

  ui.alert('Back up now', 'Saved "' + BACKUP_PREFIX + stamp + '" in the Drive folder "' + BACKUP_FOLDER +
    '". The newest ' + BACKUP_KEEP + ' backups are kept.', ui.ButtonSet.OK);
}
