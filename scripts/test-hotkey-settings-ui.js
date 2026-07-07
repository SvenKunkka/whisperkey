'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert.ok(
  mainSource.includes('Change Hotkey…'),
  'tray menu should expose a hotkey editor'
);
assert.ok(
  mainSource.includes("ipcMain.handle('hotkey:set'"),
  'main process should save custom hotkeys from the settings window'
);
assert.ok(
  mainSource.includes('maybeExplainCustomHotkeyPermissions'),
  'custom non-modifier hotkeys should explain the required macOS permissions'
);
assert.ok(
  fs.existsSync(path.join(root, 'renderer', 'hotkey.html')),
  'hotkey editor window should have an HTML entrypoint'
);
assert.ok(
  fs.existsSync(path.join(root, 'renderer', 'hotkey.js')),
  'hotkey editor window should capture key presses'
);

console.log('ok - hotkey settings UI is wired');
