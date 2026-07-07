'use strict';

const assert = require('assert');
const {
  diagnosticButtons,
  diagnosticActionForResponse
} = require('../src/diagnostic-actions');

const accessibilityOnly = {
  hardFail: true,
  checks: [
    { name: 'Accessibility permission', ok: false },
    { name: 'Input Monitoring', ok: true }
  ]
};

assert.deepStrictEqual(
  diagnosticButtons(accessibilityOnly),
  ['Open Accessibility', 'Open Logs', 'Close']
);
assert.strictEqual(diagnosticActionForResponse(0, accessibilityOnly), 'accessibility');
assert.strictEqual(diagnosticActionForResponse(1, accessibilityOnly), 'logs');
assert.strictEqual(diagnosticActionForResponse(2, accessibilityOnly), 'close');

const microphoneOnly = {
  hardFail: true,
  checks: [
    { name: 'Microphone permission', ok: false },
    { name: 'Accessibility permission', ok: true },
    { name: 'Input Monitoring', ok: true }
  ]
};

assert.deepStrictEqual(
  diagnosticButtons(microphoneOnly),
  ['Open Microphone', 'Open Logs', 'Close']
);
assert.strictEqual(diagnosticActionForResponse(0, microphoneOnly), 'microphone');

const customHotkey = {
  hardFail: true,
  checks: [
    { name: 'Accessibility permission', ok: false },
    { name: 'Input Monitoring', ok: null }
  ]
};

assert.deepStrictEqual(
  diagnosticButtons(customHotkey),
  ['Open Accessibility', 'Open Input Monitoring', 'Open Logs', 'Close']
);
assert.strictEqual(diagnosticActionForResponse(1, customHotkey), 'inputMonitoring');

assert.deepStrictEqual(diagnosticButtons({ hardFail: false, checks: [] }), ['Close']);
assert.strictEqual(diagnosticActionForResponse(0, { hardFail: false, checks: [] }), 'close');

console.log('ok - diagnostics buttons prioritize the permission that is actually required');
