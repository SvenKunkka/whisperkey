'use strict';

const assert = require('assert');

const {
  isModifierOnlyHotkey,
  resolveMacKeyServerPath,
  resolveModifierMonitorPath
} = require('../src/hotkey');

const resourcesPath = '/Applications/WhisperKey.app/Contents/Resources';
const expected = '/Applications/WhisperKey.app/Contents/Resources/app.asar.unpacked/node_modules/node-global-key-listener/bin/MacKeyServer';
const monitorExpected = '/Applications/WhisperKey.app/Contents/Resources/modifier-monitor/ModifierMonitor';

const actual = resolveMacKeyServerPath(resourcesPath, candidate => candidate === expected);
assert.strictEqual(actual, expected);

const missing = resolveMacKeyServerPath(resourcesPath, () => false);
assert.strictEqual(missing, null);

const monitorActual = resolveModifierMonitorPath(resourcesPath, candidate => candidate === monitorExpected);
assert.strictEqual(monitorActual, monitorExpected);

const monitorMissing = resolveModifierMonitorPath(resourcesPath, () => false);
assert.strictEqual(monitorMissing, null);

assert.strictEqual(isModifierOnlyHotkey(['META', 'SHIFT']), true);
assert.strictEqual(isModifierOnlyHotkey(['LEFT META', 'RIGHT SHIFT']), true);
assert.strictEqual(isModifierOnlyHotkey(['META', 'F5']), false);

console.log('ok - packaged MacKeyServer path resolves to app.asar.unpacked');
