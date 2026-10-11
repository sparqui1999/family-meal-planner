'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Ids = require('../src/logic/ids');

describe('Ids.next', () => {
  it('starts at 0001 when nothing exists', () => {
    assert.equal(Ids.next('P', []), 'P-0001');
    assert.equal(Ids.next('P', undefined), 'P-0001');
  });
  it('goes one past the highest number, even with gaps', () => {
    assert.equal(Ids.next('P', ['P-0001', 'P-0007', 'P-0003']), 'P-0008');
  });
  it('ignores other prefixes and malformed ids', () => {
    assert.equal(Ids.next('Q', ['P-0009', 'Q-0002', 'Q-x', '', null]), 'Q-0003');
  });
  it('supports a custom padding width and grows past it', () => {
    assert.equal(Ids.next('I', ['I-9'], 2), 'I-10');
    assert.equal(Ids.next('I', [], 6), 'I-000001');
    assert.equal(Ids.next('I', ['I-9999']), 'I-10000');
  });
});
