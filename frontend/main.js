// Handles window creation, application lifecycle events, etc.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 2400, // Initial window width
    height: 2400, // Initial window height
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Path to preload script
      contextIsolation: true, // Recommended for security
      nodeIntegration: false, // Disable Node.js integration in renderer for security
    },
  });

  // Load the index.html of the app.
  mainWindow.loadFile('index.html');

  // Open the DevTools automatically (optional, useful for development)
  mainWindow.webContents.openDevTools();

  // --- Example IPC Handler (for communication between main and renderer) ---
  // ipcMain.handle('some-async-action', async (event, arg) => {
  //   console.log('Received from renderer:', arg);
  //   // Example: Call a Python script or interact with the database here
  //   return { success: true, data: 'Processed data from main' };
  // });
}

// This method will be called when Electron has finished initialization
// and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});