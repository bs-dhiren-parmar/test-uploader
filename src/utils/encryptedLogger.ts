/**
 * Encrypted Logger Utility
 * 
 * Provides encrypted logging functionality for the Electron app.
 * Logs are encrypted using AES-256-GCM and stored in the app's userData directory.
 * 
 * Features:
 * - Encrypted log files (AES-256-GCM)
 * - Log rotation (daily files, max size, max files)
 * - Multiple log levels (error, warn, info, debug)
 * - Contextual information (timestamp, user, session)
 * - Automatic error serialization
 */

export enum LogLevel {
    ERROR = "error",
    WARN = "warn",
    INFO = "info",
    DEBUG = "debug",
}

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
        details?: Record<string, unknown>;
    };
    user?: {
        userId?: string;
        orgId?: string;
        email?: string;
    };
    session?: {
        sessionId: string;
    };
    source?: {
        fileName?: string;
        lineNumber?: number;
        columnNumber?: number;
    };
    system?: {
        os?: string;
        osVersion?: string;
        platform?: string;
        arch?: string;
    };
}

interface LoggerConfig {
    maxFileSize?: number; // in bytes, default 10MB
    maxFiles?: number; // default 30 days
    enableConsole?: boolean; // also log to console, default true in dev
}

class EncryptedLogger {
    private sessionId: string;
    private config: Required<LoggerConfig>;
    private logBuffer: LogEntry[] = [];
    private flushInterval: NodeJS.Timeout | null = null;
    private readonly FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
    private readonly MAX_BUFFER_SIZE = 50; // Max entries before forced flush
    private systemInfo: LogEntry["system"] | null = null;

    constructor(config: LoggerConfig = {}) {
        this.sessionId = this.generateSessionId();
        this.config = {
            maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
            maxFiles: config.maxFiles || 30, // 30 days
            enableConsole: config.enableConsole ?? (process.env.NODE_ENV === "development"),
        };

        // Initialize system info synchronously first (fallback)
        this.systemInfo = this.getSystemInfoFromNavigator();
        
        // Then try to get more accurate info from Electron API asynchronously
        this.initializeSystemInfo().catch((err) => {
            console.error("Error initializing system info:", err);
        });

        // Start periodic flush
        this.startFlushInterval();

        // Flush on app close
        if (typeof window !== "undefined") {
            window.addEventListener("beforeunload", () => {
                this.flush();
            });
        }
    }

    private async initializeSystemInfo(): Promise<void> {
        try {
            // Get OS info from Electron API if available
            if (window.electronAPI?.getSystemInfo) {
                try {
                    this.systemInfo = await window.electronAPI.getSystemInfo();
                } catch (error) {
                    // Fallback to navigator if IPC fails
                    this.systemInfo = this.getSystemInfoFromNavigator();
                }
            } else {
                // Fallback: use navigator info
                this.systemInfo = this.getSystemInfoFromNavigator();
            }
        } catch (error) {
            console.error("Error initializing system info:", error);
            this.systemInfo = {
                os: "unknown",
                osVersion: "unknown",
                platform: "unknown",
                arch: "unknown",
            };
        }
    }

    private getSystemInfoFromNavigator(): LogEntry["system"] {
        const platform = navigator.platform || "unknown";
        const userAgent = navigator.userAgent || "";
        
        let os = "unknown";
        let osVersion = "unknown";
        
        if (userAgent.includes("Windows")) {
            os = "Windows";
            const match = userAgent.match(/Windows NT (\d+\.\d+)/);
            if (match) {
                osVersion = match[1];
            }
        } else if (userAgent.includes("Mac OS X") || userAgent.includes("Macintosh")) {
            os = "macOS";
            const match = userAgent.match(/Mac OS X (\d+[._]\d+[._]\d+)/);
            if (match) {
                osVersion = match[1].replace(/_/g, ".");
            }
        } else if (userAgent.includes("Linux")) {
            os = "Linux";
        }
        
        return {
            os,
            osVersion,
            platform,
            arch: userAgent.includes("x64") || userAgent.includes("x86_64") ? "x64" : 
                  userAgent.includes("arm64") || userAgent.includes("aarch64") ? "arm64" : "unknown",
        };
    }

    private generateSessionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private getCurrentUser(): LogEntry["user"] {
        try {
            const userId = localStorage.getItem("user_id");
            const orgId = localStorage.getItem("org_id");
            const email = localStorage.getItem("user_email");
            return {
                userId: userId || undefined,
                orgId: orgId || undefined,
                email: email || undefined,
            };
        } catch {
            return undefined;
        }
    }

