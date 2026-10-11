'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Health = require('../src/logic/health');
const Ingredients = require('../src/logic/ingredients');
const { healthRules } = require('./helpers/fixtures');

const base = { health_base: 5, health_scale: 1.5 };
const ings = (pairs) => Ingredients.index(pairs.map(([name, tag]) => ({ name, health_tag: tag })));
const lines = (...names) => names.map((n) => ({ ingredient: n }));

describe('Health.scoreDish', () => {
  it('matches the worked example: +3 +2 -1 -1 and grilled gives 7', () => {
    const idx = ings([['a', 'leafy_veg'], ['b', 'vegetable'], ['c', 'refined_carb'], ['d', 'dairy_rich']]);
    assert.equal(Health.scoreDish({ cook_method: 'grilled' }, lines('a', 'b', 'c', 'd'), idx, healthRules, base), 7);
  });
  it('returns the base score when no ingredient has a tag', () => {
    assert.equal(Health.scoreDish({}, lines('x'), ings([['x', '']]), healthRules, base), 5);
    assert.equal(Health.scoreDish({}, [], {}, healthRules, base), 5);
  });
  it('still applies the cooking method when nothing is tagged', () => {
    assert.equal(Health.scoreDish({ cook_method: 'fried' }, [], {}, healthRules, base), 3);
  });
  it('clamps between 1 and 10', () => {
    const greens = ings([['g', 'leafy_veg']]);
    assert.equal(Health.scoreDish({ cook_method: 'steamed' }, lines('g'), greens, healthRules, { health_base: 9, health_scale: 3 }), 10);
    const junk = ings([['j', 'processed_meat']]);
    assert.equal(Health.scoreDish({ cook_method: 'fried' }, lines('j'), junk, healthRules, { health_base: 2, health_scale: 3 }), 1);
  });
  it('ignores unknown tags, optional lines and ingredients that are not in the list', () => {
    const idx = ings([['a', 'mystery_tag'], ['b', 'leafy_veg']]);
    const withOptional = [{ ingredient: 'a' }, { ingredient: 'b', optional: true }, { ingredient: 'ghost' }];
    assert.equal(Health.scoreDish({}, withOptional, idx, healthRules, base), 5);
  });
  it('averages by line, so a longer recipe is not scored higher', () => {
    const idx = ings([['a', 'vegetable']]);
    const one = Health.scoreDish({}, lines('a'), idx, healthRules, base);
    const five = Health.scoreDish({}, lines('a', 'a', 'a', 'a', 'a'), idx, healthRules, base);
    assert.equal(one, five);
  });
  it('is not case sensitive about ingredient names or tags', () => {
    const idx = ings([['Spinach', 'LEAFY_VEG']]);
    assert.equal(Health.scoreDish({}, lines('  spinach '), idx, healthRules, base), 10); // 5 + 3 * 1.5 = 9.5 rounds to 10
  });
  it('returns a whole number', () => {
    const idx = ings([['a', 'fruit'], ['b', 'neutral']]);
    assert.equal(Number.isInteger(Health.scoreDish({}, lines('a', 'b'), idx, healthRules, base)), true);
  });
});

describe('Health.scoreMeal', () => {
  it('averages the main and the sides to one decimal', () => {
    assert.equal(Health.scoreMeal(8, [6]), 7);
    assert.equal(Health.scoreMeal(7, [6, 6]), 6.3);
  });
  it('skips sides without a score', () => {
    assert.equal(Health.scoreMeal(8, [null, '']), 8);
    assert.equal(Health.scoreMeal(null, [6]), 6);
  });
  it('returns null when nothing has a score', () => {
    assert.equal(Health.scoreMeal(null, []), null);
    assert.equal(Health.scoreMeal(undefined, [null]), null);
  });
});
