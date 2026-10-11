'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Shopping = require('../src/logic/shopping');
const Ingredients = require('../src/logic/ingredients');
const { Seed, units, slot, restaurantSlot } = require('./helpers/fixtures');

const aisles = Seed.tables.cfg_aisles;
const ingredientList = [
  { name: 'Milk', aisle: 'Dairy & Eggs', is_staple: false },
  { name: 'Salt', aisle: 'Spices', is_staple: true },
  { name: 'Garlic', aisle: 'Produce', is_staple: false },
  { name: 'Chicken Breast', aisle: 'Meat & Seafood', is_staple: false },
  { name: 'Mystery Spice', aisle: '', is_staple: false }
];
const L = (ingredient, qty, unit, extra) => Object.assign({ ingredient, qty, unit: unit || '', qty_text: qty == null ? '' : String(qty), optional: false }, extra || {});

function ctx(recipes, extra) {
  const dishes = Object.keys(recipes).map((name) => ({ name, servings: 4 }));
  const lines = {};
  Object.keys(recipes).forEach((name) => { lines[Ingredients.normalize(name)] = recipes[name]; });
  return Object.assign({
    dishesByName: Ingredients.index(dishes), recipeLinesByDish: lines, ingredientsByName: Ingredients.index(ingredientList),
    units, runningLowIngredients: [], defaultServings: 4
  }, extra || {});
}
const plan = (...slots) => slots;
const find = (items, name) => items.find((i) => i.name === name);

