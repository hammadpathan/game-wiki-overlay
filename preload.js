const { contextBridge, ipcRenderer } = require('electron');

// Track if listeners are already registered to prevent duplicates
let clickThroughListener = null;
let gamepadListener = null;
let analogListener = null;

contextBridge.exposeInMainWorld('electronAPI', {
  onClickThroughChanged: (callback) => {
    // Remove existing listener if any
    if (clickThroughListener) {
      ipcRenderer.removeListener('click-through-changed', clickThroughListener);
    }
    clickThroughListener = (event, enabled) => callback(enabled);
    ipcRenderer.on('click-through-changed', clickThroughListener);
  },
  onGamepadAction: (callback) => {
    if (gamepadListener) {
      ipcRenderer.removeListener('gamepad-action', gamepadListener);
    }
    gamepadListener = (event, action) => callback(action);
    ipcRenderer.on('gamepad-action', gamepadListener);
  },
  onAnalogInput: (callback) => {
    if (analogListener) {
      ipcRenderer.removeListener('analog-input', analogListener);
    }
    analogListener = (event, data) => callback(data);
    ipcRenderer.on('analog-input', analogListener);
  },
  closeWindow: () => {
    ipcRenderer.send('close-window');
  },
  startResize: (direction) => {
    ipcRenderer.send('start-resize', direction);
  },
  stopResize: () => {
    ipcRenderer.send('stop-resize');
  },
  setOpacity: (opacity) => {
    ipcRenderer.send('set-opacity', opacity);
  }
});