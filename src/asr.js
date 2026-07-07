'use strict';
// WhisperEngine: local speech-to-text via whisper.cpp's `whisper-cli` binary.
// We spawn the compiled binary against the WAV and read plain text back. This is
// the most robust integration path (no native node-gyp addon to keep in sync with
// Electron's ABI) and matches the "whisper.cpp preferred" requirement.
//
// Tuning for short-form dictation latency:
//   -nt            no timestamps (we only want text)
//   -np            no progress prints
//   --language     auto|en|zh
//   --prompt       only in auto mode, nudges mixed Chinese/English dictation
//   -t <threads>   CPU threads
//   -bs/-bo        lower values for fixed language, wider search for auto mode
const { spawn } = require('child_process');
const fs = require('fs');

const MIXED_LANGUAGE_PROMPT = [
  '中英混合听写，保留中文和 English words。',
  'Transcribe exactly what was spoken, preserving Chinese and English in the same sentence.'
].join(' ');

function isAutoLanguage(language) {
  return !language || String(language).toLowerCase() === 'auto';
}

function buildWhisperArgs({ modelPath, wavFile, threads, language = 'auto' }) {
  const auto = isAutoLanguage(language);
  const args = [
    '-m', modelPath,
    '-f', wavFile,
    '-t', String(threads),
    '-l', auto ? 'auto' : String(language),
    '-nt', '-np'
  ];

  if (auto) {
    args.push(
      '--prompt', MIXED_LANGUAGE_PROMPT,
      '--carry-initial-prompt',
      '-bs', '5', '-bo', '5'
    );
  } else {
    args.push('-bs', '1', '-bo', '1');
  }

  return args;
}

class WhisperEngine {
  constructor({ binPath, modelPath, language = 'auto', threads = 4 }) {
    this.engine = 'whisper.cpp';
    this.model = '';
    this.binPath = binPath;       // absolute path to whisper-cli
    this.modelPath = modelPath;   // absolute path to ggml-<model>.bin
    this.language = language;
    this.threads = threads;
  }

  ready() {
    return fs.existsSync(this.binPath) && fs.existsSync(this.modelPath);
  }

  // Returns a Promise<string> of transcribed plain text.
  transcribe(wavFile) {
    return new Promise((resolve, reject) => {
      if (!this.ready()) {
        return reject(new Error('whisper.cpp binary or model missing. Run: npm run setup:whisper && npm run setup:model'));
      }
      // No output-file flags: we capture transcribed text from stdout directly.
      const args = buildWhisperArgs({
        modelPath: this.modelPath,
        wavFile,
        threads: this.threads,
        language: this.language
      });
      const proc = spawn(this.binPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '';
      proc.stdout.on('data', d => { out += d.toString(); });
      proc.stderr.on('data', d => { err += d.toString(); });
      proc.on('error', reject);
      proc.on('close', code => {
        if (code !== 0) return reject(new Error(err.trim() || `whisper-cli exited ${code}`));
        resolve(out);
      });
    });
  }
}

const ASR_ENGINE_FACTORIES = {
  'whisper.cpp': ({ runtime, language, threads }) => {
    const engine = new WhisperEngine({
      binPath: runtime.binPath,
      modelPath: runtime.modelPath,
      language,
      threads
    });
    engine.model = runtime.model;
    return engine;
  }
};

function availableAsrEngines() {
  return Object.keys(ASR_ENGINE_FACTORIES);
}

function createAsrEngine({ runtime, language = 'auto', threads = 4 }) {
  const factory = ASR_ENGINE_FACTORIES[runtime.engine];
  if (!factory) throw new Error(`Unsupported ASR engine: ${runtime.engine}`);
  return factory({ runtime, language, threads });
}

module.exports = {
  WhisperEngine,
  createAsrEngine,
  availableAsrEngines,
  buildWhisperArgs,
  MIXED_LANGUAGE_PROMPT
};