describe('Shopping.buildList', () => {
  it('collects main and side ingredients for planned home dinners', () => {
    const c = ctx({ Alfredo: [L('Chicken Breast', 1, 'lb')], Rice: [L('Garlic', 2, 'clove')] });
    const r = Shopping.buildList(plan(slot('2026-10-12', 'Alfredo', { side_1: 'Rice' })), c);
    assert.deepEqual(r.items.map((i) => i.name).sort(), ['Chicken Breast', 'Garlic']);
    assert.deepEqual(r.missingRecipes, []);
  });
  it('scales quantities to the servings of that night', () => {
    const c = ctx({ Alfredo: [L('Chicken Breast', 1, 'lb')] });
    assert.equal(find(Shopping.buildList(plan(slot('2026-10-12', 'Alfredo', { servings: 8 })), c).items, 'Chicken Breast').qty, 2);
    assert.equal(find(Shopping.buildList(plan(slot('2026-10-12', 'Alfredo', { servings: 2 })), c).items, 'Chicken Breast').qty, 0.5);
    assert.equal(find(Shopping.buildList(plan(slot('2026-10-12', 'Alfredo', { servings: '' })), c).items, 'Chicken Breast').qty, 1, 'blank servings means the recipe size');
  });
  it('combines the same ingredient across dishes, converting units', () => {
    const c = ctx({ A: [L('Milk', 1, 'cup')], B: [L('Milk', 2, 'cup')], C: [L('Milk', 8, 'tbsp')] });
    const r = Shopping.buildList(plan(slot('2026-10-12', 'A'), slot('2026-10-13', 'B'), slot('2026-10-14', 'C')), c);
    const milk = r.items.filter((i) => i.name === 'Milk');
    assert.equal(milk.length, 1);
    assert.equal(milk[0].qty, 3.5); assert.equal(milk[0].unit, 'cup');
    assert.deepEqual(milk[0].flags, []);
    assert.equal(milk[0].source_dishes.length, 3);
  });
  it('lists the same dish twice in a week once, with the quantity added up', () => {
    const c = ctx({ A: [L('Milk', 1, 'cup')] });
    const r = Shopping.buildList(plan(slot('2026-10-12', 'A'), slot('2026-10-16', 'A')), c);
    assert.equal(find(r.items, 'Milk').qty, 2);
  });
  it('counts a side used under two mains twice', () => {
    const c = ctx({ A: [], B: [], Rice: [L('Garlic', 1, 'clove')] });
    c.recipeLinesByDish.a = [L('Milk', 1, 'cup')]; c.recipeLinesByDish.b = [L('Milk', 1, 'cup')];
    const r = Shopping.buildList(plan(slot('2026-10-12', 'A', { side_1: 'Rice' }), slot('2026-10-13', 'B', { side_1: 'Rice' })), c);
    assert.equal(find(r.items, 'Garlic').qty, 2);
  });
  it('keeps units that cannot combine as separate flagged lines', () => {
    const c = ctx({ A: [L('Milk', 1, 'cup')], B: [L('Milk', 1, 'lb')] });
    const milk = Shopping.buildList(plan(slot('2026-10-12', 'A'), slot('2026-10-13', 'B')), c).items.filter((i) => i.name === 'Milk');
    assert.equal(milk.length, 2);
    assert.ok(milk.every((m) => m.flags.includes('unit_mismatch')));
  });
  it('leaves out optional ingredients', () => {
    const c = ctx({ A: [L('Garlic', 1, 'clove', { optional: true }), L('Milk', 1, 'cup')] });
    assert.deepEqual(Shopping.buildList(plan(slot('2026-10-12', 'A')), c).items.map((i) => i.name), ['Milk']);
  });
  it('collapses "to taste" lines, folding them into a quantity line when there is one', () => {
    const c = ctx({ A: [L('Salt', null)], B: [L('Salt', null)], C: [L('Salt', 1, 'tsp')] });
    assert.equal(Shopping.buildList(plan(slot('2026-10-12', 'A'), slot('2026-10-13', 'B')), c).items.length, 1);
    const withQty = Shopping.buildList(plan(slot('2026-10-12', 'A'), slot('2026-10-13', 'C')), c).items;
    assert.equal(withQty.length, 1);
    assert.equal(withQty[0].qty, 1);
    assert.equal(withQty[0].source_dishes.length, 2);
  });
  it('pre-ticks staples as "have it" and leaves everything else unticked', () => {
    const c = ctx({ A: [L('Salt', 1, 'tsp'), L('Milk', 1, 'cup')] });
    const r = Shopping.buildList(plan(slot('2026-10-12', 'A')), c);
    assert.equal(find(r.items, 'Salt').have_it, true);
    assert.equal(find(r.items, 'Milk').have_it, false);
    assert.ok(r.items.every((i) => i.in_cart === false && i.is_manual === false));
  });
  it('uses the stored aisle and an empty aisle for unknown ingredients', () => {
    const c = ctx({ A: [L('Milk', 1, 'cup'), L('Mystery Spice', 1, 'tsp'), L('Dragon Fruit', 1, '')] });
    const r = Shopping.buildList(plan(slot('2026-10-12', 'A')), c);
    assert.equal(find(r.items, 'Milk').aisle, 'Dairy & Eggs');
    assert.equal(find(r.items, 'Mystery Spice').aisle, '');
    assert.equal(find(r.items, 'Dragon Fruit').aisle, '');
  });
  it('skips restaurant nights, removed, replaced and cooked meals', () => {
    const c = ctx({ A: [L('Milk', 1, 'cup')] });
    const r = Shopping.buildList(plan(restaurantSlot('2026-10-12', 'Taco Place'), slot('2026-10-13', 'A', { status: 'removed' }),
      slot('2026-10-14', 'A', { status: 'replaced' }), slot('2026-10-15', 'A', { status: 'cooked' })), c);
    assert.deepEqual(r.items, []);
    assert.deepEqual(r.missingRecipes, []);
  });
  it('reports dishes that have no recipe yet', () => {
    const c = ctx({ A: [L('Milk', 1, 'cup')], Empty: [] });
    const r = Shopping.buildList(plan(slot('2026-10-12', 'A'), slot('2026-10-13', 'Empty'), slot('2026-10-14', 'Unknown Dish')), c);
    assert.deepEqual(r.missingRecipes, [{ date: '2026-10-13', dish: 'Empty' }, { date: '2026-10-14', dish: 'Unknown Dish' }]);
    assert.equal(r.items.length, 1);
  });
  it('adds running-low ingredients, un-ticking a staple that is already on the list', () => {
    const c = ctx({ A: [L('Salt', 1, 'tsp')] }, { runningLowIngredients: ['salt', 'Milk', 'Milk'] });
    const r = Shopping.buildList(plan(slot('2026-10-12', 'A')), c);
    assert.equal(find(r.items, 'Salt').have_it, false);
    assert.ok(find(r.items, 'Salt').flags.includes('running_low'));
    const milk = r.items.filter((i) => i.name === 'Milk');
    assert.equal(milk.length, 1);
    assert.equal(milk[0].qty, null);
    assert.deepEqual(milk[0].flags, ['running_low']);
  });
  it('returns an empty list for an empty plan', () => {
    assert.deepEqual(Shopping.buildList([], ctx({})), { items: [], missingRecipes: [] });
  });
});

