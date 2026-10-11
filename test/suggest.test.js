'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Suggest = require('../src/logic/suggest');
const Dates = require('../src/logic/dates');
const { settings, varietyRules, dish, side, slot, restaurantSlot, library } = require('./helpers/fixtures');
const { seeded } = require('./helpers/rng');

// Week of Sunday Oct 11 2026. Open dates: Mon Oct 12 .. Fri Oct 16.
const OPEN = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];

function ctxFor(overrides) {
  return Object.assign({
    dishes: library, dishSides: [], ratingByDish: {}, history: [], settings, typeWeights: {}, varietyRules, restaurants: [],
    ratingByRestaurant: {}, visits: []
  }, overrides || {});
}
const req = (extra) => Object.assign({ openDates: OPEN, lockedSlots: [], excludeDishes: [], profile: 'Normal' }, extra || {});
const names = (r) => r.suggestions.map((s) => s.dish);

describe('Suggest.suggestMeals', () => {
  it('fills every open day with a different main dish', () => {
    const r = Suggest.suggestMeals(req(), ctxFor(), seeded(1));
    assert.equal(r.suggestions.length, 5);
    assert.deepEqual(r.unfilled, []);
    assert.deepEqual(r.suggestions.map((s) => s.date), OPEN);
    assert.equal(new Set(names(r)).size, 5);
    assert.ok(!names(r).includes('Rice'), 'sides are never suggested as mains');
  });
  it('is repeatable with the same seed', () => {
    assert.deepEqual(Suggest.suggestMeals(req(), ctxFor(), seeded(42)), Suggest.suggestMeals(req(), ctxFor(), seeded(42)));
  });
  it('follows the variety rules: no back-to-back types and at most two of a type per week', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = Suggest.suggestMeals(req(), ctxFor(), seeded(seed));
      const types = r.suggestions.map((s) => library.find((d) => d.name === s.dish).type);
      for (let i = 1; i < types.length; i++) assert.notEqual(types[i], types[i - 1], 'seed ' + seed);
      const counts = {};
      types.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
      assert.ok(Math.max(...Object.values(counts)) <= 2, 'seed ' + seed);
    }
  });
  it('honors the excluded dishes, so pressing Suggest again gives a new set', () => {
    const first = Suggest.suggestMeals(req(), ctxFor(), seeded(3));
    const again = Suggest.suggestMeals(req({ excludeDishes: names(first) }), ctxFor(), seeded(4));
    names(again).forEach((n) => assert.ok(!names(first).includes(n), n));
  });
  it('does not repeat a dish cooked within the repeat window, before or after the date', () => {
    const only = [dish('Spaghetti', 'Pasta')];
    const before = Suggest.suggestMeals(req({ openDates: ['2026-10-12'] }), ctxFor({ dishes: only, history: [slot('2026-10-05', 'Spaghetti', { status: 'cooked' })] }), seeded(1));
    assert.deepEqual(before.suggestions, []);
    assert.match(before.unfilled[0].reason, /too recently/);
    const after = Suggest.suggestMeals(req({ openDates: ['2026-10-12'] }), ctxFor({ dishes: only, history: [slot('2026-10-30', 'Spaghetti')] }), seeded(1));
    assert.deepEqual(after.suggestions, []);
    const old = Suggest.suggestMeals(req({ openDates: ['2026-10-12'] }), ctxFor({ dishes: only, history: [slot('2026-09-10', 'Spaghetti')] }), seeded(1));
    assert.equal(old.suggestions.length, 1);
  });
  it('counts locked dishes and earlier picks toward the repeat window', () => {
    const only = [dish('Spaghetti', 'Pasta')];
    const r = Suggest.suggestMeals(req({ openDates: ['2026-10-12'], lockedSlots: [slot('2026-10-13', 'Spaghetti')] }), ctxFor({ dishes: only }), seeded(1));
    assert.deepEqual(r.suggestions, []);
    const twoDays = Suggest.suggestMeals(req({ openDates: ['2026-10-12', '2026-10-30'] }), ctxFor({ dishes: only }), seeded(1));
    assert.equal(twoDays.suggestions.length, 1, 'the same dish is not used twice within 21 days');
    assert.equal(twoDays.unfilled.length, 1);
  });
  it('ignores saved slots on the dates being re-rolled', () => {
    const only = [dish('Spaghetti', 'Pasta')];
    const r = Suggest.suggestMeals(req({ openDates: ['2026-10-12'] }), ctxFor({ dishes: only, history: [slot('2026-10-12', 'Spaghetti')] }), seeded(1));
    assert.equal(r.suggestions.length, 1);
  });
  it('ignores removed and replaced slots in the history', () => {
    const only = [dish('Spaghetti', 'Pasta')];
    const hist = [slot('2026-10-05', 'Spaghetti', { status: 'removed' }), slot('2026-10-06', 'Spaghetti', { status: 'replaced' })];
    assert.equal(Suggest.suggestMeals(req({ openDates: ['2026-10-12'] }), ctxFor({ dishes: only, history: hist }), seeded(1)).suggestions.length, 1);
  });
  it('skips dishes that suit only other seasons, and uses the date to decide', () => {
    const soup = [dish('Soup', 'Soup', { seasons: ['Winter'] })];
    assert.deepEqual(Suggest.suggestMeals(req({ openDates: ['2026-10-13'] }), ctxFor({ dishes: soup }), seeded(1)).suggestions, []);
    assert.equal(Suggest.suggestMeals(req({ openDates: ['2026-12-15'] }), ctxFor({ dishes: soup }), seeded(1)).suggestions.length, 1);
    assert.equal(Suggest.suggestMeals(req({ openDates: ['2026-11-30', '2026-12-01'] }), ctxFor({ dishes: soup }), seeded(1)).suggestions[0].date, '2026-12-01', 'Nov 30 is Fall');
  });
  it('allows dishes with several seasons and year-round dishes', () => {
    const multi = [dish('Stew', 'Beef', { seasons: ['Fall', 'Winter'] })];
    assert.equal(Suggest.suggestMeals(req({ openDates: ['2026-10-13'] }), ctxFor({ dishes: multi }), seeded(1)).suggestions.length, 1);
  });
  it('suggests at most one untried idea per week, counting locked ideas', () => {
    const ideas = [dish('Idea A', 'Pasta', { status: 'idea' }), dish('Idea B', 'Pork', { status: 'idea' }), dish('Idea C', 'Beef', { status: 'idea' })];
    const r = Suggest.suggestMeals(req({ openDates: ['2026-10-12', '2026-10-14', '2026-10-16'] }), ctxFor({ dishes: ideas }), seeded(1));
    assert.equal(r.suggestions.length, 1);
    assert.equal(r.unfilled.length, 2);
    const locked = Suggest.suggestMeals(req({ openDates: ['2026-10-14'], lockedSlots: [slot('2026-10-12', 'Idea A')] }), ctxFor({ dishes: ideas }), seeded(1));
    assert.deepEqual(locked.suggestions, []);
  });
  it('never suggests retired dishes', () => {
    const r = Suggest.suggestMeals(req({ openDates: ['2026-10-12'] }), ctxFor({ dishes: [dish('Old', 'Pasta', { status: 'retired' })] }), seeded(1));
    assert.deepEqual(r.suggestions, []);
    assert.equal(r.unfilled.length, 1);
  });
  it('can exclude dishes over the cook-time limit in strict mode only', () => {
    const roast = [dish('Roast', 'Beef', { prep_min: 30, cook_min: 150 })];
    const strict = Object.assign({}, settings, { cook_time_mode: 'strict' });
    const hard = Suggest.suggestMeals(req({ openDates: ['2026-10-13'] }), ctxFor({ dishes: roast, settings: strict }), seeded(1));
    assert.deepEqual(hard.suggestions, []);
    assert.match(hard.unfilled[0].reason, /too long/);
    assert.equal(Suggest.suggestMeals(req({ openDates: ['2026-10-13'] }), ctxFor({ dishes: roast }), seeded(1)).suggestions.length, 1, 'soft mode still allows it');
    assert.equal(Suggest.suggestMeals(req({ openDates: ['2026-10-17'] }), ctxFor({ dishes: [dish('Roast', 'Beef', { prep_min: 30, cook_min: 60 })], settings: strict }), seeded(1)).suggestions.length, 1, 'weekend limit is longer');
  });
  it('counts locked restaurant nights toward the variety rules', () => {
    const rules = [{ rule: 'one mexican', active: true, profile: '', match_by: 'cuisine', match_value: 'Mexican', limit: 1, consecutive: false, days: 'all', applies_to: 'both' }];
    const tacos = [dish('Tacos', 'Beef', { cuisine: 'Mexican' })];
    const r = Suggest.suggestMeals(req({ openDates: ['2026-10-14'], lockedSlots: [restaurantSlot('2026-10-12', 'Taco Place')] }),
      ctxFor({ dishes: tacos, varietyRules: rules, restaurants: [{ name: 'Taco Place', cuisine: 'Mexican' }] }), seeded(1));
    assert.deepEqual(r.suggestions, []);
    assert.match(r.unfilled[0].reason, /variety/);
  });
  it('uses only the rules of the chosen profile', () => {
    const beefy = [dish('Stew', 'Beef'), dish('Tacos', 'Beef'), dish('Chili', 'Beef')];
    const open = ['2026-10-12', '2026-10-14', '2026-10-16'];
    const normalRun = Suggest.suggestMeals(req({ openDates: open, profile: 'Normal' }), ctxFor({ dishes: beefy }), seeded(1));
    const tightRun = Suggest.suggestMeals(req({ openDates: open, profile: 'Tight budget' }), ctxFor({ dishes: beefy }), seeded(1));
    assert.equal(normalRun.suggestions.length, 2, 'Normal: beef max 2 per week');
    assert.equal(tightRun.suggestions.length, 1, 'Tight budget: beef max 1 per week');
  });
  it('adds only the usual, active sides (up to three)', () => {
    const dishes = [dish('Alfredo', 'Chicken'), side('Rice'), side('Salad'), side('Bread'), side('Peas'), side('Old Side', { status: 'retired' }), side('Extra')];
    const dishSides = ['Rice', 'Salad', 'Bread', 'Peas', 'Old Side'].map((s) => ({ main_dish: 'Alfredo', side_dish: s, is_default: true }))
      .concat([{ main_dish: 'Alfredo', side_dish: 'Extra', is_default: false }]);
    const r = Suggest.suggestMeals(req({ openDates: ['2026-10-12'] }), ctxFor({ dishes, dishSides }), seeded(1));
    assert.deepEqual(r.suggestions[0].sides, ['Rice', 'Salad', 'Bread']);
  });
  it('prefers highly rated favorites over many draws', () => {
    const dishes = [dish('Loved', 'Pasta', { favorite: true }), dish('Meh', 'Pork')];
    const ratingByDish = { loved: { avg: 5, count: 3 }, meh: { avg: 1, count: 3 } };
    let loved = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (Suggest.suggestMeals(req({ openDates: ['2026-10-13'] }), ctxFor({ dishes, ratingByDish }), seeded(seed)).suggestions[0].dish === 'Loved') loved++;
    }
    assert.ok(loved > 150, 'Loved picked ' + loved + ' of 200');
  });
  it('does not throw and reports every day as unfilled when the library is empty', () => {
    const r = Suggest.suggestMeals(req(), ctxFor({ dishes: [] }), seeded(1));
    assert.deepEqual(r.suggestions, []);
    assert.equal(r.unfilled.length, 5);
    assert.ok(r.unfilled.every((u) => typeof u.reason === 'string' && u.reason.length > 0));
  });
  it('reports every day as unfilled when every dish is excluded', () => {
    const r = Suggest.suggestMeals(req({ excludeDishes: library.map((d) => d.name) }), ctxFor(), seeded(1));
    assert.deepEqual(r.suggestions, []);
    assert.match(r.unfilled[0].reason, /already shown/);
  });
  it('works with no open dates', () => {
    assert.deepEqual(Suggest.suggestMeals(req({ openDates: [] }), ctxFor(), seeded(1)), { suggestions: [], unfilled: [] });
  });
  it('does not change the data it was given', () => {
    const c = ctxFor({ history: [slot('2026-10-05', 'Spaghetti')] });
    const before = JSON.stringify(c);
    Suggest.suggestMeals(req({ lockedSlots: [slot('2026-10-20', 'Chili')] }), c, seeded(1));
    assert.equal(JSON.stringify(c), before);
  });
});

