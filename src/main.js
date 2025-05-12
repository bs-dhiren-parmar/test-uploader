const {app, BrowserWindow, ipcMain, Notification, dialog} = require("electron");
const path = require("path");
const {cancelAllFileUpload} = require("./utils/apiServerics");
let isUploading = {},
    keyObj = {},
    currentToken,
    currnetBaseurl;
const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            nativeWindowOpen: true,
            devTools: true,
        },
    });
    mainWindow.maximize();
    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, "index.html"));
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
    mainWindow.on("close", async (event) => {
        let isRereshAllowed = true;
        if (isUploading) {
            for (const val of Object.values(isUploading)) {
                if (!val) {
                    isRereshAllowed = false;
                    break;
                }
            }
        }
        if (!isRereshAllowed) {
            let isRefresh = dialog.showMessageBoxSync(null, {
                type: "warning",
                buttons: ["Cancel", "Okay"],
                defaultId: 3,
                title: "Warning",
                message: "It looks like you have been uploading something?",
                detail: "If you leave before complete, your upload will be stop.",
            });
            if (isRefresh === 0) {
                event.preventDefault(); // If you prevent default behavior in Mozilla
                event.returnValue = "";
            } else {
                await cancelAllFileUpload(currnetBaseurl, currentToken, Object.keys(isUploading), keyObj).catch((error) => {
                    console.error("%c 🍐 error", "color:#42b983", error);
                });
                isUploading = {};
                keyObj = {};
                return "";
            }
        }
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.commandLine.appendSwitch('js-flags', '--max-old-space-size=1800000000')
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

process.on("uncaughtException", function (err) {
    console.error(err.message);
});
app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

ipcMain.handle("showNotificaction", async (event, {title, body}) => {
    new Notification({title, body}).show();
});

ipcMain.handle("showErrorBox", async (event, {title, message}) => {
    dialog.showErrorBox(title, message);
});

ipcMain.handle("showInfoBox", async (event, {message, type, buttons}) => {
    dialog.showMessageBox({
        message,
        type,
        buttons,
    });
});

ipcMain.handle("showCloseConfirmBox", async () => {
    let isRefresh = dialog.showMessageBoxSync(null, {
        type: "warning",
        buttons: ["Cancel", "Okay"],
        defaultId: 3,
        title: "Warning",
        message: "It looks like you have been uploading something?",
        detail: "If you leave before complete, your upload will be stop.",
    });
    return isRefresh;
});
ipcMain.handle("showFileNameChangeConformation", async (event, message) => {
    return new Promise((resolve, reject) =>{
        try {
            let isRefresh = dialog.showMessageBoxSync(null, {
                type: "warning",
                buttons: ["Cancel", "Okay"],
                defaultId: 3,
                title: "Warning",
                message: "selected sample Id is not matching with file name?",
                detail: message,
            });
            return resolve(!!isRefresh);
        } catch (error) {
            reject(error)
        }
    })
});

ipcMain.handle("closeActionCheck", async (event, {data}) => {
    isUploading = data;
});

ipcMain.handle("KeyObjUpdate", async (event, {data}) => {
    keyObj = data;
});

ipcMain.handle("keepLoginDetails", (event, {apiKey, baseUrl}) => {
    currentToken = apiKey;
    currnetBaseurl = baseUrl;
});
