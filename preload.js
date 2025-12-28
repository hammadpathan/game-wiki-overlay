const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onClickThroughChanged: (callback) => {
    ipcRenderer.on('click-through-changed', (event, enabled) => callback(enabled));
  },
  onGamepadAction: (callback) => {
    ipcRenderer.on('gamepad-action', (event, action) => callback(action));
  },
  onAnalogInput: (callback) => {
    ipcRenderer.on('analog-input', (event, data) => callback(data));
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