// This preload script sets up secure communication between the renderer process
// and the main process using Electron's contextBridge and ipcRenderer.
// Preload script contains code that runs before my web page is loaded into the browser window.
// Often used to expose APIs to the renderer process in a secure way.

// Listners are supposed to be defined in main.js, this file just exposes the ipcRenderer methods.

const { contextBridge, ipcRenderer } = require('electron');

// Track if listeners are already registered to prevent duplicates
let clickThroughListener = null;
let gamepadListener = null;
let analogListener = null;
let scrollListener = null;

// This exposes a secure API to the renderer process

contextBridge.exposeInMainWorld('electronAPI', {
  /*
  onClickThroughChanged: (callback) => {
    clickThroughListener = (event, enabled) => callback(enabled);
    ipcRenderer.on('click-through-changed', clickThroughListener);
  },*/

  // Gamepad input listener
  onGamepadAction: (callback) => {
    gamepadListener = (event, action) => callback(action);
    ipcRenderer.on('gamepad-action', gamepadListener);
  },

  // Analog input listener
  onAnalogInput: (callback) => {
    analogListener = (event, data) => callback(data);
    ipcRenderer.on('analog-input', analogListener);
  },

  // Scroll input listener
  onGamepadScroll: (callback) => {
    scrollListener = (event, data) => callback(data);
    ipcRenderer.on('gamepad-scroll', scrollListener);
  },

  // Close window
  closeWindow: () => ipcRenderer.send('close-window'),
  // Resize window
  startResize: (direction) => ipcRenderer.send('start-resize', direction),

  stopResize: () => ipcRenderer.send('stop-resize'),

  // Set window opacity
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity),
});