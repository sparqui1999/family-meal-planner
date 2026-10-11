'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const PlanOps = require('../src/logic/planOps');
const { slot, restaurantSlot } = require('./helpers/fixtures');

const D = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
const base = () => [
  slot(D[0], 'A', { plan_id: 'P-1', locked: true }),
  slot(D[1], 'B', { plan_id: 'P-2' }),
  slot(D[2], 'C', { plan_id: 'P-3' })
];
const dateOf = (plan, id) => plan.find((s) => s.plan_id === id).date;
const active = (plan) => plan.filter((s) => s.status !== 'removed');

describe('PlanOps.swapDays', () => {
  it('swaps two meals', () => {
    const out = PlanOps.swapDays(base(), D[0], D[1]);
    assert.equal(dateOf(out, 'P-1'), D[1]);
    assert.equal(dateOf(out, 'P-2'), D[0]);
    assert.equal(dateOf(out, 'P-3'), D[2]);
  });
  it('moves a meal to an empty day', () => {
    assert.equal(dateOf(PlanOps.swapDays(base(), D[0], D[4]), 'P-1'), D[4]);
  });
  it('does nothing when both days are the same', () => {
    assert.deepEqual(PlanOps.swapDays(base(), D[0], D[0]), base());
  });
  it('does not change its input', () => {
    const plan = base();
    PlanOps.swapDays(plan, D[0], D[1]);
    assert.deepEqual(plan, base());
  });
  it('ignores removed meals', () => {
    const plan = base().concat([slot(D[3], 'Gone', { plan_id: 'P-9', status: 'removed' })]);
    const out = PlanOps.swapDays(plan, D[0], D[3]);
    assert.equal(dateOf(out, 'P-1'), D[3]);
    assert.equal(dateOf(out, 'P-9'), D[3], 'a removed meal stays where it was');
  });
});

describe('PlanOps.moveToDay', () => {
  it('moves to an empty day and keeps the lock', () => {
    const r = PlanOps.moveToDay(base(), D[0], D[4], {});
    assert.equal(dateOf(r.plan, 'P-1'), D[4]);
    assert.equal(r.plan.find((s) => s.plan_id === 'P-1').locked, true);
    assert.deepEqual(r.queued, []); assert.deepEqual(r.removed, []);
  });
  it('swaps when the day is occupied (default)', () => {
    const r = PlanOps.moveToDay(base(), D[0], D[1], {});
    assert.equal(dateOf(r.plan, 'P-1'), D[1]);
    assert.equal(dateOf(r.plan, 'P-2'), D[0]);
  });
  it('shifts the chain of meals one day later, absorbed by the first gap', () => {
    const r = PlanOps.moveToDay(base(), D[0], D[1], { ifOccupied: 'shift' });
    assert.equal(dateOf(r.plan, 'P-1'), D[1]);
    assert.equal(dateOf(r.plan, 'P-2'), D[2]);
    assert.equal(dateOf(r.plan, 'P-3'), D[3]);
  });
  it('shift stops at the day the moved meal left behind', () => {
    const r = PlanOps.moveToDay(base(), D[2], D[0], { ifOccupied: 'shift' });
    assert.equal(dateOf(r.plan, 'P-3'), D[0]);
    assert.equal(dateOf(r.plan, 'P-1'), D[1]);
    assert.equal(dateOf(r.plan, 'P-2'), D[2]);
  });
  it('shift can push meals across a week boundary', () => {
    const plan = [slot('2026-10-17', 'A', { plan_id: 'P-1' }), slot('2026-10-18', 'B', { plan_id: 'P-2' }), slot('2026-10-12', 'C', { plan_id: 'P-3' })];
    const r = PlanOps.moveToDay(plan, '2026-10-12', '2026-10-17', { ifOccupied: 'shift' });
    assert.equal(dateOf(r.plan, 'P-3'), '2026-10-17');
    assert.equal(dateOf(r.plan, 'P-1'), '2026-10-18');
    assert.equal(dateOf(r.plan, 'P-2'), '2026-10-19');
  });
  it('can queue the meal that was there', () => {
    const r = PlanOps.moveToDay(base(), D[0], D[1], { ifOccupied: 'queue_existing' });
    assert.equal(r.queued.length, 1);
    assert.equal(r.queued[0].dish, 'B');
    assert.equal(r.plan.find((s) => s.plan_id === 'P-2').status, 'removed');
    assert.equal(dateOf(r.plan, 'P-1'), D[1]);
  });
  it('can delete the meal that was there', () => {
    const r = PlanOps.moveToDay(base(), D[0], D[1], { ifOccupied: 'delete_existing' });
    assert.equal(r.removed.length, 1);
    assert.equal(r.removed[0].dish, 'B');
    assert.equal(r.queued.length, 0);
    assert.equal(active(r.plan).length, 2);
  });
  it('does nothing when from and to are the same', () => {
    assert.deepEqual(PlanOps.moveToDay(base(), D[0], D[0], { ifOccupied: 'shift' }).plan, base());
  });
  it('explains when there is nothing to move', () => {
    const r = PlanOps.moveToDay(base(), D[4], D[3], {});
    assert.deepEqual(r.plan, base());
    assert.match(r.notes[0], /Nothing is planned/);
  });
  it('rejects an unknown option', () => {
    assert.throws(() => PlanOps.moveToDay(base(), D[0], D[1], { ifOccupied: 'explode' }), /Unknown option/);
  });
  it('does not change its input', () => {
    const plan = base();
    PlanOps.moveToDay(plan, D[0], D[1], { ifOccupied: 'shift' });
    assert.deepEqual(plan, base());
  });
});

