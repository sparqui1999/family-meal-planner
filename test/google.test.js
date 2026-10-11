// Runs the real dist/Server.gs against a strict fake of Google Sheets, cache, lock and mail.
// It cannot prove things that only real Google can (formula results, consent screens), but it does catch
// ordering bugs, wrong calls, lost data and mixed-up ids.
'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { makeEnv } = require('./helpers/fakeGoogle');
const Schema = require('../src/data/schema');

const sorted = (list) => list.slice().sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0));

function fresh() {
  const env = makeEnv();
  env.call('setupAll');
  return env;
}
const col = (env, tab, name) => {
  const sheet = env.spreadsheet().getSheetByName(tab);
  const i = sheet.data[0].indexOf(name);
  return sheet.data.slice(1).map((r) => r[i]).filter((v) => v !== '' && v !== undefined);
};

function addDish(env, name, ingredients, extra) {
  env.call('api_saveDish', Object.assign({ name, role: 'main', type: 'Pasta', cuisine: 'Italian', servings: 4, prep_min: 10, cook_min: 20 }, extra || {}));
  if (ingredients) {
    env.call('api_saveRecipe', name, { servings: 4, ingredients: ingredients.map(([q, u, i]) => ({ qty_text: q, unit: u, ingredient: i })), steps: [{ text: 'Cook it for 10 minutes.' }] });
  }
}

describe('setup', () => {
  let env;
  before(() => { env = fresh(); });

  it('creates every tab in the plan, hides the helper tab, and puts README in', () => {
    const names = env.spreadsheet().sheets.map((s) => s.name);
    Schema.tabs.forEach((t) => assert.ok(names.includes(t.tab), t.tab));
    assert.ok(names.includes('README'));
    assert.equal(names.includes('Sheet1'), false);
    assert.equal(env.spreadsheet().getSheetByName('sys_lists').hidden, true);
  });
  it('writes the headers from the schema', () => {
    Schema.tabs.filter((t) => t.group !== 'system').forEach((t) => {
      assert.deepEqual(env.spreadsheet().getSheetByName(t.tab).data[0].slice(0, t.columns.length), t.columns.map((c) => c.name), t.tab);
    });
  });
  it('loads the starter data and makes the person who ran setup the first admin', () => {
    assert.equal(env.call('api_bootstrap').me.role, 'admin');
    assert.ok(col(env, 'lib_ingredients', 'name').length >= 120);
    assert.equal(col(env, 'cfg_settings', 'key').length, 30);
  });
  it('can be run again without duplicating anything', () => {
    env.call('setupAll');
    assert.equal(col(env, 'cfg_settings', 'key').length, 30);
    assert.equal(col(env, 'cfg_members', 'name').length, 1);
    assert.equal(col(env, 'lib_ingredients', 'name').length, 187);
  });
  it('can be run again after a run that stopped before the first admin was added', () => {
    const e = fresh();
    e.spreadsheet().getSheetByName('cfg_members').data.splice(1);
    e.uncache();
    e.call('setupAll');
    assert.equal(e.call('api_bootstrap').me.role, 'admin');
  });
  it('still builds the dropdowns, one column at a time, if Google refuses the large batch', () => {
    const e = makeEnv({ refuseBatchValidations: true });
    e.call('setupAll');
    assert.equal(e.counters.batchValidations, 0);
    const withRule = (c) => c.key || c.type === 'boolean' || c.enum || c.list || c.ref;
    const expected = Schema.tabs.reduce((n, t) => n + t.columns.filter(withRule).length, 0);
    assert.equal(e.counters.singleValidations, expected, 'one rule per column that needs one');
    assert.equal(e.call('api_bootstrap').me.role, 'admin');
  });
  it('uses the large batch when Google accepts it', () => {
    const e = fresh();
    assert.ok(e.counters.batchValidations >= 20);
  });
  it('does not let a non-admin re-run it once an admin exists', () => {
    const e = fresh();
    e.user.email = 'stranger@example.com';
    assert.throws(() => e.call('setupAll'), /Only a planner admin/);
  });
});

