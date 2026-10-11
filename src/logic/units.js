// Quantities and units: parsing, formatting, conversion, combining.
var Units = (function () {
  'use strict';

  var FRAC = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  var EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];

  function single_(text) {
    var s = String(text).trim();
    var m;
    if ((m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s))) {
      return Number(m[3]) === 0 ? null : Number(m[1]) + Number(m[2]) / Number(m[3]);
    }
    if ((m = /^(\d+)\/(\d+)$/.exec(s))) {
      return Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
    }
    if ((m = /^(\d+(?:\.\d+)?)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/.exec(s))) return Number(m[1]) + FRAC[m[2]];
    if ((m = /^([¼½¾⅓⅔⅛⅜⅝⅞])$/.exec(s))) return FRAC[m[1]];
    if ((m = /^(\d+(?:\.\d+)?|\.\d+)$/.exec(s))) return Number(m[1]);
    return null;
  }

  // '1 1/2' -> 1.5, '2-3' -> 3 (approx), 'a pinch' / '' -> null
  function parseQty(text) {
    if (text == null) return { qty: null, approx: false };
    var s = String(text).trim();
    if (!s) return { qty: null, approx: false };
    var q = single_(s);
    if (q !== null) return { qty: q, approx: false };
    var m = /^(.+?)\s*(-|–|—|to)\s*(.+)$/i.exec(s);
    if (m) {
      var a = single_(m[1]);
      var b = single_(m[3]);
      if (a !== null && b !== null) {
        if (m[2] === '-' && /^\d+$/.test(m[1].trim()) && /^\d+\/\d+$/.test(m[3].trim())) {
          return { qty: a + b, approx: false }; // "1-1/2" is a mixed number
        }
        return { qty: Math.max(a, b), approx: true };
      }
    }
    return { qty: null, approx: false };
  }

  // 1.5 -> '1½', 0.333 -> '⅓', 2 -> '2'
  function formatQty(n) {
    if (n == null || n === '' || isNaN(n)) return '';
    n = Number(n);
    var whole = Math.floor(n + 1e-9);
    var frac = n - whole;
    if (frac < 0) frac = 0;
    var f = '';
    if (Math.abs(frac - 1 / 3) < 0.03) {
      f = '⅓';
    } else if (Math.abs(frac - 2 / 3) < 0.03) {
      f = '⅔';
    } else {
      var eighths = Math.round(frac * 8);
      if (eighths === 8) { whole += 1; eighths = 0; }
      f = EIGHTHS[eighths];
    }
    if (whole === 0 && f === '') return n > 0 ? '⅛' : '0';
    return whole > 0 ? String(whole) + f : f;
  }

  function row_(text, table) {
    var t = String(text == null ? '' : text).trim().toLowerCase();
    if (!t) return null;
    for (var i = 0; i < table.length; i++) {
      if (String(table[i].unit).toLowerCase() === t) return table[i];
    }
    var canon = normalizeUnit(t, table);
    if (!canon) return null;
    for (var j = 0; j < table.length; j++) {
      if (table[j].unit === canon) return table[j];
    }
    return null;
  }

  // 'tablespoons' -> 'tbsp'; unknown -> null
  function normalizeUnit(text, unitsTable) {
    var t = String(text == null ? '' : text).trim().toLowerCase().replace(/\.$/, '');
    if (!t) return null;
    var cands = [t];
    if (/s$/.test(t)) cands.push(t.slice(0, -1));
    if (/es$/.test(t)) cands.push(t.slice(0, -2));
    for (var i = 0; i < unitsTable.length; i++) {
      var row = unitsTable[i];
      var names = [String(row.unit).toLowerCase()].concat(
        String(row.aliases || '').split(',').map(function (a) { return a.trim().toLowerCase(); }).filter(Boolean)
      );
      for (var c = 0; c < cands.length; c++) {
        if (names.indexOf(cands[c]) !== -1) return row.unit;
      }
    }
    return null;
  }

  // Returns the converted quantity, or null when units are unknown or in different families.
  // Count units (clove, can, ...) never convert into each other.
  function convert(qty, from, to, unitsTable) {
    if (String(from || '').toLowerCase() === String(to || '').toLowerCase()) return qty;
    var rf = row_(from, unitsTable);
    var rt = row_(to, unitsTable);
    if (!rf || !rt || rf.family !== rt.family) return null;
    if (rf.family === 'count') return rf.unit === rt.unit ? qty : null;
    return qty * Number(rf.to_base) / Number(rt.to_base);
  }

  // a, b = { qty, unit }. Result is in a's unit, or null if they cannot combine.
  function combine(a, b, unitsTable) {
    if (a.qty == null || b.qty == null) return null;
    if (String(a.unit || '').toLowerCase() === String(b.unit || '').toLowerCase()) {
      return { qty: Math.round((a.qty + b.qty) * 1e9) / 1e9, unit: a.unit };
    }
    var c = convert(b.qty, b.unit, a.unit, unitsTable);
    if (c == null) return null;
    return { qty: Math.round((a.qty + c) * 1e9) / 1e9, unit: a.unit };
  }

  return {
    parseQty: parseQty,
    formatQty: formatQty,
    normalizeUnit: normalizeUnit,
    convert: convert,
    combine: combine
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Units; }
