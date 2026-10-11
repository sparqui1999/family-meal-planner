// Name-reference integrity: rename cascades, orphan detection, duplicate names.
// Used by BOTH the web app and the sheet-bound script.
// `tables` = { tabName: [rowObject, ...] }; `schema` = Schema (has .tabs).
var References = (function () {
  'use strict';

  function eq_(a, b) {
    return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
  }

  function tabDef_(schema, tab) {
    for (var i = 0; i < schema.tabs.length; i++) {
      if (schema.tabs[i].tab === tab) return schema.tabs[i];
    }
    return null;
  }

  function keyColumn_(schema, tab) {
    var def = tabDef_(schema, tab);
    if (!def) return null;
    for (var i = 0; i < def.columns.length; i++) {
      if (def.columns[i].key) return def.columns[i].name;
    }
    return null;
  }

  // Every column (in any tab) whose values are names from `tab`.
  function referencingColumns(schema, tab) {
    var out = [];
    schema.tabs.forEach(function (t) {
      t.columns.forEach(function (c) {
        if (c.ref === tab) out.push({ tab: t.tab, column: c.name });
      });
    });
    return out;
  }

  // Returns { tables: newTables, count } with oldName replaced by newName in the key cell
  // and in every referencing column. Throws if newName already belongs to another row.
  function applyRename(tables, schema, tab, oldName, newName) {
    var keyCol = keyColumn_(schema, tab);
    if (!keyCol) throw new Error('Tab ' + tab + ' has no name column');
    var target = String(newName == null ? '' : newName).trim();
    if (!target) throw new Error('The new name cannot be empty');
    var rows = tables[tab] || [];
    var found = false;
    rows.forEach(function (r) {
      if (eq_(r[keyCol], oldName)) found = true;
      else if (eq_(r[keyCol], target)) throw new Error('"' + target + '" already exists');
    });
    if (!found) throw new Error('"' + oldName + '" was not found');

    var out = {};
    Object.keys(tables).forEach(function (t) { out[t] = tables[t]; });
    var count = 0;

    function replaceIn(tabName, column) {
      var list = out[tabName];
      if (!list) return;
      out[tabName] = list.map(function (r) {
        if (!eq_(r[column], oldName)) return r;
        var copy = {};
        Object.keys(r).forEach(function (k) { copy[k] = r[k]; });
        copy[column] = target;
        count += 1;
        return copy;
      });
    }

    replaceIn(tab, keyCol);
    referencingColumns(schema, tab).forEach(function (rc) { replaceIn(rc.tab, rc.column); });
    return { tables: out, count: count };
  }

  // Non-blank reference values that match no row of the referenced tab.
  // `row` is the sheet row number (header = row 1); uses row._row when the caller supplies it.
  function findOrphans(tables, schema) {
    var orphans = [];
    schema.tabs.forEach(function (t) {
      if (t.group === 'system') return;
      var rows = tables[t.tab] || [];
      t.columns.forEach(function (c) {
        if (!c.ref || c.internal || c.enum) return;
        var keyCol = keyColumn_(schema, c.ref);
        if (!keyCol) return;
        var valid = {};
        (tables[c.ref] || []).forEach(function (r) { valid[String(r[keyCol]).trim().toLowerCase()] = true; });
        rows.forEach(function (r, i) {
          var v = r[c.name];
          if (v == null || String(v).trim() === '') return;
          if (!valid[String(v).trim().toLowerCase()]) {
            orphans.push({ tab: t.tab, row: r._row || i + 2, column: c.name, value: v });
          }
        });
      });
    });
    return orphans;
  }

  function isDuplicateName(rows, nameColumn, name, exceptRowIndex) {
    for (var i = 0; i < rows.length; i++) {
      if (i === exceptRowIndex) continue;
      if (eq_(rows[i][nameColumn], name)) return true;
    }
    return false;
  }

  return {
    referencingColumns: referencingColumns,
    applyRename: applyRename,
    findOrphans: findOrphans,
    isDuplicateName: isDuplicateName
  };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = References; }
