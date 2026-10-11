'use strict';
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { build } = require('../scripts/build-dist');

const DIST = path.join(__dirname, '..', 'dist');
const FILES = ['Server.gs', 'Bound.gs', 'index.html', 'appsscript.json', 'bound_appsscript.json'];
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
let fresh;

before(() => {
  fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-dist-'));
  build(fresh);
});

describe('dist is up to date', () => {
  it('matches a fresh build, byte for byte', () => {
    FILES.forEach((f) => assert.equal(read(DIST, f), read(fresh, f), f + ' is stale: run npm run build'));
  });
  it('is deterministic', () => {
    const second = fs.mkdtempSync(path.join(os.tmpdir(), 'meal-dist2-'));
    build(second);
    FILES.forEach((f) => assert.equal(read(fresh, f), read(second, f), f));
  });
  it('produces all five files and nothing empty', () => {
    FILES.forEach((f) => assert.ok(read(DIST, f).length > 100, f));
  });
});

describe('Server.gs', () => {
  const server = () => read(DIST, 'Server.gs');
  it('parses as JavaScript', () => {
    assert.doesNotThrow(() => new vm.Script(server()));
  });
  it('contains every namespace, the entry points and the api functions', () => {
    const s = server();
    ['Schema', 'Seed', 'Dates', 'Ids', 'Units', 'Ingredients', 'References', 'RecipeParser', 'Recipe', 'Health', 'Ratings', 'Variety', 'Scoring',
      'Suggest', 'PlanOps', 'Shopping', 'Members', 'Config', 'Db', 'Setup'].forEach((n) => assert.ok(new RegExp('var ' + n + ' = ').test(s), n));
    ['function setupAll', 'function doGet', 'function requireMember_', 'function api_bootstrap', 'function api_savePlan', 'function api_getShoppingList', 'function api_emailList'].forEach((x) => assert.ok(s.includes(x), x));
    assert.ok((s.match(/^function api_/gm) || []).length >= 40);
  });
  it('ends with the main entry file', () => {
    const markers = server().match(/^\/\/ ===== .* =====$/gm);
    assert.equal(markers[markers.length - 1], '// ===== src/google/main.js =====');
  });
  it('does not include the sheet-bound script or tests', () => {
    assert.ok(!/function backupNow/.test(server()));
    assert.ok(!/node:test/.test(server()));
  });
});

describe('Bound.gs', () => {
  const bound = () => read(DIST, 'Bound.gs');
  it('parses as JavaScript', () => {
    assert.doesNotThrow(() => new vm.Script(bound()));
  });
  it('has the menu, rename cascade, link check and backup, plus the schema and reference logic it needs', () => {
    ['function onOpen', 'function onEdit', 'function backupNow', 'function checkLinks', 'var Schema = ', 'var References = '].forEach((x) => assert.ok(bound().includes(x), x));
  });
  it('does not include the web app code', () => {
    ['var Db = ', 'function doGet', 'function api_'].forEach((x) => assert.ok(!bound().includes(x), x));
  });
});

describe('index.html', () => {
  const html = () => read(DIST, 'index.html');
  it('has no leftover build markers', () => {
    assert.ok(!/INLINE:/.test(html()));
  });
  it('inlines the styles and every script, with balanced tags', () => {
    assert.ok(html().includes('<style>'));
    assert.equal((html().match(/<script>/g) || []).length, (html().match(/<\/script>/g) || []).length);
    ['var UI = ', 'UI.screens.week', 'UI.screens.plan', 'UI.screens.dishes', 'UI.screens.restaurants', 'UI.screens.shopping', 'var Dates = ', 'var Units = ', 'var Recipe = ', 'UI.init()']
      .forEach((x) => assert.ok(html().includes(x), x));
  });
  it('parses every inline script', () => {
    const scripts = [...html().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.ok(scripts.length >= 10);
    scripts.forEach((s, i) => assert.doesNotThrow(() => new vm.Script(s), 'script ' + i));
  });
  it('loads nothing from other sites', () => {
    assert.ok(!/<script[^>]+src=/i.test(html()));
    assert.ok(!/<link[^>]+href=/i.test(html()));
    assert.ok(!/@import/i.test(html()));
  });
  it('is mobile friendly', () => {
    assert.ok(html().includes('name="viewport"'));
  });
});

describe('manifests', () => {
  const json = (f) => JSON.parse(read(DIST, f));
  it('web app runs as the visitor, in Pacific time, without Drive access', () => {
    const m = json('appsscript.json');
    assert.equal(m.webapp.executeAs, 'USER_ACCESSING');
    assert.equal(m.webapp.access, 'ANYONE');
    assert.equal(m.timeZone, 'America/Los_Angeles');
    assert.equal(m.runtimeVersion, 'V8');
    assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/spreadsheets'));
    assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/script.send_mail'));
    assert.ok(!m.oauthScopes.some((s) => /\/auth\/drive/.test(s)), 'the web app must not request Drive');
  });
  it('sheet helper has Drive access for backups but is not a web app', () => {
    const m = json('bound_appsscript.json');
    assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/drive'));
    assert.ok(m.oauthScopes.includes('https://www.googleapis.com/auth/script.container.ui'));
    assert.equal(m.webapp, undefined);
    assert.equal(m.timeZone, 'America/Los_Angeles');
  });
});
