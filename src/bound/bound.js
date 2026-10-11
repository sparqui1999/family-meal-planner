// Script bound to the planner spreadsheet (Extensions > Apps Script).
// Gives the sheet a "Meal Planner" menu, keeps links intact when names are edited by hand,
// and backs the sheet up on demand. Only the spreadsheet owner can run the backup.
// Uses the globals Schema and References (included above this file in dist/Bound.gs).

var BACKUP_FOLDER = 'Meal Planner Backups';
var BACKUP_PREFIX = 'Meal Planner backup ';
var BACKUP_KEEP = 8;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Meal Planner')
    .addItem('Back up now', 'backupNow')
    .addItem('Check links', 'checkLinks')
    .addToUi();
}

function toast_(message, seconds) {
  SpreadsheetApp.getActive().toast(message, 'Meal Planner', seconds || 6);
}

function sameName_(a, b) {
  return String(a == null ? '' : a).trim().toLowerCase() === String(b == null ? '' : b).trim().toLowerCase();
}

function headerIndex_(sheet, name) {
  var lastCol = sheet.getLastColumn();
  if (!lastCol) return -1;
  var head = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return head.indexOf(name);
}

// Replaces oldName with newName in every column that refers to `tab`. Returns the number of cells changed.
function cascadeRename_(tab, oldName, newName) {
  var ss = SpreadsheetApp.getActive();
  var total = 0;
  References.referencingColumns(Schema, tab).forEach(function (rc) {
    var sheet = ss.getSheetByName(rc.tab);
    if (!sheet || sheet.getLastRow() < 2) return;
    var idx = headerIndex_(sheet, rc.column);
    if (idx < 0) return;
    var range = sheet.getRange(2, idx + 1, sheet.getLastRow() - 1, 1);
    var count = 0;
    var out = range.getValues().map(function (r) {
      if (sameName_(r[0], oldName)) { count += 1; return [newName]; }
      return r;
    });
    if (count) { range.setValues(out); total += count; }
  });
  if (tab === 'cfg_profiles') {
    var settings = ss.getSheetByName('cfg_settings');
    if (settings && settings.getLastRow() >= 2) {
      var kIdx = headerIndex_(settings, 'key');
      var vIdx = headerIndex_(settings, 'value');
      var rows = settings.getRange(2, 1, settings.getLastRow() - 1, settings.getLastColumn()).getValues();
      rows.forEach(function (r, i) {
        if (r[kIdx] === 'active_profile' && sameName_(r[vIdx], oldName)) {
          settings.getRange(i + 2, vIdx + 1).setValue(newName);
          total += 1;
        }
      });
    }
  }
  return total;
}

// Simple trigger: fires when a person edits the sheet by hand.
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var def = Schema.tab(sheet.getName());
    if (!def || def.group === 'system') return;
    var firstRow = e.range.getRow();
    if (firstRow + e.range.getNumRows() - 1 < 2) return;

    var keyName = Schema.keyColumn(def.tab);
    if (!keyName) return;
    var keyCol = headerIndex_(sheet, keyName) + 1;
    if (keyCol < 1) return;
    var c1 = e.range.getColumn();
    var c2 = c1 + e.range.getNumColumns() - 1;
    if (keyCol < c1 || keyCol > c2) return;

    if (e.range.getNumRows() > 1 || e.range.getNumColumns() > 1) {
      toast_('Several names were changed at once, so links were not updated. Run Meal Planner > Check links.', 10);
      return;
    }
    var oldName = e.oldValue;
    var newName = String(e.value == null ? '' : e.value).trim();
    if (oldName === undefined || oldName === '') return; // a brand-new name has nothing pointing at it
    if (newName === '') {
      toast_('A name was deleted. Anything that used it now has a broken link. Run Meal Planner > Check links.', 10);
      return;
    }
    if (sameName_(oldName, newName) && String(oldName) === newName) return;

    var names = sheet.getRange(2, keyCol, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
    var dupes = names.filter(function (r) { return sameName_(r[0], newName); }).length;
    if (dupes > 1) {
      e.range.setValue(oldName);
      toast_('"' + newName + '" already exists, so the name was changed back to "' + oldName + '".', 8);
      return;
    }
    var count = cascadeRename_(def.tab, String(oldName), newName);
    toast_('Renamed "' + oldName + '" to "' + newName + '" in ' + count + ' place' + (count === 1 ? '' : 's') + '.');
  } catch (err) {
    try { toast_('Could not update links: ' + err.message, 10); } catch (ignore) { /* nothing more to do */ }
  }
}

function readTable_(tab) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(tab);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var head = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    var blank = true;
    head.forEach(function (h, j) {
      if (h === '') return;
      row[h] = values[i][j];
      if (values[i][j] !== '' && values[i][j] !== false) blank = false;
    });
    if (blank) continue;
    row._row = i + 1;
    rows.push(row);
  }
  return rows;
}

function checkLinks() {
  var ui = SpreadsheetApp.getUi();
  var tables = {};
  Schema.tabs.forEach(function (t) { if (t.group !== 'system') tables[t.tab] = readTable_(t.tab); });
  var orphans = References.findOrphans(tables, Schema);
  if (!orphans.length) {
    ui.alert('Check links', 'All links are good. Nothing points at a name that does not exist.', ui.ButtonSet.OK);
    return;
  }
  var lines = orphans.slice(0, 20).map(function (o) { return o.tab + ', row ' + o.row + ', ' + o.column + ': "' + o.value + '"'; });
  var more = orphans.length > 20 ? '\n...and ' + (orphans.length - 20) + ' more.' : '';
  ui.alert('Check links', orphans.length + ' link(s) point at a name that no longer exists:\n\n' + lines.join('\n') + more +
    '\n\nFix each one by choosing a name from the dropdown, or by adding the missing item.', ui.ButtonSet.OK);
}

function backupNow() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive();
  var file = DriveApp.getFileById(ss.getId());
  var owner = file.getOwner();
  var me = Session.getActiveUser().getEmail();
  if (!owner || String(owner.getEmail()).toLowerCase() !== String(me).toLowerCase()) {
    ui.alert('Back up now', 'Only the owner of this spreadsheet can run a backup.', ui.ButtonSet.OK);
    return;
  }
  var folders = DriveApp.getFoldersByName(BACKUP_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER);
  var stamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH-mm');
  file.makeCopy(BACKUP_PREFIX + stamp, folder);

  var backups = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.getName().indexOf(BACKUP_PREFIX) === 0) backups.push(f);
  }
  backups.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  backups.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });

  ui.alert('Back up now', 'Saved "' + BACKUP_PREFIX + stamp + '" in the Drive folder "' + BACKUP_FOLDER +
    '". The newest ' + BACKUP_KEEP + ' backups are kept.', ui.ButtonSet.OK);
}
