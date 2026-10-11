// Pattern for every logic test file: node:test + node:assert/strict, one describe per function.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Dates = require('../src/logic/dates');

describe('addDays', () => {
  it('adds and subtracts days', () => {
    assert.equal(Dates.addDays('2026-10-11', 1), '2026-10-12');
    assert.equal(Dates.addDays('2026-10-11', -11), '2026-09-30');
  });
  it('crosses month and year boundaries', () => {
    assert.equal(Dates.addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(Dates.addDays('2026-01-01', -1), '2025-12-31');
  });
  it('handles leap days', () => {
    assert.equal(Dates.addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(Dates.addDays('2026-02-28', 1), '2026-03-01');
  });
  it('is not affected by daylight saving changes', () => {
    assert.equal(Dates.addDays('2026-03-07', 1), '2026-03-08');
    assert.equal(Dates.addDays('2026-03-08', 1), '2026-03-09');
    assert.equal(Dates.addDays('2026-11-01', 1), '2026-11-02');
  });
});

describe('diffDays', () => {
  it('counts whole days from a to b', () => {
    assert.equal(Dates.diffDays('2026-10-11', '2026-10-18'), 7);
    assert.equal(Dates.diffDays('2026-10-18', '2026-10-11'), -7);
    assert.equal(Dates.diffDays('2026-10-11', '2026-10-11'), 0);
  });
  it('spans a daylight saving change correctly', () => {
    assert.equal(Dates.diffDays('2026-03-07', '2026-03-09'), 2);
  });
});

describe('dayOfWeek', () => {
  it('returns 0 for Sunday through 6 for Saturday', () => {
    assert.equal(Dates.dayOfWeek('2026-10-11'), 0);
    assert.equal(Dates.dayOfWeek('2026-10-14'), 3);
    assert.equal(Dates.dayOfWeek('2026-10-17'), 6);
  });
});

describe('startOfWeek', () => {
  it('finds the Sunday on or before a date', () => {
    assert.equal(Dates.startOfWeek('2026-10-11', 0), '2026-10-11');
    assert.equal(Dates.startOfWeek('2026-10-17', 0), '2026-10-11');
  });
  it('respects a different first day of the week', () => {
    assert.equal(Dates.startOfWeek('2026-10-11', 1), '2026-10-05');
    assert.equal(Dates.startOfWeek('2026-10-14', 1), '2026-10-12');
  });
  it('treats a missing first day as Sunday', () => {
    assert.equal(Dates.startOfWeek('2026-10-14'), '2026-10-11');
  });
});

describe('range', () => {
  it('lists consecutive dates', () => {
    assert.deepEqual(Dates.range('2026-10-30', 4), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
  it('returns nothing for zero days', () => {
    assert.deepEqual(Dates.range('2026-10-30', 0), []);
  });
});

describe('month', () => {
  it('returns the month number', () => {
    assert.equal(Dates.month('2026-10-11'), 10);
    assert.equal(Dates.month('2026-01-05'), 1);
  });
});

describe('seasonOf', () => {
  const map = { Winter: [12, 1, 2], Spring: [3, 4, 5], Summer: [6, 7, 8], Fall: [9, 10, 11] };
  it('finds the season for a date', () => {
    assert.equal(Dates.seasonOf('2026-10-11', map), 'Fall');
    assert.equal(Dates.seasonOf('2026-01-15', map), 'Winter');
  });
  it('switches at a month boundary', () => {
    assert.equal(Dates.seasonOf('2026-11-30', map), 'Fall');
    assert.equal(Dates.seasonOf('2026-12-01', map), 'Winter');
  });
  it('returns null when no season covers the month', () => {
    assert.equal(Dates.seasonOf('2026-10-11', { Winter: [12] }), null);
  });
});

describe('isWeekend', () => {
  it('checks the day against the weekend list', () => {
    assert.equal(Dates.isWeekend('2026-10-11', [0, 6]), true);
    assert.equal(Dates.isWeekend('2026-10-17', [0, 6]), true);
    assert.equal(Dates.isWeekend('2026-10-14', [0, 6]), false);
  });
});

describe('isValid', () => {
  it('accepts real dates', () => {
    assert.equal(Dates.isValid('2026-10-11'), true);
    assert.equal(Dates.isValid('2028-02-29'), true);
  });
  it('rejects impossible or badly formatted dates', () => {
    assert.equal(Dates.isValid('2026-02-30'), false);
    assert.equal(Dates.isValid('2026-13-01'), false);
    assert.equal(Dates.isValid('10/11/2026'), false);
    assert.equal(Dates.isValid(null), false);
  });
});

describe('parseDayList', () => {
  it('reads comma separated text, numbers and arrays', () => {
    assert.deepEqual(Dates.parseDayList('0,6'), [0, 6]);
    assert.deepEqual(Dates.parseDayList(6), [6]);
    assert.deepEqual(Dates.parseDayList([1, 2]), [1, 2]);
    assert.deepEqual(Dates.parseDayList(''), []);
  });
});
