'use strict';

const assert = require('assert');

const { isDiskImageAppPath, shouldWarnAboutInstallLocation } = require('../src/install-location');

assert.strictEqual(
  isDiskImageAppPath('/Volumes/WhisperKey/WhisperKey.app/Contents/MacOS/WhisperKey'),
  true
);

assert.strictEqual(
  isDiskImageAppPath('/Applications/WhisperKey.app/Contents/MacOS/WhisperKey'),
  false
);

assert.strictEqual(
  shouldWarnAboutInstallLocation({
    isPackaged: true,
    executablePath: '/Volumes/WhisperKey/WhisperKey.app/Contents/MacOS/WhisperKey'
  }),
  true
);

assert.strictEqual(
  shouldWarnAboutInstallLocation({
    isPackaged: false,
    executablePath: '/Volumes/WhisperKey/WhisperKey.app/Contents/MacOS/WhisperKey'
  }),
  false
);

console.log('ok - install location warning detects apps launched from DMG volumes');