describe('PlanOps.eatOut', () => {
  const rest = { restaurant: 'Taco Place' };
  it('simply adds a locked restaurant night on an empty day', () => {
    const r = PlanOps.eatOut(base(), D[4], rest);
    assert.equal(r.plan.length, 4);
    const added = r.plan[3];
    assert.equal(added.kind, 'restaurant'); assert.equal(added.restaurant, 'Taco Place');
    assert.equal(added.date, D[4]); assert.equal(added.locked, true); assert.equal(added.dish, ''); assert.equal(added.status, 'planned');
  });
  it('queues the original meal for next week', () => {
    const r = PlanOps.eatOut(base(), D[1], rest, { type: 'queue' });
    assert.equal(r.queued[0].dish, 'B');
    assert.equal(r.plan.find((s) => s.plan_id === 'P-2').status, 'removed');
    assert.equal(active(r.plan).filter((s) => s.date === D[1]).length, 1);
    assert.equal(active(r.plan).find((s) => s.date === D[1]).kind, 'restaurant');
  });
  it('deletes the original meal', () => {
    const r = PlanOps.eatOut(base(), D[1], rest, { type: 'delete' });
    assert.equal(r.removed[0].dish, 'B');
    assert.equal(active(r.plan).length, 3);
  });
  it('moves the original meal to another day', () => {
    const r = PlanOps.eatOut(base(), D[1], rest, { type: 'move', to: D[4] });
    assert.equal(dateOf(r.plan, 'P-2'), D[4]);
    assert.equal(active(r.plan).find((s) => s.date === D[1]).restaurant, 'Taco Place');
  });
  it('moves the original and handles whatever is on the new day', () => {
    const shift = PlanOps.eatOut(base(), D[0], rest, { type: 'move', to: D[1], ifOccupied: 'shift' });
    assert.equal(dateOf(shift.plan, 'P-1'), D[1]);
    assert.equal(dateOf(shift.plan, 'P-2'), D[2]);
    assert.equal(dateOf(shift.plan, 'P-3'), D[3]);
    const queue = PlanOps.eatOut(base(), D[0], rest, { type: 'move', to: D[1], ifOccupied: 'queue_existing' });
    assert.equal(queue.queued[0].dish, 'B');
  });
  it('replaces an existing restaurant night too', () => {
    const plan = [restaurantSlot(D[0], 'Old Place', { plan_id: 'P-1' })];
    const r = PlanOps.eatOut(plan, D[0], rest, { type: 'delete' });
    assert.equal(active(r.plan).length, 1);
    assert.equal(active(r.plan)[0].restaurant, 'Taco Place');
  });
  it('insists on a choice when a meal is already planned', () => {
    assert.throws(() => PlanOps.eatOut(base(), D[1], rest), /Choose what to do/);
    assert.throws(() => PlanOps.eatOut(base(), D[1], rest, {}), /Choose what to do/);
  });
  it('rejects moving the original to the same day, and unknown actions', () => {
    assert.throws(() => PlanOps.eatOut(base(), D[1], rest, { type: 'move', to: D[1] }), /different day/);
    assert.throws(() => PlanOps.eatOut(base(), D[1], rest, { type: 'teleport' }), /Unknown option/);
  });
  it('does not change its input', () => {
    const plan = base();
    PlanOps.eatOut(plan, D[1], rest, { type: 'delete' });
    assert.deepEqual(plan, base());
  });
});

