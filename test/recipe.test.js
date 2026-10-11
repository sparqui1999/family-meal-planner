'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Recipe = require('../src/logic/recipe');

describe('Recipe.scaleIngredients', () => {
  const lines = [
    { ingredient: 'flour', qty: 2, qty_text: '2', unit: 'cup' },
    { ingredient: 'salt', qty: null, qty_text: 'to taste', unit: '' },
    { ingredient: 'milk', qty: 1, qty_text: '1', unit: 'cup' }
  ];
  it('scales quantities and rewrites the amount text', () => {
    const out = Recipe.scaleIngredients(lines, 4, 6);
    assert.equal(out[0].qty, 3); assert.equal(out[0].qty_text, '3');
    assert.equal(out[2].qty, 1.5); assert.equal(out[2].qty_text, '1½');
  });
  it('leaves lines without a number alone', () => {
    const out = Recipe.scaleIngredients(lines, 4, 8);
    assert.equal(out[1].qty, null); assert.equal(out[1].qty_text, 'to taste');
  });
  it('rounds awkward results to the nearest eighth', () => {
    const out = Recipe.scaleIngredients([{ qty: 1, qty_text: '1' }], 3, 4);
    assert.equal(out[0].qty_text, '1⅓');
  });
  it('does not change the original lines', () => {
    Recipe.scaleIngredients(lines, 4, 8);
    assert.equal(lines[0].qty, 2);
  });
  it('refuses zero or negative servings', () => {
    assert.throws(() => Recipe.scaleIngredients(lines, 4, 0), /greater than zero/);
    assert.throws(() => Recipe.scaleIngredients(lines, 0, 4), /greater than zero/);
    assert.throws(() => Recipe.scaleIngredients(lines, 4, -2), /greater than zero/);
  });
});

describe('Recipe.groupByLabel', () => {
  it('groups in order with the unlabeled group first', () => {
    const groups = Recipe.groupByLabel([
      { n: 1, group_label: 'Sauce' }, { n: 2, group_label: '' }, { n: 3, group_label: 'Sauce' }, { n: 4, group_label: 'Topping' }, { n: 5 }
    ]);
    assert.deepEqual(groups.map((g) => g.label), ['', 'Sauce', 'Topping']);
    assert.deepEqual(groups[0].lines.map((l) => l.n), [2, 5]);
    assert.deepEqual(groups[1].lines.map((l) => l.n), [1, 3]);
  });
  it('returns nothing for no lines', () => {
    assert.deepEqual(Recipe.groupByLabel([]), []);
  });
});