describe('Shopping.mergeWithExisting', () => {
  const built = (name, qty, unit, extra) => Object.assign({ ingredient: name, name, qty, unit: unit || '', aisle: '', have_it: false, in_cart: false, source_dishes: [], flags: [], is_manual: false }, extra || {});

  it('keeps ticks and ids from the existing list', () => {
    const r = Shopping.mergeWithExisting([built('Milk', 2, 'cup'), built('Salt', 1, 'tsp', { have_it: true })],
      [built('Milk', 2, 'cup', { have_it: true, in_cart: true, item_id: 'I-0001' }), built('Salt', 1, 'tsp', { have_it: false, item_id: 'I-0002' })]);
    const milk = find(r.items, 'Milk');
    assert.equal(milk.have_it, true); assert.equal(milk.in_cart, true); assert.equal(milk.item_id, 'I-0001');
    assert.equal(find(r.items, 'Salt').have_it, false, 'an un-ticked staple stays un-ticked');
  });
  it('reports what was added, removed and changed', () => {
    const r = Shopping.mergeWithExisting([built('Milk', 3, 'cup'), built('Garlic', 1, 'clove')], [built('Milk', 2, 'cup'), built('Gone', 1, 'lb')]);
    assert.deepEqual(r.changes.added.map((a) => a.name), ['Garlic']);
    assert.deepEqual(r.changes.removed.map((a) => a.name), ['Gone']);
    assert.deepEqual(r.changes.changed, [{ name: 'Milk', from: 2, to: 3 }]);
    assert.ok(!find(r.items, 'Gone'));
  });
  it('keeps a no-longer-needed item that is already in the cart, flagged', () => {
    const r = Shopping.mergeWithExisting([], [built('Old', 1, 'lb', { in_cart: true })]);
    assert.equal(r.items.length, 1);
    assert.ok(r.items[0].flags.includes('no_longer_needed'));
    assert.deepEqual(r.changes.removed.map((x) => x.name), ['Old']);
  });
  it('always keeps manual items', () => {
    const manual = { ingredient: '', name: 'Paper towels', qty: 2, unit: '', aisle: 'Household', have_it: false, in_cart: false, flags: [], is_manual: true };
    const r = Shopping.mergeWithExisting([built('Milk', 1, 'cup')], [manual]);
    assert.ok(find(r.items, 'Paper towels'));
    assert.deepEqual(r.changes.removed, []);
  });
  it('treats a different unit as a different line', () => {
    const r = Shopping.mergeWithExisting([built('Milk', 1, 'lb')], [built('Milk', 1, 'cup', { have_it: true })]);
    assert.equal(find(r.items, 'Milk').have_it, false);
    assert.equal(r.changes.added.length, 1);
  });
  it('keeps an aisle chosen just for this list, even if the ingredient default is different', () => {
    const r = Shopping.mergeWithExisting([built('Milk', 1, 'cup', { aisle: 'Dairy & Eggs' })], [built('Milk', 1, 'cup', { aisle: 'Beverages' })]);
    assert.equal(find(r.items, 'Milk').aisle, 'Beverages');
  });
  it('lets a blank aisle on the existing line take the ingredient default', () => {
    const r = Shopping.mergeWithExisting([built('Milk', 1, 'cup', { aisle: 'Dairy & Eggs' })], [built('Milk', 1, 'cup', { aisle: '' })]);
    assert.equal(find(r.items, 'Milk').aisle, 'Dairy & Eggs');
  });
  it('gives a brand-new line the ingredient default aisle', () => {
    const r = Shopping.mergeWithExisting([built('Milk', 1, 'cup', { aisle: 'Dairy & Eggs' })], []);
    assert.equal(find(r.items, 'Milk').aisle, 'Dairy & Eggs');
  });
  it('un-ticks an item that has just been marked running low', () => {
    const r = Shopping.mergeWithExisting([built('Salt', 1, 'tsp', { flags: ['running_low'] })], [built('Salt', 1, 'tsp', { have_it: true, in_cart: true })]);
    assert.equal(find(r.items, 'Salt').have_it, false);
    assert.equal(find(r.items, 'Salt').in_cart, false);
  });
  it('keeps the ticks of an item that was already marked running low', () => {
    const r = Shopping.mergeWithExisting([built('Salt', 1, 'tsp', { flags: ['running_low'] })], [built('Salt', 1, 'tsp', { in_cart: true, flags: ['running_low'] })]);
    assert.equal(find(r.items, 'Salt').in_cart, true);
  });
  it('understands ticks stored as TRUE/FALSE text', () => {
    const r = Shopping.mergeWithExisting([built('Milk', 1, 'cup')], [built('Milk', 1, 'cup', { have_it: 'TRUE', in_cart: 'FALSE' })]);
    assert.equal(find(r.items, 'Milk').have_it, true);
    assert.equal(find(r.items, 'Milk').in_cart, false);
  });
  it('does not change its inputs', () => {
    const newItems = [built('Milk', 1, 'cup')];
    const existing = [built('Milk', 1, 'cup', { have_it: true })];
    const a = JSON.stringify(newItems); const b = JSON.stringify(existing);
    Shopping.mergeWithExisting(newItems, existing);
    assert.equal(JSON.stringify(newItems), a); assert.equal(JSON.stringify(existing), b);
  });
});

