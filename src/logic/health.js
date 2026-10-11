// Automatic healthy score (1-10) from ingredient health tags and cooking method.
var Health = (function () {
  'use strict';

  function Ingredients_() { return (typeof module !== 'undefined' && module.exports) ? require('./ingredients') : Ingredients; }

  function num_(v, d) {
    var n = Number(v);
    return (v === '' || v == null || isNaN(n)) ? d : n;
  }

  // dish: {cook_method}; lines: recipe lines [{ingredient, optional}];
  // ingredientsByName: { normalizedName: {health_tag} }; rules: [{kind, key, points}]
  function scoreDish(dish, lines, ingredientsByName, rules, settings) {
    var s = settings || {};
    var base = num_(s.health_base, 5);
    var scale = num_(s.health_scale, 1.5);
    var ingPoints = {};
    var methodPoints = {};
    (rules || []).forEach(function (r) {
      var key = String(r.key).trim().toLowerCase();
      if (r.kind === 'ingredient') ingPoints[key] = Number(r.points);
      else if (r.kind === 'method') methodPoints[key] = Number(r.points);
    });
    var sum = 0;
    var count = 0;
    (lines || []).forEach(function (line) {
      if (line.optional) return;
      var ing = ingredientsByName[Ingredients_().normalize(line.ingredient)];
      if (!ing || !ing.health_tag) return;
      var pts = ingPoints[String(ing.health_tag).trim().toLowerCase()];
      if (pts == null || isNaN(pts)) return;
      sum += pts;
      count += 1;
    });
    var avg = count ? sum / count : 0;
    var method = methodPoints[String((dish && dish.cook_method) || '').trim().toLowerCase()] || 0;
    var raw = count ? base + avg * scale + method : base + method;
    return Math.max(1, Math.min(10, Math.round(raw)));
  }

  // Mean of non-null scores, one decimal; null if there are none.
  function scoreMeal(mainScore, sideScores) {
    var all = [mainScore].concat(sideScores || []).filter(function (v) { return v != null && v !== '' && !isNaN(v); }).map(Number);
    if (!all.length) return null;
    var mean = all.reduce(function (a, b) { return a + b; }, 0) / all.length;
    return Math.round(mean * 10) / 10;
  }

  return { scoreDish: scoreDish, scoreMeal: scoreMeal };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Health; }
