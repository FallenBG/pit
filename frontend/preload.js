// 3. preload.js - Securely exposes specific Node.js/Electron APIs to the Renderer process
    // *** UPDATED for IPC ***

    const { contextBridge, ipcRenderer } = require('electron');

    console.log('Preload script loaded.');

    // Expose protected methods that allow the renderer process to use
    // the ipcRenderer without exposing the entire object
    contextBridge.exposeInMainWorld('electronAPI', {
        // Settings
        getSetting: (key) => ipcRenderer.invoke('db:get-setting', key),
        setSetting: (key, value) => ipcRenderer.invoke('db:set-setting', key, value),

        // Assets
        addAsset: (assetData) => ipcRenderer.invoke('db:add-asset', assetData),
        getAllAssets: () => ipcRenderer.invoke('db:get-all-assets'),
        // getAssetByTicker: (ticker) => ipcRenderer.invoke('db:get-asset-by-ticker', ticker), // Example for later
        // getAssetById: (id) => ipcRenderer.invoke('db:get-asset-by-id', id), // Example for later

        // Transactions
        addTransaction: (txData) => ipcRenderer.invoke('db:add-transaction', txData),
        getAllTransactions: () => ipcRenderer.invoke('db:get-all-transactions'),
        // getTransactionsForAsset: (assetId) => ipcRenderer.invoke('db:get-transactions-for-asset', assetId), // Example for later

        // Example: Expose a function to show file open dialog via main process
        // openFile: () => ipcRenderer.invoke('dialog:openFile')
    });

    console.log('electronAPI exposed to main world.');