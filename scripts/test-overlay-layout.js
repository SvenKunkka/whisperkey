'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const overlayHtml = fs.readFileSync(path.join(root, 'renderer', 'overlay.html'), 'utf8');
const overlayCss = fs.readFileSync(path.join(root, 'renderer', 'overlay.css'), 'utf8');

assert.ok(
  mainSource.includes('Enable Accessibility'),
  'permission failures should use concise overlay text'
);
assert.ok(
  overlayHtml.includes("style-src 'self'"),
  'overlay CSP should allow its external stylesheet to load'
);
assert.match(
  overlayCss,
  /#pill\s*\{[\s\S]*overflow:\s*hidden;/,
  'pill should clip unexpected long content'
);
assert.match(
  overlayCss,
  /#label\s*\{[\s\S]*text-overflow:\s*ellipsis;[\s\S]*white-space:\s*nowrap;/,
  'label should ellipsize instead of spilling outside the overlay'
);

console.log('ok - overlay clips long status text');
