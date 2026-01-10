const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the API in a secure way
contextBridge.exposeInMainWorld("electronAPI", {
    // ==================== System Info ====================
    getVersions: () => ({
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron,
    }),

    getAppVersion: () => ipcRenderer.invoke("getAppVersion"),

    // Get system information (OS, platform, arch)
    getSystemInfo: () => ipcRenderer.invoke("getSystemInfo"),

    // ==================== Dialogs & Notifications ====================

    // Show desktop notification
    showNotification: (title, body) => ipcRenderer.invoke("showNotification", { title, body }),

    // Show error dialog box
    showErrorBox: (title, message) => ipcRenderer.invoke("showErrorBox", { title, message }),

    // Show info dialog box
    showInfoBox: (message, type = "info", buttons = ["OK"]) => ipcRenderer.invoke("showInfoBox", { message, type, buttons }),

    // Show close confirmation dialog when uploads are in progress
    showCloseConfirmBox: () => ipcRenderer.invoke("showCloseConfirmBox"),

    // Show file name change confirmation dialog
    showFileNameChangeConformation: (message) => ipcRenderer.invoke("showFileNameChangeConformation", message),

    // ==================== Upload Tracking ====================

    // Update upload status tracking (used to warn on close)
    closeActionCheck: (data) => ipcRenderer.invoke("closeActionCheck", { data }),

    // Update key object for uploads (for cancel-all functionality)
    keyObjUpdate: (data) => ipcRenderer.invoke("KeyObjUpdate", { data }),

    // Store login details for API calls from main process
    keepLoginDetails: (apiKey, baseUrl) => ipcRenderer.invoke("keepLoginDetails", { apiKey, baseUrl }),

    // ==================== Secure Storage ====================

    // Check if encryption is available
    isEncryptionAvailable: () => ipcRenderer.invoke("isEncryptionAvailable"),

    // Store a value securely (encrypted)
    secureStore: (key, value) => ipcRenderer.invoke("secureStore", { key, value }),

    // Retrieve a securely stored value
    secureRetrieve: (key) => ipcRenderer.invoke("secureRetrieve", { key }),

    // Delete a securely stored value
    secureDelete: (key) => ipcRenderer.invoke("secureDelete", { key }),

    // ==================== File System Access ====================

    // Read file from local path (for resume upload) - WARNING: Only for small files (<100MB)
    readLocalFile: (filePath) => ipcRenderer.invoke("readLocalFile", { filePath }),

    // Read a specific chunk from a file (for large file resume uploads)
    // This is memory-efficient and should be used for files > 100MB
    readFileChunk: (filePath, offset, length) => ipcRenderer.invoke("readFileChunk", { filePath, offset, length }),

    // Get file stats
    getFileStats: (filePath) => ipcRenderer.invoke("getFileStats", { filePath }),

    // ==================== Encrypted Logging ====================

    // Write encrypted log entries
    writeEncryptedLog: (entries) => ipcRenderer.invoke("writeEncryptedLog", { entries }),

    // Read and decrypt log file
    readEncryptedLog: (options) => ipcRenderer.invoke("readEncryptedLog", options),

    // Get list of log files
    getLogFiles: () => ipcRenderer.invoke("getLogFiles"),

    // ==================== Event Listeners ====================

    // Listen for clear upload queue event (called when app is closing)
    onClearUploadQueue: (callback) => {
        ipcRenderer.on("clearUploadQueue", callback);
        // Return cleanup function
        return () => ipcRenderer.removeListener("clearUploadQueue", callback);
    },
});
