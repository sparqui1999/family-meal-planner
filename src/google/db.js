// Sheet access: one function per kind of read/write. Rows are objects keyed by column name.
// Every write runs inside the script lock; reads are cached for 60 seconds.
var Db = (function () {
  'use strict';

  var CACHE_SECONDS = 60;
  var CACHE_MAX_CHARS = 90000;
  var held_ = false;

  function eq_(a, b) {
    return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
  }

  function def_(tab) {
    var t = Schema.tab(tab);
    if (!t || t.group === 'system') throw new Error('Unknown tab: ' + tab);
    return t;
  }

  function sheet_(tab) {
    var s = Config.spreadsheet().getSheetByName(tab);
    if (!s) throw new Error('Missing tab: ' + tab + '. Run setupAll again.');
    return s;
  }

  function headerMap_(sheet) {
    var lastCol = sheet.getLastColumn();
    var vals = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var map = {};
    vals.forEach(function (h, i) { if (h !== '') map[String(h)] = i; });
    return { width: vals.length, map: map };
  }

  function tz_() {
    return Config.spreadsheet().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  }

  function coerceIn_(v, type) {
    if (type === 'boolean') return v === true || String(v).toUpperCase() === 'TRUE';
    if (type === 'number') {
      if (v === '' || v == null) return null;
      var n = Number(v);
      return isNaN(n) ? null : n;
    }
    if (type === 'json') {
      if (v === '' || v == null) return null;
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch (e) { return v; }
      }
      return v;
    }
    if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
    return v == null ? '' : String(v);
  }

  function coerceOut_(v, type) {
    if (type === 'boolean') return v === true || String(v).toUpperCase() === 'TRUE';
    if (type === 'number') return v === '' || v == null || isNaN(Number(v)) ? '' : Number(v);
    if (type === 'json') return v == null || v === '' ? '' : (typeof v === 'string' ? v : JSON.stringify(v));
    return v == null ? '' : String(v);
  }

  function cacheGet_(tab) {
    try {
      var c = CacheService.getScriptCache().get('t:' + tab);
      return c ? JSON.parse(c) : null;
    } catch (e) { return null; }
  }

  function cachePut_(tab, rows) {
    try {
      var s = JSON.stringify(rows);
      if (s.length < CACHE_MAX_CHARS) CacheService.getScriptCache().put('t:' + tab, s, CACHE_SECONDS);
    } catch (e) { /* cache is optional */ }
  }

  // Small derived lookups that are cached next to a table and cleared whenever that table changes.
  var DERIVED_ = { lib_recipe_ingredients: ['has'] };

  function invalidate(tab) {
    try {
      var keys = ['t:' + tab].concat((DERIVED_[tab] || []).map(function (k) { return 'd:' + tab + ':' + k; }));
      CacheService.getScriptCache().removeAll(keys);
    } catch (e) { /* ignore */ }
  }

  function derived(tab, key, build) {
    var cacheKey = 'd:' + tab + ':' + key;
    try {
      var hit = CacheService.getScriptCache().get(cacheKey);
      if (hit) return JSON.parse(hit);
    } catch (e) { /* fall through and rebuild */ }
    var value = build();
    try {
      var text = JSON.stringify(value);
      if (text.length < CACHE_MAX_CHARS) CacheService.getScriptCache().put(cacheKey, text, CACHE_SECONDS);
    } catch (e) { /* cache is optional */ }
    return value;
  }

  function load_(tab) {
    var d = def_(tab);
    var sheet = sheet_(tab);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var rows = [];
    if (lastRow >= 2 && lastCol >= 1) {
      var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
      var head = values[0];
      var idx = d.columns.map(function (c) { return head.indexOf(c.name); });
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        var blank = true;
        for (var b = 0; b < row.length; b++) { if (row[b] !== '' && row[b] !== false) { blank = false; break; } }
        if (blank) continue;
        var o = { _row: i + 1 };
        d.columns.forEach(function (c, j) {
          o[c.name] = coerceIn_(idx[j] < 0 ? '' : row[idx[j]], c.type);
        });
        rows.push(o);
      }
    }
    return rows;
  }

  function readAll(tab) {
    var cached = cacheGet_(tab);
    if (cached) return cached;
    var rows = load_(tab);
    cachePut_(tab, rows);
    return rows;
  }

  function withLock_(fn) {
    if (held_) return fn();
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (e) {
      throw new Error('The planner is busy, please try again.');
    }
    held_ = true;
    try {
      return fn();
    } finally {
      held_ = false;
      lock.releaseLock();
    }
  }

  function matches_(row, match) {
    return Object.keys(match).every(function (k) { return eq_(row[k], match[k]); });
  }

  function toMatch_(colOrMatch, val) {
    if (typeof colOrMatch === 'object') return colOrMatch;
    var m = {};
    m[colOrMatch] = val;
    return m;
  }

  function rowArray_(d, hm, obj) {
    var arr = [];
    for (var i = 0; i < hm.width; i++) arr.push('');
    d.columns.forEach(function (c) {
      var p = hm.map[c.name];
      if (p != null && Object.prototype.hasOwnProperty.call(obj, c.name)) arr[p] = coerceOut_(obj[c.name], c.type);
    });
    return arr;
  }

  function textCols_(d, hm) {
    return d.columns.filter(function (c) { return c.type === 'string' || c.type === 'date' || c.type === 'json'; })
      .map(function (c) { return hm.map[c.name]; })
      .filter(function (p) { return p != null; });
  }

  function appendMany(tab, objs) {
    if (!objs || !objs.length) return 0;
    return withLock_(function () {
      var d = def_(tab);
      var sheet = sheet_(tab);
      var hm = headerMap_(sheet);
      var start = Math.max(sheet.getLastRow(), 1) + 1;
      var end = start + objs.length - 1;
      if (end > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), end - sheet.getMaxRows() + 100);
      textCols_(d, hm).forEach(function (p) { sheet.getRange(start, p + 1, objs.length, 1).setNumberFormat('@'); });
      var data = objs.map(function (o) { return rowArray_(d, hm, o); });
      sheet.getRange(start, 1, data.length, hm.width).setValues(data);
      invalidate(tab);
      return objs.length;
    });
  }

  function append(tab, obj) {
    return appendMany(tab, [obj]);
  }

  // Writes one row with a single read and a single write.
  function writeCells_(d, sheet, hm, rowNumber, patch) {
    var rng = sheet.getRange(rowNumber, 1, 1, hm.width);
    var cur = rng.getValues()[0];
    d.columns.forEach(function (c) {
      var p = hm.map[c.name];
      if (p == null || !Object.prototype.hasOwnProperty.call(patch, c.name)) return;
      cur[p] = coerceOut_(patch[c.name], c.type);
    });
    rng.setValues([cur]);
  }

  function updateWhere(tab, match, patch) {
    return withLock_(function () {
      var d = def_(tab);
      var sheet = sheet_(tab);
      var hm = headerMap_(sheet);
      var count = 0;
      load_(tab).forEach(function (row) {
        if (!matches_(row, match)) return;
        writeCells_(d, sheet, hm, row._row, patch);
        count += 1;
      });
      invalidate(tab);
      return count;
    });
  }

  // items: [{ key, patch }]. One read of the tab, then one write per changed row.
  function updateMany(tab, keyCol, items) {
    if (!items || !items.length) return 0;
    return withLock_(function () {
      var d = def_(tab);
      var sheet = sheet_(tab);
      var hm = headerMap_(sheet);
      var byKey = {};
      load_(tab).forEach(function (r) {
        var k = String(r[keyCol]).trim().toLowerCase();
        (byKey[k] = byKey[k] || []).push(r);
      });
      var count = 0;
      items.forEach(function (it) {
        (byKey[String(it.key).trim().toLowerCase()] || []).forEach(function (r) {
          writeCells_(d, sheet, hm, r._row, it.patch);
          count += 1;
        });
      });
      invalidate(tab);
      return count;
    });
  }

  // Fresh (uncached) values of one column. Use inside Db.locked when choosing the next id.
  function column(tab, col) {
    def_(tab);
    return load_(tab).map(function (r) { return r[col]; });
  }

  // Updates the first row whose keyCol equals keyVal. Throws if none.
  function update(tab, keyCol, keyVal, patch) {
    var m = {};
    m[keyCol] = keyVal;
    var changed = updateWhere(tab, m, patch);
    if (!changed) throw new Error('Not found: ' + keyVal);
    return changed;
  }

  // Deletes rows bottom-up, one call per block of consecutive rows.
  function deleteRows_(sheet, rowNumbers) {
    var rows = rowNumbers.slice().sort(function (a, b) { return a - b; });
    var blocks = [];
    rows.forEach(function (r) {
      var last = blocks[blocks.length - 1];
      if (last && r === last.start + last.count) last.count += 1;
      else blocks.push({ start: r, count: 1 });
    });
    blocks.reverse().forEach(function (b) { sheet.deleteRows(b.start, b.count); });
  }

  // deleteWhere(tab, col, val) or deleteWhere(tab, {col: val, ...})
  function deleteWhere(tab, colOrMatch, val) {
    var match = toMatch_(colOrMatch, val);
    return withLock_(function () {
      def_(tab);
      var sheet = sheet_(tab);
      var rows = load_(tab).filter(function (r) { return matches_(r, match); }).map(function (r) { return r._row; });
      deleteRows_(sheet, rows);
      invalidate(tab);
      return rows.length;
    });
  }

  function replaceWhere(tab, colOrMatch, val, rows) {
    var match = toMatch_(colOrMatch, typeof colOrMatch === 'object' ? undefined : val);
    var newRows = typeof colOrMatch === 'object' ? val : rows;
    return withLock_(function () {
      deleteWhere(tab, match);
      return appendMany(tab, newRows || []);
    });
  }

  function renameInColumn_(tab, column, oldName, newName) {
    var d = def_(tab);
    var sheet = sheet_(tab);
    var hm = headerMap_(sheet);
    var p = hm.map[column];
    var lastRow = sheet.getLastRow();
    if (p == null || lastRow < 2) return 0;
    var range = sheet.getRange(2, p + 1, lastRow - 1, 1);
    var vals = range.getValues();
    var count = 0;
    var out = vals.map(function (r) {
      if (eq_(r[0], oldName)) { count += 1; return [newName]; }
      return r;
    });
    if (count) { range.setValues(out); invalidate(tab); }
    return count;
  }

  // Renames a name everywhere it is used (the key cell and every referencing column).
  function applyRename(tab, oldName, newName) {
    return withLock_(function () {
      var keyCol = Schema.keyColumn(tab);
      if (!keyCol) throw new Error('This item cannot be renamed.');
      var target = String(newName == null ? '' : newName).trim();
      if (!target) throw new Error('The new name cannot be empty.');
      var rows = load_(tab);
      var found = false;
      rows.forEach(function (r) {
        if (eq_(r[keyCol], oldName)) found = true;
        else if (eq_(r[keyCol], target)) throw new Error('"' + target + '" already exists.');
      });
      if (!found) throw new Error('"' + oldName + '" was not found.');
      var count = renameInColumn_(tab, keyCol, oldName, target);
      References.referencingColumns(Schema, tab).forEach(function (rc) {
        count += renameInColumn_(rc.tab, rc.column, oldName, target);
      });
      return count;
    });
  }

  function nextId(tab, idCol, prefix) {
    return Ids.next(prefix, load_(tab).map(function (r) { return r[idCol]; }));
  }

  return {
    locked: withLock_,
    derived: derived,
    column: column,
    updateMany: updateMany,
    readAll: readAll,
    appendMany: appendMany,
    append: append,
    update: update,
    updateWhere: updateWhere,
    deleteWhere: deleteWhere,
    replaceWhere: replaceWhere,
    applyRename: applyRename,
    nextId: nextId,
    invalidate: invalidate
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Db; }
