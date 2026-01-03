import { FILE_TYPE, MONTHS } from "./constants";
import type { Patient } from "../types";

/**
 * Validate email format
 */
export const validateEmail = (email: string): RegExpMatchArray | null => {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

/**
 * Validate URL format
 */
export const validateUrl = (url: string): boolean => {
    const urlRegex = new RegExp("https?://(?:w{1,3}.)?[a-zA-Z0-9.-]+(?:.[a-z]+)*(?::d+)?(?![^<]*(?:</w+>))", "gm");
    const ipUrlRegex = new RegExp("^((https?://)|(www.))(?:([a-zA-Z]+)|(\\d+\\.\\d+\\.\\d+\\.\\d+)):\\d{4}$", "gm");
    return urlRegex.test(url) || ipUrlRegex.test(url);
};

/**
 * Validate sample ID format (alphanumeric, hyphens, underscores only)
 */
export const validateSampleId = (sampleId: string): boolean => {
    const sampleIdRegex = /^[a-zA-Z0-9_-]+$/;
    return sampleIdRegex.test(sampleId);
};

/**
 * Get two-digit format for numbers
 */
const getTwoDigitFormat = (num: number): string => {
    return num > 9 ? String(num) : "0" + num;
};

/**
 * Format date object to string
 */
export const formatDateTime = (dateObj: Date | null): string | null => {
    if (!dateObj) return null;

    const date = getTwoDigitFormat(dateObj.getDate());
    const hour = getTwoDigitFormat(dateObj.getHours());
    const minutes = getTwoDigitFormat(dateObj.getMinutes());
    const seconds = getTwoDigitFormat(dateObj.getSeconds());

    return `${date}-${MONTHS[dateObj.getMonth()]}-${dateObj.getFullYear()} ${hour}:${minutes}:${seconds}`;
};

/**
 * Get local date time from ISO string
 */
export const getLocalDateTime = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    const dateObj = new Date(dateString);
    return formatDateTime(dateObj) || "";
};

/**
 * Get current date time for file naming
 */
export const getCurrentDateTime = (): string => {
    const dateObj = new Date();
    const date = ("0" + dateObj.getDate()).slice(-2);
    const month = ("0" + (dateObj.getMonth() + 1)).slice(-2);
    const year = ("0" + dateObj.getFullYear()).slice(-2);
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();

    return `${month}${date}${year}_${hours}${minutes}${seconds}`;
};

/**
 * Check file extension and return file type
 */
export const checkFileExtension = (fileName: string): string => {
    const fileNames = fileName.split(".");
    const fileNamesLen = fileNames.length;
    const lastExt = fileNames[fileNamesLen - 1];
    const prevExt = fileNames[fileNamesLen - 2];

    const fileTypes: (keyof typeof FILE_TYPE)[] = ["fastq", "uncompressed_fastq", "bam", "bai", "vcf"];

    for (const fileExt of fileTypes) {
        if (FILE_TYPE[fileExt].includes(`.${lastExt}`)) {
            return fileExt;
        }
        if (prevExt && FILE_TYPE[fileExt].includes(`.${prevExt}.${lastExt}`)) {
            return fileExt;
        }
    }

    return "";
};

/**
 * Convert object to query string
 */
export const objectToQueryString = (obj: Record<string, unknown>): string => {
    return Object.keys(obj)
        .map((key) => {
            if (typeof obj[key] === "object") {
                return `${key}=${JSON.stringify(obj[key])}`;
            }
            return `${key}=${obj[key]}`;
        })
        .join("&");
};

/**
 * Get file chunk at specific index
 */
export const getCurrentChunk = (file: File, chunkIndex: number, chunkSize: number): Blob => {
    const offset = chunkIndex * chunkSize;
    return file.slice(offset, offset + chunkSize);
};

/**
 * Calculate number of chunks for a file
 */
export const getChunkCount = (fileSize: number, chunkSize: number): number => {
    return Math.ceil(fileSize / chunkSize);
};

/**
 * Format file size to human readable
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Check if file name contains spaces
 */
export const hasSpaces = (fileName: string): boolean => {
    return fileName.includes(" ");
};

/**
 * Sanitize file name by replacing special characters (except - _ .) with underscore
 * Spaces and any character that is not alphanumeric, dot, hyphen, or underscore will be replaced
 */
export const sanitizeFileName = (fileName: string): string => {
    // Split into name and extension parts to preserve extension
    const lastDotIndex = fileName.lastIndexOf(".");
    
    if (lastDotIndex === -1) {
        // No extension, sanitize entire name
        return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    }
    
    // Handle compound extensions like .fastq.gz, .vcf.gz, .bam.bai
    const compoundExtensions = [".fastq.gz", ".fq.gz", ".vcf.gz", ".vcf.idx", ".bam.bai"];
    let baseName = fileName;
    let extension = "";
    
    for (const ext of compoundExtensions) {
        if (fileName.toLowerCase().endsWith(ext)) {
            baseName = fileName.slice(0, -ext.length);
            extension = fileName.slice(-ext.length);
            break;
        }
    }
    
    // If no compound extension found, use simple extension
    if (!extension) {
        baseName = fileName.slice(0, lastDotIndex);
        extension = fileName.slice(lastDotIndex);
    }
    
    // Sanitize base name only (replace spaces and special chars with underscore)
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_");
    
    return sanitizedBaseName + extension;
};

/**
 * Get patient display name
 */
export const getPatientDisplayName = (patient: Patient): string => {
    let name = "";
    if (patient.first_name) name = patient.first_name;
    if (patient.last_name) name += ` ${patient.last_name}`;
    return `${name.trim()} - [${patient.mrn}]`;
};

/**
 * Download a file from URL without opening a white window
 * Uses a hidden anchor element to trigger download
 */
export const downloadFile = (url: string, filename?: string): void => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || '';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Clean up after a short delay
    setTimeout(() => {
        document.body.removeChild(link);
    }, 100);
};
