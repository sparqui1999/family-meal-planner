'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Ratings = require('../src/logic/ratings');

describe('Ratings.average', () => {
  it('averages star ratings given as numbers or text', () => {
    assert.deepEqual(Ratings.average([{ stars: '4' }, { stars: 5 }]), { avg: 4.5, count: 2 });
  });
  it('rounds to two decimals', () => {
    assert.deepEqual(Ratings.average([{ stars: 5 }, { stars: 5 }, { stars: 4 }]), { avg: 4.67, count: 3 });
  });
  it('returns no average when there are no valid ratings', () => {
    assert.deepEqual(Ratings.average([]), { avg: null, count: 0 });
    assert.deepEqual(Ratings.average(undefined), { avg: null, count: 0 });
  });
  it('ignores out-of-range or blank stars', () => {
    assert.deepEqual(Ratings.average([{ stars: 0 }, { stars: 7 }, { stars: '' }, { stars: 3 }]), { avg: 3, count: 1 });
  });
});

describe('Ratings.byItem', () => {
  it('groups ratings by normalized name', () => {
    const map = Ratings.byItem([
      { dish: 'Beef Tacos', stars: 5 }, { dish: 'beef tacos', stars: 3 }, { dish: 'Chili', stars: 4 }, { dish: '', stars: 1 }
    ], 'dish');
    assert.deepEqual(map['beef tacos'], { avg: 4, count: 2 });
    assert.deepEqual(map.chili, { avg: 4, count: 1 });
    assert.equal(Object.keys(map).length, 2);
  });
});
