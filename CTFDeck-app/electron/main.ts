import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as url from 'url';

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the Angular app
  // Check if we are in development mode (e.g. via environment variable or argument)
  // For simplicity in this plan, we will try to load from dist first.

  const appPath = path.join(__dirname, '../dist/CTFDeck-app/browser/index.html');

  win.loadURL(
    url.format({
      pathname: appPath,
      protocol: 'file:',
      slashes: true,
    }),
  );

  // Open the DevTools.
  // win.webContents.openDevTools();

  win.on('closed', () => {
    win = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});
