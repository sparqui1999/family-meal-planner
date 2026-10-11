// Turns pasted recipe text (and single ingredient lines) into structured data.
var RecipeParser = (function () {
  'use strict';

  function Units_() { return (typeof module !== 'undefined' && module.exports) ? require('./units') : Units; }

  var FR = '¼½¾⅓⅔⅛⅜⅝⅞';
  var Q = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?\\s*[' + FR + ']?|[' + FR + '])';
  var QTY_RE = new RegExp('^(' + Q + '(?:\\s*(?:-|–|to)\\s*' + Q + ')?)(?=\\s|$|\\()');
  var QTY_START = new RegExp('^[\\d' + FR + ']');
  var NUMBERED_STEP = /^\d+\s*[.)]\s/;
  var ING_HEAD = /^ingredients?\s*:?$/i;
  var STEP_HEAD = /^(directions?|instructions?|method|steps?|preparation)\s*:?$/i;
  var CONTAINERS = { handful: 1, sprig: 1, stick: 1, head: 1, package: 1, pkg: 1, jar: 1, bottle: 1, box: 1, bag: 1, stalk: 1, ear: 1, sheet: 1, loaf: 1, block: 1, container: 1, carton: 1 };

  function isContainer_(word) {
    var w = word.toLowerCase();
    return !!(CONTAINERS[w] || CONTAINERS[w.replace(/s$/, '')] || CONTAINERS[w.replace(/es$/, '')]);
  }

  function parseIngredientLine(line, unitsTable) {
    var table = unitsTable || [];
    var out = { qty_text: '', qty: null, unit: '', name: '', prep_note: '', optional: false, confidence: 'ok' };
    var raw = String(line == null ? '' : line).replace(/^[\s\-•*☐□]+/, '').trim();
    if (!raw) { out.confidence = 'review'; return out; }

    if (/\(\s*optional\s*\)/i.test(raw) || /[,;]?\s*\boptional\s*$/i.test(raw)) {
      out.optional = true;
      raw = raw.replace(/\(\s*optional\s*\)/i, '').replace(/[,;]?\s*\boptional\s*$/i, '').trim();
    }

    // Split off a trailing note at the first comma that is outside parentheses.
    var main = raw;
    var note = '';
    var depth = 0;
    for (var i = 0; i < raw.length; i++) {
      var ch = raw.charAt(i);
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) {
        main = raw.slice(0, i).trim();
        note = raw.slice(i + 1).trim();
        break;
      }
    }

    var rest = main;
    var m = QTY_RE.exec(main);
    if (m) {
      out.qty_text = m[1].trim();
      out.qty = Units_().parseQty(out.qty_text).qty;
      rest = main.slice(m[0].length).trim();
    }

    var pm = /^\(([^)]*)\)\s*/.exec(rest);
    if (pm) {
      note = note ? pm[1].trim() + '; ' + note : pm[1].trim();
      rest = rest.slice(pm[0].length);
      out.confidence = 'review';
    }

    if (m) {
      var words = rest.split(/\s+/);
      var unit = '';
      if (words.length >= 2) {
        var u2 = Units_().normalizeUnit(words[0] + ' ' + words[1], table);
        if (u2) { unit = u2; rest = words.slice(2).join(' '); }
      }
      if (!unit && words[0]) {
        var u1 = Units_().normalizeUnit(words[0], table);
        if (u1) {
          unit = u1;
          rest = words.slice(1).join(' ');
        } else if (isContainer_(words[0])) {
          unit = words[0].toLowerCase();
          rest = words.slice(1).join(' ');
          out.confidence = 'review';
        }
      }
      out.unit = unit;
    }

    out.name = rest.replace(/^of\s+/i, '').trim();
    out.prep_note = note;
    if (!out.name) out.confidence = 'review';
    return out;
  }

  function parseMinutes_(str) {
    var s = String(str);
    var h = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i.exec(s);
    var mi = /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/i.exec(s);
    if (!h && !mi) {
      return /^\s*\d+\s*$/.test(s) ? Number(s) : null;
    }
    return Math.round((h ? Number(h[1]) * 60 : 0) + (mi ? Number(mi[1]) : 0));
  }

  function timerOf_(text) {
    var m = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?)\b/i.exec(text);
    if (!m) return null;
    return Math.round(/^h/i.test(m[2]) ? Number(m[1]) * 60 : Number(m[1]));
  }

  function subHeading_(line) {
    if (/:$/.test(line) && line.length <= 60) return line.replace(/:$/, '').trim();
    if (/^[A-Z][A-Z0-9\s&'\-,]{2,}$/.test(line) && /[A-Z]{2}/.test(line)) return line.trim();
    if (/^for\s+(?:the\s+)?[A-Za-z][A-Za-z\s'-]{1,40}$/i.test(line)) return line.trim();
    return '';
  }

  function parseRecipeText(text, unitsTable) {
    var result = { title: '', servings: null, prep_min: null, cook_min: null, ingredients: [], steps: [], warnings: [] };
    try {
      var lines = String(text == null ? '' : text).split(/\r?\n/).map(function (l) { return l.trim(); });
      if (!lines.some(Boolean)) {
        result.warnings.push('The recipe text is empty.');
        return result;
      }
      var hasHeadings = lines.some(function (l) { return ING_HEAD.test(l) || STEP_HEAD.test(l); });
      var mode = hasHeadings ? 'pre' : 'guess';
      if (!hasHeadings) {
        result.warnings.push('No "Ingredients" or "Directions" headings were found, so lines were sorted by guess. Please review.');
      }
      var group = '';
      var section = '';

      var addIngredient = function (line) {
        var p = parseIngredientLine(line, unitsTable);
        if (!p.name && !p.qty_text) return;
        if (p.confidence === 'review') result.warnings.push('Check this ingredient: "' + line + '"');
        p.group_label = group;
        result.ingredients.push(p);
      };
      var addStep = function (line) {
        var t = line.replace(/^\s*(?:step\s*\d+\s*[:.)-]?|\d+\s*[.)])\s*/i, '').trim();
        if (!t) return;
        result.steps.push({ step_no: result.steps.length + 1, section_label: section, text: t, timer_min: timerOf_(t) });
      };

      lines.forEach(function (line) {
        if (!line) return;
        if (ING_HEAD.test(line)) { mode = 'ing'; group = ''; return; }
        if (STEP_HEAD.test(line)) { mode = 'steps'; section = ''; return; }

        var sm = /^(?:serves|servings?|makes|yields?)\s*:?\s*(\d+)/i.exec(line);
        if (sm) { result.servings = Number(sm[1]); return; }
        var tm = /^(prep|cook)(?:\s*time)?\s*:\s*(.+)$/i.exec(line);
        if (tm) {
          var mins = parseMinutes_(tm[2]);
          if (mins != null) {
            if (tm[1].toLowerCase() === 'prep') result.prep_min = mins; else result.cook_min = mins;
            return;
          }
        }

        if (mode === 'pre') {
          if (!result.title) result.title = line;
          return;
        }
        if (mode === 'guess') {
          if (QTY_START.test(line) && !NUMBERED_STEP.test(line)) addIngredient(line); else addStep(line);
          return;
        }
        var sub = subHeading_(line);
        if (sub) {
          if (mode === 'ing') group = sub; else section = sub;
          return;
        }
        if (mode === 'ing') addIngredient(line); else addStep(line);
      });

      if (!result.ingredients.length) result.warnings.push('No ingredients were found.');
      if (!result.steps.length) result.warnings.push('No steps were found.');
    } catch (e) {
      result.warnings.push('Could not fully read the recipe: ' + (e && e.message ? e.message : e));
    }
    return result;
  }

  return { parseIngredientLine: parseIngredientLine, parseRecipeText: parseRecipeText };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = RecipeParser; }
