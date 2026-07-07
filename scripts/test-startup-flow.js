'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');

assert.ok(
  !mainSource.includes('await ensureMicPermission();'),
  'microphone permission prompt must not block hotkey startup'
);
assert.ok(
  mainSource.includes('ensureMicPermission().catch'),
  'microphone permission prompt should run in the background'
);

console.log('ok - startup does not block hotkey registration on microphone permission prompt');
