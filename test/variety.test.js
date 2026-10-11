'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Variety = require('../src/logic/variety');
const { settings, varietyRules } = require('./helpers/fixtures');

// 2026-10-11 is a Sunday. Week (Sun start): Oct 11-17. Next week starts Oct 18.
const d = (date, type, extra) => Object.assign({ date, kind: 'home', type, cuisine: '', tags: [] }, extra || {});
const rule = (extra) => Object.assign({
  rule: 'test rule', active: true, profile: '', match_by: 'type', match_value: '*', limit: '', consecutive: false, days: 'all', applies_to: 'both'
}, extra);
const normal = Variety.activeRules(varietyRules, 'Normal');

describe('Variety.activeRules', () => {
  it('keeps rules for every profile plus the active profile only', () => {
    assert.deepEqual(Variety.activeRules(varietyRules, 'Normal').map((r) => r.rule),
      ['Max 2 of the same type per week', 'No same type back-to-back', 'Beef max 2 per week']);
    assert.deepEqual(Variety.activeRules(varietyRules, 'Tight budget').map((r) => r.rule),
      ['Max 2 of the same type per week', 'No same type back-to-back', 'Beef max 1 per week']);
  });
  it('drops rules that are switched off', () => {
    const rules = [rule({ rule: 'on' }), rule({ rule: 'off', active: false })];
    assert.deepEqual(Variety.activeRules(rules, 'Normal').map((r) => r.rule), ['on']);
  });
  it('compares profile names ignoring case', () => {
    assert.equal(Variety.activeRules([rule({ profile: 'Tight Budget' })], 'tight budget').length, 1);
  });
});

