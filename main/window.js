const { BrowserWindow, app, webContents } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

// Config file path for persisting window bounds
const configPath = path.join(app.getPath('userData'), 'window-config.json');

function loadWindowBounds() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Ignore errors, use defaults
  }
  return { width: 900, height: 600 };
}

function saveWindowBounds() {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    fs.writeFileSync(configPath, JSON.stringify(bounds));
  } catch (e) {
    // Ignore save errors
  }
}

function createWindow() {
  const bounds = loadWindowBounds();
  
  mainWindow = new BrowserWindow({
    ...bounds,
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

  // Handle webview webContents - increase max listeners to prevent warnings
  // Webviews add internal listeners during navigation which can trigger warnings
  mainWindow.webContents.on('did-attach-webview', (event, webviewContents) => {
    webviewContents.setMaxListeners(0);
    
    // Suppress ERR_ABORTED errors that occur during rapid navigation
    // These are normal when user navigates before previous page finishes loading
    webviewContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      // ERR_ABORTED (-3) is expected when navigating away quickly
      if (errorCode === -3) {
        return; // Silently ignore
      }
    });
  });

  // Optional: make movable by dragging background
  mainWindow.setMovable(true);

  // Disable menu
  mainWindow.setMenu(null);

  // Save bounds when window is moved or resized
  mainWindow.on('moved', saveWindowBounds);
  mainWindow.on('resized', saveWindowBounds);
  mainWindow.on('close', saveWindowBounds);
}

function getMainWindow() {
  return mainWindow;
}

module.exports = { createWindow, getMainWindow };