// Name matching helpers. normalize() is the single key function used for every name lookup.
var Ingredients = (function () {
  'use strict';

  function normalize(name) {
    return String(name == null ? '' : name)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // list of {name,...} -> { normalizedName: item }
  function index(list) {
    var map = {};
    (list || []).forEach(function (item) { map[normalize(item.name)] = item; });
    return map;
  }

  // Exact normalized match, then trailing-s add/remove. No fuzzy matching.
  function match(name, ingredientsList) {
    var n = normalize(name);
    if (!n) return null;
    var map = index(ingredientsList);
    if (map[n]) return map[n];
    var alt = /s$/.test(n) ? n.slice(0, -1) : n + 's';
    return map[alt] || null;
  }

  return { normalize: normalize, index: index, match: match };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Ingredients; }
