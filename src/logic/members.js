// Household member lookup (access gate for the web app).
var Members = (function () {
  'use strict';

  function find(email, members) {
    var e = String(email == null ? '' : email).trim().toLowerCase();
    if (!e) return null;
    for (var i = 0; i < (members || []).length; i++) {
      if (String(members[i].email || '').trim().toLowerCase() === e) return members[i];
    }
    return null;
  }

  function isAdmin(member) {
    return !!member && member.role === 'admin';
  }

  return { find: find, isAdmin: isAdmin };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Members; }
