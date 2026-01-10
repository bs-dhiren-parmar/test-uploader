interface FileReadResult {
    success: boolean;
    data?: string;
    error?: string;
}

interface FileChunkReadResult {
    success: boolean;
    data?: string;  // Base64 encoded chunk data
    bytesRead?: number;  // Actual bytes read (may be less than requested for last chunk)
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
    /**
     * Read a specific chunk from a file (memory-efficient for large files)
     * @param filePath - Path to the file
     * @param offset - Byte offset to start reading from
     * @param length - Number of bytes to read
     * @returns Base64 encoded chunk data
     */
    readFileChunk: (filePath: string, offset: number, length: number) => Promise<FileChunkReadResult>;
    getFileStats: (filePath: string) => Promise<FileStatsResult>;

    // Encrypted Logging
    writeEncryptedLog: (entries: Array<Record<string, unknown>>) => Promise<{ success: boolean; error?: string }>;
    readEncryptedLog: (options: { date?: string }) => Promise<{ success: boolean; entries?: Array<Record<string, unknown>>; error?: string }>;
    getLogFiles: () => Promise<{ success: boolean; files?: Array<{ name: string; size: number; modified: string }>; error?: string }>;

    // Event Listeners
    onClearUploadQueue: (callback: () => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export {};
