'use strict';

const assert = require('assert');

const {
  normalizeHotkey,
  formatHotkey,
  tokensFromCapture
} = require('../src/hotkey-config');

assert.deepStrictEqual(
  normalizeHotkey(['meta', 'shift', 'f5']),
  ['META', 'SHIFT', 'F5'],
  'hotkey tokens should be normalized for the listener'
);

assert.deepStrictEqual(
  tokensFromCapture({ modifiers: { meta: true, shift: true }, key: 'a' }),
  ['META', 'SHIFT', 'A'],
  'captured browser keyboard events should become listener tokens'
);

assert.deepStrictEqual(
  tokensFromCapture({ modifiers: { alt: true }, key: 'å', code: 'KeyA' }),
  ['ALT', 'A'],
  'captured shortcuts should save the physical key, not the Option-modified character'
);

assert.strictEqual(
  formatHotkey(['META', 'SHIFT', 'F5']),
  '⌘ + ⇧ + F5',
  'tray and settings UI should show readable hotkeys'
);

assert.throws(
  () => normalizeHotkey([]),
  /Choose at least one key/,
  'empty hotkeys should be rejected'
);

console.log('ok - hotkey configuration helpers normalize and format custom keys');
