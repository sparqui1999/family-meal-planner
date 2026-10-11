'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Scoring = require('../src/logic/scoring');
const { Seed, settings, dish } = require('./helpers/fixtures');
const { seeded } = require('./helpers/rng');

const TUE = '2026-10-13';
const SAT = '2026-10-17';
const never = () => Infinity;
const ctx = (extra) => Object.assign({ settings, ratingByDish: {}, daysSince: never, typeWeights: {} }, extra || {});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + ' vs ' + b);

describe('Scoring.parseSettings', () => {
  it('turns numeric text into numbers and keeps other text', () => {
    assert.equal(settings.repeat_days, 21);
    assert.equal(settings.w_time_penalty, 0.75);
    assert.equal(settings.cook_time_mode, 'soft');
    assert.equal(settings.timezone, 'America/Los_Angeles');
  });
  it('adds a weekend list and season months', () => {
    assert.deepEqual(settings.weekend_days_list, [0, 6]);
    assert.deepEqual(settings.season_months.Winter, [12, 1, 2]);
    assert.deepEqual(settings.season_months.Fall, [9, 10, 11]);
  });
  it('falls back to defaults for missing keys', () => {
    const s = Scoring.parseSettings([]);
    assert.deepEqual(s.weekend_days_list, [0, 6]);
    assert.deepEqual(s.season_months.Summer, [6, 7, 8]);
  });
});

describe('Scoring.typeWeightMap', () => {
  it('returns multipliers for one profile, keyed by normalized type', () => {
    const map = Scoring.typeWeightMap(Seed.tables.cfg_type_weights, 'Tight budget');
    assert.equal(map.beef, 0.4);
    assert.equal(map.chicken, 1.5);
    assert.equal(map.pork, 1);
    assert.equal(Scoring.typeWeightMap(Seed.tables.cfg_type_weights, 'normal').beef, 1);
  });
});

describe('Scoring.cookLimit and exceedsCookLimit', () => {
  it('uses the weeknight limit on weekdays and the weekend limit on weekends', () => {
    assert.equal(Scoring.cookLimit(TUE, settings), 45);
    assert.equal(Scoring.cookLimit(SAT, settings), 120);
  });
  it('compares prep plus cook time to the limit', () => {
    const roast = dish('Roast', 'Beef', { prep_min: 30, cook_min: 60 });
    assert.equal(Scoring.exceedsCookLimit(roast, TUE, settings), true);
    assert.equal(Scoring.exceedsCookLimit(roast, SAT, settings), false);
    assert.equal(Scoring.exceedsCookLimit(dish('Quick', 'Pasta', { prep_min: 10, cook_min: 35 }), TUE, settings), false);
    assert.equal(Scoring.exceedsCookLimit(dish('Unknown', 'Pasta', { prep_min: null, cook_min: '' }), TUE, settings), false);
  });
});

describe('Scoring.daysSince', () => {
  it('finds the nearest day in either direction', () => {
    assert.equal(Scoring.daysSince('x', '2026-10-13', ['2026-10-01', '2026-10-10', '2026-10-20']), 3);
  });
  it('is Infinity when there is no history', () => {
    assert.equal(Scoring.daysSince('x', TUE, []), Infinity);
    assert.equal(Scoring.daysSince('x', TUE, undefined), Infinity);
  });
});

