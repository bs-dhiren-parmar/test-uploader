const { app, BrowserWindow, ipcMain, Notification, dialog, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Secure storage file path for encrypted credentials
const getSecureStoragePath = () => path.join(app.getPath("userData"), "secure-credentials.json");

// Read encrypted credentials from file
const readSecureCredentials = () => {
    try {
        const filePath = getSecureStoragePath();
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
            return data;
        }
    } catch (error) {
        console.error("Error reading secure credentials:", error.message);
    }
    return {};
};

// Write encrypted credentials to file
const writeSecureCredentials = (credentials) => {
    try {
        const filePath = getSecureStoragePath();
        fs.writeFileSync(filePath, JSON.stringify(credentials), "utf8");
    } catch (error) {
        console.error("Error writing secure credentials:", error.message);
    }
};

const isDev = process.argv.includes("--dev");
const VITE_DEV_SERVER_URL = "http://localhost:3000";

// Disable sandbox on Linux to avoid SUID permission issues
// Also disable /dev/shm usage to avoid shared memory permission errors
// Disable GPU acceleration to prevent GLib-GObject crashes
if (process.platform === "linux") {
    app.commandLine.appendSwitch("no-sandbox");
    app.commandLine.appendSwitch("disable-dev-shm-usage");
    app.commandLine.appendSwitch("disable-gpu");
    app.commandLine.appendSwitch("disable-software-rasterizer");
    app.commandLine.appendSwitch("disable-gpu-compositing");
}

let mainWindow;
let isUploading = {};
let keyObj = {};
let currentToken = "";
let currentBaseUrl = "";

function createWindow() {
    // Determine the icon path based on platform
    let iconPath;
    if (process.platform === "win32") {
        iconPath = path.join(__dirname, "build", "icon.ico");
    } else if (process.platform === "darwin") {
        iconPath = path.join(__dirname, "build", "icon.icns");
    } else {
        iconPath = path.join(__dirname, "build", "icon.png");
    }

    // Fallback to root directory icons if build directory icons don't exist
    if (!fs.existsSync(iconPath)) {
        if (process.platform === "win32") {
            iconPath = path.join(__dirname, "icon.ico");
        } else if (process.platform === "darwin") {
            iconPath = path.join(__dirname, "icon.icns");
        } else {
            iconPath = path.join(__dirname, "icon.png");
        }
    }

    // Create the browser window
    mainWindow = new BrowserWindow({
        minWidth: 800,
        minHeight: 600,
        width: 1200,
        height: 800,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: isDev,
        },
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
        mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
    }

    // Handle close event - check for active uploads
    mainWindow.on("close", async (event) => {
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
                type: "warning",
                buttons: ["Cancel", "Okay"],
                defaultId: 0,
                title: "Warning",
                message: "It looks like you have been uploading something?",
                detail: "If you leave before complete, your upload will be stopped.",
            });

            if (result === 0) {
                event.preventDefault();
            } else {
                // Notify renderer to clear the upload queue
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send("clearUploadQueue");
                }

                // Cancel all uploads before closing
                if (currentBaseUrl && currentToken) {
                    try {
                        const axios = require("axios");
                        await axios.post(
                            `${currentBaseUrl}/api/file-upload/cancel-all`,
                            {
                                ids: Object.keys(isUploading),
                                keyObj,
                            },
                            {
                                headers: { "api-key": currentToken },
                            }
                        );
                    } catch (error) {
                        console.error("Error cancelling uploads:", error.message);
                    }
                }
                isUploading = {};
                keyObj = {};
            }
        }
    });

    // Emitted when the window is closed
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

// Register IPC handlers before app is ready to ensure they're available
// This prevents "No handler registered" errors during initialization
function registerIpcHandlers() {
    // Get app version
    ipcMain.handle("getAppVersion", () => {
        return app.getVersion();
    });

    // Get system information
    ipcMain.handle("getSystemInfo", () => {
        const os = require("os");
        return {
            os: os.type(), // 'Windows_NT', 'Darwin', 'Linux'
            osVersion: os.release(), // OS version
            platform: process.platform, // 'win32', 'darwin', 'linux'
            arch: os.arch(), // 'x64', 'ia32', 'arm64', etc.
        };
    });
}

// Register handlers immediately (before app.whenReady)
// Handlers registered at module level persist throughout the app lifecycle
registerIpcHandlers();

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        // On macOS, re-create a window when the dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
    // On macOS, keep the app running even when all windows are closed
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err.message);
});

// ==================== IPC Handlers ====================

// Show desktop notification
ipcMain.handle("showNotification", async (event, { title, body }) => {
    new Notification({ title, body }).show();
});

// Show error dialog box
ipcMain.handle("showErrorBox", async (event, { title, message }) => {
    dialog.showErrorBox(title, message);
});

// Show info dialog box
ipcMain.handle("showInfoBox", async (event, { message, type, buttons }) => {
    return dialog.showMessageBox(mainWindow, {
        message,
        type: type || "info",
        buttons: buttons || ["OK"],
    });
});

