// One-time setup: builds the spreadsheet (tabs, headers, dropdowns, README) and loads starter data.
// Safe to run again, even after a run that stopped halfway: it never duplicates starter rows or deletes your data.
// Every dropdown in the sheet is sorted A to Z.
var Setup = (function () {
  'use strict';

  var MAX_ROWS = 2000;
  var SKIP_SORTED = { lib_dishes: 1, lib_restaurants: 1, lib_ingredients: 1 };

  function byName_(a, b) {
    var x = String(a).toLowerCase();
    var y = String(b).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }

  function colLetter_(tab, column) {
    return Schema.letter(Schema.columnIndex(tab, column));
  }

  function keyRange_(tab) {
    var L = colLetter_(tab, Schema.keyColumn(tab));
    return tab + '!$' + L + '$2:$' + L;
  }

  function sortedNames_(tab) {
    var r = keyRange_(tab);
    return '=IFERROR(SORT(FILTER(' + r + ', ' + r + '<>"")),"")';
  }

  function dishList_(roleFilter) {
    var name = 'lib_dishes!$' + colLetter_('lib_dishes', 'name') + '$2:$' + colLetter_('lib_dishes', 'name');
    var status = 'lib_dishes!$' + colLetter_('lib_dishes', 'status') + '$2:$' + colLetter_('lib_dishes', 'status');
    var role = 'lib_dishes!$' + colLetter_('lib_dishes', 'role') + '$2:$' + colLetter_('lib_dishes', 'role');
    var cond = name + '<>"", ' + status + '<>"retired"' + (roleFilter ? ', ' + role + '="' + roleFilter + '"' : '');
    return '=IFERROR(SORT(FILTER(' + name + ', ' + cond + ')),"")';
  }

  function restaurantList_(activeOnly) {
    var name = keyRange_('lib_restaurants');
    var status = 'lib_restaurants!$' + colLetter_('lib_restaurants', 'status') + '$2:$' + colLetter_('lib_restaurants', 'status');
    var cond = name + '<>""' + (activeOnly ? ', ' + status + '<>"retired"' : '');
    return '=IFERROR(SORT(FILTER(' + name + ', ' + cond + ')),"")';
  }

  // Hidden helper lists. Each is sorted A to Z by a formula, and dropdowns read from them.
  function listDefs_() {
    var stack = 'lib_dish_types!$A$2:$A; lib_cuisines!$A$2:$A; lib_tags!$A$2:$A; "*"';
    var lists = [
      { key: 'all_dishes', formula: dishList_('') },
      { key: 'main_dishes', formula: dishList_('main') },
      { key: 'side_dishes', formula: dishList_('side') },
      { key: 'active_restaurants', formula: restaurantList_(true) },
      { key: 'all_restaurants', formula: restaurantList_(false) },
      { key: 'ingredient_names', formula: sortedNames_('lib_ingredients') },
      { key: 'match_values', formula: '=IFERROR(SORT(UNIQUE(FILTER({' + stack + '}, {' + stack + '}<>""))),"")' }
    ];
    var seen = {};
    Schema.tabs.forEach(function (t) {
      t.columns.forEach(function (c) {
        if (c.ref && !c.list && !SKIP_SORTED[c.ref] && !seen[c.ref]) {
          seen[c.ref] = true;
          lists.push({ key: 'sorted_' + c.ref, formula: sortedNames_(c.ref) });
        }
      });
    });
    return lists;
  }

  function listKeyFor_(c) {
    if (c.list) return c.list;
    if (c.ref === 'lib_dishes') return 'all_dishes';
    if (c.ref === 'lib_restaurants') return 'all_restaurants';
    if (c.ref === 'lib_ingredients') return 'ingredient_names';
    return 'sorted_' + c.ref;
  }

  function sysRange_(ss, key) {
    var lists = listDefs_();
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].key === key) {
        var L = Schema.letter(i);
        return ss.getRange('sys_lists!' + L + '2:' + L);
      }
    }
    throw new Error('Unknown list: ' + key);
  }

  function ensureSheet_(ss, name, index) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name, index);
    return sheet;
  }

  function isText_(c) {
    return c.type === 'string' || c.type === 'date' || c.type === 'json';
  }

  function textRuns_(cols) {
    var runs = [];
    var start = -1;
    cols.forEach(function (c, i) {
      if (isText_(c) && start < 0) start = i;
      if (!isText_(c) && start >= 0) { runs.push([start, i - 1]); start = -1; }
    });
    if (start >= 0) runs.push([start, cols.length - 1]);
    return runs;
  }

  // The dropdown, checkbox or uniqueness rule for one column, or null.
  function ruleFor_(ss, c, index) {
    if (c.key) {
      var L = Schema.letter(index);
      return SpreadsheetApp.newDataValidation()
        .requireFormulaSatisfied('=COUNTIF($' + L + '$2:$' + L + ', ' + L + '2)<=1')
        .setAllowInvalid(false)
        .setHelpText('Each name must be unique.')
        .build();
    }
    if (c.type === 'boolean') return SpreadsheetApp.newDataValidation().requireCheckbox().build();
    if (c.enum) return SpreadsheetApp.newDataValidation().requireValueInList(c.enum.slice().sort(byName_), true).setAllowInvalid(false).build();
    if (c.list || c.ref) {
      return SpreadsheetApp.newDataValidation().requireValueInRange(sysRange_(ss, listKeyFor_(c)), true).setAllowInvalid(true).build();
    }
    return null;
  }

  function buildSysLists_(ss) {
    var sheet = ss.getSheetByName('sys_lists');
    sheet.setTabColor(Schema.COLORS.system);
    listDefs_().forEach(function (l, i) {
      sheet.getRange(1, i + 1).setValue(l.key).setFontWeight('bold');
      sheet.getRange(2, i + 1).setFormula(l.formula);
    });
    sheet.hideSheet();
  }

  // Headers, text formats, dropdowns and protection, using as few calls as possible.
  function buildTab_(ss, t) {
    var cols = t.columns;
    var sheet = ss.getSheetByName(t.tab);
    sheet.setTabColor(t.color);
    if (!cols.length) return;
    if (sheet.getMaxRows() < MAX_ROWS + 1) sheet.insertRowsAfter(sheet.getMaxRows(), MAX_ROWS + 1 - sheet.getMaxRows());
    if (sheet.getMaxColumns() < cols.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), cols.length - sheet.getMaxColumns());

    var header = sheet.getRange(1, 1, 1, cols.length);
    header.setValues([cols.map(function (c) { return c.name; })]).setFontWeight('bold').setBackground('#f1f3f4');
    header.setNotes([cols.map(function (c) { return c.desc || ''; })]);
    sheet.setFrozenRows(1);

    textRuns_(cols).forEach(function (run) {
      sheet.getRange(2, run[0] + 1, MAX_ROWS, run[1] - run[0] + 1).setNumberFormat('@');
    });

    var rules = cols.map(function (c, i) { return ruleFor_(ss, c, i); });
    var grid = null;
    if (rules.some(function (r, i) { return r && !cols[i].key; })) {
      var row = rules.map(function (r, i) { return cols[i].key ? null : r; });
      grid = [];
      for (var r = 0; r < MAX_ROWS; r++) grid.push(row);
      try {
        sheet.getRange(2, 1, MAX_ROWS, cols.length).setDataValidations(grid);
      } catch (e) {
        // If Google refuses the large batch, apply the same rules one column at a time.
        cols.forEach(function (c, i) {
          if (rules[i] && !c.key) sheet.getRange(2, i + 1, MAX_ROWS, 1).setDataValidation(rules[i]);
        });
      }
    }
    cols.forEach(function (c, i) {
      // The uniqueness rule uses a relative reference, so it is applied to its column as a block.
      if (c.key) sheet.getRange(2, i + 1, MAX_ROWS, 1).setDataValidation(rules[i]);
      if (c.internal) {
        sheet.getRange(1, i + 1, MAX_ROWS + 1, 1).setBackground('#eeeeee').setFontColor('#777777');
        sheet.getRange(2, i + 1, MAX_ROWS, 1).protect().setDescription('Internal id. Do not edit.').setWarningOnly(true);
      }
      if (c.protect) {
        sheet.getRange(2, i + 1, MAX_ROWS, 1).protect().setDescription('Set automatically. Do not edit.').setWarningOnly(true);
      }
    });
  }

  function buildReadme_(ss) {
    var sheet = ensureSheet_(ss, 'README', 0);
    sheet.clear();
    var rows = [
      ['Family Meal Planner data'],
      [''],
      ['This spreadsheet is the planner\'s database. Blue tabs (lib_) hold dishes, recipes and restaurants. Green tabs (act_) hold plans, ratings and shopping. Orange tabs (cfg_) hold settings.'],
      ['Rename dishes, restaurants and ingredients freely: every link follows the new name. Names must be unique. Dropdowns are sorted A to Z.'],
      ['Grey "internal id" columns belong to the app. Please do not edit them.'],
      ['Use the Meal Planner menu: Back up now (owner only) and Check links.'],
      [''],
      ['Tab', 'What it holds']
    ];
    Schema.tabs.forEach(function (t) { if (t.group !== 'system') rows.push([t.tab, t.desc]); });
    sheet.getRange(1, 1, rows.length, 2).setValues(rows.map(function (r) { return [r[0], r[1] || '']; }));
    sheet.getRange(1, 1).setFontSize(16).setFontWeight('bold');
    sheet.getRange(8, 1, 1, 2).setFontWeight('bold');
    sheet.setColumnWidth(1, 220);
    sheet.setColumnWidth(2, 700);
    sheet.setTabColor('#202124');
  }

  function seed_() {
    Object.keys(Seed.tables).forEach(function (tab) {
      var sheet = Config.spreadsheet().getSheetByName(tab);
      if (sheet && sheet.getLastRow() < 2) Db.appendMany(tab, Seed.tables[tab]);
    });
    var members = Db.readAll('cfg_members');
    if (!members.length) {
      var email = Session.getActiveUser().getEmail();
      var local = String(email).split('@')[0] || 'Owner';
      Db.append('cfg_members', { name: local.charAt(0).toUpperCase() + local.slice(1), email: email, role: 'admin' });
    }
  }

  // Only block a re-run when real admins already exist. A run that stopped halfway has none,
  // and its owner must still be able to finish setup.
  function checkMayRerun_() {
    var members = [];
    try { members = Db.readAll('cfg_members'); } catch (e) { members = []; }
    var admins = members.filter(function (m) { return Members.isAdmin(m); });
    if (admins.length && !Members.isAdmin(Members.find(Session.getActiveUser().getEmail(), members))) {
      throw new Error('Only a planner admin can run setup again.');
    }
  }

  function run() {
    var props = PropertiesService.getScriptProperties();
    var id = props.getProperty('SHEET_ID');
    var ss;
    if (id) {
      checkMayRerun_();
      ss = SpreadsheetApp.openById(id);
    } else {
      ss = SpreadsheetApp.create('Family Meal Planner');
      props.setProperty('SHEET_ID', ss.getId());
    }
    Config.reset();

    // 1. Create every tab first, so dropdowns can point at tabs that come later in the list.
    ensureSheet_(ss, 'README', 0);
    var index = 1;
    ['cfg', 'lib', 'act'].forEach(function (prefix) {
      Schema.tabs.forEach(function (t) {
        if (t.tab.indexOf(prefix + '_') === 0) { ensureSheet_(ss, t.tab, index); index += 1; }
      });
    });
    ensureSheet_(ss, 'sys_lists', index);

    // 2. The sorted helper lists that dropdowns read from.
    buildSysLists_(ss);

    // 3. Headers, formats, dropdowns, protection.
    ['cfg', 'lib', 'act'].forEach(function (prefix) {
      Schema.tabs.forEach(function (t) { if (t.tab.indexOf(prefix + '_') === 0) buildTab_(ss, t); });
    });

    buildReadme_(ss);
    var blank = ss.getSheetByName('Sheet1');
    if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);
    ss.setActiveSheet(ss.getSheetByName('README'));

    seed_();
    Logger.log('Family Meal Planner sheet: ' + ss.getUrl());
    return ss.getUrl();
  }

  return { run: run };
})();

// Run this once from the Apps Script editor (select setupAll, then Run).
function setupAll() {
  return Setup.run();
}

if (typeof module !== 'undefined' && module.exports) { module.exports = Setup; }
