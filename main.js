const { app, BrowserWindow, ipcMain, Notification, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

// Secure storage file path for encrypted credentials
const getSecureStoragePath = () => path.join(app.getPath('userData'), 'secure-credentials.json');

// Read encrypted credentials from file
const readSecureCredentials = () => {
  try {
    const filePath = getSecureStoragePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data;
    }
  } catch (error) {
    console.error('Error reading secure credentials:', error.message);
  }
  return {};
};

// Write encrypted credentials to file
const writeSecureCredentials = (credentials) => {
  try {
    const filePath = getSecureStoragePath();
    fs.writeFileSync(filePath, JSON.stringify(credentials), 'utf8');
  } catch (error) {
    console.error('Error writing secure credentials:', error.message);
  }
};

const isDev = process.argv.includes('--dev');
const VITE_DEV_SERVER_URL = 'http://localhost:3000';

let mainWindow;
let isUploading = {};
let keyObj = {};
let currentToken = '';
let currentBaseUrl = '';

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev
    }
  });

  // Maximize window on start
  mainWindow.maximize();

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Handle close event - check for active uploads
  mainWindow.on('close', async (event) => {
    let isRefreshAllowed = true;
    
    if (isUploading && Object.keys(isUploading).length > 0) {
      for (const val of Object.values(isUploading)) {
        if (!val) {
          isRefreshAllowed = false;
          break;
        }
      }
    }

    if (!isRefreshAllowed) {
      const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Okay'],
        defaultId: 0,
        title: 'Warning',
        message: 'It looks like you have been uploading something?',
        detail: 'If you leave before complete, your upload will be stopped.'
      });

      if (result === 0) {
        event.preventDefault();
      } else {
        // Cancel all uploads before closing
        if (currentBaseUrl && currentToken) {
          try {
            const axios = require('axios');
            await axios.post(`${currentBaseUrl}/api/file-upload/cancel-all`, {
              ids: Object.keys(isUploading),
              keyObj
            }, {
              headers: { 'api-key': currentToken }
            });
          } catch (error) {
            console.error('Error cancelling uploads:', error.message);
          }
        }
        isUploading = {};
        keyObj = {};
      }
    }
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
});

// ==================== IPC Handlers ====================

// Show desktop notification
ipcMain.handle('showNotification', async (event, { title, body }) => {
  new Notification({ title, body }).show();
});

// Show error dialog box
ipcMain.handle('showErrorBox', async (event, { title, message }) => {
  dialog.showErrorBox(title, message);
});

// Show info dialog box
ipcMain.handle('showInfoBox', async (event, { message, type, buttons }) => {
  return dialog.showMessageBox(mainWindow, {
    message,
    type: type || 'info',
    buttons: buttons || ['OK']
  });
});

// Show close confirmation dialog
ipcMain.handle('showCloseConfirmBox', async () => {
  const result = dialog.showMessageBoxSync(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Okay'],
    defaultId: 0,
    title: 'Warning',
    message: 'It looks like you have been uploading something?',
    detail: 'If you leave before complete, your upload will be stopped.'
  });
  return result;
});

// Show file name change confirmation
ipcMain.handle('showFileNameChangeConformation', async (event, message) => {
  return new Promise((resolve, reject) => {
    try {
      const result = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Okay'],
        defaultId: 0,
        title: 'Warning',
        message: 'Selected sample ID is not matching with file name?',
        detail: message
      });
      resolve(result === 1);
    } catch (error) {
      reject(error);
    }
  });
});

// Track upload status
ipcMain.handle('closeActionCheck', async (event, { data }) => {
  isUploading = data;
});

// Update key object for uploads
ipcMain.handle('KeyObjUpdate', async (event, { data }) => {
  keyObj = data;
});

// Store login details for cancel-all on close
ipcMain.handle('keepLoginDetails', (event, { apiKey, baseUrl }) => {
  currentToken = apiKey;
  currentBaseUrl = baseUrl;
});

// Get app version
ipcMain.handle('getAppVersion', () => {
  return app.getVersion();
});

// ==================== Secure Storage ====================

// Check if encryption is available
ipcMain.handle('isEncryptionAvailable', () => {
  return safeStorage.isEncryptionAvailable();
});

// Store a value securely (encrypted)
ipcMain.handle('secureStore', (event, { key, value }) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      const credentials = readSecureCredentials();
      credentials[key] = encrypted.toString('base64');
      writeSecureCredentials(credentials);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error storing secure value:', error.message);
    return false;
  }
});

// Retrieve a securely stored value
ipcMain.handle('secureRetrieve', (event, { key }) => {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const credentials = readSecureCredentials();
      if (credentials[key]) {
        const encrypted = Buffer.from(credentials[key], 'base64');
        return safeStorage.decryptString(encrypted);
      }
    }
    return null;
  } catch (error) {
    console.error('Error retrieving secure value:', error.message);
    return null;
  }
});

// Delete a securely stored value
ipcMain.handle('secureDelete', (event, { key }) => {
  try {
    const credentials = readSecureCredentials();
    if (credentials[key]) {
      delete credentials[key];
      writeSecureCredentials(credentials);
    }
    return true;
  } catch (error) {
    console.error('Error deleting secure value:', error.message);
    return false;
  }
});

// ==================== File System Access ====================

// Read file from local path (for resume upload functionality)
ipcMain.handle('readLocalFile', async (event, { filePath }) => {
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      return { success: true, data: buffer.toString('base64') };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Error reading local file:', error.message);
    return { success: false, error: error.message };
  }
});

// Get file stats (for resume upload)
ipcMain.handle('getFileStats', async (event, { filePath }) => {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return { success: true, size: stats.size, exists: true };
    }
    return { success: false, exists: false };
  } catch (error) {
    console.error('Error getting file stats:', error.message);
    return { success: false, error: error.message };
  }
});



