'use strict';

function inputMonitoringNeedsManualGrant(report) {
  return !!(report && report.checks || []).some(check =>
    check.name === 'Input Monitoring' && check.ok !== true
  );
}

function checkFailed(report, name) {
  return !!(report && report.checks || []).some(check =>
    check.name === name && check.ok === false
  );
}

function diagnosticButtons(report) {
  if (!report || !report.hardFail) return ['Close'];
  const buttons = [];
  if (checkFailed(report, 'Microphone permission')) buttons.push('Open Microphone');
  if (checkFailed(report, 'Accessibility permission')) buttons.push('Open Accessibility');
  if (inputMonitoringNeedsManualGrant(report)) buttons.push('Open Input Monitoring');
  buttons.push('Open Logs', 'Close');
  return buttons;
}

function diagnosticActionForResponse(response, report) {
  const label = diagnosticButtons(report)[response] || 'Close';
  if (label === 'Open Microphone') return 'microphone';
  if (label === 'Open Accessibility') return 'accessibility';
  if (label === 'Open Input Monitoring') return 'inputMonitoring';
  if (label === 'Open Logs') return 'logs';
  return 'close';
}

module.exports = {
  diagnosticButtons,
  diagnosticActionForResponse
};
