interface FileReadResult {
    success: boolean;
    data?: string;
    error?: string;
}

interface FileStatsResult {
    success: boolean;
    size?: number;
    exists?: boolean;
    error?: string;
}

interface ElectronAPI {
    // System Info
    getVersions: () => { node: string; chrome: string; electron: string };
    getAppVersion: () => Promise<string>;

    // Dialogs & Notifications
    showNotification: (title: string, body: string) => Promise<void>;
    showErrorBox: (title: string, message: string) => Promise<void>;
    showInfoBox: (message: string, type?: string, buttons?: string[]) => Promise<void>;
    showCloseConfirmBox: () => Promise<number>;
    showFileNameChangeConformation: (message: string) => Promise<boolean>;

    // Upload Tracking
    closeActionCheck: (data: Record<string, boolean>) => Promise<void>;
    keyObjUpdate: (data: Record<string, unknown>) => Promise<void>;
    keepLoginDetails: (apiKey: string, baseUrl: string) => Promise<void>;

    // Secure Storage
    isEncryptionAvailable: () => Promise<boolean>;
    secureStore: (key: string, value: string) => Promise<boolean>;
    secureRetrieve: (key: string) => Promise<string | null>;
    secureDelete: (key: string) => Promise<boolean>;

    // File System Access
    readLocalFile: (filePath: string) => Promise<FileReadResult>;
    getFileStats: (filePath: string) => Promise<FileStatsResult>;

    // Event Listeners
    onClearUploadQueue: (callback: () => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export {};