describe('Scoring.scoreDish', () => {
  const plain = dish('Plain Dish', 'Pasta');
  it('scores a never-made, unrated dish at 2 (1 + full recency bonus)', () => {
    near(Scoring.scoreDish(plain, TUE, ctx()), 2);
  });
  it('adds a bonus for favorites', () => {
    near(Scoring.scoreDish(dish('Plain Dish', 'Pasta', { favorite: true }), TUE, ctx()), 2.5);
  });
  it('rewards high ratings and penalizes low ones', () => {
    near(Scoring.scoreDish(plain, TUE, ctx({ ratingByDish: { 'plain dish': { avg: 5, count: 2 } } })), 3);
    near(Scoring.scoreDish(plain, TUE, ctx({ ratingByDish: { 'plain dish': { avg: 1, count: 2 } } })), 1);
  });
  it('gives a bigger bonus the longer it has been, up to a cap', () => {
    const at = (days) => Scoring.scoreDish(plain, TUE, ctx({ daysSince: () => days }));
    near(at(0), 1); near(at(45), 1.5); near(at(90), 2); near(at(900), 2);
  });
  it('nudges healthier dishes up', () => {
    near(Scoring.scoreDish(dish('Plain Dish', 'Pasta', { health_score: 10 }), TUE, ctx()), 2.3);
    near(Scoring.scoreDish(dish('Plain Dish', 'Pasta', { health_score: null }), TUE, ctx()), 2);
  });
  it('adds a bonus when the dish suits the season of that date', () => {
    near(Scoring.scoreDish(dish('Plain Dish', 'Pasta', { seasons: ['Fall'] }), TUE, ctx()), 2.5);
    near(Scoring.scoreDish(dish('Plain Dish', 'Pasta', { seasons: ['Winter'] }), TUE, ctx()), 2);
    near(Scoring.scoreDish(dish('Plain Dish', 'Pasta', { seasons: ['fall'] }), TUE, ctx()), 2.5);
  });
  it('uses the season of the date, which can change at a month boundary', () => {
    const winter = dish('Plain Dish', 'Pasta', { seasons: ['Winter'] });
    near(Scoring.scoreDish(winter, '2026-11-30', ctx()), 2);
    near(Scoring.scoreDish(winter, '2026-12-01', ctx()), 2.5);
  });
  it('penalizes long dishes on weeknights only in soft mode', () => {
    const slow = dish('Slow', 'Beef', { prep_min: 20, cook_min: 60 });
    near(Scoring.scoreDish(slow, TUE, ctx()), 1.25);
    near(Scoring.scoreDish(slow, SAT, ctx()), 2);
    near(Scoring.scoreDish(slow, TUE, ctx({ settings: Object.assign({}, settings, { cook_time_mode: 'strict' }) })), 2);
  });
  it('multiplies by the type weight for the active profile', () => {
    near(Scoring.scoreDish(dish('Plain Dish', 'Beef'), TUE, ctx({ typeWeights: { beef: 0.4 } })), 0.8);
  });
  it('never goes below the floor of 0.05', () => {
    const bad = dish('Bad', 'Pasta', { health_score: 1 });
    near(Scoring.scoreDish(bad, TUE, ctx({ ratingByDish: { bad: { avg: 1 } }, daysSince: () => 0 })), 0.05);
  });
});

describe('Scoring.weightedPick', () => {
  const items = [{ item: 'a', weight: 1 }, { item: 'b', weight: 3 }];
  it('picks in proportion to weight using the supplied random number', () => {
    assert.equal(Scoring.weightedPick(items, () => 0), 'a');
    assert.equal(Scoring.weightedPick(items, () => 0.2), 'a');
    assert.equal(Scoring.weightedPick(items, () => 0.3), 'b');
    assert.equal(Scoring.weightedPick(items, () => 0.999999), 'b');
  });
  it('favors heavier items over many seeded draws', () => {
    const rng = seeded(7);
    let b = 0;
    for (let i = 0; i < 2000; i++) if (Scoring.weightedPick(items, rng) === 'b') b++;
    assert.ok(b > 1350 && b < 1650, 'b picked ' + b + ' times');
  });
  it('returns null for an empty list and copes with all-zero weights', () => {
    assert.equal(Scoring.weightedPick([], () => 0.5), null);
    assert.equal(Scoring.weightedPick(undefined, () => 0.5), null);
    assert.ok(['a', 'b'].includes(Scoring.weightedPick([{ item: 'a', weight: 0 }, { item: 'b', weight: 0 }], () => 0.5)));
  });
});
