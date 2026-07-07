'use strict';

const assert = require('assert');
const { buildWhisperArgs } = require('../src/asr');

const autoArgs = buildWhisperArgs({
  modelPath: '/model.bin',
  wavFile: '/take.wav',
  threads: 8,
  language: 'auto'
});

assert.deepStrictEqual(autoArgs.slice(0, 6), ['-m', '/model.bin', '-f', '/take.wav', '-t', '8']);
assert.ok(autoArgs.includes('-l') && autoArgs.includes('auto'), 'auto mode should still ask whisper.cpp to detect language');
assert.ok(autoArgs.includes('--prompt'), 'auto mode should provide a mixed Chinese/English dictation prompt');
assert.ok(autoArgs.includes('--carry-initial-prompt'), 'auto mode should carry the mixed-language prompt through segments');
assert.ok(autoArgs.includes('-bs') && autoArgs.includes('5'), 'auto mode should use a less aggressive beam size for mixed language');
assert.ok(autoArgs.includes('-bo') && autoArgs.includes('5'), 'auto mode should use a less aggressive best-of for mixed language');

const zhArgs = buildWhisperArgs({
  modelPath: '/model.bin',
  wavFile: '/take.wav',
  threads: 8,
  language: 'zh'
});

assert.ok(zhArgs.includes('-l') && zhArgs.includes('zh'), 'explicit language should still be honored');
assert.ok(!zhArgs.includes('--prompt'), 'explicit single-language mode should not force the mixed-language prompt');
assert.ok(zhArgs.includes('-bs') && zhArgs.includes('1'), 'explicit language mode keeps the low-latency settings');

console.log('ok - asr args favor mixed Chinese/English only in auto mode');
