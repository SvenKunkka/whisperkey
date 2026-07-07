'use strict';

const assert = require('assert');
const diagnostics = require('../src/diagnostics');

const report = {
  ts: 'test',
  checks: [
    {
      name: 'Input Monitoring',
      ok: null,
      detail: 'not required for default modifier-only hotkey',
      hint: 'Only needed when falling back to event-tap key listener'
    }
  ]
};

const text = diagnostics.format(report);
assert.ok(text.includes('not required for default modifier-only hotkey'));
assert.ok(!text.includes('required for the hotkey'));

console.log('ok - diagnostics no longer requires Input Monitoring for default modifier hotkey');