describe('Suggest.suggestRestaurants', () => {
  const rest = (name, cuisine, extra) => Object.assign({ name, cuisine, status: 'active', favorite: false }, extra || {});
  const six = [rest('A', 'Mexican'), rest('B', 'Thai'), rest('C', 'Italian'), rest('D', 'BBQ'), rest('E', 'Japanese'), rest('F', 'American')];
  const rctx = (extra) => ctxFor(Object.assign({ restaurants: six, dishes: [], varietyRules: [] }, extra || {}));
  const rreq = (extra) => Object.assign({ date: '2026-10-15', excludeNames: [] }, extra || {});

  it('returns five different restaurants by default', () => {
    const r = Suggest.suggestRestaurants(rreq(), rctx(), seeded(1));
    assert.equal(r.restaurants.length, 5);
    assert.equal(new Set(r.restaurants.map((x) => x.name)).size, 5);
    assert.equal(r.exhausted, false);
  });
  it('gives different options when the shown ones are excluded, then reports exhausted', () => {
    const first = Suggest.suggestRestaurants(rreq(), rctx(), seeded(1));
    const more = Suggest.suggestRestaurants(rreq({ excludeNames: first.restaurants.map((x) => x.name) }), rctx(), seeded(2));
    assert.equal(more.restaurants.length, 1);
    assert.ok(!first.restaurants.some((x) => x.name === more.restaurants[0].name));
    assert.equal(more.exhausted, true);
  });
  it('skips retired restaurants', () => {
    const r = Suggest.suggestRestaurants(rreq({ count: 10 }), rctx({ restaurants: six.concat([rest('Closed', 'Thai', { status: 'retired' })]) }), seeded(1));
    assert.ok(!r.restaurants.some((x) => x.name === 'Closed'));
    assert.equal(r.restaurants.length, 6);
    assert.equal(r.exhausted, true);
  });
  it('skips restaurants visited within the repeat window (recorded visits or planned nights)', () => {
    const r = Suggest.suggestRestaurants(rreq({ count: 10 }), rctx({
      visits: [{ restaurant: 'A', date: '2026-10-08' }], history: [restaurantSlot('2026-10-20', 'B')]
    }), seeded(1));
    const got = r.restaurants.map((x) => x.name);
    assert.ok(!got.includes('A') && !got.includes('B'));
    assert.equal(got.length, 4);
  });
  it('brings a restaurant back once the window has passed', () => {
    const r = Suggest.suggestRestaurants(rreq({ count: 10 }), rctx({ visits: [{ restaurant: 'A', date: '2026-09-20' }] }), seeded(1));
    assert.ok(r.restaurants.some((x) => x.name === 'A'));
  });
  it('respects a count and treats a smaller pool as exhausted', () => {
    assert.equal(Suggest.suggestRestaurants(rreq({ count: 2 }), rctx(), seeded(1)).restaurants.length, 2);
    const small = Suggest.suggestRestaurants(rreq(), rctx({ restaurants: six.slice(0, 2) }), seeded(1));
    assert.equal(small.restaurants.length, 2);
    assert.equal(small.exhausted, true);
  });
  it('follows cuisine variety rules, counting dinners at home too', () => {
    const rules = [{ rule: 'one mexican', active: true, profile: '', match_by: 'cuisine', match_value: 'Mexican', limit: 1, consecutive: false, days: 'all', applies_to: 'both' }];
    const r = Suggest.suggestRestaurants(rreq({ count: 10 }), rctx({ varietyRules: rules, dishes: [dish('Tacos', 'Beef', { cuisine: 'Mexican' })], history: [slot('2026-10-13', 'Tacos')] }), seeded(1));
    assert.ok(!r.restaurants.some((x) => x.name === 'A'), 'the Mexican restaurant is ruled out');
    assert.equal(r.restaurants.length, 5);
  });
  it('favors favorites and well-rated places over many draws', () => {
    const pool = [rest('Fav', 'Thai', { favorite: true }), rest('Plain', 'Italian')];
    let fav = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = Suggest.suggestRestaurants(rreq({ count: 1 }), rctx({ restaurants: pool, ratingByRestaurant: { fav: { avg: 5, count: 2 }, plain: { avg: 2, count: 2 } } }), seeded(seed));
      if (r.restaurants[0].name === 'Fav') fav++;
    }
    assert.ok(fav > 140, 'Fav picked ' + fav + ' of 200');
  });
  it('returns nothing and exhausted for an empty list', () => {
    assert.deepEqual(Suggest.suggestRestaurants(rreq(), rctx({ restaurants: [] }), seeded(1)), { restaurants: [], exhausted: true });
  });
});

describe('Suggest date handling', () => {
  it('works across a month boundary', () => {
    const open = Dates.range('2026-10-29', 5);
    const r = Suggest.suggestMeals(req({ openDates: open }), ctxFor(), seeded(5));
    assert.equal(r.suggestions.length + r.unfilled.length, 5);
  });
});
