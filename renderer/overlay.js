'use strict';
// Overlay renderer: reflects StateManager events into the floating pill.
const pill = document.getElementById('pill');
const label = document.getElementById('label');

const TEXT = {
  idle: 'Idle',
  recording: 'Recording…',
  transcribing: 'Transcribing…',
  done: 'Done',
  error: 'Error'
};

window.wk.onState(({ state, detail }) => {
  pill.className = state;
  label.textContent = detail || TEXT[state] || state;
});
