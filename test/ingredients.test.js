'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Ingredients = require('../src/logic/ingredients');

describe('Ingredients.normalize', () => {
  it('lowercases, trims, collapses spaces and strips punctuation', () => {
    assert.equal(Ingredients.normalize('  Mom\'s   Chili!  '), 'mom s chili');
    assert.equal(Ingredients.normalize('CHICKEN Breast'), 'chicken breast');
  });
  it('keeps accented letters and digits', () => {
    assert.equal(Ingredients.normalize('Jalapeño 2'), 'jalapeño 2');
  });
  it('handles null and undefined', () => {
    assert.equal(Ingredients.normalize(null), '');
    assert.equal(Ingredients.normalize(undefined), '');
  });
});

describe('Ingredients.index', () => {
  it('keys items by normalized name', () => {
    const map = Ingredients.index([{ name: 'Chicken Breast' }, { name: 'Salt' }]);
    assert.equal(map['chicken breast'].name, 'Chicken Breast');
    assert.equal(map.salt.name, 'Salt');
  });
  it('copes with an empty list', () => {
    assert.deepEqual(Ingredients.index(undefined), {});
  });
});

describe('Ingredients.match', () => {
  const list = [{ name: 'Chicken Breast' }, { name: 'Egg' }, { name: 'Onions' }];
  it('matches exactly after normalizing', () => {
    assert.equal(Ingredients.match('  chicken breast ', list).name, 'Chicken Breast');
  });
  it('tolerates a missing or extra trailing s', () => {
    assert.equal(Ingredients.match('eggs', list).name, 'Egg');
    assert.equal(Ingredients.match('onion', list).name, 'Onions');
    assert.equal(Ingredients.match('Chicken Breasts', list).name, 'Chicken Breast');
  });
  it('does not guess at misspellings or blank names', () => {
    assert.equal(Ingredients.match('chiken breast', list), null);
    assert.equal(Ingredients.match('', list), null);
    assert.equal(Ingredients.match('butter', list), null);
  });
});
