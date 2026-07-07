'use strict';

const assert = require('assert');
const path = require('path');

const { DEFAULTS } = require('../src/config');
const paths = require('../src/paths');
const { createAsrEngine, availableAsrEngines } = require('../src/asr');
const { getAsrEngineSpec, modelFilename } = require('../src/asr-models');

const fakeApp = { isPackaged: true };
const resourcesPath = '/Applications/WhisperKey.app/Contents/Resources';
const previousResourcesPath = process.resourcesPath;
process.resourcesPath = resourcesPath;

try {
  assert.strictEqual(DEFAULTS.asrEngine, 'whisper.cpp', 'default ASR engine should be explicit');
  assert.ok(availableAsrEngines().includes('whisper.cpp'), 'whisper.cpp should be a registered ASR engine');

  const spec = getAsrEngineSpec('whisper.cpp');
  assert.strictEqual(spec.label, 'whisper.cpp');
  assert.strictEqual(modelFilename('whisper.cpp', 'small'), 'ggml-small.bin');

  const runtime = paths.asrRuntime(fakeApp, { asrEngine: 'whisper.cpp', model: 'small' });
  assert.deepStrictEqual(
    runtime,
    {
      engine: 'whisper.cpp',
      engineLabel: 'whisper.cpp',
      binPath: path.join(resourcesPath, 'whisper', 'whisper-cli'),
      model: 'small',
      modelLabel: 'small',
      modelPath: path.join(resourcesPath, 'models', 'ggml-small.bin')
    },
    'runtime paths should come from the engine/model catalog'
  );

  const engine = createAsrEngine({
    runtime,
    language: 'auto',
    threads: 8
  });
  assert.strictEqual(engine.engine, 'whisper.cpp');
  assert.strictEqual(engine.model, 'small');
} finally {
  process.resourcesPath = previousResourcesPath;
}

console.log('ok - asr framework resolves engines and model runtimes');
