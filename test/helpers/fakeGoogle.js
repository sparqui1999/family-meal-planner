// A strict in-memory stand-in for the Google services that dist/Server.gs uses
// (SpreadsheetApp, CacheService, LockService, MailApp, ...). It is deliberately picky, like the real
// thing: a range on a tab that does not exist throws, writes outside the sheet's size throw.
// Randomness is seeded so tests are repeatable.
'use strict';

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { seeded } = require('./rng');

function makeEnv(options) {
  const o = options || {};
  const FIXED = new Date(o.now || '2026-10-11T19:00:00Z').getTime();
  class FakeDate extends Date {
    constructor(...a) { if (!a.length) super(FIXED); else super(...a); }
    static now() { return FIXED; }
  }
  const FakeMath = Object.create(Math);
  FakeMath.random = seeded(o.seed || 1);

  const props = {};
  const cache = {};
  const sent = [];
  const spreadsheets = {};
  const validationLists = [];
  const counters = { locks: 0, singleValidations: 0, batchValidations: 0 };
  const user = { email: o.email || 'owner@example.com' };
  let nextId = 1;

  class Range {
    constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
    check() {
      if (this.r < 1 || this.c < 1 || this.nr < 1 || this.nc < 1) throw new Error('Range has a zero or negative size');
      if (this.r + this.nr - 1 > this.sheet.maxRows || this.c + this.nc - 1 > this.sheet.maxCols) {
        throw new Error('The coordinates of the range are outside the dimensions of the sheet ' + this.sheet.name);
      }
    }
    getValues() {
      this.check();
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = [];
        for (let j = 0; j < this.nc; j++) {
          const v = (this.sheet.data[this.r - 1 + i] || [])[this.c - 1 + j];
          row.push(v === undefined ? '' : v);
        }
        out.push(row);
      }
      return out;
    }
    setValues(vals) {
      this.check();
      if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error('setValues size mismatch');
      for (let i = 0; i < this.nr; i++) {
        while (this.sheet.data.length < this.r + i) this.sheet.data.push([]);
        for (let j = 0; j < this.nc; j++) this.sheet.data[this.r - 1 + i][this.c - 1 + j] = vals[i][j];
      }
      return this;
    }
    setValue(v) { return this.setValues(Array.from({ length: this.nr }, () => Array(this.nc).fill(v))); }
    setFormula(f) { return this.setValue(f); }
    getRow() { return this.r; }
    getColumn() { return this.c; }
    getNumRows() { return this.nr; }
    getNumColumns() { return this.nc; }
    getSheet() { return this.sheet; }
    protect() { const p = { setDescription() { return p; }, setWarningOnly() { return p; } }; return p; }
  }
  ['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor', 'setNote', 'setNotes', 'setFontSize']
    .forEach((m) => { Range.prototype[m] = function () { this.check(); return this; }; });
  Range.prototype.setDataValidation = function () { this.check(); counters.singleValidations += 1; return this; };
  Range.prototype.setDataValidations = function () {
    this.check();
    if (o.refuseBatchValidations) throw new Error('Exception: Argument too large: rules');
    counters.batchValidations += 1;
    return this;
  };

  class Sheet {
    constructor(ss, name) { Object.assign(this, { ss, name, data: [], maxRows: 1000, maxCols: 26, hidden: false }); }
    getName() { return this.name; }
    getRange(a, b, c, d) { return typeof a === 'string' ? this.ss.getRange(a) : new Range(this, a, b, c || 1, d || 1); }
    getLastRow() { let last = 0; this.data.forEach((row, i) => { if (row.some((v) => v !== '' && v !== undefined)) last = i + 1; }); return last; }
    getLastColumn() { let last = 0; this.data.forEach((row) => row.forEach((v, j) => { if (v !== '' && v !== undefined) last = Math.max(last, j + 1); })); return last; }
    getMaxRows() { return this.maxRows; }
    getMaxColumns() { return this.maxCols; }
    insertRowsAfter(after, n) { this.maxRows += n; }
    insertColumnsAfter(after, n) { this.maxCols += n; }
    deleteRow(r) { this.data.splice(r - 1, 1); }
    deleteRows(r, n) { this.data.splice(r - 1, n); }
    setTabColor() {}
    setFrozenRows() {}
    hideSheet() { this.hidden = true; }
    setColumnWidth() {}
    clear() { this.data = []; }
  }

  class Spreadsheet {
    constructor() { this.id = 'SHEET' + (nextId++); this.sheets = [new Sheet(this, 'Sheet1')]; spreadsheets[this.id] = this; }
    getId() { return this.id; }
    getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
    getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
    insertSheet(n) { const s = new Sheet(this, n); this.sheets.push(s); return s; }
    deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
    getSheets() { return this.sheets; }
    setActiveSheet() {}
    getSpreadsheetTimeZone() { return 'America/Los_Angeles'; }
    getRange(a1) {
      const m = /^(?:'?([^'!]+)'?!)?([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(a1);
      if (!m) throw new Error('Bad A1 notation: ' + a1);
      let sheet = this.sheets[0];
      if (m[1]) {
        sheet = this.getSheetByName(m[1]);
        if (!sheet) throw new Error('Exception: Range not found: ' + a1);
      }
      return new Range(sheet, 1, 1, 1, 1);
    }
  }

  const builder = () => {
    const b = { build() { return {}; } };
    ['requireFormulaSatisfied', 'setAllowInvalid', 'setHelpText', 'requireCheckbox', 'requireValueInRange'].forEach((m) => { b[m] = () => b; });
    b.requireValueInList = (list) => { validationLists.push(list); return b; };
    return b;
  };

  const ctx = {
    console, Date: FakeDate, Math: FakeMath, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Promise, isNaN, isFinite, parseInt, parseFloat, Intl, Set, Map,
    SpreadsheetApp: { create: () => new Spreadsheet(), openById: (id) => spreadsheets[id], newDataValidation: builder },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => (k in cache ? cache[k] : null),
      put: (k, v) => { cache[k] = v; },
      remove: (k) => { delete cache[k]; },
      removeAll: (ks) => { ks.forEach((k) => { delete cache[k]; }); }
    }) },
    LockService: { getScriptLock: () => ({ waitLock() { counters.locks += 1; }, releaseLock() {} }) },
    Session: { getActiveUser: () => ({ getEmail: () => user.email }), getScriptTimeZone: () => 'America/Los_Angeles' },
    Utilities: { formatDate: (d, tz, fmt) => { const iso = new Date(d).toISOString(); return fmt.indexOf('HH') >= 0 ? iso.slice(0, 19) : iso.slice(0, 10); } },
    MailApp: { sendEmail: (m) => { if (o.mailFail) throw new Error(o.mailFail); sent.push(m); } },
    Logger: { log() {} },
    HtmlService: {
      createHtmlOutput: (s) => ({ html: s, setTitle() { return this; } }),
      createHtmlOutputFromFile: (f) => ({ file: f, setTitle() { return this; }, addMetaTag() { return this; } })
    }
  };
  vm.createContext(ctx);
  const serverPath = o.server || path.join(__dirname, '..', '..', 'dist', 'Server.gs');
  vm.runInContext(fs.readFileSync(serverPath, 'utf8'), ctx, { filename: 'Server.gs' });

  // Calls a server function with plain-data arguments and returns plain data, like google.script.run.
  function call(name, ...args) {
    ctx.__args = JSON.parse(JSON.stringify(args));
    const r = vm.runInContext(name + '(...__args)', ctx);
    return r === undefined ? undefined : JSON.parse(JSON.stringify(r));
  }
  return {
    ctx, call, sent, props, user, validationLists, counters,
    spreadsheet: () => spreadsheets[props.SHEET_ID],
    run: (code) => vm.runInContext(code, ctx),
    uncache: () => { Object.keys(cache).forEach((k) => delete cache[k]); }
  };
}

module.exports = { makeEnv };