describe('Variety.check', () => {
  it('blocks a third dish of the same type in a week', () => {
    const slots = [d('2026-10-12', 'Chicken'), d('2026-10-14', 'Chicken')];
    const v = Variety.check(slots, d('2026-10-16', 'Chicken'), normal, settings);
    assert.equal(v.length, 1);
    assert.match(v[0].message, /Max 2 of the same type per week/);
  });
  it('allows the same type twice', () => {
    const slots = [d('2026-10-12', 'Chicken')];
    assert.deepEqual(Variety.check(slots, d('2026-10-14', 'Chicken'), normal, settings), []);
  });
  it('blocks the same type on back-to-back days, before or after', () => {
    const slots = [d('2026-10-13', 'Pasta')];
    assert.equal(Variety.check(slots, d('2026-10-14', 'Pasta'), normal, settings).length, 1);
    assert.equal(Variety.check(slots, d('2026-10-12', 'Pasta'), normal, settings).length, 1);
    assert.equal(Variety.check(slots, d('2026-10-15', 'Pasta'), normal, settings).length, 0);
  });
  it('applies back-to-back across a week boundary but counts weeks from the first day of the week', () => {
    const slots = [d('2026-10-17', 'Pasta')];
    assert.equal(Variety.check(slots, d('2026-10-18', 'Pasta'), normal, settings).length, 1);
    const three = [d('2026-10-12', 'Chicken'), d('2026-10-14', 'Chicken')];
    assert.equal(Variety.check(three, d('2026-10-18', 'Chicken'), normal, settings).length, 0, 'Sunday starts a new week');
  });
  it('respects a Monday week start', () => {
    const monday = Object.assign({}, settings, { first_day_of_week: 1 });
    const slots = [d('2026-10-12', 'Chicken'), d('2026-10-14', 'Chicken')];
    assert.equal(Variety.check(slots, d('2026-10-18', 'Chicken'), normal, monday).length, 1, 'Oct 18 is still the same Mon-Sun week');
  });
  it('keeps counts separate for each type when the value is *', () => {
    const slots = [d('2026-10-12', 'Chicken'), d('2026-10-14', 'Chicken'), d('2026-10-15', 'Beef')];
    assert.equal(Variety.check(slots, d('2026-10-17', 'Pork'), normal, settings).length, 0);
  });
  it('applies a rule for one named value only to that value', () => {
    const r = [rule({ rule: 'beef 1', match_value: 'Beef', limit: 1 })];
    const slots = [d('2026-10-12', 'Beef')];
    assert.equal(Variety.check(slots, d('2026-10-14', 'Beef'), r, settings).length, 1);
    assert.equal(Variety.check(slots, d('2026-10-14', 'Chicken'), r, settings).length, 0);
  });
  it('matches named values ignoring case', () => {
    const r = [rule({ rule: 'beef 1', match_value: 'beef', limit: 1 })];
    assert.equal(Variety.check([d('2026-10-12', 'BEEF')], d('2026-10-14', 'Beef'), r, settings).length, 1);
  });
  it('counts only weekend nights for a weekends-only rule', () => {
    const r = [rule({ rule: 'weekend beef', match_value: 'Beef', limit: 1, days: 'weekends' })];
    const slots = [d('2026-10-18', 'Beef'), d('2026-10-21', 'Beef')]; // Sun, Wed
    assert.equal(Variety.check(slots, d('2026-10-24', 'Beef'), r, settings).length, 1, 'Saturday after a Sunday');
    assert.equal(Variety.check(slots, d('2026-10-20', 'Beef'), r, settings).length, 0, 'a weekday candidate is outside the rule');
    assert.equal(Variety.check([d('2026-10-21', 'Beef')], d('2026-10-24', 'Beef'), r, settings).length, 0, 'weekday beef is not counted');
  });
  it('limits restaurants by cuisine and does not touch home dinners', () => {
    const r = [rule({ rule: 'one mexican restaurant', match_by: 'cuisine', match_value: 'Mexican', limit: 1, applies_to: 'restaurant' })];
    const slots = [{ date: '2026-10-12', kind: 'restaurant', type: '', cuisine: 'Mexican', tags: [] }];
    assert.equal(Variety.check(slots, { date: '2026-10-15', kind: 'restaurant', type: '', cuisine: 'Mexican', tags: [] }, r, settings).length, 1);
    assert.equal(Variety.check(slots, d('2026-10-15', 'Beef', { cuisine: 'Mexican' }), r, settings).length, 0);
    assert.equal(Variety.check([d('2026-10-12', 'Beef', { cuisine: 'Mexican' })], { date: '2026-10-15', kind: 'restaurant', type: '', cuisine: 'Mexican', tags: [] }, r, settings).length, 0, 'home dinners are not counted');
  });
  it('counts a rule that applies to both home and restaurant nights across kinds', () => {
    const r = [rule({ rule: 'one mexican', match_by: 'cuisine', match_value: 'Mexican', limit: 1, applies_to: 'both' })];
    const slots = [d('2026-10-12', 'Beef', { cuisine: 'Mexican' })];
    assert.equal(Variety.check(slots, { date: '2026-10-15', kind: 'restaurant', type: '', cuisine: 'Mexican', tags: [] }, r, settings).length, 1);
  });
  it('matches tags', () => {
    const r = [rule({ rule: 'one quick', match_by: 'tag', match_value: 'Quick', limit: 1 })];
    const slots = [d('2026-10-12', 'Pasta', { tags: ['Quick'] })];
    assert.equal(Variety.check(slots, d('2026-10-14', 'Beef', { tags: ['Quick', 'Grill'] }), r, settings).length, 1);
    assert.equal(Variety.check(slots, d('2026-10-14', 'Beef', { tags: ['Grill'] }), r, settings).length, 0);
  });
  it('ignores blank types and switched-off rules', () => {
    assert.deepEqual(Variety.check([d('2026-10-12', '')], d('2026-10-13', ''), normal, settings), []);
    const off = [rule({ active: false, limit: 0 })];
    assert.deepEqual(Variety.check([], d('2026-10-13', 'Beef'), off, settings), []);
  });
  it('does not count a slot on the candidate date (it is being replaced)', () => {
    const r = [rule({ rule: 'beef 1', match_value: 'Beef', limit: 1 })];
    assert.equal(Variety.check([d('2026-10-14', 'Beef')], d('2026-10-14', 'Beef'), r, settings).length, 0);
  });
  it('works with no slots and no rules', () => {
    assert.deepEqual(Variety.check([], d('2026-10-14', 'Beef'), [], settings), []);
    assert.deepEqual(Variety.check(undefined, d('2026-10-14', 'Beef'), undefined, settings), []);
  });
});
