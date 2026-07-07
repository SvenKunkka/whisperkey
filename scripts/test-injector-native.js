'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const injectorSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'injector.js'), 'utf8');

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

test('injector does not route paste through osascript', () => {
  assert.ok(!injectorSource.includes('osascript'), 'injector must not spawn osascript');
  assert.ok(!injectorSource.includes('System Events'), 'injector must not ask System Events to send keys');
});

test('injector uses the native paste shortcut helper', () => {
  assert.ok(
    injectorSource.includes("require('./native-paste')"),
    'injector should use src/native-paste.js'
  );
});

test('injector fails clearly when Accessibility is not granted', () => {
  assert.ok(
    injectorSource.includes('isTrustedAccessibilityClient(false)'),
    'injector should check Accessibility before posting paste events'
  );
  assert.ok(
    injectorSource.includes('Accessibility permission is not granted'),
    'injector should explain the missing Accessibility permission'
  );
});
