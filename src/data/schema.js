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
