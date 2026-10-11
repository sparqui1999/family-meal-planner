'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const References = require('../src/logic/references');
const Schema = require('../src/data/schema');

function tables() {
  return {
    lib_dishes: [{ name: 'Tacos', role: 'main' }, { name: 'Rice', role: 'side' }, { name: 'Chili', role: 'main' }],
    lib_dish_sides: [{ main_dish: 'Tacos', side_dish: 'Rice', is_default: true }],
    act_meal_plan: [{ date: '2026-10-12', dish: 'tacos', side_1: 'Rice', side_2: '', side_3: '', status: 'planned' }],
    act_dish_comments: [{ dish: 'TACOS', member: 'Sam', text: 'yum' }],
    cfg_members: [{ name: 'Sam', email: 's@example.com', role: 'admin' }]
  };
}

describe('References.referencingColumns', () => {
  it('lists every column that holds dish names', () => {
    const cols = References.referencingColumns(Schema, 'lib_dishes').map((c) => c.tab + '.' + c.column);
    for (const expected of ['act_meal_plan.dish', 'act_meal_plan.side_1', 'act_meal_plan.side_2', 'act_meal_plan.side_3',
      'lib_dish_sides.main_dish', 'lib_dish_sides.side_dish', 'lib_recipe_ingredients.dish', 'act_dish_ratings.dish', 'act_queue.dish']) {
      assert.ok(cols.includes(expected), 'missing ' + expected);
    }
  });
  it('returns nothing for a tab nobody refers to', () => {
    assert.deepEqual(References.referencingColumns(Schema, 'act_queue'), []);
  });
});

describe('References.applyRename', () => {
  it('renames the key cell and every reference, ignoring case', () => {
    const t = tables();
    const r = References.applyRename(t, Schema, 'lib_dishes', 'Tacos', 'Street Tacos');
    assert.equal(r.count, 4);
    assert.equal(r.tables.lib_dishes[0].name, 'Street Tacos');
    assert.equal(r.tables.lib_dish_sides[0].main_dish, 'Street Tacos');
    assert.equal(r.tables.act_meal_plan[0].dish, 'Street Tacos');
    assert.equal(r.tables.act_dish_comments[0].dish, 'Street Tacos');
  });
  it('leaves the original tables untouched', () => {
    const t = tables();
    References.applyRename(t, Schema, 'lib_dishes', 'Tacos', 'Street Tacos');
    assert.equal(t.lib_dishes[0].name, 'Tacos');
    assert.equal(t.act_meal_plan[0].dish, 'tacos');
  });
  it('only changes the renamed item, not others', () => {
    const r = References.applyRename(tables(), Schema, 'lib_dishes', 'Tacos', 'Street Tacos');
    assert.equal(r.tables.lib_dishes[1].name, 'Rice');
    assert.equal(r.tables.act_meal_plan[0].side_1, 'Rice');
  });
  it('allows a change of capitalization only', () => {
    const r = References.applyRename(tables(), Schema, 'lib_dishes', 'Tacos', 'TACOS');
    assert.equal(r.tables.lib_dishes[0].name, 'TACOS');
  });
  it('refuses a new name that another item already has', () => {
    assert.throws(() => References.applyRename(tables(), Schema, 'lib_dishes', 'Tacos', 'chili'), /already exists/);
  });
  it('refuses an empty new name, an unknown old name, and a tab with no name column', () => {
    assert.throws(() => References.applyRename(tables(), Schema, 'lib_dishes', 'Tacos', '   '), /empty/);
    assert.throws(() => References.applyRename(tables(), Schema, 'lib_dishes', 'Ghost', 'X'), /not found/);
    assert.throws(() => References.applyRename(tables(), Schema, 'act_queue', 'a', 'b'), /no name column/);
  });
});

describe('References.findOrphans', () => {
  it('reports names that match nothing, with sheet row numbers', () => {
    const t = tables();
    t.act_meal_plan[0].side_2 = 'Ghost';
    const orphans = References.findOrphans(t, Schema);
    assert.deepEqual(orphans, [{ tab: 'act_meal_plan', row: 2, column: 'side_2', value: 'Ghost' }]);
  });
  it('uses the row number supplied by the caller when there is one', () => {
    const t = tables();
    t.act_meal_plan[0].side_2 = 'Ghost';
    t.act_meal_plan[0]._row = 17;
    assert.equal(References.findOrphans(t, Schema)[0].row, 17);
  });
  it('ignores blanks, enums, internal ids and matches case-insensitively', () => {
    assert.deepEqual(References.findOrphans(tables(), Schema), []);
  });
  it('finds nothing in a clean data set and also copes with missing tables', () => {
    assert.deepEqual(References.findOrphans({}, Schema), []);
  });
});

describe('References.isDuplicateName', () => {
  const rows = [{ name: 'A' }, { name: 'b' }];
  it('detects a duplicate ignoring case', () => {
    assert.equal(References.isDuplicateName(rows, 'name', 'B'), true);
    assert.equal(References.isDuplicateName(rows, 'name', 'C'), false);
  });
  it('ignores the row being edited', () => {
    assert.equal(References.isDuplicateName(rows, 'name', 'A', 0), false);
    assert.equal(References.isDuplicateName(rows, 'name', 'A', 1), true);
  });
});
