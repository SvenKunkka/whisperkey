'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

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

test('Electron main entry points to an existing source file', () => {
  assert.strictEqual(pkg.main, 'src/main.js');
  assert.ok(exists(pkg.main), `${pkg.main} does not exist`);
});

test('runtime dependency for the global hotkey listener is declared', () => {
  assert.ok(pkg.dependencies, 'dependencies block is missing');
  assert.ok(pkg.dependencies['node-global-key-listener'], 'node-global-key-listener is not declared');
});

test('setup scripts exist and are exposed through npm scripts', () => {
  assert.strictEqual(pkg.scripts['build:native-paste'], 'bash scripts/build-native-paste.sh');
  assert.strictEqual(pkg.scripts['setup:whisper'], 'bash scripts/setup-whisper.sh');
  assert.strictEqual(pkg.scripts['setup:model'], 'bash scripts/download-model.sh');
  assert.strictEqual(pkg.scripts['bundle:ffmpeg'], 'bash scripts/bundle-ffmpeg.sh');
  assert.strictEqual(pkg.scripts['dist:local'], 'bash scripts/create-local-dmg.sh');
  assert.ok(exists('scripts/build-native-paste.sh'));
  assert.ok(exists('scripts/setup-whisper.sh'));
  assert.ok(exists('scripts/download-model.sh'));
  assert.ok(exists('scripts/bundle-ffmpeg.sh'));
  assert.ok(exists('scripts/create-local-dmg.sh'));
});

test('packaged resource layout matches runtime path resolution', () => {
  const resources = pkg.build.extraResources || [];
  assert.deepStrictEqual(
    resources,
    [
      { from: 'vendor/whisper', to: 'whisper', filter: ['**/*'] },
      { from: 'vendor/ffmpeg', to: 'ffmpeg', filter: ['**/*'] },
      { from: 'vendor/modifier-monitor', to: 'modifier-monitor', filter: ['**/*'] },
      { from: 'models', to: 'models', filter: ['**/*'] }
    ]
  );
  assert.ok(
    (pkg.build.asarUnpack || []).includes('node_modules/node-global-key-listener/bin/**/*'),
    'node-global-key-listener key server binary must be unpacked from asar'
  );
  assert.ok(
    (pkg.build.asarUnpack || []).includes('native/build/Release/**/*.node'),
    'native paste helper must be unpacked from asar'
  );
  assert.ok(
    (pkg.build.files || []).includes('native/build/Release/**/*.node'),
    'native paste helper must be included in packaged app files'
  );
});

test('macOS menu-bar and permission metadata are configured for packaged builds', () => {
  assert.strictEqual(pkg.build.mac.entitlements, 'build/entitlements.mac.plist');
  assert.strictEqual(pkg.build.mac.entitlementsInherit, 'build/entitlements.mac.plist');
  assert.strictEqual(pkg.build.mac.hardenedRuntime, true);
  assert.strictEqual(pkg.build.mac.extendInfo.LSUIElement, true);
  assert.strictEqual(pkg.build.mac.extendInfo.NSMicrophoneUsageDescription.length > 0, true);
});

test('README setup commands match package scripts', () => {
  const readme = read('README.md');
  assert.ok(readme.includes('npm run setup:whisper'));
  assert.ok(readme.includes('npm run setup:model'));
  assert.ok(readme.includes('npm run bundle:ffmpeg'));
});

test('capture pipeline cleans temporary wav files from a finally block', () => {
  const main = read('src/main.js');
  const finallyIndex = main.indexOf('finally');
  assert.ok(finallyIndex > -1, 'pipeline should have a finally block');
  assert.ok(
    main.indexOf('AudioRecorder.cleanup(result && result.file)', finallyIndex) > finallyIndex,
    'temporary wav cleanup should run from finally'
  );
});
