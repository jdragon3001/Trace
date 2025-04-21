import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import RecordingService from './services/RecordingService';

let mainWindow: BrowserWindow | null = null;
let recordingServiceInstance: RecordingService | null = null;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      webSecurity: true
    }
  });

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' file:;"]
      }
    });
  });

  // In development, load from the local dev server
  const indexPath = path.join(__dirname, '..', 'renderer', 'index.html');
  console.log('Loading index from:', indexPath);
  mainWindow.loadFile(indexPath);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Instantiate and setup RecordingService after app is ready
  recordingServiceInstance = new RecordingService();
  recordingServiceInstance.setupShortcuts();

  // Ensure cleanup on quit
  app.on('will-quit', () => {
    recordingServiceInstance?.cleanup();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
}); 