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

// ===== src/data/seed.js =====
// Starter data loaded once by setupAll(). Everything here can be edited in the sheet afterwards.
var Seed = (function () {
  'use strict';

  var AISLE = {
    PR: 'Produce', MS: 'Meat & Seafood', DL: 'Deli', BK: 'Bakery', DA: 'Dairy & Eggs', FZ: 'Frozen',
    PG: 'Pasta & Grains', CJ: 'Canned & Jarred', CS: 'Condiments & Sauces', BA: 'Baking', SP: 'Spices',
    IN: 'International', SN: 'Snacks', BV: 'Beverages', HH: 'Household', OT: 'Other'
  };
  var TAG = {
    lv: 'leafy_veg', ve: 'vegetable', fr: 'fruit', le: 'legume', wg: 'whole_grain', fi: 'fish', lp: 'lean_protein',
    ne: 'neutral', rc: 'refined_carb', dr: 'dairy_rich', rm: 'red_meat', pm: 'processed_meat', fd: 'fried', as: 'added_sugar'
  };

  // name|aisle|tag|staple(1)
  var INGREDIENTS = [
    'spinach|PR|lv', 'kale|PR|lv', 'romaine lettuce|PR|lv', 'mixed greens|PR|lv', 'arugula|PR|lv', 'cabbage|PR|ve',
    'broccoli|PR|ve', 'cauliflower|PR|ve', 'carrot|PR|ve', 'celery|PR|ve', 'onion|PR|ve', 'red onion|PR|ve',
    'green onion|PR|ve', 'garlic|PR|ve', 'bell pepper|PR|ve', 'jalapeno|PR|ve', 'tomato|PR|ve', 'cherry tomatoes|PR|ve',
    'cucumber|PR|ve', 'zucchini|PR|ve', 'yellow squash|PR|ve', 'mushrooms|PR|ve', 'potato|PR|ne', 'sweet potato|PR|ve',
    'corn|PR|ve', 'green beans|PR|ve', 'asparagus|PR|ve', 'eggplant|PR|ve', 'butternut squash|PR|ve',
    'brussels sprouts|PR|ve', 'bok choy|PR|lv', 'shallot|PR|ve', 'ginger|PR|ve', 'avocado|PR|fr', 'lemon|PR|fr',
    'lime|PR|fr', 'apple|PR|fr', 'banana|PR|fr', 'orange|PR|fr', 'strawberries|PR|fr', 'blueberries|PR|fr',
    'grapes|PR|fr', 'cilantro|PR|lv', 'parsley|PR|lv', 'basil|PR|lv',
    'chicken breast|MS|lp', 'chicken thighs|MS|lp', 'whole chicken|MS|lp', 'ground turkey|MS|lp', 'ground beef|MS|rm',
    'beef steak|MS|rm', 'beef roast|MS|rm', 'stew meat|MS|rm', 'pork chops|MS|rm', 'pork tenderloin|MS|lp',
    'pork roast|MS|rm', 'bacon|MS|pm', 'sausage|MS|pm', 'italian sausage|MS|pm', 'ham|MS|pm', 'hot dogs|MS|pm',
    'salmon|MS|fi', 'shrimp|MS|fi', 'white fish fillets|MS|fi', 'tilapia|MS|fi', 'tuna steak|MS|fi',
    'pepperoni|DL|pm', 'deli turkey|DL|lp',
    'hamburger buns|BK|rc', 'hot dog buns|BK|rc', 'tortillas|BK|rc', 'whole wheat tortillas|BK|wg', 'bread|BK|rc',
    'whole wheat bread|BK|wg', 'naan|BK|rc', 'pita bread|BK|rc', 'french bread|BK|rc',
    'milk|DA|ne', 'heavy cream|DA|dr', 'half and half|DA|dr', 'butter|DA|dr|1', 'eggs|DA|lp', 'cheddar cheese|DA|dr',
    'mozzarella cheese|DA|dr', 'parmesan cheese|DA|dr', 'feta cheese|DA|dr', 'cream cheese|DA|dr', 'sour cream|DA|dr',
    'greek yogurt|DA|lp', 'yogurt|DA|ne', 'cottage cheese|DA|lp', 'shredded cheese|DA|dr', 'ricotta cheese|DA|dr',
    'frozen peas|FZ|ve', 'frozen corn|FZ|ve', 'frozen broccoli|FZ|ve', 'frozen mixed vegetables|FZ|ve',
    'frozen shrimp|FZ|fi', 'french fries|FZ|fd', 'ice cream|FZ|as', 'frozen pizza|FZ|rc', 'frozen spinach|FZ|lv',
    'spaghetti|PG|rc', 'penne|PG|rc', 'macaroni|PG|rc', 'whole wheat pasta|PG|wg', 'lasagna noodles|PG|rc',
    'rice|PG|rc', 'brown rice|PG|wg', 'quinoa|PG|wg', 'couscous|PG|rc', 'egg noodles|PG|rc', 'oats|PG|wg',
    'breadcrumbs|PG|rc',
    'diced tomatoes|CJ|ve', 'tomato sauce|CJ|ve', 'tomato paste|CJ|ve', 'marinara sauce|CJ|ve', 'chicken broth|CJ|ne',
    'beef broth|CJ|ne', 'vegetable broth|CJ|ne', 'black beans|CJ|le', 'kidney beans|CJ|le', 'chickpeas|CJ|le',
    'pinto beans|CJ|le', 'refried beans|CJ|le', 'coconut milk|CJ|dr', 'canned tuna|CJ|fi', 'green chiles|CJ|ve',
    'salsa|CJ|ve', 'olives|CJ|ne', 'enchilada sauce|CJ|ve',
    'olive oil|CS|ne|1', 'cooking oil|CS|ne|1', 'soy sauce|CS|ne', 'ketchup|CS|as', 'mustard|CS|ne', 'mayonnaise|CS|dr',
    'bbq sauce|CS|as', 'hot sauce|CS|ne', 'worcestershire sauce|CS|ne', 'vinegar|CS|ne', 'balsamic vinegar|CS|ne',
    'salad dressing|CS|dr', 'ranch dressing|CS|dr', 'honey|CS|as', 'maple syrup|CS|as', 'peanut butter|CS|ne',
    'teriyaki sauce|CS|as', 'sesame oil|CS|ne',
    'flour|BA|rc|1', 'sugar|BA|as|1', 'brown sugar|BA|as', 'baking powder|BA|ne|1', 'baking soda|BA|ne|1',
    'vanilla extract|BA|ne', 'cornstarch|BA|rc|1', 'cocoa powder|BA|ne', 'chocolate chips|BA|as',
    'salt|SP|ne|1', 'black pepper|SP|ne|1', 'garlic powder|SP|ne|1', 'onion powder|SP|ne|1', 'paprika|SP|ne|1',
    'cumin|SP|ne|1', 'chili powder|SP|ne|1', 'oregano|SP|ne|1', 'italian seasoning|SP|ne|1', 'cinnamon|SP|ne|1',
    'red pepper flakes|SP|ne|1', 'thyme|SP|ne|1', 'bay leaves|SP|ne|1', 'taco seasoning|SP|ne', 'curry powder|SP|ne',
    'rice noodles|IN|rc', 'ramen noodles|IN|rc', 'curry paste|IN|ne', 'fish sauce|IN|ne', 'hoisin sauce|IN|as',
    'tahini|IN|ne',
    'tortilla chips|SN|fd', 'crackers|SN|rc',
    'tofu|OT|lp', 'tempeh|OT|lp', 'walnuts|OT|ne', 'almonds|OT|ne', 'pine nuts|OT|ne'
  ].map(function (line) {
    var p = line.split('|');
    return { name: p[0], aisle: AISLE[p[1]], health_tag: TAG[p[2]], default_unit: '', is_staple: p[3] === '1' };
  });

  var aisleNames = ['PR', 'MS', 'DL', 'BK', 'DA', 'FZ', 'PG', 'CJ', 'CS', 'BA', 'SP', 'IN', 'SN', 'BV', 'HH', 'OT'];

  var healthRules = [];
  [['leafy_veg', 3], ['vegetable', 2], ['fruit', 1], ['legume', 2], ['whole_grain', 2], ['fish', 2], ['lean_protein', 1],
    ['neutral', 0], ['refined_carb', -1], ['dairy_rich', -1], ['red_meat', -1], ['processed_meat', -2], ['fried', -2],
    ['added_sugar', -2]].forEach(function (r) { healthRules.push({ kind: 'ingredient', key: r[0], points: r[1] }); });
  [['grilled', 1], ['steamed', 1], ['baked', 0], ['roasted', 0], ['sauteed', 0], ['slow-cooked', 0], ['boiled', 0],
    ['raw', 0], ['fried', -2]].forEach(function (r) { healthRules.push({ kind: 'method', key: r[0], points: r[1] }); });

  var settings = [
    ['plan_days', 7], ['week_view_days', 8], ['default_servings', 4], ['repeat_days', 21], ['max_ideas_per_week', 1],
    ['w_rating', 1.0], ['w_favorite', 0.5], ['w_recency', 1.0], ['w_health', 0.3], ['w_season', 0.5],
    ['recency_cap_days', 90], ['weeknight_max_minutes', 45], ['weekend_max_minutes', 120], ['weekend_days', '0,6'],
    ['cook_time_mode', 'soft'], ['w_time_penalty', 0.75], ['restaurant_suggest_count', 5], ['restaurant_repeat_days', 14],
    ['first_day_of_week', 0], ['shopping_week_start_day', 0], ['season_winter', '12,1,2'], ['season_spring', '3,4,5'],
    ['season_summer', '6,7,8'], ['season_fall', '9,10,11'], ['health_base', 5], ['health_scale', 1.5],
    ['active_profile', 'Normal'], ['timezone', 'America/Los_Angeles'], ['store_name', 'Vons'], ['refresh_minutes', 5]
  ].map(function (r) { return { key: r[0], value: String(r[1]) }; });

  var dishTypes = ['Pasta', 'Chicken', 'Beef', 'Pork', 'Seafood', 'Vegetarian', 'Soup', 'Salad', 'Other'];

  var tables = {
    cfg_profiles: [{ name: 'Normal' }, { name: 'Tight budget' }],
    cfg_aisles: aisleNames.map(function (code, i) { return { name: AISLE[code], store: 'Vons', sort_order: i + 1 }; }),
    cfg_health_rules: healthRules,
    cfg_settings: settings,
    cfg_units: [
      { unit: 'tsp', family: 'volume', to_base: 1, aliases: 'teaspoon,teaspoons,tsps' },
      { unit: 'tbsp', family: 'volume', to_base: 3, aliases: 'tablespoon,tablespoons,tbsps,tbs' },
      { unit: 'cup', family: 'volume', to_base: 48, aliases: 'cups,c' },
      { unit: 'fl oz', family: 'volume', to_base: 6, aliases: 'fluid ounce,fluid ounces,fl. oz,floz' },
      { unit: 'pint', family: 'volume', to_base: 96, aliases: 'pints,pt' },
      { unit: 'quart', family: 'volume', to_base: 192, aliases: 'quarts,qt' },
      { unit: 'gallon', family: 'volume', to_base: 768, aliases: 'gallons,gal' },
      { unit: 'ml', family: 'volume', to_base: 0.202884, aliases: 'milliliter,milliliters,millilitre' },
      { unit: 'l', family: 'volume', to_base: 202.884, aliases: 'liter,liters,litre,litres' },
      { unit: 'oz', family: 'weight', to_base: 28.3495, aliases: 'ounce,ounces' },
      { unit: 'lb', family: 'weight', to_base: 453.592, aliases: 'lbs,pound,pounds' },
      { unit: 'g', family: 'weight', to_base: 1, aliases: 'gram,grams' },
      { unit: 'kg', family: 'weight', to_base: 1000, aliases: 'kilogram,kilograms' },
      { unit: 'each', family: 'count', to_base: 1, aliases: 'ea,piece,pieces' },
      { unit: 'clove', family: 'count', to_base: 1, aliases: 'cloves' },
      { unit: 'can', family: 'count', to_base: 1, aliases: 'cans' },
      { unit: 'pinch', family: 'count', to_base: 1, aliases: 'pinches,dash,dashes' },
      { unit: 'bunch', family: 'count', to_base: 1, aliases: 'bunches' },
      { unit: 'slice', family: 'count', to_base: 1, aliases: 'slices' }
    ],
    cfg_variety_rules: [
      { rule: 'Max 2 of the same type per week', active: true, profile: '', match_by: 'type', match_value: '*', limit: 2, consecutive: false, days: 'all', applies_to: 'home', note: 'Keeps the week varied' },
      { rule: 'No same type back-to-back', active: true, profile: '', match_by: 'type', match_value: '*', limit: '', consecutive: true, days: 'all', applies_to: 'home', note: 'No chicken two nights in a row' },
      { rule: 'Beef max 2 per week', active: true, profile: 'Normal', match_by: 'type', match_value: 'Beef', limit: 2, consecutive: false, days: 'all', applies_to: 'home', note: '' },
      { rule: 'Beef max 1 per week', active: true, profile: 'Tight budget', match_by: 'type', match_value: 'Beef', limit: 1, consecutive: false, days: 'all', applies_to: 'home', note: 'Beef is expensive right now' }
    ],
    cfg_type_weights: dishTypes.map(function (t) { return { profile: 'Normal', type: t, multiplier: 1 }; }).concat(
      dishTypes.map(function (t) {
        var m = { Beef: 0.4, Chicken: 1.5, Pasta: 1.3, Vegetarian: 1.3 }[t];
        return { profile: 'Tight budget', type: t, multiplier: m == null ? 1 : m };
      })
    ),
    lib_dish_types: dishTypes.map(function (t, i) { return { name: t, sort: i + 1 }; }),
    lib_cuisines: ['American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai', 'Indian', 'Mediterranean', 'BBQ', 'Fast Food', 'Other']
      .map(function (n) { return { name: n }; }),
    lib_ingredients: INGREDIENTS
  };

  return { tables: tables, AISLE: AISLE, TAG: TAG };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Seed; }

// ===== src/logic/dates.js =====
// Date helpers. Dates are 'YYYY-MM-DD' strings; math is UTC-based so DST never matters.
var Dates = (function () {
  'use strict';

  var MS = 86400000;

  function parse_(iso) {
    var p = String(iso).split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function format_(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  function isValid(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    return format_(parse_(iso)) === iso;
  }

  function addDays(iso, n) {
    return format_(parse_(iso) + n * MS);
  }

  // Whole days from a to b (b - a).
  function diffDays(a, b) {
    return Math.round((parse_(b) - parse_(a)) / MS);
  }

  // 0 = Sunday ... 6 = Saturday
  function dayOfWeek(iso) {
    return new Date(parse_(iso)).getUTCDay();
  }

  function startOfWeek(iso, firstDay) {
    var fd = firstDay == null || firstDay === '' ? 0 : Number(firstDay);
    var back = (dayOfWeek(iso) - fd + 7) % 7;
    return addDays(iso, -back);
  }

  function range(startIso, n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(addDays(startIso, i));
    return out;
  }

  function month(iso) {
    return Number(String(iso).slice(5, 7));
  }

  // seasonMonthsMap: { Winter: [12,1,2], Spring: [3,4,5], ... }
  function seasonOf(iso, seasonMonthsMap) {
    var m = month(iso);
    for (var name in seasonMonthsMap) {
      if (Object.prototype.hasOwnProperty.call(seasonMonthsMap, name) && seasonMonthsMap[name].indexOf(m) !== -1) {
        return name;
      }
    }
    return null;
  }

  function isWeekend(iso, weekendDays) {
    return weekendDays.indexOf(dayOfWeek(iso)) !== -1;
  }

  // "0,6" or 6 or [0,6] -> [0,6]
  function parseDayList(value) {
    if (Array.isArray(value)) return value.map(Number);
    return String(value == null ? '' : value)
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s !== ''; })
      .map(Number);
  }

  return {
    isValid: isValid,
    addDays: addDays,
    diffDays: diffDays,
    dayOfWeek: dayOfWeek,
    startOfWeek: startOfWeek,
    range: range,
    month: month,
    seasonOf: seasonOf,
    isWeekend: isWeekend,
    parseDayList: parseDayList
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Dates; }

// ===== src/logic/health.js =====
// Automatic healthy score (1-10) from ingredient health tags and cooking method.
var Health = (function () {
  'use strict';

  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function num_(v, d) {
    var n = Number(v);
    return (v === '' || v == null || isNaN(n)) ? d : n;
  }

  // dish: {cook_method}; lines: recipe lines [{ingredient, optional}];
  // ingredientsByName: { normalizedName: {health_tag} }; rules: [{kind, key, points}]
  function scoreDish(dish, lines, ingredientsByName, rules, settings) {
    var s = settings || {};
    var base = num_(s.health_base, 5);
    var scale = num_(s.health_scale, 1.5);
    var ingPoints = {};
    var methodPoints = {};
    (rules || []).forEach(function (r) {
      var key = String(r.key).trim().toLowerCase();
      if (r.kind === 'ingredient') ingPoints[key] = Number(r.points);
      else if (r.kind === 'method') methodPoints[key] = Number(r.points);
    });
    var sum = 0;
    var count = 0;
    (lines || []).forEach(function (line) {
      if (line.optional) return;
      var ing = ingredientsByName[Ingredients_().normalize(line.ingredient)];
      if (!ing || !ing.health_tag) return;
      var pts = ingPoints[String(ing.health_tag).trim().toLowerCase()];
      if (pts == null || isNaN(pts)) return;
      sum += pts;
      count += 1;
    });
    var avg = count ? sum / count : 0;
    var method = methodPoints[String((dish && dish.cook_method) || '').trim().toLowerCase()] || 0;
    var raw = count ? base + avg * scale + method : base + method;
    return Math.max(1, Math.min(10, Math.round(raw)));
  }

  // Mean of non-null scores, one decimal; null if there are none.
  function scoreMeal(mainScore, sideScores) {
    var all = [mainScore].concat(sideScores || []).filter(function (v) { return v != null && v !== '' && !isNaN(v); }).map(Number);
    if (!all.length) return null;
    var mean = all.reduce(function (a, b) { return a + b; }, 0) / all.length;
    return Math.round(mean * 10) / 10;
  }

  return { scoreDish: scoreDish, scoreMeal: scoreMeal };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Health; }

// ===== src/logic/ids.js =====
// Internal ids (plan, queue, shopping item only). Everything else is keyed by name.
var Ids = (function () {
  'use strict';

  // next('P', ['P-0001','P-0007']) -> 'P-0008'
  function next(prefix, existingIds, pad) {
    var width = pad == null ? 4 : pad;
    var max = 0;
    var re = new RegExp('^' + prefix + '-(\\d+)$');
    (existingIds || []).forEach(function (id) {
      var m = re.exec(String(id));
      if (m) max = Math.max(max, Number(m[1]));
    });
    var n = String(max + 1);
    while (n.length < width) n = '0' + n;
    return prefix + '-' + n;
  }

  return { next: next };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Ids; }

// ===== src/logic/ingredients.js =====
// Name matching helpers. normalize() is the single key function used for every name lookup.
var Ingredients = (function () {
  'use strict';

  function normalize(name) {
    return String(name == null ? '' : name)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // list of {name,...} -> { normalizedName: item }
  function index(list) {
    var map = {};
    (list || []).forEach(function (item) { map[normalize(item.name)] = item; });
    return map;
  }

  // Exact normalized match, then trailing-s add/remove. No fuzzy matching.
  function match(name, ingredientsList) {
    var n = normalize(name);
    if (!n) return null;
    var map = index(ingredientsList);
    if (map[n]) return map[n];
    var alt = /s$/.test(n) ? n.slice(0, -1) : n + 's';
    return map[alt] || null;
  }

  return { normalize: normalize, index: index, match: match };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Ingredients; }

// ===== src/logic/members.js =====
// Household member lookup (access gate for the web app).
var Members = (function () {
  'use strict';

  function find(email, members) {
    var e = String(email == null ? '' : email).trim().toLowerCase();
    if (!e) return null;
    for (var i = 0; i < (members || []).length; i++) {
      if (String(members[i].email || '').trim().toLowerCase() === e) return members[i];
    }
    return null;
  }

  function isAdmin(member) {
    return !!member && member.role === 'admin';
  }

  return { find: find, isAdmin: isAdmin };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Members; }

// ===== src/logic/planOps.js =====
// Moving, swapping and replacing planned meals. Never mutates its input.
// A slot is { plan_id, date, kind, dish, side_1..3, restaurant, servings, status, locked, notes }.
var PlanOps = (function () {
  'use strict';

  function Dates_() { return (typeof module !== 'undefined' && module.exports) ? require('./dates') : Dates; }
  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function isActive_(s) { return s.status !== 'removed' && s.status !== 'replaced'; }

  function copy_(s) {
    var c = {};
    Object.keys(s).forEach(function (k) { c[k] = s[k]; });
    return c;
  }

  function occupant_(plan, date, exceptIdx) {
    for (var i = 0; i < plan.length; i++) {
      if (i !== exceptIdx && plan[i].date === date && isActive_(plan[i])) return i;
    }
    return -1;
  }

  function swapDays(plan, a, b) {
    var out = plan.map(copy_);
    if (a === b) return out;
    out.forEach(function (s) {
      if (!isActive_(s)) return;
      if (s.date === a) s.date = b;
      else if (s.date === b) s.date = a;
    });
    return out;
  }

  // opts.ifOccupied: 'swap' | 'shift' | 'queue_existing' | 'delete_existing'
  function moveToDay(plan, from, to, opts) {
    var mode = (opts && opts.ifOccupied) || 'swap';
    var out = plan.map(copy_);
    var result = { plan: out, queued: [], removed: [], notes: [] };
    if (from === to) return result;
    var mi = occupant_(out, from, -1);
    if (mi < 0) {
      result.notes.push('Nothing is planned on ' + from + '.');
      return result;
    }
    var oi = occupant_(out, to, mi);
    if (oi < 0) {
      out[mi].date = to;
      return result;
    }
    if (mode === 'swap') {
      out[mi].date = to;
      out[oi].date = from;
    } else if (mode === 'shift') {
      var chain = [];
      var day = to;
      for (;;) {
        var idx = occupant_(out, day, mi);
        if (idx < 0) break;
        chain.push(idx);
        day = Dates_().addDays(day, 1);
      }
      chain.forEach(function (i) { out[i].date = Dates_().addDays(out[i].date, 1); });
      out[mi].date = to;
      result.notes.push('Moved ' + chain.length + ' meal(s) one day later.');
    } else if (mode === 'queue_existing') {
      result.queued.push(copy_(out[oi]));
      out[oi].status = 'removed';
      out[mi].date = to;
    } else if (mode === 'delete_existing') {
      out[oi].status = 'removed';
      result.removed.push(copy_(out[oi]));
      out[mi].date = to;
    } else {
      throw new Error('Unknown option: ' + mode);
    }
    return result;
  }

  // originalAction: { type: 'move', to, ifOccupied } | { type: 'queue' } | { type: 'delete' }
  function eatOut(plan, date, restaurantSlot, originalAction) {
    var slot = copy_(restaurantSlot);
    slot.date = date;
    slot.kind = 'restaurant';
    slot.status = slot.status || 'planned';
    slot.locked = true;
    slot.dish = '';
    var out = plan.map(copy_);
    var result = { plan: out, queued: [], removed: [], notes: [] };
    var oi = occupant_(out, date, -1);
    if (oi >= 0) {
      if (!originalAction || !originalAction.type) {
        throw new Error('Choose what to do with the meal already planned for that day.');
      }
      if (originalAction.type === 'move') {
        if (originalAction.to === date) throw new Error('Pick a different day for the original meal.');
        var moved = moveToDay(out, date, originalAction.to, { ifOccupied: originalAction.ifOccupied });
        result.plan = moved.plan;
        result.queued = moved.queued;
        result.removed = moved.removed;
        result.notes = moved.notes;
      } else if (originalAction.type === 'queue') {
        result.queued.push(copy_(out[oi]));
        out[oi].status = 'removed';
      } else if (originalAction.type === 'delete') {
        out[oi].status = 'removed';
        result.removed.push(copy_(out[oi]));
      } else {
        throw new Error('Unknown option: ' + originalAction.type);
      }
    }
    result.plan.push(slot);
    return result;
  }

  // Slots dated today .. today+days-1 that are planned or cooked, sorted by date. Empty days are omitted.
  function visibleWeek(plan, today, days) {
    var last = Dates_().addDays(today, days - 1);
    return plan
      .filter(function (s) {
        return (s.status === 'planned' || s.status === 'cooked') && s.date >= today && s.date <= last;
      })
      .map(copy_)
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  // Drops slots that point at a dish/restaurant that no longer exists; blanks missing sides.
  function validateDraft(slots, dishNames, restaurantNames) {
    var dishSet = {};
    (dishNames || []).forEach(function (n) { dishSet[Ingredients_().normalize(n)] = true; });
    var restSet = {};
    (restaurantNames || []).forEach(function (n) { restSet[Ingredients_().normalize(n)] = true; });
    var kept = [];
    var dropped = [];
    (slots || []).forEach(function (s) {
      var c = copy_(s);
      var N = Ingredients_().normalize;
      if (c.kind === 'restaurant') {
        var restNew = c.new_restaurant_name && N(c.new_restaurant_name) === N(c.restaurant);
        if (!restSet[N(c.restaurant)] && !restNew) {
          dropped.push({ date: c.date, reason: 'restaurant no longer exists' });
          return;
        }
      } else {
        var dishNew = c.new_dish_name && N(c.new_dish_name) === N(c.dish);
        if (!dishSet[N(c.dish)] && !dishNew) {
          dropped.push({ date: c.date, reason: 'dish no longer exists' });
          return;
        }
        ['side_1', 'side_2', 'side_3'].forEach(function (f) {
          if (c[f] && !dishSet[Ingredients_().normalize(c[f])]) c[f] = '';
        });
      }
      kept.push(c);
    });
    return { slots: kept, dropped: dropped };
  }

  return {
    swapDays: swapDays,
    moveToDay: moveToDay,
    eatOut: eatOut,
    visibleWeek: visibleWeek,
    validateDraft: validateDraft
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = PlanOps; }

// ===== src/logic/ratings.js =====
// Star rating averages. One row per (item, member); the average is shown everywhere.
var Ratings = (function () {
  'use strict';

  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function average(rows) {
    var stars = (rows || []).map(function (r) { return Number(r.stars); }).filter(function (n) { return n >= 1 && n <= 5; });
    if (!stars.length) return { avg: null, count: 0 };
    var sum = stars.reduce(function (a, b) { return a + b; }, 0);
    return { avg: Math.round((sum / stars.length) * 100) / 100, count: stars.length };
  }

  // field = 'dish' or 'restaurant' -> { normalizedName: {avg, count} }
  function byItem(rows, field) {
    var groups = {};
    (rows || []).forEach(function (r) {
      var key = Ingredients_().normalize(r[field]);
      if (!key) return;
      (groups[key] = groups[key] || []).push(r);
    });
    var out = {};
    Object.keys(groups).forEach(function (k) { out[k] = average(groups[k]); });
    return out;
  }

  return { average: average, byItem: byItem };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Ratings; }

// ===== src/logic/recipe.js =====
// Recipe display helpers: scaling and grouping.
var Recipe = (function () {
  'use strict';

  function Units_() { return (typeof module !== 'undefined' && module.exports) ? require('./units') : Units; }

  // lines: [{qty, qty_text, ...}] -> new lines scaled from fromServings to toServings.
  function scaleIngredients(lines, fromServings, toServings) {
    var from = Number(fromServings);
    var to = Number(toServings);
    if (!(from > 0) || !(to > 0)) throw new Error('Servings must be greater than zero');
    var factor = to / from;
    return (lines || []).map(function (line) {
      var copy = {};
      Object.keys(line).forEach(function (k) { copy[k] = line[k]; });
      if (line.qty != null && line.qty !== '' && isFinite(line.qty)) {
        copy.qty = Math.round(Number(line.qty) * factor * 1e6) / 1e6;
        copy.qty_text = Units_().formatQty(copy.qty);
      }
      return copy;
    });
  }

  // -> [{label, lines}] in original order, unlabeled group first.
  function groupByLabel(lines) {
    var groups = [];
    var byLabel = {};
    (lines || []).forEach(function (line) {
      var label = line.group_label || '';
      if (!byLabel[label]) {
        byLabel[label] = { label: label, lines: [] };
        groups.push(byLabel[label]);
      }
      byLabel[label].lines.push(line);
    });
    groups.sort(function (a, b) { return (a.label === '' ? 0 : 1) - (b.label === '' ? 0 : 1); });
    return groups;
  }

  return { scaleIngredients: scaleIngredients, groupByLabel: groupByLabel };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Recipe; }

// ===== src/logic/recipeParser.js =====
// Turns pasted recipe text (and single ingredient lines) into structured data.
var RecipeParser = (function () {
  'use strict';

  function Units_() { return (typeof module !== 'undefined' && module.exports) ? require('./units') : Units; }

  var FR = '¼½¾⅓⅔⅛⅜⅝⅞';
  var Q = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?\\s*[' + FR + ']?|[' + FR + '])';
  var QTY_RE = new RegExp('^(' + Q + '(?:\\s*(?:-|–|to)\\s*' + Q + ')?)(?=\\s|$|\\()');
  var QTY_START = new RegExp('^[\\d' + FR + ']');
  var NUMBERED_STEP = /^\d+\s*[.)]\s/;
  var ING_HEAD = /^ingredients?\s*:?$/i;
  var STEP_HEAD = /^(directions?|instructions?|method|steps?|preparation)\s*:?$/i;
  var CONTAINERS = { handful: 1, sprig: 1, stick: 1, head: 1, package: 1, pkg: 1, jar: 1, bottle: 1, box: 1, bag: 1, stalk: 1, ear: 1, sheet: 1, loaf: 1, block: 1, container: 1, carton: 1 };

  function isContainer_(word) {
    var w = word.toLowerCase();
    return !!(CONTAINERS[w] || CONTAINERS[w.replace(/s$/, '')] || CONTAINERS[w.replace(/es$/, '')]);
  }

  function parseIngredientLine(line, unitsTable) {
    var table = unitsTable || [];
    var out = { qty_text: '', qty: null, unit: '', name: '', prep_note: '', optional: false, confidence: 'ok' };
    var raw = String(line == null ? '' : line).replace(/^[\s\-•*☐□]+/, '').trim();
    if (!raw) { out.confidence = 'review'; return out; }

    if (/\(\s*optional\s*\)/i.test(raw) || /[,;]?\s*\boptional\s*$/i.test(raw)) {
      out.optional = true;
      raw = raw.replace(/\(\s*optional\s*\)/i, '').replace(/[,;]?\s*\boptional\s*$/i, '').trim();
    }

    // Split off a trailing note at the first comma that is outside parentheses.
    var main = raw;
    var note = '';
    var depth = 0;
    for (var i = 0; i < raw.length; i++) {
      var ch = raw.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) {
        main = raw.slice(0, i).trim();
        note = raw.slice(i + 1).trim();
        break;
      }
    }

    var rest = main;
    var m = QTY_RE.exec(main);
    if (m) {
      out.qty_text = m[1].trim();
      out.qty = Units_().parseQty(out.qty_text).qty;
      rest = main.slice(m[0].length).trim();
    }

    var pm = /^\(([^)]*)\)\s*/.exec(rest);
    if (pm) {
      note = note ? pm[1].trim() + '; ' + note : pm[1].trim();
      rest = rest.slice(pm[0].length);
      out.confidence = 'review';
    }

    if (m) {
      var words = rest.split(/\s+/);
      var unit = '';
      if (words.length >= 2) {
        var u2 = Units_().normalizeUnit(words[0] + ' ' + words[1], table);
        if (u2) { unit = u2; rest = words.slice(2).join(' '); }
      }
      if (!unit && words[0]) {
        var u1 = Units_().normalizeUnit(words[0], table);
        if (u1) {
          unit = u1;
          rest = words.slice(1).join(' ');
        } else if (isContainer_(words[0])) {
          unit = words[0].toLowerCase();
          rest = words.slice(1).join(' ');
          out.confidence = 'review';
        }
      }
      out.unit = unit;
    }

    out.name = rest.replace(/^of\s+/i, '').trim();
    out.prep_note = note;
    if (!out.name) out.confidence = 'review';
    return out;
  }

  function parseMinutes_(str) {
    var s = String(str);
    var h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i.exec(s);
    var mi = /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/i.exec(s);
    if (!h && !mi) {
      return /^\s*\d+\s*$/.test(s) ? Number(s) : null;
    }
    return Math.round((h ? Number(h[1]) * 60 : 0) + (mi ? Number(mi[1]) : 0));
  }

  function timerOf_(text) {
    var m = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i.exec(text);
    if (!m) return null;
    return Math.round(/^h/i.test(m[2]) ? Number(m[1]) * 60 : Number(m[1]));
  }

  function subHeading_(line) {
    if (/:$/.test(line) && line.length <= 60) return line.replace(/:$/, '').trim();
    if (/^[A-Z][A-Z0-9\s&'\-,]{2,}$/.test(line) && /[A-Z]{2}/.test(line)) return line.trim();
    if (/^for\s+(?:the\s+)?[A-Za-z][A-Za-z\s'-]{1,40}$/i.test(line)) return line.trim();
    return '';
  }

  function parseRecipeText(text, unitsTable) {
    var result = { title: '', servings: null, prep_min: null, cook_min: null, ingredients: [], steps: [], warnings: [] };
    try {
      var lines = String(text == null ? '' : text).split(/\r?\n/).map(function (l) { return l.trim(); });
      if (!lines.some(Boolean)) {
        result.warnings.push('The recipe text is empty.');
        return result;
      }
      var hasHeadings = lines.some(function (l) { return ING_HEAD.test(l) || STEP_HEAD.test(l); });
      var mode = hasHeadings ? 'pre' : 'guess';
      if (!hasHeadings) {
        result.warnings.push('No "Ingredients" or "Directions" headings were found, so lines were sorted by guess. Please review.');
      }
      var group = '';
      var section = '';

      var addIngredient = function (line) {
        var p = parseIngredientLine(line, unitsTable);
        if (!p.name && !p.qty_text) return;
        if (p.confidence === 'review') result.warnings.push('Check this ingredient: "' + line + '"');
        p.group_label = group;
        result.ingredients.push(p);
      };
      var addStep = function (line) {
        var t = line.replace(/^\s*(?:step\s*\d+\s*[:.)-]?|\d+\s*[.)])\s*/i, '').trim();
        if (!t) return;
        result.steps.push({ step_no: result.steps.length + 1, section_label: section, text: t, timer_min: timerOf_(t) });
      };

      lines.forEach(function (line) {
        if (!line) return;
        if (ING_HEAD.test(line)) { mode = 'ing'; group = ''; return; }
        if (STEP_HEAD.test(line)) { mode = 'steps'; section = ''; return; }

        var sm = /^(?:serves|servings?|makes|yields?)\s*:?\s*(\d+)/i.exec(line);
        if (sm) { result.servings = Number(sm[1]); return; }
        var tm = /^(prep|cook)(?:\s*time)?\s*:\s*(.+)$/i.exec(line);
        if (tm) {
          var mins = parseMinutes_(tm[2]);
          if (mins != null) {
            if (tm[1].toLowerCase() === 'prep') result.prep_min = mins; else result.cook_min = mins;
            return;
          }
        }

        if (mode === 'pre') {
          if (!result.title) result.title = line;
          return;
        }
        if (mode === 'guess') {
          if (QTY_START.test(line) && !NUMBERED_STEP.test(line)) addIngredient(line); else addStep(line);
          return;
        }
        var sub = subHeading_(line);
        if (sub) {
          if (mode === 'ing') group = sub; else section = sub;
          return;
        }
        if (mode === 'ing') addIngredient(line); else addStep(line);
      });

      if (!result.ingredients.length) result.warnings.push('No ingredients were found.');
      if (!result.steps.length) result.warnings.push('No steps were found.');
    } catch (e) {
      result.warnings.push('Could not fully read the recipe: ' + (e && e.message ? e.message : e));
    }
    return result;
  }

  return { parseIngredientLine: parseIngredientLine, parseRecipeText: parseRecipeText };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = RecipeParser; }

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

// ===== src/logic/scoring.js =====
// Dish scoring and weighted random pick. All weights come from cfg_settings.
var Scoring = (function () {
  'use strict';

  function Dates_() { return (typeof module !== 'undefined' && module.exports) ? require('./dates') : Dates; }
  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function num_(v, d) {
    var n = Number(v);
    return (v === '' || v == null || isNaN(n)) ? d : n;
  }

  // cfg_settings rows [{key,value}] -> typed settings object (+ weekend_days_list, season_months)
  function parseSettings(rows) {
    var s = {};
    (rows || []).forEach(function (r) {
      var v = r.value;
      if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) v = Number(v);
      s[r.key] = v;
    });
    var d = Dates_();
    s.weekend_days_list = d.parseDayList(s.weekend_days != null ? s.weekend_days : '0,6');
    s.season_months = seasonMonths(s);
    return s;
  }

  function seasonMonths(s) {
    var d = Dates_();
    return {
      Winter: d.parseDayList(s.season_winter != null ? s.season_winter : '12,1,2'),
      Spring: d.parseDayList(s.season_spring != null ? s.season_spring : '3,4,5'),
      Summer: d.parseDayList(s.season_summer != null ? s.season_summer : '6,7,8'),
      Fall: d.parseDayList(s.season_fall != null ? s.season_fall : '9,10,11')
    };
  }

  // cfg_type_weights rows -> { normalizedTypeName: multiplier } for one profile
  function typeWeightMap(rows, profile) {
    var map = {};
    (rows || []).forEach(function (r) {
      if (String(r.profile).trim().toLowerCase() !== String(profile).trim().toLowerCase()) return;
      var m = Number(r.multiplier);
      if (!isNaN(m)) map[Ingredients_().normalize(r.type)] = m;
    });
    return map;
  }

  function minutes_(dish) {
    return num_(dish.prep_min, 0) + num_(dish.cook_min, 0);
  }

  function weekendList_(s) {
    return s.weekend_days_list || Dates_().parseDayList(s.weekend_days != null ? s.weekend_days : '0,6');
  }

  function cookLimit(date, settings) {
    var s = settings || {};
    return Dates_().isWeekend(date, weekendList_(s)) ? num_(s.weekend_max_minutes, 120) : num_(s.weeknight_max_minutes, 45);
  }

  function exceedsCookLimit(dish, date, settings) {
    return minutes_(dish) > cookLimit(date, settings);
  }

  // Smallest number of days between `date` and any date in historyDates; Infinity if none.
  function daysSince(name, date, historyDates) {
    var best = Infinity;
    (historyDates || []).forEach(function (h) {
      var diff = Math.abs(Dates_().diffDays(h, date));
      if (diff < best) best = diff;
    });
    return best;
  }

  // ctx: { settings, ratingByDish, daysSince(name,date), seasonMonths | season, typeWeights }
  function scoreDish(dish, date, ctx) {
    var s = ctx.settings || {};
    var key = Ingredients_().normalize(dish.name);
    var rating = ctx.ratingByDish && ctx.ratingByDish[key];
    var avg = rating && rating.avg != null ? rating.avg : 3;
    var cap = num_(s.recency_cap_days, 90);
    var days = typeof ctx.daysSince === 'function' ? ctx.daysSince(dish.name, date) : Infinity;
    var recency = Math.min(isFinite(days) ? days : cap, cap) / cap;

    var season = ctx.season || null;
    if (!season) {
      var months = ctx.seasonMonths || s.season_months || seasonMonths(s);
      season = Dates_().seasonOf(date, months);
    }
    var seasonHit = season && (dish.seasons || []).some(function (x) {
      return String(x).trim().toLowerCase() === String(season).toLowerCase();
    }) ? 1 : 0;

    var penalty = 0;
    if (s.cook_time_mode !== 'strict' && exceedsCookLimit(dish, date, s)) penalty = num_(s.w_time_penalty, 0.75);

    var favorite = dish.favorite === true || String(dish.favorite).toUpperCase() === 'TRUE' ? 1 : 0;
    var value = 1 +
      num_(s.w_rating, 1) * (avg - 3) / 2 +
      num_(s.w_favorite, 0.5) * favorite +
      num_(s.w_recency, 1) * recency +
      num_(s.w_health, 0.3) * (num_(dish.health_score, 5) - 5) / 5 +
      num_(s.w_season, 0.5) * seasonHit -
      penalty;
    value = Math.max(0.05, value);
    var tw = ctx.typeWeights ? ctx.typeWeights[Ingredients_().normalize(dish.type)] : undefined;
    return value * (tw == null ? 1 : tw);
  }

  // items: [{ item, weight }] -> chosen item or null
  function weightedPick(items, rng) {
    if (!items || !items.length) return null;
    var total = items.reduce(function (a, b) { return a + Math.max(0, b.weight); }, 0);
    if (total <= 0) return items[Math.floor(rng() * items.length)].item;
    var r = rng() * total;
    for (var i = 0; i < items.length; i++) {
      r -= Math.max(0, items[i].weight);
      if (r < 0) return items[i].item;
    }
    return items[items.length - 1].item;
  }

  return {
    parseSettings: parseSettings,
    seasonMonths: seasonMonths,
    typeWeightMap: typeWeightMap,
    cookLimit: cookLimit,
    exceedsCookLimit: exceedsCookLimit,
    daysSince: daysSince,
    scoreDish: scoreDish,
    weightedPick: weightedPick
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Scoring; }

// ===== src/logic/shopping.js =====
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

// ===== src/logic/suggest.js =====
// Meal and restaurant suggestions. Pure: all data in, picks out; randomness injected.
var Suggest = (function () {
  'use strict';

  function Dates_() { return (typeof module !== 'undefined' && module.exports) ? require('./dates') : Dates; }
  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }
  function Scoring_() { return (typeof module !== 'undefined' && module.exports) ? require('./scoring') : Scoring; }
  function Variety_() { return (typeof module !== 'undefined' && module.exports) ? require('./variety') : Variety; }

  function k_(x) { return Ingredients_().normalize(x); }
  function num_(v, d) { var n = Number(v); return (v === '' || v == null || isNaN(n)) ? d : n; }
  function isActive_(s) { return s.status !== 'removed' && s.status !== 'replaced'; }
  function slotKey_(s) { return [s.date, s.kind, k_(s.dish), k_(s.restaurant)].join('|'); }

  function descriptor_(slot, dishByKey, restByKey) {
    if (slot.kind === 'restaurant') {
      var r = restByKey[k_(slot.restaurant)];
      return { date: slot.date, kind: 'restaurant', type: '', cuisine: r ? r.cuisine : '', tags: [] };
    }
    var d = dishByKey[k_(slot.dish)];
    return { date: slot.date, kind: 'home', type: d ? d.type : '', cuisine: d ? d.cuisine : '', tags: d ? (d.tags || []) : [] };
  }

  function buildWorking_(request, ctx, openSet) {
    var working = [];
    var seen = {};
    var add = function (slot) {
      if (!isActive_(slot) || openSet[slot.date]) return;
      var key = slotKey_(slot);
      if (seen[key]) return;
      seen[key] = true;
      working.push(slot);
    };
    (ctx.history || []).forEach(add);
    (request.lockedSlots || []).forEach(add);
    return working;
  }

  // request: { openDates, lockedSlots, excludeDishes, profile }
  // -> { suggestions: [{date, dish, sides, score}], unfilled: [{date, reason}] }
  function suggestMeals(request, ctx, rng) {
    var s = ctx.settings || {};
    var d = Dates_();
    var scoring = Scoring_();
    var variety = Variety_();
    var dishes = ctx.dishes || [];
    var dishByKey = {};
    dishes.forEach(function (x) { dishByKey[k_(x.name)] = x; });
    var restByKey = {};
    (ctx.restaurants || []).forEach(function (x) { restByKey[k_(x.name)] = x; });

    var open = (request.openDates || []).slice().sort();
    var openSet = {};
    open.forEach(function (x) { openSet[x] = true; });
    var working = buildWorking_(request, ctx, openSet);
    var excluded = {};
    (request.excludeDishes || []).forEach(function (n) { excluded[k_(n)] = true; });
    var rules = variety.activeRules(ctx.varietyRules || [], request.profile || s.active_profile);
    var repeatDays = num_(s.repeat_days, 21);
    var maxIdeas = num_(s.max_ideas_per_week, 1);
    var firstDay = s.first_day_of_week == null ? 0 : s.first_day_of_week;
    var seasonMonths = s.season_months || scoring.seasonMonths(s);

    var suggestions = [];
    var unfilled = [];

    var dishDatesFor = function (name) {
      var out = [];
      working.forEach(function (sl) {
        if (sl.kind === 'home' && k_(sl.dish) === k_(name)) out.push(sl.date);
      });
      return out;
    };

    open.forEach(function (date) {
      var week = d.startOfWeek(date, firstDay);
      var ideasThisWeek = working.filter(function (sl) {
        var dd = sl.kind === 'home' ? dishByKey[k_(sl.dish)] : null;
        return dd && dd.status === 'idea' && d.startOfWeek(sl.date, firstDay) === week;
      }).length;

      var pool = dishes.filter(function (x) { return x.role === 'main' && (x.status === 'active' || x.status === 'idea'); });
      var reason = '';
      var step = function (list, why) {
        if (!list.length && !reason) reason = why;
        return list;
      };
      pool = step(pool.filter(function (x) { return x.status === 'active' || ideasThisWeek < maxIdeas; }), 'no active dishes in the library');
      pool = step(pool.filter(function (x) { return !excluded[k_(x.name)]; }), 'every dish was already shown or excluded');
      pool = step(pool.filter(function (x) {
        return scoring.daysSince(x.name, date, dishDatesFor(x.name)) >= repeatDays;
      }), 'every dish was cooked too recently');
      pool = step(pool.filter(function (x) {
        if (!x.seasons || !x.seasons.length) return true;
        var season = d.seasonOf(date, seasonMonths);
        return x.seasons.some(function (z) { return String(z).toLowerCase() === String(season).toLowerCase(); });
      }), 'every dish is out of season');
      pool = step(pool.filter(function (x) {
        return !(s.cook_time_mode === 'strict' && scoring.exceedsCookLimit(x, date, s));
      }), 'every dish takes too long for that day');
      var workingDescs = working.map(function (sl) { return descriptor_(sl, dishByKey, restByKey); });
      pool = step(pool.filter(function (x) {
        var cand = { date: date, kind: 'home', type: x.type, cuisine: x.cuisine, tags: x.tags || [] };
        return variety.check(workingDescs, cand, rules, s).length === 0;
      }), 'the variety rules rule out every dish');

      if (!pool.length) {
        unfilled.push({ date: date, reason: reason || 'no dish is eligible' });
        return;
      }

      var items = pool.map(function (x) {
        return {
          item: x,
          weight: scoring.scoreDish(x, date, {
            settings: s,
            ratingByDish: ctx.ratingByDish,
            daysSince: function (name, dt) { return scoring.daysSince(name, dt, dishDatesFor(name)); },
            seasonMonths: seasonMonths,
            typeWeights: ctx.typeWeights
          })
        };
      });
      var pick = scoring.weightedPick(items, rng);

      var sides = (ctx.dishSides || [])
        .filter(function (r) {
          return k_(r.main_dish) === k_(pick.name) && (r.is_default === true || String(r.is_default).toUpperCase() === 'TRUE');
        })
        .map(function (r) { return dishByKey[k_(r.side_dish)]; })
        .filter(function (x) { return x && x.role === 'side' && x.status === 'active'; })
        .map(function (x) { return x.name; })
        .slice(0, 3);

      var score = items.filter(function (i) { return i.item === pick; })[0].weight;
      suggestions.push({ date: date, dish: pick.name, sides: sides, score: Math.round(score * 1000) / 1000 });
      working.push({ date: date, kind: 'home', dish: pick.name, status: 'planned' });
    });

    return { suggestions: suggestions, unfilled: unfilled };
  }

  // request: { date, excludeNames, count }
  // ctx: { restaurants, ratingByRestaurant, visits:[{restaurant,date}], history, settings, varietyRules, ... }
  // -> { restaurants: [{name, score}], exhausted }
  function suggestRestaurants(request, ctx, rng) {
    var s = ctx.settings || {};
    var scoring = Scoring_();
    var variety = Variety_();
    var count = num_(request.count, num_(s.restaurant_suggest_count, 5));
    var repeatDays = num_(s.restaurant_repeat_days, 14);
    var cap = num_(s.recency_cap_days, 90);
    var excluded = {};
    (request.excludeNames || []).forEach(function (n) { excluded[k_(n)] = true; });

    var dishByKey = {};
    (ctx.dishes || []).forEach(function (x) { dishByKey[k_(x.name)] = x; });
    var restByKey = {};
    (ctx.restaurants || []).forEach(function (x) { restByKey[k_(x.name)] = x; });

    var openSet = {};
    openSet[request.date] = true;
    var working = buildWorking_(request, ctx, openSet);
    var descs = working.map(function (sl) { return descriptor_(sl, dishByKey, restByKey); });
    var rules = variety.activeRules(ctx.varietyRules || [], request.profile || s.active_profile);

    var visitDates = {};
    (ctx.visits || []).forEach(function (v) { (visitDates[k_(v.restaurant)] = visitDates[k_(v.restaurant)] || []).push(v.date); });
    working.forEach(function (sl) {
      if (sl.kind === 'restaurant') (visitDates[k_(sl.restaurant)] = visitDates[k_(sl.restaurant)] || []).push(sl.date);
    });

    var pool = (ctx.restaurants || []).filter(function (r) { return r.status !== 'retired' && !excluded[k_(r.name)]; });
    pool = pool.filter(function (r) {
      return scoring.daysSince(r.name, request.date, visitDates[k_(r.name)] || []) >= repeatDays;
    });
    pool = pool.filter(function (r) {
      var cand = { date: request.date, kind: 'restaurant', type: '', cuisine: r.cuisine, tags: [] };
      return variety.check(descs, cand, rules, s).length === 0;
    });

    var items = pool.map(function (r) {
      var rating = ctx.ratingByRestaurant && ctx.ratingByRestaurant[k_(r.name)];
      var avg = rating && rating.avg != null ? rating.avg : 3;
      var days = scoring.daysSince(r.name, request.date, visitDates[k_(r.name)] || []);
      var recency = Math.min(isFinite(days) ? days : cap, cap) / cap;
      var fav = r.favorite === true || String(r.favorite).toUpperCase() === 'TRUE' ? 1 : 0;
      var score = Math.max(0.05, 1 + num_(s.w_rating, 1) * (avg - 3) / 2 + num_(s.w_favorite, 0.5) * fav + num_(s.w_recency, 1) * recency);
      return { item: r, weight: score };
    });

    var picked = [];
    while (picked.length < count && items.length) {
      var choice = scoring.weightedPick(items, rng);
      var idx = items.findIndex(function (i) { return i.item === choice; });
      picked.push({ name: choice.name, score: Math.round(items[idx].weight * 1000) / 1000 });
      items.splice(idx, 1);
    }
    return { restaurants: picked, exhausted: picked.length < count };
  }

  return { suggestMeals: suggestMeals, suggestRestaurants: suggestRestaurants };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Suggest; }

// ===== src/logic/units.js =====
// Quantities and units: parsing, formatting, conversion, combining.
var Units = (function () {
  'use strict';

  var FRAC = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  var EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

  function single_(text) {
    var s = String(text).trim();
    var m;
    if ((m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s))) {
      return Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3]);
    }
    if ((m = /^(\d+)\/(\d+)$/.exec(s))) {
      return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
    }
    if ((m = /^(\d+(?:\.\d+)?)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/.exec(s))) return Number(m[1]) + FRAC[m[2]];
    if ((m = /^([¼½¾⅓⅔⅛⅜⅝⅞])$/.exec(s))) return FRAC[m[1]];
    if ((m = /^(\d+(?:\.\d+)?|\.\d+)$/.exec(s))) return Number(m[1]);
    return null;
  }

  // '1 1/2' -> 1.5, '2-3' -> 3 (approx), 'a pinch' / '' -> null
  function parseQty(text) {
    if (text == null) return { qty: null, approx: false };
    var s = String(text).trim();
    if (!s) return { qty: null, approx: false };
    var q = single_(s);
    if (q !== null) return { qty: q, approx: false };
    var m = /^(.+?)\s*(-|–|—|to)\s*(.+)$/i.exec(s);
    if (m) {
      var a = single_(m[1]);
      var b = single_(m[3]);
      if (a !== null && b !== null) {
        if (m[2] === '-' && /^\d+$/.test(m[1].trim()) && /^\d+\/\d+$/.test(m[3].trim())) {
          return { qty: a + b, approx: false }; // "1-1/2" is a mixed number
        }
        return { qty: Math.max(a, b), approx: true };
      }
    }
    return { qty: null, approx: false };
  }

  // 1.5 -> '1½', 0.333 -> '⅓', 2 -> '2'
  function formatQty(n) {
    if (n == null || n === '' || isNaN(n)) return '';
    n = Number(n);
    var whole = Math.floor(n + 1e-9);
    var frac = n - whole;
    if (frac < 0) frac = 0;
    var f = '';
    if (Math.abs(frac - 1 / 3) < 0.03) {
      f = '⅓';
    } else if (Math.abs(frac - 2 / 3) < 0.03) {
      f = '⅔';
    } else {
      var eighths = Math.round(frac * 8);
      if (eighths === 8) { whole += 1; eighths = 0; }
      f = EIGHTHS[eighths];
    }
    if (whole === 0 && f === '') return n > 0 ? '⅛' : '0';
    return whole > 0 ? String(whole) + f : f;
  }

  function row_(text, table) {
    var t = String(text == null ? '' : text).trim().toLowerCase();
    if (!t) return null;
    for (var i = 0; i < table.length; i++) {
      if (String(table[i].unit).toLowerCase() === t) return table[i];
    }
    var canon = normalizeUnit(t, table);
    if (!canon) return null;
    for (var j = 0; j < table.length; j++) {
      if (table[j].unit === canon) return table[j];
    }
    return null;
  }

  // 'tablespoons' -> 'tbsp'; unknown -> null
  function normalizeUnit(text, unitsTable) {
    var t = String(text == null ? '' : text).trim().toLowerCase().replace(/\.$/, '');
    if (!t) return null;
    var cands = [t];
    if (/s$/.test(t)) cands.push(t.slice(0, -1));
    if (/es$/.test(t)) cands.push(t.slice(0, -2));
    for (var i = 0; i < unitsTable.length; i++) {
      var row = unitsTable[i];
      var names = [String(row.unit).toLowerCase()].concat(
        String(row.aliases || '').split(',').map(function (a) { return a.trim().toLowerCase(); }).filter(Boolean)
      );
      for (var c = 0; c < cands.length; c++) {
        if (names.indexOf(cands[c]) !== -1) return row.unit;
      }
    }
    return null;
  }

  // Returns the converted quantity, or null when units are unknown or in different families.
  // Count units (clove, can, ...) never convert into each other.
  function convert(qty, from, to, unitsTable) {
    if (String(from || '').toLowerCase() === String(to || '').toLowerCase()) return qty;
    var rf = row_(from, unitsTable);
    var rt = row_(to, unitsTable);
    if (!rf || !rt || rf.family !== rt.family) return null;
    if (rf.family === 'count') return rf.unit === rt.unit ? qty : null;
    return qty * Number(rf.to_base) / Number(rt.to_base);
  }

  // a, b = { qty, unit }. Result is in a's unit, or null if they cannot combine.
  function combine(a, b, unitsTable) {
    if (a.qty == null || b.qty == null) return null;
    if (String(a.unit || '').toLowerCase() === String(b.unit || '').toLowerCase()) {
      return { qty: Math.round((a.qty + b.qty) * 1e9) / 1e9, unit: a.unit };
    }
    var c = convert(b.qty, b.unit, a.unit, unitsTable);
    if (c == null) return null;
    return { qty: Math.round((a.qty + c) * 1e9) / 1e9, unit: a.unit };
  }

  return {
    parseQty: parseQty,
    formatQty: formatQty,
    normalizeUnit: normalizeUnit,
    convert: convert,
    combine: combine
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Units; }

// ===== src/logic/variety.js =====
// Variety rules: limits per week and "not back-to-back" checks.
// A slot descriptor is { date, kind: 'home'|'restaurant', type, cuisine, tags: [] } (names).
var Variety = (function () {
  'use strict';

  function Dates_() { return (typeof module !== 'undefined' && module.exports) ? require('./dates') : Dates; }

  function eq_(a, b) {
    return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
  }

  function isOff_(rule) {
    return rule.active === false || String(rule.active).toUpperCase() === 'FALSE';
  }

  function activeRules(rules, profile) {
    return (rules || []).filter(function (r) {
      if (isOff_(r)) return false;
      return !r.profile || eq_(r.profile, profile);
    });
  }

  function valuesOf_(slot, by) {
    var vals = by === 'type' ? [slot.type] : by === 'cuisine' ? [slot.cuisine] : (slot.tags || []);
    return vals.filter(function (v) { return v != null && String(v).trim() !== ''; });
  }

  function matches_(slot, by, value) {
    return valuesOf_(slot, by).some(function (v) { return eq_(v, value); });
  }

  function dayFits_(dayClass, date, weekend) {
    if (!dayClass || dayClass === 'all') return true;
    var isWk = Dates_().isWeekend(date, weekend);
    return dayClass === 'weekends' ? isWk : !isWk;
  }

  // -> [{ rule, message }]
  function check(slots, candidate, rules, settings) {
    var s = settings || {};
    var d = Dates_();
    var firstDay = s.first_day_of_week == null ? 0 : s.first_day_of_week;
    var weekend = s.weekend_days_list || d.parseDayList(s.weekend_days != null ? s.weekend_days : '0,6');
    var candWeek = d.startOfWeek(candidate.date, firstDay);
    var prev = d.addDays(candidate.date, -1);
    var next = d.addDays(candidate.date, 1);
    var out = [];
    var seen = {};

    function push(rule, message) {
      var key = rule.rule + '|' + message;
      if (seen[key]) return;
      seen[key] = true;
      out.push({ rule: rule.rule, message: message });
    }

    (rules || []).forEach(function (r) {
      if (isOff_(r)) return;
      var appliesTo = r.applies_to || 'both';
      if (appliesTo !== 'both' && appliesTo !== candidate.kind) return;
      var dayClass = r.days || 'all';
      if (!dayFits_(dayClass, candidate.date, weekend)) return;

      var cvals = valuesOf_(candidate, r.match_by);
      var targets = r.match_value === '*' ? cvals : cvals.filter(function (v) { return eq_(v, r.match_value); });
      if (!targets.length) return;

      var kindFits = function (sl) { return appliesTo === 'both' || sl.kind === appliesTo; };
      var hasLimit = r.limit !== '' && r.limit != null && !isNaN(Number(r.limit));
      var wantsConsecutive = r.consecutive === true || String(r.consecutive).toUpperCase() === 'TRUE';

      targets.forEach(function (v) {
        if (hasLimit) {
          var count = (slots || []).filter(function (sl) {
            return sl.date !== candidate.date && kindFits(sl) && dayFits_(dayClass, sl.date, weekend) &&
              d.startOfWeek(sl.date, firstDay) === candWeek && matches_(sl, r.match_by, v);
          }).length;
          if (count >= Number(r.limit)) {
            push(r, r.rule + ': already ' + count + ' "' + v + '" this week (limit ' + r.limit + ')');
          }
        }
        if (wantsConsecutive) {
          var adjacent = (slots || []).some(function (sl) {
            return (sl.date === prev || sl.date === next) && kindFits(sl) && matches_(sl, r.match_by, v);
          });
          if (adjacent) push(r, r.rule + ': "' + v + '" is on the day before or after');
        }
      });
    });
    return out;
  }

  return { activeRules: activeRules, check: check };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Variety; }

// ===== src/google/api.js =====
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

// ===== src/google/config.js =====
// Where the data lives. The spreadsheet id is stored in Script Properties by setupAll().
var Config = (function () {
  'use strict';

  var cached_ = null;

  function sheetId() {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!id) throw new Error('The planner is not set up yet. Run setupAll once from the Apps Script editor.');
    return id;
  }

  function spreadsheet() {
    if (!cached_) cached_ = SpreadsheetApp.openById(sheetId());
    return cached_;
  }

  function reset() {
    cached_ = null;
  }

  return { sheetId: sheetId, spreadsheet: spreadsheet, reset: reset };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Config; }

// ===== src/google/db.js =====
// Sheet access: one function per kind of read/write. Rows are objects keyed by column name.
// Every write runs inside the script lock; reads are cached for 60 seconds.
var Db = (function () {
  'use strict';

  var CACHE_SECONDS = 60;
  var CACHE_MAX_CHARS = 90000;
  var held_ = false;

  function eq_(a, b) {
    return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
  }

  function def_(tab) {
    var t = Schema.tab(tab);
    if (!t || t.group === 'system') throw new Error('Unknown tab: ' + tab);
    return t;
  }

  function sheet_(tab) {
    var s = Config.spreadsheet().getSheetByName(tab);
    if (!s) throw new Error('Missing tab: ' + tab + '. Run setupAll again.');
    return s;
  }

  function headerMap_(sheet) {
    var lastCol = sheet.getLastColumn();
    var vals = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var map = {};
    vals.forEach(function (h, i) { if (h !== '') map[String(h)] = i; });
    return { width: vals.length, map: map };
  }

  function tz_() {
    return Config.spreadsheet().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  }

  function coerceIn_(v, type) {
    if (type === 'boolean') return v === true || String(v).toUpperCase() === 'TRUE';
    if (type === 'number') {
      if (v === '' || v == null) return null;
      var n = Number(v);
      return isNaN(n) ? null : n;
    }
    if (type === 'json') {
      if (v === '' || v == null) return null;
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch (e) { return v; }
      }
      return v;
    }
    if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
    return v == null ? '' : String(v);
  }

  function coerceOut_(v, type) {
    if (type === 'boolean') return v === true || String(v).toUpperCase() === 'TRUE';
    if (type === 'number') return v === '' || v == null || isNaN(Number(v)) ? '' : Number(v);
    if (type === 'json') return v == null || v === '' ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
    return v == null ? '' : String(v);
  }

  function cacheGet_(tab) {
    try {
      var c = CacheService.getScriptCache().get('t:' + tab);
      return c ? JSON.parse(c) : null;
    } catch (e) { return null; }
  }

  function cachePut_(tab, rows) {
    try {
      var s = JSON.stringify(rows);
      if (s.length < CACHE_MAX_CHARS) CacheService.getScriptCache().put('t:' + tab, s, CACHE_SECONDS);
    } catch (e) { /* cache is optional */ }
  }

  // Small derived lookups that are cached next to a table and cleared whenever that table changes.
  var DERIVED_ = { lib_recipe_ingredients: ['has'] };

  function invalidate(tab) {
    try {
      var keys = ['t:' + tab].concat((DERIVED_[tab] || []).map(function (k) { return 'd:' + tab + ':' + k; }));
      CacheService.getScriptCache().removeAll(keys);
    } catch (e) { /* ignore */ }
  }

  function derived(tab, key, build) {
    var cacheKey = 'd:' + tab + ':' + key;
    try {
      var hit = CacheService.getScriptCache().get(cacheKey);
      if (hit) return JSON.parse(hit);
    } catch (e) { /* fall through and rebuild */ }
    var value = build();
    try {
      var text = JSON.stringify(value);
      if (text.length < CACHE_MAX_CHARS) CacheService.getScriptCache().put(cacheKey, text, CACHE_SECONDS);
    } catch (e) { /* cache is optional */ }
    return value;
  }

  function load_(tab) {
    var d = def_(tab);
    var sheet = sheet_(tab);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var rows = [];
    if (lastRow >= 2 && lastCol >= 1) {
      var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      var head = values[0];
      var idx = d.columns.map(function (c) { return head.indexOf(c.name); });
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        var blank = true;
        for (var b = 0; b < row.length; b++) { if (row[b] !== '' && row[b] !== false) { blank = false; break; } }
        if (blank) continue;
        var o = { _row: i + 1 };
        d.columns.forEach(function (c, j) {
          o[c.name] = coerceIn_(idx[j] < 0 ? '' : row[idx[j]], c.type);
        });
        rows.push(o);
      }
    }
    return rows;
  }

  function readAll(tab) {
    var cached = cacheGet_(tab);
    if (cached) return cached;
    var rows = load_(tab);
    cachePut_(tab, rows);
    return rows;
  }

  function withLock_(fn) {
    if (held_) return fn();
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      throw new Error('The planner is busy, please try again.');
    }
    held_ = true;
    try {
      return fn();
    } finally {
      held_ = false;
      lock.releaseLock();
    }
  }

  function matches_(row, match) {
    return Object.keys(match).every(function (k) { return eq_(row[k], match[k]); });
  }

  function toMatch_(colOrMatch, val) {
    if (typeof colOrMatch === 'object') return colOrMatch;
    var m = {};
    m[colOrMatch] = val;
    return m;
  }

  function rowArray_(d, hm, obj) {
    var arr = [];
    for (var i = 0; i < hm.width; i++) arr.push('');
    d.columns.forEach(function (c) {
      var p = hm.map[c.name];
      if (p != null && Object.prototype.hasOwnProperty.call(obj, c.name)) arr[p] = coerceOut_(obj[c.name], c.type);
    });
    return arr;
  }

  function textCols_(d, hm) {
    return d.columns.filter(function (c) { return c.type === 'string' || c.type === 'date' || c.type === 'json'; })
      .map(function (c) { return hm.map[c.name]; })
      .filter(function (p) { return p != null; });
  }

  function appendMany(tab, objs) {
    if (!objs || !objs.length) return 0;
    return withLock_(function () {
      var d = def_(tab);
      var sheet = sheet_(tab);
      var hm = headerMap_(sheet);
      var start = Math.max(sheet.getLastRow(), 1) + 1;
      var end = start + objs.length - 1;
      if (end > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), end - sheet.getMaxRows() + 100);
      textCols_(d, hm).forEach(function (p) { sheet.getRange(start, p + 1, objs.length, 1).setNumberFormat('@'); });
      var data = objs.map(function (o) { return rowArray_(d, hm, o); });
      sheet.getRange(start, 1, data.length, hm.width).setValues(data);
      invalidate(tab);
      return objs.length;
    });
  }

  function append(tab, obj) {
    return appendMany(tab, [obj]);
  }

  // Writes one row with a single read and a single write.
  function writeCells_(d, sheet, hm, rowNumber, patch) {
    var rng = sheet.getRange(rowNumber, 1, 1, hm.width);
    var cur = rng.getValues()[0];
    d.columns.forEach(function (c) {
      var p = hm.map[c.name];
      if (p == null || !Object.prototype.hasOwnProperty.call(patch, c.name)) return;
      cur[p] = coerceOut_(patch[c.name], c.type);
    });
    rng.setValues([cur]);
  }

  function updateWhere(tab, match, patch) {
    return withLock_(function () {
      var d = def_(tab);
      var sheet = sheet_(tab);
      var hm = headerMap_(sheet);
      var count = 0;
      load_(tab).forEach(function (row) {
        if (!matches_(row, match)) return;
        writeCells_(d, sheet, hm, row._row, patch);
        count += 1;
      });
      invalidate(tab);
      return count;
    });
  }

  // items: [{ key, patch }]. One read of the tab, then one write per changed row.
  function updateMany(tab, keyCol, items) {
    if (!items || !items.length) return 0;
    return withLock_(function () {
      var d = def_(tab);
      var sheet = sheet_(tab);
      var hm = headerMap_(sheet);
      var byKey = {};
      load_(tab).forEach(function (r) {
        var k = String(r[keyCol]).trim().toLowerCase();
        (byKey[k] = byKey[k] || []).push(r);
      });
      var count = 0;
      items.forEach(function (it) {
        (byKey[String(it.key).trim().toLowerCase()] || []).forEach(function (r) {
          writeCells_(d, sheet, hm, r._row, it.patch);
          count += 1;
        });
      });
      invalidate(tab);
      return count;
    });
  }

  // Fresh (uncached) values of one column. Use inside Db.locked when choosing the next id.
  function column(tab, col) {
    def_(tab);
    return load_(tab).map(function (r) { return r[col]; });
  }

  // Updates the first row whose keyCol equals keyVal. Throws if none.
  function update(tab, keyCol, keyVal, patch) {
    var m = {};
    m[keyCol] = keyVal;
    var changed = updateWhere(tab, m, patch);
    if (!changed) throw new Error('Not found: ' + keyVal);
    return changed;
  }

  // Deletes rows bottom-up, one call per block of consecutive rows.
  function deleteRows_(sheet, rowNumbers) {
    var rows = rowNumbers.slice().sort(function (a, b) { return a - b; });
    var blocks = [];
    rows.forEach(function (r) {
      var last = blocks[blocks.length - 1];
      if (last && r === last.start + last.count) last.count += 1;
      else blocks.push({ start: r, count: 1 });
    });
    blocks.reverse().forEach(function (b) { sheet.deleteRows(b.start, b.count); });
  }

  // deleteWhere(tab, col, val) or deleteWhere(tab, {col: val, ...})
  function deleteWhere(tab, colOrMatch, val) {
    var match = toMatch_(colOrMatch, val);
    return withLock_(function () {
      def_(tab);
      var sheet = sheet_(tab);
      var rows = load_(tab).filter(function (r) { return matches_(r, match); }).map(function (r) { return r._row; });
      deleteRows_(sheet, rows);
      invalidate(tab);
      return rows.length;
    });
  }

  function replaceWhere(tab, colOrMatch, val, rows) {
    var match = toMatch_(colOrMatch, typeof colOrMatch === 'object' ? undefined : val);
    var newRows = typeof colOrMatch === 'object' ? val : rows;
    return withLock_(function () {
      deleteWhere(tab, match);
      return appendMany(tab, newRows || []);
    });
  }

  function renameInColumn_(tab, column, oldName, newName) {
    var d = def_(tab);
    var sheet = sheet_(tab);
    var hm = headerMap_(sheet);
    var p = hm.map[column];
    var lastRow = sheet.getLastRow();
    if (p == null || lastRow < 2) return 0;
    var range = sheet.getRange(2, p + 1, lastRow - 1, 1);
    var vals = range.getValues();
    var count = 0;
    var out = vals.map(function (r) {
      if (eq_(r[0], oldName)) { count += 1; return [newName]; }
      return r;
    });
    if (count) { range.setValues(out); invalidate(tab); }
    return count;
  }

  // Renames a name everywhere it is used (the key cell and every referencing column).
  function applyRename(tab, oldName, newName) {
    return withLock_(function () {
      var keyCol = Schema.keyColumn(tab);
      if (!keyCol) throw new Error('This item cannot be renamed.');
      var target = String(newName == null ? '' : newName).trim();
      if (!target) throw new Error('The new name cannot be empty.');
      var rows = load_(tab);
      var found = false;
      rows.forEach(function (r) {
        if (eq_(r[keyCol], oldName)) found = true;
        else if (eq_(r[keyCol], target)) throw new Error('"' + target + '" already exists.');
      });
      if (!found) throw new Error('"' + oldName + '" was not found.');
      var count = renameInColumn_(tab, keyCol, oldName, target);
      References.referencingColumns(Schema, tab).forEach(function (rc) {
        count += renameInColumn_(rc.tab, rc.column, oldName, target);
      });
      return count;
    });
  }

  function nextId(tab, idCol, prefix) {
    return Ids.next(prefix, load_(tab).map(function (r) { return r[idCol]; }));
  }

  return {
    locked: withLock_,
    derived: derived,
    column: column,
    updateMany: updateMany,
    readAll: readAll,
    appendMany: appendMany,
    append: append,
    update: update,
    updateWhere: updateWhere,
    deleteWhere: deleteWhere,
    replaceWhere: replaceWhere,
    applyRename: applyRename,
    nextId: nextId,
    invalidate: invalidate
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Db; }

// ===== src/google/setup.js =====
// One-time setup: builds the spreadsheet (tabs, headers, dropdowns, README) and loads starter data.
// Safe to run again, even after a run that stopped halfway: it never duplicates starter rows or deletes your data.
// Every dropdown in the sheet is sorted A to Z.
var Setup = (function () {
  'use strict';

  var MAX_ROWS = 2000;
  var SKIP_SORTED = { lib_dishes: 1, lib_restaurants: 1, lib_ingredients: 1 };

  function byName_(a, b) {
    var x = String(a).toLowerCase();
    var y = String(b).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }

  function colLetter_(tab, column) {
    return Schema.letter(Schema.columnIndex(tab, column));
  }

  function keyRange_(tab) {
    var L = colLetter_(tab, Schema.keyColumn(tab));
    return tab + '!$' + L + '$2:$' + L;
  }

  function sortedNames_(tab) {
    var r = keyRange_(tab);
    return '=IFERROR(SORT(FILTER(' + r + ', ' + r + '<>"")),"")';
  }

  function dishList_(roleFilter) {
    var name = 'lib_dishes!$' + colLetter_('lib_dishes', 'name') + '$2:$' + colLetter_('lib_dishes', 'name');
    var status = 'lib_dishes!$' + colLetter_('lib_dishes', 'status') + '$2:$' + colLetter_('lib_dishes', 'status');
    var role = 'lib_dishes!$' + colLetter_('lib_dishes', 'role') + '$2:$' + colLetter_('lib_dishes', 'role');
    var cond = name + '<>"", ' + status + '<>"retired"' + (roleFilter ? ', ' + role + '="' + roleFilter + '"' : '');
    return '=IFERROR(SORT(FILTER(' + name + ', ' + cond + ')),"")';
  }

  function restaurantList_(activeOnly) {
    var name = keyRange_('lib_restaurants');
    var status = 'lib_restaurants!$' + colLetter_('lib_restaurants', 'status') + '$2:$' + colLetter_('lib_restaurants', 'status');
    var cond = name + '<>""' + (activeOnly ? ', ' + status + '<>"retired"' : '');
    return '=IFERROR(SORT(FILTER(' + name + ', ' + cond + ')),"")';
  }

  // Hidden helper lists. Each is sorted A to Z by a formula, and dropdowns read from them.
  function listDefs_() {
    var stack = 'lib_dish_types!$A$2:$A; lib_cuisines!$A$2:$A; lib_tags!$A$2:$A; "*"';
    var lists = [
      { key: 'all_dishes', formula: dishList_('') },
      { key: 'main_dishes', formula: dishList_('main') },
      { key: 'side_dishes', formula: dishList_('side') },
      { key: 'active_restaurants', formula: restaurantList_(true) },
      { key: 'all_restaurants', formula: restaurantList_(false) },
      { key: 'ingredient_names', formula: sortedNames_('lib_ingredients') },
      { key: 'match_values', formula: '=IFERROR(SORT(UNIQUE(FILTER({' + stack + '}, {' + stack + '}<>""))),"")' }
    ];
    var seen = {};
    Schema.tabs.forEach(function (t) {
      t.columns.forEach(function (c) {
        if (c.ref && !c.list && !SKIP_SORTED[c.ref] && !seen[c.ref]) {
          seen[c.ref] = true;
          lists.push({ key: 'sorted_' + c.ref, formula: sortedNames_(c.ref) });
        }
      });
    });
    return lists;
  }

  function listKeyFor_(c) {
    if (c.list) return c.list;
    if (c.ref === 'lib_dishes') return 'all_dishes';
    if (c.ref === 'lib_restaurants') return 'all_restaurants';
    if (c.ref === 'lib_ingredients') return 'ingredient_names';
    return 'sorted_' + c.ref;
  }

  function sysRange_(ss, key) {
    var lists = listDefs_();
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].key === key) {
        var L = Schema.letter(i);
        return ss.getRange('sys_lists!' + L + '2:' + L);
      }
    }
    throw new Error('Unknown list: ' + key);
  }

  function ensureSheet_(ss, name, index) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name, index);
    return sheet;
  }

  function isText_(c) {
    return c.type === 'string' || c.type === 'date' || c.type === 'json';
  }

  function textRuns_(cols) {
    var runs = [];
    var start = -1;
    cols.forEach(function (c, i) {
      if (isText_(c) && start < 0) start = i;
      if (!isText_(c) && start >= 0) { runs.push([start, i - 1]); start = -1; }
    });
    if (start >= 0) runs.push([start, cols.length - 1]);
    return runs;
  }

  // The dropdown, checkbox or uniqueness rule for one column, or null.
  function ruleFor_(ss, c, index) {
    if (c.key) {
      var L = Schema.letter(index);
      return SpreadsheetApp.newDataValidation()
        .requireFormulaSatisfied('=COUNTIF($' + L + '$2:$' + L + ', ' + L + '2)<=1')
        .setAllowInvalid(false)
        .setHelpText('Each name must be unique.')
        .build();
    }
    if (c.type === 'boolean') return SpreadsheetApp.newDataValidation().requireCheckbox().build();
    if (c.enum) return SpreadsheetApp.newDataValidation().requireValueInList(c.enum.slice().sort(byName_), true).setAllowInvalid(false).build();
    if (c.list || c.ref) {
      return SpreadsheetApp.newDataValidation().requireValueInRange(sysRange_(ss, listKeyFor_(c)), true).setAllowInvalid(true).build();
    }
    return null;
  }

  function buildSysLists_(ss) {
    var sheet = ss.getSheetByName('sys_lists');
    sheet.setTabColor(Schema.COLORS.system);
    listDefs_().forEach(function (l, i) {
      sheet.getRange(1, i + 1).setValue(l.key).setFontWeight('bold');
      sheet.getRange(2, i + 1).setFormula(l.formula);
    });
    sheet.hideSheet();
  }

  // Headers, text formats, dropdowns and protection, using as few calls as possible.
  function buildTab_(ss, t) {
    var cols = t.columns;
    var sheet = ss.getSheetByName(t.tab);
    sheet.setTabColor(t.color);
    if (!cols.length) return;
    if (sheet.getMaxRows() < MAX_ROWS + 1) sheet.insertRowsAfter(sheet.getMaxRows(), MAX_ROWS + 1 - sheet.getMaxRows());
    if (sheet.getMaxColumns() < cols.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols.length - sheet.getMaxColumns());

    var header = sheet.getRange(1, 1, 1, cols.length);
    header.setValues([cols.map(function (c) { return c.name; })]).setFontWeight('bold').setBackground('#f1f3f4');
    header.setNotes([cols.map(function (c) { return c.desc || ''; })]);
    sheet.setFrozenRows(1);

    textRuns_(cols).forEach(function (run) {
      sheet.getRange(2, run[0] + 1, MAX_ROWS, run[1] - run[0] + 1).setNumberFormat('@');
    });

    var rules = cols.map(function (c, i) { return ruleFor_(ss, c, i); });
    var grid = null;
    if (rules.some(function (r, i) { return r && !cols[i].key; })) {
      var row = rules.map(function (r, i) { return cols[i].key ? null : r; });
      grid = [];
      for (var r = 0; r < MAX_ROWS; r++) grid.push(row);
      try {
        sheet.getRange(2, 1, MAX_ROWS, cols.length).setDataValidations(grid);
      } catch (e) {
        // If Google refuses the large batch, apply the same rules one column at a time.
        cols.forEach(function (c, i) {
          if (rules[i] && !c.key) sheet.getRange(2, i + 1, MAX_ROWS, 1).setDataValidation(rules[i]);
        });
      }
    }
    cols.forEach(function (c, i) {
      // The uniqueness rule uses a relative reference, so it is applied to its column as a block.
      if (c.key) sheet.getRange(2, i + 1, MAX_ROWS, 1).setDataValidation(rules[i]);
      if (c.internal) {
        sheet.getRange(1, i + 1, MAX_ROWS + 1, 1).setBackground('#eeeeee').setFontColor('#777777');
        sheet.getRange(2, i + 1, MAX_ROWS, 1).protect().setDescription('Internal id. Do not edit.').setWarningOnly(true);
      }
      if (c.protect) {
        sheet.getRange(2, i + 1, MAX_ROWS, 1).protect().setDescription('Set automatically. Do not edit.').setWarningOnly(true);
      }
    });
  }

  function buildReadme_(ss) {
    var sheet = ensureSheet_(ss, 'README', 0);
    sheet.clear();
    var rows = [
      ['Family Meal Planner data'],
      [''],
      ['This spreadsheet is the planner\'s database. Blue tabs (lib_) hold dishes, recipes and restaurants. Green tabs (act_) hold plans, ratings and shopping. Orange tabs (cfg_) hold settings.'],
      ['Rename dishes, restaurants and ingredients freely: every link follows the new name. Names must be unique. Dropdowns are sorted A to Z.'],
      ['Grey "internal id" columns belong to the app. Please do not edit them.'],
      ['Use the Meal Planner menu: Back up now (owner only) and Check links.'],
      [''],
      ['Tab', 'What it holds']
    ];
    Schema.tabs.forEach(function (t) { if (t.group !== 'system') rows.push([t.tab, t.desc]); });
    sheet.getRange(1, 1, rows.length, 2).setValues(rows.map(function (r) { return [r[0], r[1] || '']; }));
    sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');
    sheet.getRange(8, 1, 1, 2).setFontWeight('bold');
    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(2, 700);
    sheet.setTabColor('#202124');
  }

  function seed_() {
    Object.keys(Seed.tables).forEach(function (tab) {
      var sheet = Config.spreadsheet().getSheetByName(tab);
      if (sheet && sheet.getLastRow() < 2) Db.appendMany(tab, Seed.tables[tab]);
    });
    var members = Db.readAll('cfg_members');
    if (!members.length) {
      var email = Session.getActiveUser().getEmail();
      var local = String(email).split('@')[0] || 'Owner';
      Db.append('cfg_members', { name: local.charAt(0).toUpperCase() + local.slice(1), email: email, role: 'admin' });
    }
  }

  // Only block a re-run when real admins already exist. A run that stopped halfway has none,
  // and its owner must still be able to finish setup.
  function checkMayRerun_() {
    var members = [];
    try { members = Db.readAll('cfg_members'); } catch (e) { members = []; }
    var admins = members.filter(function (m) { return Members.isAdmin(m); });
    if (admins.length && !Members.isAdmin(Members.find(Session.getActiveUser().getEmail(), members))) {
      throw new Error('Only a planner admin can run setup again.');
    }
  }

  function run() {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SHEET_ID');
    var ss;
    if (id) {
      checkMayRerun_();
      ss = SpreadsheetApp.openById(id);
    } else {
      ss = SpreadsheetApp.create('Family Meal Planner');
      props.setProperty('SHEET_ID', ss.getId());
    }
    Config.reset();

    // 1. Create every tab first, so dropdowns can point at tabs that come later in the list.
    ensureSheet_(ss, 'README', 0);
    var index = 1;
    ['cfg', 'lib', 'act'].forEach(function (prefix) {
      Schema.tabs.forEach(function (t) {
        if (t.tab.indexOf(prefix + '_') === 0) { ensureSheet_(ss, t.tab, index); index += 1; }
      });
    });
    ensureSheet_(ss, 'sys_lists', index);

    // 2. The sorted helper lists that dropdowns read from.
    buildSysLists_(ss);

    // 3. Headers, formats, dropdowns, protection.
    ['cfg', 'lib', 'act'].forEach(function (prefix) {
      Schema.tabs.forEach(function (t) { if (t.tab.indexOf(prefix + '_') === 0) buildTab_(ss, t); });
    });

    buildReadme_(ss);
    var blank = ss.getSheetByName('Sheet1');
    if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);
    ss.setActiveSheet(ss.getSheetByName('README'));

    seed_();
    Logger.log('Family Meal Planner sheet: ' + ss.getUrl());
    return ss.getUrl();
  }

  return { run: run };
})();

// Run this once from the Apps Script editor (select setupAll, then Run).
function setupAll() {
  return Setup.run();
}

if (typeof module !== 'undefined' && module.exports) { module.exports = Setup; }

// ===== src/google/main.js =====
// Web app entry point and the member gate used by every api_* function.

function today_() {
  var tz = 'America/Los_Angeles';
  try {
    var rows = Db.readAll('cfg_settings');
    for (var i = 0; i < rows.length; i++) if (rows[i].key === 'timezone' && rows[i].value) tz = rows[i].value;
  } catch (e) { tz = Session.getScriptTimeZone(); }
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function requireMember_() {
  var email = Session.getActiveUser().getEmail();
  var member = Members.find(email, Db.readAll('cfg_members'));
  if (!member) throw new Error('No access for ' + (email || 'this account') + '. Ask an admin to add you to the planner.');
  return member;
}

function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function doGet() {
  var email = Session.getActiveUser().getEmail();
  var member = null;
  try { member = Members.find(email, Db.readAll('cfg_members')); } catch (e) {
    return HtmlService.createHtmlOutput('<p style="font:18px sans-serif;padding:24px">' + escapeHtml_(e.message) + '</p>')
      .setTitle('Family Meal Planner');
  }
  if (!member) {
    return HtmlService.createHtmlOutput(
      '<div style="font:18px sans-serif;padding:24px"><h2>No access</h2><p>' + escapeHtml_(email || 'This account') +
      ' is not on the family list. Ask the planner admin to add this email to the cfg_members tab.</p></div>'
    ).setTitle('Family Meal Planner');
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Family Meal Planner')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

if (typeof module !== 'undefined' && module.exports) { module.exports = { doGet: doGet }; }
