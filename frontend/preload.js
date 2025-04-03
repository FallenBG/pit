// Acts as a bridge between the sandboxed renderer and the main process.

const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded.');

// Expose specific IPC functions to the renderer process
// This is a safer way than enabling nodeIntegration
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Expose a function to send data to the main process
  // sendData: (channel, data) => ipcRenderer.send(channel, data),

  // Example: Expose a function to invoke an async action in the main process
  // invokeAction: (channel, data) => ipcRenderer.invoke(channel, data),

  // Add other functions you need to expose here (e.g., for file system access via main process)
  // Be very selective about what you expose for security reasons.
  // Example: Requesting file open dialog
  // openFile: () => ipcRenderer.invoke('dialog:openFile')
});