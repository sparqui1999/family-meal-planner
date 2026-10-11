#!/usr/bin/env node
// Builds the files you paste into Google Apps Script:
//   dist/Server.gs            all server code (web app project)
//   dist/index.html           the page, with CSS and JavaScript inlined
//   dist/appsscript.json      web app manifest
//   dist/Bound.gs             script for the spreadsheet menu, rename cascade and backup
//   dist/bound_appsscript.json
// Output is deterministic: the same source always produces the same files.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function jsFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).sort().map((f) => dir + '/' + f);
}

function concat(files) {
  return files.map((f) => '// ===== ' + f + ' =====\n' + read(f).replace(/\s+$/, '') + '\n').join('\n');
}

function checkSyntax(source, label) {
  try {
    new vm.Script(source, { filename: label });
  } catch (e) {
    throw new Error('Syntax error in ' + label + ': ' + e.message);
  }
}

function buildServer() {
  const google = jsFiles('src/google');
  const main = 'src/google/main.js';
  const files = jsFiles('src/data').concat(jsFiles('src/logic'), google.filter((f) => f !== main), [main]);
  return concat(files);
}

function buildBound() {
  return concat(['src/data/schema.js', 'src/logic/references.js', 'src/bound/bound.js']);
}

function buildIndex() {
  const html = read('src/ui/index.html');
  return html.replace(/<!--INLINE:(css|js):([^>]+?)-->/g, (match, kind, rel) => {
    const content = read('src/ui/' + rel).replace(/\s+$/, '');
    if (kind === 'js') {
      if (/<\/script/i.test(content)) throw new Error('src/ui/' + rel + ' contains a closing script tag');
      checkSyntax(content, 'src/ui/' + rel);
      return '<script>\n' + content + '\n</script>';
    }
    return '<style>\n' + content + '\n</style>';
  });
}

function build(outDir) {
  const out = outDir || path.join(ROOT, 'dist');
  const server = buildServer();
  const bound = buildBound();
  const index = buildIndex();
  checkSyntax(server, 'Server.gs');
  checkSyntax(bound, 'Bound.gs');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'Server.gs'), server);
  fs.writeFileSync(path.join(out, 'Bound.gs'), bound);
  fs.writeFileSync(path.join(out, 'index.html'), index);
  fs.writeFileSync(path.join(out, 'appsscript.json'), read('src/appsscript.json'));
  fs.writeFileSync(path.join(out, 'bound_appsscript.json'), read('src/bound/appsscript.json'));
  return out;
}

if (require.main === module) {
  const out = build(process.argv[2]);
  console.log('Built ' + path.relative(ROOT, out) + '/');
}

module.exports = { build, buildServer, buildBound, buildIndex };