// Show close confirmation dialog
ipcMain.handle("showCloseConfirmBox", async () => {
    // Check if there are active uploads before showing the dialog
    let hasActiveUploads = false;

    if (isUploading && Object.keys(isUploading).length > 0) {
        for (const val of Object.values(isUploading)) {
            if (!val) {
                hasActiveUploads = true;
                break;
            }
        }
    }

    // Only show dialog if there are active uploads
    if (!hasActiveUploads) {
        // No active uploads, return "Okay" (1) to allow proceeding
        return 1;
    }

    const result = dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["Cancel", "Okay"],
        defaultId: 0,
        title: "Warning",
        message: "It looks like you have been uploading something?",
        detail: "If you leave before complete, your upload will be stopped.",
    });
    return result;
});

// Show file name change confirmation
ipcMain.handle("showFileNameChangeConformation", async (event, message) => {
    return new Promise((resolve, reject) => {
        try {
            const result = dialog.showMessageBoxSync(mainWindow, {
                type: "warning",
                buttons: ["Cancel", "Okay"],
                defaultId: 0,
                title: "Warning",
                message: "Selected sample ID is not matching with file name?",
                detail: message,
            });
            resolve(result === 1);
        } catch (error) {
            reject(error);
        }
    });
});

// Track upload status
ipcMain.handle("closeActionCheck", async (event, { data }) => {
    isUploading = data;
});

// Update key object for uploads
ipcMain.handle("KeyObjUpdate", async (event, { data }) => {
    keyObj = data;
});

// Store login details for cancel-all on close
ipcMain.handle("keepLoginDetails", (event, { apiKey, baseUrl }) => {
    currentToken = apiKey;
    currentBaseUrl = baseUrl;
});

// Note: IPC handlers for getAppVersion and getSystemInfo are now registered
// in registerIpcHandlers() function above to ensure they're available early

// ==================== Secure Storage ====================

// Check if encryption is available
ipcMain.handle("isEncryptionAvailable", () => {
    return safeStorage.isEncryptionAvailable();
});

// Store a value securely (encrypted)
ipcMain.handle("secureStore", (event, { key, value }) => {
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(value);
            const credentials = readSecureCredentials();
            credentials[key] = encrypted.toString("base64");
            writeSecureCredentials(credentials);
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error storing secure value:", error.message);
        return false;
    }
});

// Retrieve a securely stored value
ipcMain.handle("secureRetrieve", (event, { key }) => {
    try {
        if (safeStorage.isEncryptionAvailable()) {
            const credentials = readSecureCredentials();
            if (credentials[key]) {
                const encrypted = Buffer.from(credentials[key], "base64");
                return safeStorage.decryptString(encrypted);
            }
        }
        return null;
    } catch (error) {
        console.error("Error retrieving secure value:", error.message);
        return null;
    }
});

// Delete a securely stored value
ipcMain.handle("secureDelete", (event, { key }) => {
    try {
        const credentials = readSecureCredentials();
        if (credentials[key]) {
            delete credentials[key];
            writeSecureCredentials(credentials);
        }
        return true;
    } catch (error) {
        console.error("Error deleting secure value:", error.message);
        return false;
    }
});

// ==================== File System Access ====================

// Read file from local path (for resume upload functionality)
// WARNING: This method loads the ENTIRE file into memory - only use for small files (<100MB)
// For large files, use readFileChunk instead
ipcMain.handle("readLocalFile", async (event, { filePath }) => {
    try {
        if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            return { success: true, data: buffer.toString("base64") };
        }
        return { success: false, error: "File not found" };
    } catch (error) {
        console.error("Error reading local file:", error.message);
        return { success: false, error: error.message };
    }
});

// Read a specific chunk from a file (for large file resume uploads)
// This is memory-efficient as it only reads the requested portion
ipcMain.handle("readFileChunk", async (event, { filePath, offset, length }) => {
    let fileHandle = null;
    try {
        if (!fs.existsSync(filePath)) {
            return { success: false, error: "File not found" };
        }

        // Use async file operations for better performance
        const fsPromises = require("fs").promises;
        fileHandle = await fsPromises.open(filePath, "r");
        
        // Allocate buffer for the chunk
        const buffer = Buffer.alloc(length);
        
        // Read the specific chunk from the file
        const { bytesRead } = await fileHandle.read(buffer, 0, length, offset);
        
        // Close the file handle
        await fileHandle.close();
        fileHandle = null;
        
        // Return only the bytes that were actually read (important for last chunk)
        const actualData = bytesRead < length ? buffer.slice(0, bytesRead) : buffer;
        
        return { 
            success: true, 
            data: actualData.toString("base64"),
            bytesRead: bytesRead
        };
    } catch (error) {
        console.error("Error reading file chunk:", error.message);
        // Ensure file handle is closed on error
        if (fileHandle) {
            try {
                await fileHandle.close();
            } catch (closeError) {
                console.error("Error closing file handle:", closeError.message);
            }
        }
        return { success: false, error: error.message };
    }
});

