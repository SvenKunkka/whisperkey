'use strict';

const ASR_ENGINES = Object.freeze({
  'whisper.cpp': Object.freeze({
    label: 'whisper.cpp',
    binaryResourceDir: 'whisper',
    binaryDevDir: ['vendor', 'whisper'],
    binaryCandidates: Object.freeze(['whisper-cli', 'main']),
    modelResourceDir: 'models',
    modelPrefix: 'ggml-',
    modelExtension: '.bin',
    models: Object.freeze({
      tiny: Object.freeze({ label: 'tiny', speed: 'fastest', quality: 'low' }),
      base: Object.freeze({ label: 'base', speed: 'fast', quality: 'basic' }),
      small: Object.freeze({ label: 'small', speed: 'balanced', quality: 'good' }),
      medium: Object.freeze({ label: 'medium', speed: 'slower', quality: 'better' }),
      'large-v3': Object.freeze({ label: 'large-v3', speed: 'slowest', quality: 'best' }),
      'large-v3-turbo': Object.freeze({ label: 'large-v3-turbo', speed: 'slower', quality: 'best' })
    })
  })
});

function getAsrEngineSpec(engine = 'whisper.cpp') {
  const spec = ASR_ENGINES[engine];
  if (!spec) throw new Error(`Unsupported ASR engine: ${engine}`);
  return spec;
}

function getModelSpec(engine, model) {
  const spec = getAsrEngineSpec(engine);
  const modelSpec = spec.models[model];
  if (!modelSpec) throw new Error(`Unsupported ${spec.label} model: ${model}`);
  return modelSpec;
}

function modelFilename(engine, model) {
  const spec = getAsrEngineSpec(engine);
  getModelSpec(engine, model);
  return `${spec.modelPrefix}${model}${spec.modelExtension}`;
}

function availableEngines() {
  return Object.keys(ASR_ENGINES);
}

function availableModels(engine = 'whisper.cpp') {
  return Object.keys(getAsrEngineSpec(engine).models);
}

module.exports = {
  ASR_ENGINES,
  getAsrEngineSpec,
  getModelSpec,
  modelFilename,
  availableEngines,
  availableModels
};
