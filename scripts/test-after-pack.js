'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ensureExecutableResources } = require('./after-pack');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whisperkey-after-pack-'));

function touch(rel) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  fs.chmodSync(file, 0o644);
  return file;
}

function isExecutable(file) {
  return (fs.statSync(file).mode & 0o111) !== 0;
}

try {
  const keyServer = touch('WhisperKey.app/Contents/Resources/app.asar.unpacked/node_modules/node-global-key-listener/bin/MacKeyServer');
  const whisper = touch('WhisperKey.app/Contents/Resources/whisper/whisper-cli');
  const ffmpeg = touch('WhisperKey.app/Contents/Resources/ffmpeg/ffmpeg');
  const modifierMonitor = touch('WhisperKey.app/Contents/Resources/modifier-monitor/ModifierMonitor');
  const nativePaste = touch('WhisperKey.app/Contents/Resources/app.asar.unpacked/native/build/Release/paste_key.node');

  ensureExecutableResources({ appOutDir: path.join(root, 'WhisperKey.app') });

  assert.ok(isExecutable(keyServer), 'MacKeyServer should be executable');
  assert.ok(isExecutable(whisper), 'whisper-cli should be executable');
  assert.ok(isExecutable(ffmpeg), 'ffmpeg should be executable');
  assert.ok(isExecutable(modifierMonitor), 'ModifierMonitor should be executable');
  assert.ok(isExecutable(nativePaste), 'native paste helper should be executable');

  fs.chmodSync(keyServer, 0o644);
  fs.chmodSync(whisper, 0o644);
  fs.chmodSync(ffmpeg, 0o644);
  fs.chmodSync(modifierMonitor, 0o644);
  fs.chmodSync(nativePaste, 0o644);

  ensureExecutableResources({ appOutDir: root });

  assert.ok(isExecutable(keyServer), 'MacKeyServer should be executable when appOutDir is parent dir');
  assert.ok(isExecutable(whisper), 'whisper-cli should be executable when appOutDir is parent dir');
  assert.ok(isExecutable(ffmpeg), 'ffmpeg should be executable when appOutDir is parent dir');
  assert.ok(isExecutable(modifierMonitor), 'ModifierMonitor should be executable when appOutDir is parent dir');
  assert.ok(isExecutable(nativePaste), 'native paste helper should be executable when appOutDir is parent dir');
  console.log('ok - afterPack marks packaged binaries executable');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