// Get file stats (for resume upload)
ipcMain.handle("getFileStats", async (event, { filePath }) => {
    try {
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            return { success: true, size: stats.size, exists: true };
        }
        return { success: false, exists: false };
    } catch (error) {
        console.error("Error getting file stats:", error.message);
        return { success: false, error: error.message };
    }
});

// ==================== Encrypted Logging ====================

// Get log directory path
const getLogDirectory = () => {
    return path.join(app.getPath("userData"), "logs");
};

// Ensure log directory exists
const ensureLogDirectory = () => {
    const logDir = getLogDirectory();
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    return logDir;
};

// Generate encryption key (derived from app data path + app name)
const getEncryptionKey = () => {
    const keyMaterial = app.getPath("userData") + app.getName();
    return crypto.createHash("sha256").update(keyMaterial).digest();
};

// Encrypt log entry
const encryptLogEntry = (entry) => {
    try {
        const key = getEncryptionKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        
        const entryJson = JSON.stringify(entry);
        let encrypted = cipher.update(entryJson, "utf8", "hex");
        encrypted += cipher.final("hex");
        
        const authTag = cipher.getAuthTag();
        
        return {
            iv: iv.toString("hex"),
            encrypted: encrypted,
            authTag: authTag.toString("hex"),
        };
    } catch (error) {
        console.error("Error encrypting log entry:", error);
        throw error;
    }
};

// Get current log file path (daily rotation)
const getCurrentLogFilePath = () => {
    const logDir = ensureLogDirectory();
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return path.join(logDir, `app-${date}.log.enc`);
};

// Write encrypted log entries to file
ipcMain.handle("writeEncryptedLog", async (event, { entries }) => {
    try {
        if (!Array.isArray(entries) || entries.length === 0) {
            return { success: true };
        }

        const logFilePath = getCurrentLogFilePath();
        const encryptedEntries = entries.map(encryptLogEntry);
        const logLine = JSON.stringify(encryptedEntries) + "\n";

        // Append to log file
        fs.appendFileSync(logFilePath, logLine, "utf8");

        // Check file size and rotate if needed
        const stats = fs.statSync(logFilePath);
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (stats.size > maxSize) {
            // Archive current file
            const archivePath = logFilePath.replace(".log.enc", `-${Date.now()}.log.enc`);
            fs.renameSync(logFilePath, archivePath);
        }

        // Cleanup old log files (keep last 30 days)
        cleanupOldLogFiles();

        return { success: true };
    } catch (error) {
        console.error("Error writing encrypted log:", error);
        return { success: false, error: error.message };
    }
});

// Cleanup old log files
const cleanupOldLogFiles = () => {
    try {
        const logDir = ensureLogDirectory();
        const files = fs.readdirSync(logDir);
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        const now = Date.now();

        files.forEach((file) => {
            if (file.endsWith(".log.enc")) {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                if (age > maxAge) {
                    fs.unlinkSync(filePath);
                }
            }
        });
    } catch (error) {
        console.error("Error cleaning up old log files:", error);
    }
};

// Read and decrypt log file (for debugging/admin purposes)
ipcMain.handle("readEncryptedLog", async (event, { date }) => {
    try {
        const logDir = ensureLogDirectory();
        const logFilePath = path.join(logDir, `app-${date || new Date().toISOString().split("T")[0]}.log.enc`);

        if (!fs.existsSync(logFilePath)) {
            return { success: false, error: "Log file not found" };
        }

        const key = getEncryptionKey();
        const fileContent = fs.readFileSync(logFilePath, "utf8");
        const lines = fileContent.trim().split("\n");
        const decryptedEntries = [];

        for (const line of lines) {
            if (!line.trim()) continue;

            try {
                const encryptedEntries = JSON.parse(line);
                for (const encryptedEntry of encryptedEntries) {
                    const iv = Buffer.from(encryptedEntry.iv, "hex");
                    const authTag = Buffer.from(encryptedEntry.authTag, "hex");
                    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
                    decipher.setAuthTag(authTag);

                    let decrypted = decipher.update(encryptedEntry.encrypted, "hex", "utf8");
                    decrypted += decipher.final("utf8");

                    decryptedEntries.push(JSON.parse(decrypted));
                }
            } catch (parseError) {
                console.error("Error decrypting log entry:", parseError);
            }
        }

        return { success: true, entries: decryptedEntries };
    } catch (error) {
        console.error("Error reading encrypted log:", error);
        return { success: false, error: error.message };
    }
});

// Get log file list
ipcMain.handle("getLogFiles", async () => {
    try {
        const logDir = ensureLogDirectory();
        const files = fs.readdirSync(logDir)
            .filter((file) => file.endsWith(".log.enc"))
            .map((file) => {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                };
            })
            .sort((a, b) => b.modified.localeCompare(a.modified));

        return { success: true, files };
    } catch (error) {
        console.error("Error getting log files:", error);
        return { success: false, error: error.message };
    }
});