describe('PlanOps.visibleWeek', () => {
  const plan = [
    slot('2026-10-10', 'Yesterday', { status: 'cooked' }),
    slot('2026-10-12', 'B', { status: 'planned' }),
    slot('2026-10-11', 'A', { status: 'cooked' }),
    slot('2026-10-13', 'Gone', { status: 'removed' }),
    slot('2026-10-14', 'Swapped', { status: 'replaced' }),
    slot('2026-10-18', 'Last', { status: 'planned' }),
    slot('2026-10-19', 'TooFar', { status: 'planned' })
  ];
  it('shows today through the next days, sorted, with planned and cooked meals only', () => {
    assert.deepEqual(PlanOps.visibleWeek(plan, '2026-10-11', 8).map((s) => s.dish), ['A', 'B', 'Last']);
  });
  it('omits days with nothing scheduled and returns nothing for an empty plan', () => {
    assert.deepEqual(PlanOps.visibleWeek([], '2026-10-11', 8), []);
  });
  it('rolls forward as days pass', () => {
    assert.deepEqual(PlanOps.visibleWeek(plan, '2026-10-12', 8).map((s) => s.dish), ['B', 'Last', 'TooFar']);
  });
});

describe('PlanOps.validateDraft', () => {
  it('keeps good slots and drops ones pointing at missing dishes or restaurants', () => {
    const draft = [
      slot('2026-10-12', 'A'), slot('2026-10-13', 'Gone'), restaurantSlot('2026-10-14', 'Taco Place'), restaurantSlot('2026-10-15', 'Closed Place')
    ];
    const r = PlanOps.validateDraft(draft, ['A'], ['Taco Place']);
    assert.deepEqual(r.slots.map((s) => s.date), ['2026-10-12', '2026-10-14']);
    assert.deepEqual(r.dropped.map((d) => d.date), ['2026-10-13', '2026-10-15']);
    assert.ok(r.dropped.every((d) => /no longer exists/.test(d.reason)));
  });
  it('blanks a side that no longer exists but keeps the meal', () => {
    const r = PlanOps.validateDraft([slot('2026-10-12', 'A', { side_1: 'Rice', side_2: 'Ghost' })], ['A', 'Rice'], []);
    assert.equal(r.slots[0].side_1, 'Rice');
    assert.equal(r.slots[0].side_2, '');
  });
  it('keeps brand-new ideas that are not in the library yet', () => {
    const draft = [slot('2026-10-12', 'New Dish', { new_dish_name: 'New Dish' }), restaurantSlot('2026-10-13', 'New Place', { new_restaurant_name: 'New Place' })];
    const r = PlanOps.validateDraft(draft, [], []);
    assert.equal(r.slots.length, 2);
    assert.deepEqual(r.dropped, []);
  });
  it('matches names ignoring case and handles empty input', () => {
    assert.equal(PlanOps.validateDraft([slot('2026-10-12', 'a')], ['A'], []).slots.length, 1);
    assert.deepEqual(PlanOps.validateDraft(undefined, undefined, undefined), { slots: [], dropped: [] });
  });
});