describe('dropdowns are sorted A to Z', () => {
  let env;
  before(() => { env = fresh(); });

  it('sorts every fixed list in the sheet', () => {
    assert.ok(env.validationLists.length >= 15);
    env.validationLists.forEach((l) => assert.deepEqual(l, sorted(l), JSON.stringify(l)));
    assert.ok(env.validationLists.some((l) => l.join() === 'Fall,Spring,Summer,Winter'));
  });
  it('builds every name list in the sheet with a SORT formula, including aisles, units, types and members', () => {
    const sys = env.spreadsheet().getSheetByName('sys_lists');
    const names = sys.data[0].filter(Boolean);
    for (const key of ['all_dishes', 'main_dishes', 'side_dishes', 'active_restaurants', 'ingredient_names', 'match_values',
      'sorted_cfg_aisles', 'sorted_cfg_units', 'sorted_lib_dish_types', 'sorted_lib_cuisines', 'sorted_lib_tags', 'sorted_cfg_members', 'sorted_cfg_profiles']) {
      assert.ok(names.includes(key), key);
    }
    sys.data[0].forEach((h, i) => { if (h) assert.match(sys.data[1][i], /SORT\(/, h); });
  });
  it('returns every list in the app A to Z', () => {
    const lk = env.call('api_bootstrap').lookups;
    for (const key of ['types', 'cuisines', 'tags', 'units', 'members', 'seasons', 'cookMethods', 'ingredients']) assert.deepEqual(lk[key], sorted(lk[key]), key);
    assert.deepEqual(lk.aisles.map((a) => a.name), sorted(lk.aisles.map((a) => a.name)));
    assert.deepEqual(env.call('api_bootstrap').profiles, sorted(env.call('api_bootstrap').profiles));
  });
  it('sorts dish and restaurant lists ignoring capitals', () => {
    addDish(env, 'zebra stew'); addDish(env, 'Apple Pie'); addDish(env, 'banana bread');
    assert.deepEqual(env.call('api_listDishes', {}).map((d) => d.name), ['Apple Pie', 'banana bread', 'zebra stew']);
    env.call('api_saveRestaurant', { name: 'zed cafe' }); env.call('api_saveRestaurant', { name: 'Alpha Grill' });
    assert.deepEqual(env.call('api_listRestaurants').map((r) => r.name), ['Alpha Grill', 'zed cafe']);
  });
  it('offers aisles A to Z on the shopping list while the list stays in store order', () => {
    addDish(env, 'Milk Dish', [['1', 'cup', 'milk'], ['1', '', 'apple']]);
    env.call('api_savePlan', '2026-10-11', [{ date: '2026-10-12', kind: 'home', dish: 'Milk Dish' }], 14);
    const list = env.call('api_getShoppingList', '2026-10-11');
    assert.deepEqual(list.aisles, sorted(list.aisles));
    assert.deepEqual(list.items.map((i) => i.aisle), ['Produce', 'Dairy & Eggs'], 'Produce comes before Dairy in the store');
  });
});

describe('access', () => {
  it('turns strangers away from every call and from the page', () => {
    const env = fresh();
    env.user.email = 'stranger@example.com';
    assert.throws(() => env.call('api_bootstrap'), /No access/);
    assert.throws(() => env.call('api_listDishes', {}), /No access/);
    assert.throws(() => env.call('api_savePlan', '2026-10-11', [], 14), /No access/);
    assert.match(env.run('doGet()').html, /No access/);
  });
  it('lets a listed member in, ignoring email capitals', () => {
    const env = fresh();
    env.spreadsheet().getSheetByName('cfg_members').data.push(['Sam', 'Sam@Example.com', 'member']);
    env.uncache();
    env.user.email = 'sam@example.com';
    assert.equal(env.call('api_bootstrap').me.name, 'Sam');
    assert.equal(env.run('doGet()').file, 'index');
  });
});

describe('dishes and recipes', () => {
  let env;
  before(() => { env = fresh(); });

  it('saves a dish with a full recipe and scores its healthiness automatically', () => {
    addDish(env, 'Chicken Alfredo', [['8', 'oz', 'penne'], ['1', 'lb', 'chicken breast'], ['1/2', 'cup', 'parmesan cheese'], ['', '', 'salt']]);
    const d = env.call('api_getDish', 'Chicken Alfredo');
    assert.equal(d.recipe.ingredients.length, 4);
    assert.equal(d.recipe.ingredients[2].qty, 0.5);
    assert.ok(d.dish.healthy_score >= 1 && d.dish.healthy_score <= 10);
    assert.equal(d.dish.status, 'active', 'adding a recipe promotes an idea');
  });
  it('creates unknown ingredients without an aisle', () => {
    addDish(env, 'Dragon Dish', [['1', '', 'dragon fruit powder']]);
    assert.ok(col(env, 'lib_ingredients', 'name').includes('dragon fruit powder'));
  });
  it('keeps the dish\'s servings and times when a recipe is saved without them', () => {
    env.call('api_saveDish', { name: 'Timed Dish', role: 'side', type: 'Salad', cuisine: 'American', servings: 6, prep_min: 5, cook_min: 12 });
    env.call('api_saveRecipe', 'Timed Dish', { ingredients: [{ qty_text: '2', unit: 'cup', ingredient: 'mixed greens' }], steps: [{ text: 'Toss.' }] });
    const d = env.call('api_getDish', 'Timed Dish').dish;
    assert.deepEqual([d.servings, d.prep_min, d.cook_min], [6, 5, 12]);
    env.call('api_saveRecipe', 'Timed Dish', { servings: 8, prep_min: 7, ingredients: [{ qty_text: '1', unit: 'cup', ingredient: 'mixed greens' }] });
    const e = env.call('api_getDish', 'Timed Dish').dish;
    assert.deepEqual([e.servings, e.prep_min, e.cook_min], [8, 7, 12], 'times that are sent change, the rest stay');
  });
  it('changes only the fields it is given when a dish is saved again', () => {
    env.call('api_saveDish', { name: 'Side Salad', role: 'side', type: 'Salad', cuisine: 'American', servings: 6, prep_min: 5, cook_min: 0 });
    env.call('api_saveDish', { name: 'Side Salad', original_name: 'Side Salad', favorite: true });
    const d = env.call('api_getDish', 'Side Salad').dish;
    assert.equal(d.favorite, true);
    assert.equal(d.role, 'side', 'a side stays a side');
    assert.deepEqual([d.type, d.cuisine, d.servings, d.prep_min], ['Salad', 'American', 6, 5]);
    env.call('api_saveDish', { name: 'Side Salad', original_name: 'Side Salad', type: '' });
    assert.equal(env.call('api_getDish', 'Side Salad').dish.type, '', 'a field that is sent as blank is cleared on purpose');
  });
  it('sets sides on a main without touching the rest of that dish', () => {
    addDish(env, 'Roast', null, { type: 'Beef', cuisine: 'American', servings: 6 });
    env.call('api_saveDish', { name: 'Roast', original_name: 'Roast', sides: [{ side_dish: 'Side Salad', is_default: true }] });
    const d = env.call('api_getDish', 'Roast');
    assert.deepEqual([d.dish.type, d.dish.servings, d.sides.length], ['Beef', 6, 1]);
  });
  it('does only one lock for a whole dish save, so the name check and the write cannot be split', () => {
    env.counters.locks = 0;
    env.call('api_saveDish', { name: 'Lock Test', role: 'main', sides: [{ side_dish: 'Side Salad', is_default: false }], seasons: ['Fall'] });
    assert.equal(env.counters.locks, 1);
    env.counters.locks = 0;
    env.call('api_saveRestaurant', { name: 'Lock Cafe' });
    assert.equal(env.counters.locks, 1);
  });
  it('rejects a second dish with the same name, ignoring capitals', () => {
    assert.throws(() => env.call('api_saveDish', { name: 'chicken alfredo', role: 'main' }), /already exists/);
  });
  it('stores one rating per person and averages them', () => {
    env.call('api_rate', 'dish', 'Chicken Alfredo', 5);
    env.call('api_rate', 'dish', 'Chicken Alfredo', 3);
    const d = env.call('api_getDish', 'Chicken Alfredo');
    assert.deepEqual([d.rating.mine, d.rating.count, d.rating.avg], [3, 1, 3]);
    assert.throws(() => env.call('api_rate', 'dish', 'Chicken Alfredo', 9), /1 to 5/);
  });
  it('parses a pasted recipe without saving anything', () => {
    const before = col(env, 'lib_dishes', 'name').length;
    const r = env.call('api_parseRecipeText', 'Pancakes\nServes 4\nIngredients\n2 cups flour\nDirections\n1. Mix.\n2. Fry for 3 minutes.');
    assert.equal(r.ingredients.length, 1);
    assert.equal(r.steps[1].timer_min, 3);
    assert.equal(col(env, 'lib_dishes', 'name').length, before);
  });
  it('follows a rename everywhere, and refuses names that already exist', () => {
    env.call('api_addComment', 'dish', 'Chicken Alfredo', 'Great');
    env.call('api_savePlan', '2026-10-11', [{ date: '2026-10-12', kind: 'home', dish: 'Chicken Alfredo' }], 14);
    env.call('api_renameItem', 'lib_dishes', 'Chicken Alfredo', 'Creamy Chicken');
    assert.equal(env.call('api_getDish', 'Creamy Chicken').comments.length, 1);
    assert.equal(env.call('api_getWeek', '2026-10-11', 8)[0].dish, 'Creamy Chicken');
    assert.throws(() => env.call('api_renameItem', 'lib_dishes', 'Creamy Chicken', 'dragon dish'), /already exists/);
    assert.equal(env.call('api_checkLinks').total, 0);
  });
  it('updates unsaved drafts and shopping notes when a dish is renamed', () => {
    env.call('api_saveDraft', '2026-10-18', [{ date: '2026-10-19', kind: 'home', dish: 'Creamy Chicken', locked: true }], {});
    env.call('api_getShoppingList', '2026-10-11');
    env.call('api_renameItem', 'lib_dishes', 'Creamy Chicken', 'Chicken Supreme');
    assert.equal(env.call('api_getDraft', '2026-10-18').slots[0].dish, 'Chicken Supreme');
    assert.ok(env.call('api_getShoppingList', '2026-10-11').items.every((i) => i.source_dishes.every((s) => s.dish === 'Chicken Supreme')));
  });
  it('renames a budget profile and keeps the active profile pointing at it', () => {
    env.call('api_setProfile', 'Tight budget');
    env.call('api_renameItem', 'cfg_profiles', 'Tight budget', 'Lean');
    assert.equal(env.call('api_bootstrap').activeProfile, 'Lean');
    assert.throws(() => env.call('api_setProfile', 'Nope'), /Unknown budget profile/);
  });
});

describe('planning', () => {
  let env;
  before(() => {
    env = fresh();
    ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf'].forEach((n, i) => addDish(env, n, [['1', 'cup', 'milk']], { type: ['Pasta', 'Chicken', 'Beef', 'Pork', 'Seafood', 'Vegetarian', 'Soup'][i] }));
    addDish(env, 'Garlic Bread', [['1', '', 'french bread']], { role: 'side', type: 'Other' });
    env.call('api_saveDish', { name: 'Alpha', original_name: 'Alpha', role: 'main', sides: [{ side_dish: 'Garlic Bread', is_default: true }] });
  });

  it('suggests distinct dishes, with usual sides, and never writes anything', () => {
    const dates = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
    const before = env.spreadsheet().getSheetByName('act_meal_plan').getLastRow();
    const r = env.call('api_suggestMeals', dates, [], [], dates);
    assert.equal(r.suggestions.length, 5);
    assert.equal(new Set(r.suggestions.map((s) => s.dish)).size, 5);
    assert.equal(env.spreadsheet().getSheetByName('act_meal_plan').getLastRow(), before);
    const again = env.call('api_suggestMeals', dates, r.suggestions.map((s) => s.dish), [], dates);
    again.suggestions.forEach((s) => assert.ok(!r.suggestions.some((x) => x.dish === s.dish)));
  });
  it('saves a plan, shows it, and saving the same plan again changes nothing', () => {
    const slots = [{ date: '2026-10-12', kind: 'home', dish: 'Alpha', side_1: 'Garlic Bread' }, { date: '2026-10-13', kind: 'home', dish: 'Bravo' }, { date: '2026-10-14', kind: 'home', dish: 'Charlie' }];
    assert.equal(env.call('api_savePlan', '2026-10-11', slots, 14).saved, 3);
    const week = env.call('api_getWeek', '2026-10-11', 8);
    assert.deepEqual(week.map((w) => w.dish), ['Alpha', 'Bravo', 'Charlie']);
    assert.equal(week[0].sides_info[0].name, 'Garlic Bread');
    assert.equal(week[0].servings, 4);
    const snapshot = JSON.stringify(env.spreadsheet().getSheetByName('act_meal_plan').data);
    env.call('api_savePlan', '2026-10-11', week.map((w) => ({ plan_id: w.plan_id, date: w.date, kind: w.kind, dish: w.dish, side_1: w.side_1, servings: w.servings, locked: w.locked })), 14);
    assert.equal(JSON.stringify(env.spreadsheet().getSheetByName('act_meal_plan').data), snapshot);
  });
  it('rejects two meals on the same day, a meal outside the week, and unknown dishes', () => {
    assert.throws(() => env.call('api_savePlan', '2026-10-11', [{ date: '2026-10-12', kind: 'home', dish: 'Alpha' }, { date: '2026-10-12', kind: 'home', dish: 'Bravo' }], 14), /two meals/);
    assert.throws(() => env.call('api_savePlan', '2026-10-11', [{ date: '2027-01-01', kind: 'home', dish: 'Alpha' }], 14), /outside/);
    assert.throws(() => env.call('api_savePlan', '2026-10-11', [{ date: '2026-10-15', kind: 'home', dish: 'Nonexistent' }], 14), /not in the dish list/);
  });
  it('removes planned days that are missing from a save, and keeps the others', () => {
    env.call('api_savePlan', '2026-10-11', [{ date: '2026-10-12', kind: 'home', dish: 'Alpha', side_1: 'Garlic Bread' }, { date: '2026-10-13', kind: 'home', dish: 'Bravo' }], 14);
    assert.deepEqual(env.call('api_getWeek', '2026-10-11', 8).map((w) => w.dish), ['Alpha', 'Bravo']);
    env.call('api_savePlan', '2026-10-11', [{ date: '2026-10-12', kind: 'home', dish: 'Alpha' }, { date: '2026-10-13', kind: 'home', dish: 'Bravo' }, { date: '2026-10-14', kind: 'home', dish: 'Charlie' }], 14);
  });
  it('keeps a draft per person and clears it when the plan is saved', () => {
    env.call('api_saveDraft', '2026-10-18', [{ date: '2026-10-19', kind: 'home', dish: 'Delta', locked: true }, { date: '2026-10-20', kind: 'home', dish: 'Ghost' }], { suggested: {} });
    const d = env.call('api_getDraft', '2026-10-18');
    assert.deepEqual(d.slots.map((s) => s.dish), ['Delta']);
    assert.equal(d.dropped.length, 1);
    env.call('api_savePlan', '2026-10-18', [{ date: '2026-10-19', kind: 'home', dish: 'Delta' }], 14);
    assert.equal(env.call('api_getDraft', '2026-10-18'), null);
  });
  it('lets a brand-new idea be planned and creates it as an idea', () => {
    env.call('api_setSlot', { date: '2026-10-21', kind: 'home', new_dish_name: 'Mystery Casserole' });
    assert.equal(env.call('api_getDish', 'Mystery Casserole').dish.status, 'idea');
    const dry = env.call('api_setSlot', { date: '2026-10-22', kind: 'home', dish: 'Alpha', dry_run: true });
    assert.ok(Array.isArray(dry.warnings));
    assert.equal(env.call('api_getWeek', '2026-10-22', 1).length, 0, 'a dry run writes nothing');
  });
  it('swaps, shifts and queues when moving a meal', () => {
    const w = env.call('api_getWeek', '2026-10-11', 8);
    const [a, b, c] = w;
    env.call('api_moveSlot', a.plan_id, b.date, 'swap');
    let now = env.call('api_getWeek', '2026-10-11', 8);
    assert.equal(now.find((x) => x.plan_id === a.plan_id).date, b.date);
    assert.equal(now.find((x) => x.plan_id === b.plan_id).date, a.date);
    env.call('api_moveSlot', c.plan_id, a.date, 'shift');
    now = env.call('api_getWeek', '2026-10-11', 8);
    assert.equal(now.length, w.length);
    assert.equal(new Set(now.map((x) => x.date)).size, now.length, 'no two meals share a day');
    env.call('api_moveSlot', now[0].plan_id, now[1].date, 'queue_existing');
    assert.equal(env.call('api_getWeek', '2026-10-11', 8).length, w.length - 1);
    assert.equal(env.call('api_getQueue').length, 1);
  });
  it('changes only the restaurant fields it is given', () => {
    env.call('api_saveRestaurant', { name: 'Partial Place', cuisine: 'Thai', price_level: '2', address: '1 Main St', phone: '555-1234', notes: 'try the curry' });
    env.call('api_saveRestaurant', { name: 'Partial Place', original_name: 'Partial Place', favorite: true });
    const r = env.call('api_getRestaurant', 'Partial Place').restaurant;
    assert.deepEqual([r.favorite, r.cuisine, r.price_level, r.address, r.phone, r.notes], [true, 'Thai', '2', '1 Main St', '555-1234', 'try the curry']);
    assert.throws(() => env.call('api_saveRestaurant', { name: 'partial place' }), /already exists/);
  });
  it('plans a restaurant night, asking what to do with the meal that was there', () => {
    env.call('api_saveRestaurant', { name: 'Taco Place', cuisine: 'Mexican' });
    const target = env.call('api_getWeek', '2026-10-11', 8)[0];
    assert.throws(() => env.call('api_eatOut', target.date, { name: 'Taco Place' }, null), /Choose what to do/);
    env.call('api_eatOut', target.date, { name: 'Taco Place' }, { type: 'delete' });
    const night = env.call('api_getWeek', '2026-10-11', 8).find((x) => x.date === target.date);
    assert.equal(night.kind, 'restaurant');
    env.call('api_markCooked', night.plan_id);
    assert.deepEqual(env.call('api_getRestaurant', 'Taco Place').visits, [target.date]);
  });
  it('logs past meals and refuses future or doubled-up days', () => {
    env.call('api_logPastMeal', { date: '2026-10-05', kind: 'home', dish: 'Delta' });
    env.call('api_logPastMeal', { date: '2026-10-06', kind: 'restaurant', new_restaurant_name: 'Old Favorite' });
    assert.throws(() => env.call('api_logPastMeal', { date: '2026-10-05', kind: 'home', dish: 'Echo' }), /already/);
    assert.throws(() => env.call('api_logPastMeal', { date: '2026-12-05', kind: 'home', dish: 'Echo' }), /today or earlier/);
    assert.equal(env.call('api_listDishes', { q: 'delta' })[0].last_cooked, '2026-10-05');
  });
  it('never hands out the same internal id twice', () => {
    for (let i = 1; i <= 8; i++) env.call('api_setSlot', { date: '2026-12-0' + i, kind: 'home', dish: 'Echo' });
    const ids = col(env, 'act_meal_plan', 'plan_id');
    assert.equal(new Set(ids).size, ids.length);
    const queue = col(env, 'act_queue', 'queue_id');
    assert.equal(new Set(queue).size, queue.length);
  });
  it('suggests five restaurants, then different ones, and skips recent visits', () => {
    ['Thai Garden', 'BBQ Joint', 'Sushi Bar', 'Diner', 'Pasta House', 'Burger Spot'].forEach((n) => env.call('api_saveRestaurant', { name: n, cuisine: 'American' }));
    const first = env.call('api_suggestRestaurants', '2027-03-01', []);
    assert.equal(first.restaurants.length, 5);
    const more = env.call('api_suggestRestaurants', '2027-03-01', first.restaurants.map((r) => r.name));
    more.restaurants.forEach((r) => assert.ok(!first.restaurants.some((x) => x.name === r.name)));
    const nearVisit = env.call('api_suggestRestaurants', '2026-10-12', []);
    assert.ok(!nearVisit.restaurants.some((r) => r.name === 'Taco Place' || r.name === 'Old Favorite'));
  });
});

describe('shopping', () => {
  let env;
  before(() => {
    env = fresh();
    addDish(env, 'Soup A', [['1', 'cup', 'milk'], ['2', 'clove', 'garlic'], ['1', 'tsp', 'salt'], ['1', '', 'dragon fruit powder']]);
    addDish(env, 'Soup B', [['2', 'cup', 'milk'], ['1', 'cup', 'olive oil']]);
    env.call('api_savePlan', '2026-10-11', [{ date: '2026-10-12', kind: 'home', dish: 'Soup A' }, { date: '2026-10-13', kind: 'home', dish: 'Soup B', servings: 8 }], 14);
  });
  const find = (list, name) => list.items.find((i) => i.name === name);

  it('combines ingredients, scales to the servings of the night, and groups by aisle', () => {
    const list = env.call('api_getShoppingList', '2026-10-11');
    assert.equal(find(list, 'milk').qty, 5);
    assert.equal(find(list, 'milk').source_dishes.length, 2);
    assert.equal(find(list, 'olive oil').qty, 2);
    assert.equal(list.items[0].name, 'dragon fruit powder', 'items without an aisle come first');
    assert.equal(find(list, 'salt').have_it, true, 'staples start ticked');
    assert.equal(find(list, 'garlic').have_it, false);
  });
  it('keeps ticks when the list is rebuilt and reports what changed', () => {
    let list = env.call('api_getShoppingList', '2026-10-11');
    env.call('api_setInCart', find(list, 'garlic').item_id, true);
    env.call('api_setHaveIt', find(list, 'milk').item_id, true);
    env.call('api_savePlan', '2026-10-11', [{ date: '2026-10-12', kind: 'home', dish: 'Soup A' }], 14);
    list = env.call('api_getShoppingList', '2026-10-11');
    assert.equal(find(list, 'garlic').in_cart, true);
    assert.equal(find(list, 'milk').have_it, true);
    assert.equal(find(list, 'milk').qty, 1);
    assert.ok(list.changes.removed.some((r) => r.name === 'olive oil'));
    assert.ok(list.changes.changed.some((r) => r.name === 'milk'));
  });
  it('adds typed items, running-low items, and clears running low once picked up', () => {
    env.call('api_addManualItem', '2026-10-11', 'Paper towels', '2', 'each', 'Household');
    env.call('api_markRunningLow', 'salt');
    let list = env.call('api_getShoppingList', '2026-10-11');
    assert.ok(find(list, 'Paper towels'));
    assert.equal(find(list, 'salt').have_it, false);
    assert.ok(find(list, 'salt').flags.includes('running_low'));
    env.call('api_setInCart', find(list, 'salt').item_id, true);
    assert.equal(col(env, 'act_running_low', 'cleared')[0], true);
    list = env.call('api_getShoppingList', '2026-10-11');
    assert.ok(find(list, 'Paper towels'), 'typed items survive a rebuild');
  });
  it('remembers an aisle chosen for an ingredient when asked to', () => {
    const list = env.call('api_getShoppingList', '2026-10-11');
    env.call('api_setItemAisle', find(list, 'dragon fruit powder').item_id, 'Produce', true);
    const row = env.spreadsheet().getSheetByName('lib_ingredients').data.find((r) => r[0] === 'dragon fruit powder');
    assert.equal(row[1], 'Produce');
    assert.throws(() => env.call('api_setItemAisle', find(list, 'garlic').item_id, 'Not An Aisle', false), /not in the list/);
  });
  it('keeps an aisle chosen "just for this list" after the list is rebuilt, without changing the ingredient default', () => {
    let list = env.call('api_getShoppingList', '2026-10-11');
    const milk = find(list, 'milk');
    const defaultAisle = env.spreadsheet().getSheetByName('lib_ingredients').data.find((r) => r[0] === 'milk')[1];
    assert.equal(milk.aisle, defaultAisle);
    env.call('api_setItemAisle', milk.item_id, 'Beverages', false);
    list = env.call('api_getShoppingList', '2026-10-11');
    assert.equal(find(list, 'milk').aisle, 'Beverages', 'the choice is still there after a reload');
    list = env.call('api_getShoppingList', '2026-10-11');
    assert.equal(find(list, 'milk').aisle, 'Beverages', 'and after another');
    assert.equal(env.spreadsheet().getSheetByName('lib_ingredients').data.find((r) => r[0] === 'milk')[1], defaultAisle, 'the default is untouched');
  });
  it('lets an aisle chosen for an item with no aisle stick too', () => {
    addDish(env, 'Saffron Rice', [['1', 'tsp', 'saffron threads']]);
    env.call('api_setSlot', { date: '2026-10-15', kind: 'home', dish: 'Saffron Rice' });
    let list = env.call('api_getShoppingList', '2026-10-11');
    const saffron = find(list, 'saffron threads');
    assert.equal(saffron.aisle, '');
    env.call('api_setItemAisle', saffron.item_id, 'Spices', false);
    list = env.call('api_getShoppingList', '2026-10-11');
    assert.equal(find(list, 'saffron threads').aisle, 'Spices');
    assert.equal(env.spreadsheet().getSheetByName('lib_ingredients').data.find((r) => r[0] === 'saffron threads')[1], '', 'still no default aisle');
  });
  it('gives the list as text and emails it from the signed-in person', () => {
    const text = env.call('api_getListText', '2026-10-11', false);
    assert.match(text, /== Produce ==/);
    assert.ok(!/\[x\]/.test(text));
    assert.equal(env.call('api_emailList', '2026-10-11', ['a@example.com', 'b@example.com'], false).sent, 2);
    assert.equal(env.sent.length, 1);
    assert.equal(env.sent[0].to, 'a@example.com,b@example.com');
    assert.throws(() => env.call('api_emailList', '2026-10-11', ['nope'], false), /does not look like/);
    assert.throws(() => env.call('api_emailList', '2026-10-11', [], false), /at least one/);
    assert.throws(() => env.call('api_emailList', '2026-10-11', Array(11).fill('a@example.com'), false), /up to 10/);
  });
  it('reports dishes that have no recipe yet', () => {
    env.call('api_setSlot', { date: '2026-10-14', kind: 'home', new_dish_name: 'No Recipe Yet' });
    assert.ok(env.call('api_getShoppingList', '2026-10-11').missingRecipes.some((m) => m.dish === 'No Recipe Yet'));
  });
  it('explains an email that Google refuses to send', () => {
    const e = makeEnv({ mailFail: 'Service invoked too many times for one day: email.' });
    e.call('setupAll');
    assert.throws(() => e.call('api_emailList', '2026-10-11', ['a@example.com'], false), /daily email limit/);
  });
});