describe('Shopping.sortByAisle', () => {
  it('puts uncategorized first, then follows the aisle order, then the name', () => {
    const items = [
      { name: 'Milk', aisle: 'Dairy & Eggs' }, { name: 'Apple', aisle: 'Produce' }, { name: 'Zucchini', aisle: 'Produce' },
      { name: 'Mystery', aisle: '' }, { name: 'Salt', aisle: 'Spices' }, { name: 'Odd', aisle: 'Not An Aisle' }
    ];
    assert.deepEqual(Shopping.sortByAisle(items, aisles).map((i) => i.name), ['Mystery', 'Odd', 'Apple', 'Zucchini', 'Milk', 'Salt']);
  });
  it('follows a re-ordered aisle list', () => {
    const custom = [{ name: 'Spices', sort_order: 1 }, { name: 'Produce', sort_order: 2 }];
    assert.deepEqual(Shopping.sortByAisle([{ name: 'a', aisle: 'Produce' }, { name: 'b', aisle: 'Spices' }], custom).map((i) => i.name), ['b', 'a']);
  });
  it('does not change the original array', () => {
    const items = [{ name: 'b', aisle: 'Spices' }, { name: 'a', aisle: 'Produce' }];
    Shopping.sortByAisle(items, aisles);
    assert.equal(items[0].name, 'b');
  });
});

describe('Shopping.formatText and formatHtml', () => {
  const items = [
    { name: 'chicken breast', aisle: 'Meat & Seafood', qty: 1.5, unit: 'lb', have_it: false },
    { name: 'milk', aisle: 'Dairy & Eggs', qty: 1, unit: 'cup', have_it: false },
    { name: 'salt', aisle: 'Spices', qty: null, unit: '', have_it: true },
    { name: 'eggs', aisle: 'Dairy & Eggs', qty: 6, unit: 'each', have_it: false },
    { name: 'mystery', aisle: '', qty: null, unit: '', have_it: false }
  ];
  it('groups by aisle in store order with readable amounts', () => {
    const text = Shopping.formatText(items, aisles, {});
    assert.equal(text, ['== Uncategorized ==', '[ ] mystery', '', '== Meat & Seafood ==', '[ ] 1½ lb chicken breast', '',
      '== Dairy & Eggs ==', '[ ] 6 eggs', '[ ] 1 cup milk'].join('\n'));
  });
  it('leaves out items already at home unless asked', () => {
    assert.ok(!/salt/.test(Shopping.formatText(items, aisles, {})));
    assert.ok(/\[x\] salt/.test(Shopping.formatText(items, aisles, { includeHave: true })));
  });
  it('produces HTML with escaped text', () => {
    const html = Shopping.formatHtml([{ name: '<b>bold</b> & "quotes"', aisle: 'Produce<script>', qty: 1, unit: '', have_it: false }], aisles, {});
    assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quotes&quot;'));
    assert.ok(html.includes('Produce&lt;script&gt;'));
    assert.ok(!/<script/i.test(html));
  });
  it('returns empty output for an empty list', () => {
    assert.equal(Shopping.formatText([], aisles, {}), '');
    assert.equal(Shopping.formatHtml([], aisles, {}), '');
  });
});
