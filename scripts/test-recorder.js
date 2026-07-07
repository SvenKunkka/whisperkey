'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { AudioRecorder } = require('../src/recorder');

function onceWithTimeout(emitter, event, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
    emitter.once(event, value => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

async function testImmediateFfmpegExitClearsRecordingState() {
  const fakeFfmpeg = path.join(os.tmpdir(), `fake-ffmpeg-${process.pid}`);
  fs.writeFileSync(fakeFfmpeg, '#!/bin/sh\necho fake ffmpeg failed >&2\nexit 1\n');
  fs.chmodSync(fakeFfmpeg, 0o755);

  try {
    const recorder = new AudioRecorder({ ffmpegPath: fakeFfmpeg, device: ':0' });
    recorder.start();
    await onceWithTimeout(recorder, 'warn', 1000);
    assert.strictEqual(recorder.isRecording(), false);
  } finally {
    fs.rmSync(fakeFfmpeg, { force: true });
  }
}

async function testMissingFfmpegThrows() {
  const recorder = new AudioRecorder({ ffmpegPath: null });
  assert.throws(
    () => recorder.start(),
    /ffmpeg not found/
  );
}

(async () => {
  await testImmediateFfmpegExitClearsRecordingState();
  console.log('ok - immediate ffmpeg exit clears recording state');

  await testMissingFfmpegThrows();
  console.log('ok - missing ffmpeg throws synchronously');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
