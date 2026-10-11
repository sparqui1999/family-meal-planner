'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Units = require('../src/logic/units');
const { units } = require('./helpers/fixtures');

describe('Units.parseQty', () => {
  it('reads whole numbers, decimals, fractions and mixed numbers', () => {
    assert.deepEqual(Units.parseQty('2'), { qty: 2, approx: false });
    assert.deepEqual(Units.parseQty('0.5'), { qty: 0.5, approx: false });
    assert.deepEqual(Units.parseQty('3/4'), { qty: 0.75, approx: false });
    assert.deepEqual(Units.parseQty('1 1/2'), { qty: 1.5, approx: false });
  });
  it('reads unicode fractions', () => {
    assert.equal(Units.parseQty('½').qty, 0.5);
    assert.equal(Units.parseQty('1½').qty, 1.5);
    assert.equal(Units.parseQty('2 ¼').qty, 2.25);
  });
  it('takes the upper end of a range and marks it approximate', () => {
    assert.deepEqual(Units.parseQty('2-3'), { qty: 3, approx: true });
    assert.deepEqual(Units.parseQty('1 to 2'), { qty: 2, approx: true });
  });
  it('treats 1-1/2 as a mixed number, not a range', () => {
    assert.deepEqual(Units.parseQty('1-1/2'), { qty: 1.5, approx: false });
  });
  it('returns null for blank or non-numeric text', () => {
    assert.equal(Units.parseQty('').qty, null);
    assert.equal(Units.parseQty(null).qty, null);
    assert.equal(Units.parseQty('a pinch').qty, null);
    assert.equal(Units.parseQty('to taste').qty, null);
  });
  it('rejects a fraction with a zero denominator', () => {
    assert.equal(Units.parseQty('3/0').qty, null);
  });
});

describe('Units.formatQty', () => {
  it('formats whole numbers and eighths', () => {
    assert.equal(Units.formatQty(2), '2');
    assert.equal(Units.formatQty(1.5), '1½');
    assert.equal(Units.formatQty(0.25), '¼');
    assert.equal(Units.formatQty(0.75), '¾');
    assert.equal(Units.formatQty(2.125), '2⅛');
  });
  it('formats thirds', () => {
    assert.equal(Units.formatQty(1 / 3), '⅓');
    assert.equal(Units.formatQty(0.667), '⅔');
    assert.equal(Units.formatQty(1 + 1 / 3), '1⅓');
  });
  it('rounds to the nearest eighth and carries into the whole number', () => {
    assert.equal(Units.formatQty(0.99), '1');
    assert.equal(Units.formatQty(1.96), '2');
  });
  it('never shows zero for a tiny positive amount', () => {
    assert.equal(Units.formatQty(0.01), '⅛');
  });
  it('returns an empty string for missing quantities', () => {
    assert.equal(Units.formatQty(null), '');
    assert.equal(Units.formatQty(undefined), '');
    assert.equal(Units.formatQty(NaN), '');
  });
});

describe('Units.normalizeUnit', () => {
  it('maps plurals, aliases and capitals to the standard unit', () => {
    assert.equal(Units.normalizeUnit('Tablespoons', units), 'tbsp');
    assert.equal(Units.normalizeUnit('cups', units), 'cup');
    assert.equal(Units.normalizeUnit('LBS', units), 'lb');
    assert.equal(Units.normalizeUnit('fl. oz', units), 'fl oz');
    assert.equal(Units.normalizeUnit('cloves', units), 'clove');
  });
  it('returns null for unknown or blank units', () => {
    assert.equal(Units.normalizeUnit('banana', units), null);
    assert.equal(Units.normalizeUnit('', units), null);
    assert.equal(Units.normalizeUnit(null, units), null);
  });
});

describe('Units.convert', () => {
  it('converts within volume and weight', () => {
    assert.equal(Units.convert(3, 'tsp', 'tbsp', units), 1);
    assert.equal(Units.convert(1, 'cup', 'tbsp', units), 16);
    assert.ok(Math.abs(Units.convert(1, 'lb', 'oz', units) - 16) < 0.001);
  });
  it('returns the same quantity for the same unit, even an unknown one', () => {
    assert.equal(Units.convert(5, 'cup', 'cup', units), 5);
    assert.equal(Units.convert(5, 'splash', 'splash', units), 5);
  });
  it('returns null across families, for unknown units, and between different count units', () => {
    assert.equal(Units.convert(1, 'cup', 'lb', units), null);
    assert.equal(Units.convert(1, 'splash', 'cup', units), null);
    assert.equal(Units.convert(1, 'clove', 'can', units), null);
  });
});

describe('Units.combine', () => {
  it('adds the same unit', () => {
    assert.deepEqual(Units.combine({ qty: 1, unit: 'cup' }, { qty: 2, unit: 'cup' }, units), { qty: 3, unit: 'cup' });
  });
  it('converts the second quantity into the first unit', () => {
    assert.deepEqual(Units.combine({ qty: 1, unit: 'cup' }, { qty: 16, unit: 'tbsp' }, units), { qty: 2, unit: 'cup' });
    assert.deepEqual(Units.combine({ qty: 16, unit: 'tbsp' }, { qty: 1, unit: 'cup' }, units), { qty: 32, unit: 'tbsp' });
  });
  it('adds identical unknown units', () => {
    assert.deepEqual(Units.combine({ qty: 1, unit: 'splash' }, { qty: 2, unit: 'splash' }, units), { qty: 3, unit: 'splash' });
  });
  it('returns null when units cannot be combined', () => {
    assert.equal(Units.combine({ qty: 1, unit: 'cup' }, { qty: 1, unit: 'lb' }, units), null);
    assert.equal(Units.combine({ qty: 1, unit: 'clove' }, { qty: 1, unit: 'can' }, units), null);
  });
  it('returns null when either quantity is missing', () => {
    assert.equal(Units.combine({ qty: null, unit: '' }, { qty: 1, unit: '' }, units), null);
  });
  it('combines amounts with no unit', () => {
    assert.deepEqual(Units.combine({ qty: 2, unit: '' }, { qty: 3, unit: '' }, units), { qty: 5, unit: '' });
  });
});
