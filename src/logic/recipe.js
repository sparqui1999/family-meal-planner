// Recipe display helpers: scaling and grouping.
var Recipe = (function () {
  'use strict';

  function Units_() { return (typeof module !== 'undefined' && module.exports) ? require('./units') : Units; }

  // lines: [{qty, qty_text, ...}] -> new lines scaled from fromServings to toServings.
  function scaleIngredients(lines, fromServings, toServings) {
    var from = Number(fromServings);
    var to = Number(toServings);
    if (!(from > 0) || !(to > 0)) throw new Error('Servings must be greater than zero');
    var factor = to / from;
    return (lines || []).map(function (line) {
      var copy = {};
      Object.keys(line).forEach(function (k) { copy[k] = line[k]; });
      if (line.qty != null && line.qty !== '' && isFinite(line.qty)) {
        copy.qty = Math.round(Number(line.qty) * factor * 1e6) / 1e6;
        copy.qty_text = Units_().formatQty(copy.qty);
      }
      return copy;
    });
  }

  // -> [{label, lines}] in original order, unlabeled group first.
  function groupByLabel(lines) {
    var groups = [];
    var byLabel = {};
    (lines || []).forEach(function (line) {
      var label = line.group_label || '';
      if (!byLabel[label]) {
        byLabel[label] = { label: label, lines: [] };
        groups.push(byLabel[label]);
      }
      byLabel[label].lines.push(line);
    });
    groups.sort(function (a, b) { return (a.label === '' ? 0 : 1) - (b.label === '' ? 0 : 1); });
    return groups;
  }

  return { scaleIngredients: scaleIngredients, groupByLabel: groupByLabel };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Recipe; }
