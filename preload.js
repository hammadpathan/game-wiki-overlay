const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onClickThroughChanged: (callback) => {
    ipcRenderer.on('click-through-changed', (event, enabled) => callback(enabled));
  },
  closeWindow: () => {
    ipcRenderer.send('close-window');
  },
  startResize: (direction) => {
    ipcRenderer.send('start-resize', direction);
  },
  stopResize: () => {
    ipcRenderer.send('stop-resize');
  }
});