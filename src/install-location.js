'use strict';

function isDiskImageAppPath(executablePath) {
  return typeof executablePath === 'string'
    && executablePath.startsWith('/Volumes/')
    && executablePath.includes('.app/Contents/MacOS/');
}

function shouldWarnAboutInstallLocation({ isPackaged, executablePath }) {
  return !!isPackaged && isDiskImageAppPath(executablePath);
}

module.exports = { isDiskImageAppPath, shouldWarnAboutInstallLocation };