    private extractSourceInfo(error?: Error, skipFrames: number = 0): LogEntry["source"] {
        try {
            // Create a stack trace to get caller information
            const stack = error?.stack || new Error().stack;
            if (!stack) {
                return undefined;
            }

            // Parse stack trace to extract file name and line number
            // Stack format: "at functionName (file:///path/to/file.ts:123:45)"
            // or "at file:///path/to/file.ts:123:45"
            const stackLines = stack.split("\n");
            
            // Skip the first line (error message) and logger internal calls
            // Look for the first frame that's not from the logger itself
            let skippedLoggerFrames = 0;
            for (let i = 1; i < stackLines.length; i++) {
                const line = stackLines[i].trim();
                
                // Skip logger internal calls
                if (line.includes("encryptedLogger.ts") || 
                    line.includes("logger.error") || 
                    line.includes("logger.warn") || 
                    line.includes("logger.info") || 
                    line.includes("logger.debug") ||
                    line.includes("writeLog") ||
                    line.includes("createLogEntry")) {
                    skippedLoggerFrames++;
                    continue;
                }

                // After skipping logger frames, skip additional frames if requested
                if (skippedLoggerFrames <= skipFrames) {
                    continue;
                }

                // Match patterns like:
                // "at functionName (file:///path/to/file.ts:123:45)"
                // "at file:///path/to/file.ts:123:45"
                // "at http://localhost:3000/src/file.ts:123:45"
                // "at Object.functionName (file:///path/to/file.ts:123:45)"
                const patterns = [
                    /at\s+(?:.*\s+)?\(?(?:file:\/\/\/|http:\/\/|https:\/\/|)(?:.*\/)?([^\/:]+\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\)?/,
                    /at\s+(?:.*\s+)?(?:file:\/\/\/|http:\/\/|https:\/\/|)(?:.*\/)?([^\/:]+\.(?:ts|tsx|js|jsx)):(\d+):(\d+)/,
                ];
                
                for (const pattern of patterns) {
                    const match = line.match(pattern);
                    if (match) {
                        const fileName = match[1];
                        const lineNumber = parseInt(match[2], 10);
                        const columnNumber = parseInt(match[3], 10);
                        
                        if (fileName && !isNaN(lineNumber)) {
                            return {
                                fileName,
                                lineNumber,
                                columnNumber: !isNaN(columnNumber) ? columnNumber : undefined,
                            };
                        }
                    }
                }
            }
        } catch (err) {
            // Silently fail if stack parsing fails
        }
        
        return undefined;
    }

    private createLogEntry(
        level: LogLevel,
        message: string,
        context?: Record<string, unknown>,
        error?: Error
    ): LogEntry {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context,
            user: this.getCurrentUser(),
            session: {
                sessionId: this.sessionId,
            },
            system: this.systemInfo || undefined,
            source: this.extractSourceInfo(error),
        };

        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                details: this.extractErrorDetails(error),
            };
            
