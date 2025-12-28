const { BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  mainWindow.loadFile("renderer/index.html");

  // Optional: make movable by dragging background
  mainWindow.setMovable(true);

  // Disable menu
  mainWindow.setMenu(null);
}

function getMainWindow() {
  return mainWindow;
}

module.exports = { createWindow, getMainWindow };