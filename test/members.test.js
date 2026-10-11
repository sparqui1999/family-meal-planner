'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const Members = require('../src/logic/members');

const members = [
  { name: 'Sam', email: 'Sam@Example.com', role: 'admin' },
  { name: 'Alex', email: 'alex@example.com', role: 'member' }
];

describe('Members.find', () => {
  it('finds a member by email regardless of case and spaces', () => {
    assert.equal(Members.find('  sam@example.COM ', members).name, 'Sam');
  });
  it('returns null for strangers and blank emails', () => {
    assert.equal(Members.find('stranger@example.com', members), null);
    assert.equal(Members.find('', members), null);
    assert.equal(Members.find(null, members), null);
    assert.equal(Members.find('sam@example.com', []), null);
  });
});

describe('Members.isAdmin', () => {
  it('is true only for admins', () => {
    assert.equal(Members.isAdmin(members[0]), true);
    assert.equal(Members.isAdmin(members[1]), false);
    assert.equal(Members.isAdmin(null), false);
  });
});
