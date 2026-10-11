// Star rating averages. One row per (item, member); the average is shown everywhere.
var Ratings = (function () {
  'use strict';

  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function average(rows) {
    var stars = (rows || []).map(function (r) { return Number(r.stars); }).filter(function (n) { return n >= 1 && n <= 5; });
    if (!stars.length) return { avg: null, count: 0 };
    var sum = stars.reduce(function (a, b) { return a + b; }, 0);
    return { avg: Math.round((sum / stars.length) * 100) / 100, count: stars.length };
  }

  // field = 'dish' or 'restaurant' -> { normalizedName: {avg, count} }
  function byItem(rows, field) {
    var groups = {};
    (rows || []).forEach(function (r) {
      var key = Ingredients_().normalize(r[field]);
      if (!key) return;
      (groups[key] = groups[key] || []).push(r);
    });
    var out = {};
    Object.keys(groups).forEach(function (k) { out[k] = average(groups[k]); });
    return out;
  }

  return { average: average, byItem: byItem };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Ratings; }
