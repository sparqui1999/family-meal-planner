// Where the data lives. The spreadsheet id is stored in Script Properties by setupAll().
var Config = (function () {
  'use strict';

  var cached_ = null;

  function sheetId() {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!id) throw new Error('The planner is not set up yet. Run setupAll once from the Apps Script editor.');
    return id;
  }

  function spreadsheet() {
    if (!cached_) cached_ = SpreadsheetApp.openById(sheetId());
    return cached_;
  }

  function reset() {
    cached_ = null;
  }

  return { sheetId: sheetId, spreadsheet: spreadsheet, reset: reset };
})();

if (typeof module !== 'undefined' && module.exports) { module.exports = Config; }
