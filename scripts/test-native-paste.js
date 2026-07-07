'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nativePaste = require('../src/native-paste');

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

test('resolves native paste helper from the development build tree', () => {
  const expected = path.join(root, 'native', 'build', 'Release', 'paste_key.node');
  const actual = nativePaste.resolveNativePasteModulePath({
    appRoot: root,
    resourcesPath: '',
    exists: file => file === expected
  });
  assert.strictEqual(actual, expected);
});

test('resolves native paste helper from packaged app resources', () => {
  const resourcesPath = '/Applications/WhisperKey.app/Contents/Resources';
  const expected = path.join(resourcesPath, 'app.asar.unpacked', 'native', 'build', 'Release', 'paste_key.node');
  const actual = nativePaste.resolveNativePasteModulePath({
    appRoot: root,
    resourcesPath,
    exists: file => file === expected
  });
  assert.strictEqual(actual, expected);
});

test('native paste failure explains the missing helper', () => {
  assert.throws(
    () => nativePaste.loadNativePaste({ modulePath: '/missing/paste_key.node', exists: () => false }),
    /native paste helper is missing/
  );
});