            // If source info wasn't extracted from error, try to extract from stack
            if (!entry.source && error.stack) {
                entry.source = this.extractSourceInfo(error);
            }
        }

        return entry;
    }

    private extractErrorDetails(error: Error): Record<string, unknown> {
        const details: Record<string, unknown> = {};
        
        // Extract additional properties from error object
        Object.keys(error).forEach((key) => {
            if (key !== "name" && key !== "message" && key !== "stack") {
                try {
                    details[key] = (error as Record<string, unknown>)[key];
                } catch {
                    // Ignore circular references
                }
            }
        });

        // Extract axios error details if present
        if ((error as any).response) {
            details.response = {
                status: (error as any).response?.status,
                statusText: (error as any).response?.statusText,
                data: (error as any).response?.data,
            };
        }

        if ((error as any).request) {
            details.request = {
                url: (error as any).config?.url,
                method: (error as any).config?.method,
            };
        }

        return details;
    }

    private formatLogEntry(entry: LogEntry): string {
        // Format for console output (unencrypted)
        const parts = [
            `[${entry.timestamp}]`,
            `[${entry.level.toUpperCase()}]`,
            entry.message,
        ];

        // Add source info if available
        if (entry.source) {
            parts.push(`[${entry.source.fileName}:${entry.source.lineNumber}${entry.source.columnNumber ? `:${entry.source.columnNumber}` : ""}]`);
        }

        // Add system info if available
        if (entry.system) {
            parts.push(`[OS: ${entry.system.os} ${entry.system.osVersion || ""} ${entry.system.platform} ${entry.system.arch}]`.trim());
        }

        if (entry.context && Object.keys(entry.context).length > 0) {
            parts.push(`Context: ${JSON.stringify(entry.context)}`);
        }

        if (entry.error) {
            parts.push(`Error: ${entry.error.name} - ${entry.error.message}`);
            if (entry.error.stack) {
                parts.push(`Stack: ${entry.error.stack}`);
            }
        }

        return parts.join(" ");
    }

    private async writeLog(entry: LogEntry): Promise<void> {
        // Add to buffer
        this.logBuffer.push(entry);

        // Console output (if enabled)
        if (this.config.enableConsole) {
            const formatted = this.formatLogEntry(entry);
            switch (entry.level) {
                case LogLevel.ERROR:
                    console.error(formatted);
                    break;
                case LogLevel.WARN:
                    console.warn(formatted);
                    break;
                case LogLevel.INFO:
                    console.info(formatted);
                    break;
                case LogLevel.DEBUG:
                    console.debug(formatted);
                    break;
            }
        }

        // Flush if buffer is full
        if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
            await this.flush();
        }
    }

    private startFlushInterval(): void {
        if (this.flushInterval) {
            return;
        }

        this.flushInterval = setInterval(() => {
            this.flush().catch((err) => {
                console.error("Error flushing logs:", err);
            });
        }, this.FLUSH_INTERVAL_MS);
    }

    private stopFlushInterval(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
    }

    /**
     * Flush buffered logs to encrypted file
     */
    public async flush(): Promise<void> {
        if (this.logBuffer.length === 0) {
            return;
        }

        const entries = [...this.logBuffer];
        this.logBuffer = [];

        try {
            if (window.electronAPI?.writeEncryptedLog) {
                await window.electronAPI.writeEncryptedLog(entries);
            } else {
                // Fallback: log to console if Electron API not available
                console.warn("Electron API not available, logging to console only");
                entries.forEach((entry) => {
                    console.log(this.formatLogEntry(entry));
                });
            }
        } catch (error) {
            console.error("Error writing encrypted log:", error);
            // Re-add entries to buffer for retry
            this.logBuffer.unshift(...entries);
        }
    }

    /**
     * Log an error
     */
    public error(message: string, error?: Error, context?: Record<string, unknown>): void {
        const entry = this.createLogEntry(LogLevel.ERROR, message, context, error);
        // If no error provided, still try to extract source from stack
        if (!error && !entry.source) {
            entry.source = this.extractSourceInfo(undefined, 0);
        }
        this.writeLog(entry);
    }

    /**
     * Log a warning
     */
    public warn(message: string, context?: Record<string, unknown>): void {
        const entry = this.createLogEntry(LogLevel.WARN, message, context);
        // Extract source info from stack trace
        if (!entry.source) {
            entry.source = this.extractSourceInfo(undefined, 0);
        }
        this.writeLog(entry);
    }

    /**
     * Log an info message
     */
    public info(message: string, context?: Record<string, unknown>): void {
        const entry = this.createLogEntry(LogLevel.INFO, message, context);
        // Extract source info from stack trace
        if (!entry.source) {
            entry.source = this.extractSourceInfo(undefined, 0);
        }
        this.writeLog(entry);
    }

    /**
     * Log a debug message
     */
    public debug(message: string, context?: Record<string, unknown>): void {
        const entry = this.createLogEntry(LogLevel.DEBUG, message, context);
        // Extract source info from stack trace
        if (!entry.source) {
            entry.source = this.extractSourceInfo(undefined, 0);
        }
        this.writeLog(entry);
    }

    /**
     * Cleanup: flush remaining logs and stop interval
     */
    public async cleanup(): Promise<void> {
        this.stopFlushInterval();
        await this.flush();
    }
}

// Singleton instance
let loggerInstance: EncryptedLogger | null = null;

/**
 * Get the logger instance (singleton)
 */
export const getLogger = (config?: LoggerConfig): EncryptedLogger => {
    if (!loggerInstance) {
        loggerInstance = new EncryptedLogger(config);
    }
    return loggerInstance;
};

/**
 * Initialize logger with custom config
 */
export const initLogger = (config?: LoggerConfig): EncryptedLogger => {
    if (loggerInstance) {
        loggerInstance.cleanup();
    }
    loggerInstance = new EncryptedLogger(config);
    return loggerInstance;
};

/**
 * Cleanup logger (call on app shutdown)
 */
export const cleanupLogger = async (): Promise<void> => {
    if (loggerInstance) {
        await loggerInstance.cleanup();
        loggerInstance = null;
    }
};

// Export default logger instance
export const logger = getLogger();

