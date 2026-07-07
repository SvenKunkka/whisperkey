'use strict';
// StateManager: a tiny finite-state machine that is the single source of truth
// for what the app is doing. UI + everything else subscribe to 'change'.
const { EventEmitter } = require('events');

const STATES = Object.freeze({
  IDLE: 'idle',
  RECORDING: 'recording',
  TRANSCRIBING: 'transcribing',
  DONE: 'done',
  ERROR: 'error'
});

class StateManager extends EventEmitter {
  constructor() {
    super();
    this._state = STATES.IDLE;
    this._detail = '';
  }

  get state() { return this._state; }
  get detail() { return this._detail; }

  set(next, detail = '') {
    this._state = next;
    this._detail = detail;
    this.emit('change', { state: next, detail });
  }

  // Transient states auto-return to idle after a delay so the overlay hides itself.
  flash(next, detail, ms = 900) {
    this.set(next, detail);
    clearTimeout(this._t);
    this._t = setTimeout(() => this.set(STATES.IDLE), ms);
  }
}

module.exports = { StateManager, STATES };
