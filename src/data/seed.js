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
