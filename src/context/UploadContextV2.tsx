import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import axios, { CancelTokenSource, AxiosError } from "axios";
import { logger } from "../utils/encryptedLogger";
import Queue from "../utils/Queue";
import { CHUNK_SIZE } from "../utils/constants";
import { getCurrentDateTime, getCurrentChunk, getChunkCount } from "../utils/helpers";
import {
    // V2 APIs for file upload management
    createFileUploadV2,
    updateFileUploadV2,
    getStatusListV2,
    retryFileUploadV2,
    bulkDownloadV2,
    bulkDeleteV2,
    cancelFileUploadV2,
    getAssignListV2,
    assignPatientV2,
    bulkAssignPatientV2,
    getAssociationListV2,
    // V1 APIs for S3 multipart operations (still used for actual file transfer)
    initiateMultipartUpload,
    getSignedUrlsForAllPart,
    completeSignedUrl,
    cancelDeleteFileUpload,
    uploadChunk,
} from "../services/fileUploadService";
import type {
    QueueItem,
    KeyObj,
    ResumeUploadInfo,
    StatusListResponse,
    AssignListResponse,
    AssociationListResponse,
    FileUpload,
} from "../types";

// ==================== V2 Types ====================

interface FileToUploadV2 {
    file: File;
    fileName: string;
    originalFileName: string;
    fileType: string;
    patientId?: string;  // Optional in V2 - can be assigned later
    visitId?: string;
    sampleId?: string;
}

interface PatientAssignData {
    patient_id: string;
    visit_id?: string;
    sample_id?: string;
}

interface UploadContextV2Value {
    // Core upload functions
    addFilesToQueue: (filesData: FileToUploadV2[]) => Promise<void>;
    resumeUpload: (fileInfo: ResumeUploadInfo) => Promise<void>;
    cancelUpload: (fileUploadId: string, status: string) => Promise<void>;
    
    // Status state
    isUploading: Record<string, boolean>;
    isCancelAvailable: Record<string, boolean>;
    isUploadInProgress: boolean;
    
    // Upload progress callbacks
    onPartUploaded: (callback: () => void) => () => void; // Register callback, returns unsubscribe function
    
    // V2 Status Tab functions
    getStatusList: (params?: { search?: string; file_type?: string; status?: string; limit?: number; skip?: number }) => Promise<StatusListResponse>;
    retryUpload: (fileId: string) => Promise<FileUpload>;
    bulkDownload: (fileIds: string[]) => Promise<Array<{ _id: string; file_name: string; download_url?: string; error?: string }>>;
    bulkDelete: (fileIds: string[]) => Promise<{ deleted_count: number }>;
    
    // V2 Assign Tab functions
    getAssignList: (params?: { search?: string; file_type?: string; limit?: number; skip?: number }) => Promise<AssignListResponse>;
    assignPatient: (fileId: string, data: PatientAssignData) => Promise<FileUpload>;
    bulkAssignPatient: (fileIds: string[], data: PatientAssignData) => Promise<{ assigned_count: number; patient_id: string; visit_id: string; sample_id: string }>;
    
    // V2 Association Tab functions
    getAssociationList: (params: Record<string, unknown>) => Promise<AssociationListResponse>;
}

interface UploadProviderV2Props {
    children: ReactNode;
}

const UploadContextV2 = createContext<UploadContextV2Value | null>(null);

/**
 * UploadProviderV2 - V2 version of upload context with deferred patient assignment support
 * 
 * Key V2 Features:
 * - Files can be uploaded without patient assignment
 * - Patient can be assigned after upload completion
 * - Bulk operations for download, delete, and patient assignment
 * - Status, Assign, and Association tab API support
 */
export const UploadProviderV2: React.FC<UploadProviderV2Props> = ({ children }) => {
    const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
    const [isCancelAvailable, setIsCancelAvailable] = useState<Record<string, boolean>>({});
    const [keyObj, setKeyObj] = useState<Record<string, KeyObj>>({});
    const [isUploadInProgress, setIsUploadInProgress] = useState<boolean>(false);

    const fileUploadQueue = useRef<Queue<QueueItem>>(new Queue<QueueItem>());
    const cancelTokenSource = useRef<CancelTokenSource | null>(null);
    const cancelTokensRef = useRef<Record<string, CancelTokenSource>>({});

    // Use refs to avoid stale closure issues in async callbacks
    const isCancelAvailableRef = useRef<Record<string, boolean>>({});
    const keyObjRef = useRef<Record<string, KeyObj>>({});
    const isUploadInProgressRef = useRef<boolean>(false);
    
    // Callbacks for part upload events
    const partUploadCallbacksRef = useRef<Set<() => void>>(new Set());

    // Keep refs in sync with state
    isCancelAvailableRef.current = isCancelAvailable;
    keyObjRef.current = keyObj;
    isUploadInProgressRef.current = isUploadInProgress;

    // ==================== Electron API Helpers ====================

    const updateIsUploading = useCallback((data: Record<string, boolean>): void => {
        window.electronAPI?.closeActionCheck(data);
    }, []);

    const updateKeyObj = useCallback((data: Record<string, unknown>): void => {
        window.electronAPI?.keyObjUpdate(data);
    }, []);

    const showNetworkError = useCallback((): void => {
        window.electronAPI?.showErrorBox("Network Error", "Please connect to network");
    }, []);

    // ==================== Error Handling ====================

    const cancelWithError = useCallback(
        async (errorMessage: string, fileUploadId: string): Promise<void> => {
            try {
                setIsCancelAvailable((prev) => ({ ...prev, [fileUploadId]: false }));
                setIsUploading((prev) => {
                    const updated = { ...prev, [fileUploadId]: true };
                    updateIsUploading(updated);
                    return updated;
                });

                console.error("Upload error:", errorMessage);
                await cancelDeleteFileUpload(fileUploadId, "error", keyObjRef.current[fileUploadId], errorMessage);

                setKeyObj((prev) => {
                    const updated = { ...prev };
                    delete updated[fileUploadId];
                    updateKeyObj(updated);
                    return updated;
                });
            } catch (error) {
                const axiosError = error as AxiosError;
                console.error("Error cancelling upload:", axiosError.message);
            }
        },
        [updateIsUploading, updateKeyObj]
    );

    // ==================== Part Upload ====================

    const handlePartUpload = useCallback(
        async (file: File, partIndex: number, chunkLen: number, key: string, uploadId: string, fileUploadId: string): Promise<boolean> => {
            try {
                // Check if cancelled before starting this part upload
                if (!isCancelAvailableRef.current[fileUploadId]) {
                    console.log(`Upload cancelled for ${fileUploadId}, skipping part ${partIndex + 1}`);
                    return false;
                }

                const prog = parseFloat(String(((partIndex + 1) * 100) / chunkLen)).toFixed(2) + "%";

                const signedUploadResponse = await getSignedUrlsForAllPart(key, uploadId, partIndex + 1);

                if (signedUploadResponse.data?.success && signedUploadResponse.data?.data) {
                    const fileData = getCurrentChunk(file, partIndex, CHUNK_SIZE);
                    console.log("signedUploadResponse", signedUploadResponse);
                    console.log("navigator.onLine: ", navigator.onLine);
                    try {
                        if (navigator.onLine) {
                            // Create cancel token for this specific file upload
                            const cancelToken = axios.CancelToken.source();
                            cancelTokensRef.current[fileUploadId] = cancelToken;
                            cancelTokenSource.current = cancelToken; // Keep for backward compatibility
                            
                            const chunkUploadRes = await uploadChunk(
                                signedUploadResponse.data.data,
                                fileData,
                                file.type || "application/octet-stream",
                                cancelToken.token
                            );
                            console.log("chunkUploadRes", chunkUploadRes);
                            if (navigator.onLine) {
                                const etag = chunkUploadRes?.headers?.etag;
                                
                                if (!etag) {
                                    // ETag not found - likely S3 CORS issue
                                    // S3 bucket CORS must expose "ETag" header for multipart uploads
                                    console.error(
                                        "ETag header not found in S3 response. " +
                                        "Ensure S3 bucket CORS configuration exposes 'ETag' header. " +
                                        "Response headers:", chunkUploadRes?.headers
                                    );
                                    throw new Error("ETag not found in S3 response. Check S3 CORS configuration.");
                                }
                                
                                // Check again if cancelled after upload completes (before saving tags)
                                if (!isCancelAvailableRef.current[fileUploadId]) {
                                    console.log(`Upload cancelled for ${fileUploadId} after part ${partIndex + 1} upload, but saving tags`);
                                    // Still save the tag for the completed part before stopping
                                }
                                
                                // V2: Update file upload progress (save tags even if cancelled, so progress is saved)
                                await updateFileUploadV2(fileUploadId, {
                                    file_progress: prog,
                                    tag: etag.replace(/"/gi, ""),
                                    currentIndex: partIndex + 1,
                                });
                                
                                // Notify all registered callbacks that a part was uploaded
                                partUploadCallbacksRef.current.forEach(callback => {
                                    try {
                                        callback();
                                    } catch (error) {
                                        console.error('Error in part upload callback:', error);
                                    }
                                });
                                
                                // Return false if cancelled (so loop stops), true if still active
                                return isCancelAvailableRef.current[fileUploadId];
                            }
                        } else {
                            showNetworkError();
                            return false;
                        }
                    } catch (error) {
                        const axiosError = error as AxiosError;
                        if (axiosError.code !== "ERR_CANCELED") {
                            throw error;
                        }
                        return false;
                    }
                } else {
                    throw new Error("Error while getting signed URL");
                }
            } catch (error) {
                throw error;
            }
            return false;
        },
        [showNetworkError]
    );

    // ==================== Part Upload From Disk (for large file resume) ====================

    /**
     * Handle part upload by reading chunks directly from disk.
     * This is memory-efficient and works for files of any size.
     * Used for resume uploads instead of loading entire file into memory.
     */
    const handlePartUploadFromDisk = useCallback(
        async (
            filePath: string, 
            fileSize: number,
            fileType: string,
            partIndex: number, 
            chunkLen: number, 
            key: string, 
            uploadId: string, 
            fileUploadId: string
        ): Promise<boolean> => {
            try {
                // Check if cancelled before starting this part upload
                if (!isCancelAvailableRef.current[fileUploadId]) {
                    console.log(`Upload cancelled for ${fileUploadId}, skipping part ${partIndex + 1}`);
                    return false;
                }

                const prog = parseFloat(String(((partIndex + 1) * 100) / chunkLen)).toFixed(2) + "%";

                const signedUploadResponse = await getSignedUrlsForAllPart(key, uploadId, partIndex + 1);

                if (signedUploadResponse.data?.success && signedUploadResponse.data?.data) {
                    // Calculate chunk offset and length
                    const offset = partIndex * CHUNK_SIZE;
                    const remainingBytes = fileSize - offset;
                    const chunkLength = Math.min(CHUNK_SIZE, remainingBytes);

                    console.log(`Reading chunk ${partIndex + 1}/${chunkLen} from disk: offset=${offset}, length=${chunkLength}`);

                    // Read chunk from disk using Electron API (memory-efficient)
                    if (!window.electronAPI?.readFileChunk) {
                        throw new Error("readFileChunk API not available - please restart the application");
                    }

                    const chunkResult = await window.electronAPI.readFileChunk(filePath, offset, chunkLength);
                    
                    if (!chunkResult.success || !chunkResult.data) {
                        throw new Error(chunkResult.error || "Failed to read file chunk from disk");
                    }

                    // Convert base64 chunk to Blob
                    const binaryString = atob(chunkResult.data);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    const fileData = new Blob([bytes]);

                    console.log("signedUploadResponse", signedUploadResponse);
                    console.log("navigator.onLine: ", navigator.onLine);
                    console.log("Chunk size from disk:", fileData.size);

                    try {
                        if (navigator.onLine) {
                            // Create cancel token for this specific file upload
                            const cancelToken = axios.CancelToken.source();
                            cancelTokensRef.current[fileUploadId] = cancelToken;
                            cancelTokenSource.current = cancelToken;
                            
                            const chunkUploadRes = await uploadChunk(
                                signedUploadResponse.data.data,
                                fileData,
                                fileType || "application/octet-stream",
                                cancelToken.token
                            );
                            console.log("chunkUploadRes", chunkUploadRes);

                            if (navigator.onLine) {
                                const etag = chunkUploadRes?.headers?.etag;
                                
                                if (!etag) {
                                    console.error(
                                        "ETag header not found in S3 response. " +
                                        "Ensure S3 bucket CORS configuration exposes 'ETag' header. " +
                                        "Response headers:", chunkUploadRes?.headers
                                    );
                                    throw new Error("ETag not found in S3 response. Check S3 CORS configuration.");
                                }
                                
                                // Check again if cancelled after upload completes
                                if (!isCancelAvailableRef.current[fileUploadId]) {
                                    console.log(`Upload cancelled for ${fileUploadId} after part ${partIndex + 1} upload, but saving tags`);
                                }
                                
                                // Update file upload progress
                                await updateFileUploadV2(fileUploadId, {
                                    file_progress: prog,
                                    tag: etag.replace(/"/gi, ""),
                                    currentIndex: partIndex + 1,
                                });
                                
                                // Notify all registered callbacks
                                partUploadCallbacksRef.current.forEach(callback => {
                                    try {
                                        callback();
                                    } catch (error) {
                                        console.error('Error in part upload callback:', error);
                                    }
                                });
                                
                                return isCancelAvailableRef.current[fileUploadId];
                            }
                        } else {
                            showNetworkError();
                            return false;
                        }
                    } catch (error) {
                        const axiosError = error as AxiosError;
                        if (axiosError.code !== "ERR_CANCELED") {
                            throw error;
                        }
                        return false;
                    }
                } else {
                    throw new Error("Error while getting signed URL");
                }
            } catch (error) {
                throw error;
            }
            return false;
        },
        [showNetworkError]
    );

    // ==================== Complete Upload ====================

    const handleCompleteTags = useCallback(
        async (key: string, uploadId: string, fileUploadId: string, fileName: string): Promise<void> => {
            try {
                await completeSignedUrl(key, uploadId, fileUploadId);
                // V2: Update file upload to COMPLETED status
                await updateFileUploadV2(fileUploadId, {
                    status: "COMPLETED",
                    file_progress: "100%",
                    remote_file_path: key,
                });

                setIsUploading((prev) => {
                    const updated = { ...prev, [fileUploadId]: true };
                    updateIsUploading(updated);
                    return updated;
                });

                setKeyObj((prev) => {
                    const updated = { ...prev };
                    delete updated[fileUploadId];
                    updateKeyObj(updated);
                    return updated;
                });

                window.electronAPI?.showNotification("File Upload", `${fileName} is uploaded.`);
            } catch (error) {
                console.error("Error completing upload:", error);
                const axiosError = error as AxiosError;

                // V2: Update file upload to COMPLETED_WITH_ERROR status
                await updateFileUploadV2(fileUploadId, {
                    status: "COMPLETED_WITH_ERROR",
                    file_progress: "100%",
                });

                setIsUploading((prev) => {
                    const updated = { ...prev, [fileUploadId]: true };
                    updateIsUploading(updated);
                    return updated;
                });

                await cancelDeleteFileUpload(fileUploadId, "COMPLETED_WITH_ERROR", keyObjRef.current[fileUploadId], axiosError.message);

                setKeyObj((prev) => {
                    const updated = { ...prev };
                    delete updated[fileUploadId];
                    updateKeyObj(updated);
                    return updated;
                });

                window.electronAPI?.showNotification("File Upload", `${fileName} failed to upload.`);
            }
        },
        [updateIsUploading, updateKeyObj]
    );

    // ==================== File Upload Handler ====================

    /**
     * Handle normal file upload (from FileDropTab)
     * Uses File object directly from browser - no base64 conversion needed
     * This function is NOT affected by the chunked conversion logic in resumeUpload
     */
    const handleFileUpload = useCallback(
        async (file: File, patientId: string | undefined, fileUploadId: string, fileName?: string): Promise<void> => {
            try {
                const s3FileName = fileName || file.name;
                // V2: Support uploads without patient - use fileUploadId as folder identifier
                const folderIdentifier = patientId || fileUploadId;
                const key = `augmet_uploader/${folderIdentifier}_${getCurrentDateTime()}/${s3FileName}`;
                const chunkLen = getChunkCount(file.size, CHUNK_SIZE);

                if (!navigator.onLine) {
                    showNetworkError();
                    return;
                }

                // V2: Update file upload status to IN_PROGRESS
                await updateFileUploadV2(fileUploadId, {
                    status: "IN_PROGRESS",
                    file_progress: "0%",
                });

                const initialResponse = await initiateMultipartUpload(key);

                if (initialResponse.data?.success && initialResponse.data?.data) {
                    const uploadId = initialResponse.data.data.UploadId;

                    // V2: Update with AWS upload details
                    await updateFileUploadV2(fileUploadId, {
                        aws_upload_id: uploadId,
                        aws_key: key,
                    });

                    setKeyObj((prev) => {
                        const updated = { ...prev, [fileUploadId]: { key, uploadId: uploadId } };
                        updateKeyObj(updated);
                        return updated;
                    });

                    for (let partIndex = 0; partIndex < chunkLen; partIndex++) {
                        if (!navigator.onLine) {
                            showNetworkError();
                            return;
                        }

                        if (!isCancelAvailableRef.current[fileUploadId]) {
                            return;
                        }

                        const success = await handlePartUpload(file, partIndex, chunkLen, key, uploadId, fileUploadId);
                        // If upload was cancelled or part upload failed, stop processing
                        if (!success || !isCancelAvailableRef.current[fileUploadId]) {
                            console.log(`Stopping upload for ${fileUploadId} at part ${partIndex + 1}`);
                            return;
                        }
                    }

                    if (isCancelAvailableRef.current[fileUploadId]) {
                        await handleCompleteTags(key, uploadId, fileUploadId, s3FileName);
                    }
                } else {
                    throw new Error("Error while initiating file upload");
                }
            } catch (error) {
                console.error("Upload error:", error);
                await cancelWithError("Error while processing file upload", fileUploadId);
            }
        },
        [showNetworkError, handlePartUpload, handleCompleteTags, cancelWithError, updateKeyObj]
    );

    // ==================== Resume Upload Handler (File-based - for small files) ====================

    const handleFileUploadResume = useCallback(
        async (file: File, fileUploadId: string, key: string, uploadId: string, currentPartIndex: number | string): Promise<void> => {
            let startPartIndex = typeof currentPartIndex === "string" ? parseInt(currentPartIndex) || 0 : currentPartIndex || 0;

            try {
                const chunkLen = getChunkCount(file.size, CHUNK_SIZE);

                if (!navigator.onLine) {
                    showNetworkError();
                    return;
                }

                // V2: Update file upload status to IN_PROGRESS (force update)
                await updateFileUploadV2(fileUploadId, {
                    status: "IN_PROGRESS",
                    updateStatus: true,
                });

                // Always verify if uploadId is still valid before resuming
                // The uploadId might be invalid if the multipart upload was aborted
                let actualUploadId = uploadId;
                let actualKey = key;
                let needsNewUpload = false;

                // Test if uploadId is valid by trying to get a signed URL for the next part to upload
                // Use a timeout to prevent hanging if the uploadId is invalid
                const testPartNumber = startPartIndex > 0 ? startPartIndex + 1 : 1;
                try {
                    const testPromise = getSignedUrlsForAllPart(key, uploadId, testPartNumber);
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("UploadId validation timeout")), 5000)
                    );
                    
                    const testResponse = await Promise.race([testPromise, timeoutPromise]) as Awaited<ReturnType<typeof getSignedUrlsForAllPart>>;
                    if (!testResponse.data?.success) {
                        // UploadId is invalid, need to initiate new multipart upload
                        needsNewUpload = true;
                    }
                } catch (testError) {
                    // UploadId is invalid (likely aborted) or request timed out, need to initiate new multipart upload
                    console.warn("Existing uploadId is invalid or timed out, initiating new multipart upload:", testError);
                    needsNewUpload = true;
                }

                if (needsNewUpload) {
                    // Initiate a new multipart upload
                    const newKey = `augmet_uploader/${fileUploadId}_${getCurrentDateTime()}/${file.name}`;
                    const initialResponse = await initiateMultipartUpload(newKey);
                    
                    if (initialResponse.data?.success && initialResponse.data?.data) {
                        actualUploadId = initialResponse.data.data.UploadId;
                        actualKey = newKey;
                        
                        // Update file upload with new AWS details
                        await updateFileUploadV2(fileUploadId, {
                            aws_upload_id: actualUploadId,
                            aws_key: actualKey,
                        });

                        setKeyObj((prev) => {
                            const updated = { ...prev, [fileUploadId]: { key: actualKey, uploadId: actualUploadId } };
                            updateKeyObj(updated);
                            return updated;
                        });
                        
                        // If we're creating a new upload, we must start from part 0
                        startPartIndex = 0;
                    } else {
                        throw new Error("Error while initiating new multipart upload");
                    }
                }

                for (let partIndex = startPartIndex; partIndex < chunkLen; partIndex++) {
                    if (!navigator.onLine) {
                        showNetworkError();
                        return;
                    }

                    if (!isCancelAvailableRef.current[fileUploadId]) {
                        return;
                    }

                    const success = await handlePartUpload(file, partIndex, chunkLen, actualKey, actualUploadId, fileUploadId);
                    // If upload was cancelled or part upload failed, stop processing
                    if (!success || !isCancelAvailableRef.current[fileUploadId]) {
                        console.log(`Stopping resume upload for ${fileUploadId} at part ${partIndex + 1}`);
                        return;
                    }
                }

                if (isCancelAvailableRef.current[fileUploadId]) {
                    await handleCompleteTags(actualKey, actualUploadId, fileUploadId, file.name);
                }
            } catch (error) {
                console.error("Resume upload error:", error);
                await cancelWithError("Error while processing file upload", fileUploadId);
            }
        },
        [showNetworkError, handlePartUpload, handleCompleteTags, cancelWithError, updateKeyObj]
    );

    // ==================== Resume Upload Handler (Disk-based - for large files) ====================

    /**
     * Handle resume upload by reading chunks directly from disk.
     * This is memory-efficient and prevents crashes for large files (>100MB).
     * Works the same as handleFileUploadResume but reads chunks on-demand from disk
     * instead of loading the entire file into memory.
     */
    const handleFileUploadResumeFromDisk = useCallback(
        async (
            filePath: string,
            fileSize: number,
            fileType: string,
            fileName: string,
            fileUploadId: string,
            key: string,
            uploadId: string,
            currentPartIndex: number | string
        ): Promise<void> => {
            let startPartIndex = typeof currentPartIndex === "string" ? parseInt(currentPartIndex) || 0 : currentPartIndex || 0;

            try {
                const chunkLen = getChunkCount(fileSize, CHUNK_SIZE);

                console.log(`Starting disk-based resume upload: ${fileName}, size=${fileSize}, chunks=${chunkLen}, startIndex=${startPartIndex}`);

                if (!navigator.onLine) {
                    showNetworkError();
                    return;
                }

                // V2: Update file upload status to IN_PROGRESS (force update)
                await updateFileUploadV2(fileUploadId, {
                    status: "IN_PROGRESS",
                    updateStatus: true,
                });

                // Always verify if uploadId is still valid before resuming
                let actualUploadId = uploadId;
                let actualKey = key;
                let needsNewUpload = false;

                // Test if uploadId is valid
                const testPartNumber = startPartIndex > 0 ? startPartIndex + 1 : 1;
                const testResponse = await getSignedUrlsForAllPart(key, uploadId, testPartNumber);
                if (!testResponse.data?.success) {
                    console.warn("Existing uploadId is invalid, initiating new multipart upload");
                    needsNewUpload = true;
                }

                if (needsNewUpload) {
                    // Initiate a new multipart upload
                    const newKey = `augmet_uploader/${fileUploadId}_${getCurrentDateTime()}/${fileName}`;
                    const initialResponse = await initiateMultipartUpload(newKey);
                    
                    if (initialResponse.data?.success && initialResponse.data?.data) {
                        actualUploadId = initialResponse.data.data.UploadId;
                        actualKey = newKey;
                        
                        // Update file upload with new AWS details
                        await updateFileUploadV2(fileUploadId, {
                            aws_upload_id: actualUploadId,
                            aws_key: actualKey,
                        });

                        setKeyObj((prev) => {
                            const updated = { ...prev, [fileUploadId]: { key: actualKey, uploadId: actualUploadId } };
                            updateKeyObj(updated);
                            return updated;
                        });
                        
                        // If we're creating a new upload, we must start from part 0
                        startPartIndex = 0;
                        console.log(`Created new multipart upload, starting from part 0`);
                    } else {
                        throw new Error("Error while initiating new multipart upload");
                    }
                }

                // Upload each chunk by reading directly from disk (memory-efficient)
                for (let partIndex = startPartIndex; partIndex < chunkLen; partIndex++) {
                    if (!navigator.onLine) {
                        showNetworkError();
                        return;
                    }

                    if (!isCancelAvailableRef.current[fileUploadId]) {
                        return;
                    }

                    // Use disk-based chunk upload instead of File.slice()
                    const success = await handlePartUploadFromDisk(
                        filePath,
                        fileSize,
                        fileType,
                        partIndex,
                        chunkLen,
                        actualKey,
                        actualUploadId,
                        fileUploadId
                    );

                    if (!success || !isCancelAvailableRef.current[fileUploadId]) {
                        console.log(`Stopping disk-based resume upload for ${fileUploadId} at part ${partIndex + 1}`);
                        return;
                    }
                }

                if (isCancelAvailableRef.current[fileUploadId]) {
                    await handleCompleteTags(actualKey, actualUploadId, fileUploadId, fileName);
                }
            } catch (error) {
                console.error("Disk-based resume upload error:", error);
                await cancelWithError("Error while processing file upload", fileUploadId);
            }
        },
        [showNetworkError, handlePartUploadFromDisk, handleCompleteTags, cancelWithError, updateKeyObj]
    );

    // ==================== Queue Processing ====================

    const processQueue = useCallback(async (): Promise<void> => {
        try {
            while (!fileUploadQueue.current.isEmpty) {
                const item = fileUploadQueue.current.dequeue();
                if (!item) break;

                const { 
                    file, 
                    patientId, 
                    fileUploadId, 
                    isFileResume, 
                    key, 
                    uploadId, 
                    currentPartIndex, 
                    fileName,
                    // Disk-based resume upload fields
                    filePath,
                    fileSize,
                    fileType
                } = item;

                try {
                    if (isFileResume && key && uploadId) {
                        // Check if this is a disk-based resume (filePath is set) or file-based resume
                        if (filePath && fileSize) {
                            // Disk-based resume: read chunks directly from disk (memory-efficient)
                            console.log(`Processing disk-based resume upload for ${fileUploadId}`);
                            await handleFileUploadResumeFromDisk(
                                filePath,
                                fileSize,
                                fileType || "application/octet-stream",
                                fileName || "unknown",
                                fileUploadId,
                                key,
                                uploadId,
                                currentPartIndex || 0
                            );
                        } else if (file) {
                            // File-based resume (legacy): use File object
                            console.log(`Processing file-based resume upload for ${fileUploadId}`);
                            await handleFileUploadResume(file, fileUploadId, key, uploadId, currentPartIndex || 0);
                        } else {
                            throw new Error("Resume upload requires either file or filePath");
                        }
                    } else if (file) {
                        // Normal upload: use File object directly
                        await handleFileUpload(file, patientId, fileUploadId, fileName);
                    } else {
                        throw new Error("Normal upload requires a file");
                    }
                } catch (error) {
                    console.error("Queue processing error:", error);
                    await cancelWithError("Error while processing file upload", fileUploadId);
                }
            }
            setIsUploadInProgress(false);
        } catch (error) {
            console.error("Queue loop error:", error);
            setIsUploadInProgress(false);
        }
    }, [handleFileUpload, handleFileUploadResume, handleFileUploadResumeFromDisk, cancelWithError]);

    // ==================== Core Upload Functions ====================

    /**
     * Add files to upload queue
     * V2: patient_id is optional - files can be uploaded without patient assignment
     */
    const addFilesToQueue = useCallback(
        async (filesData: FileToUploadV2[]): Promise<void> => {
            const orgId = localStorage.getItem("org_id");
            
            if (!orgId) {
                const errorMsg = "Organization ID not found. Please log in again.";
                console.error(errorMsg);
                window.electronAPI?.showErrorBox("Upload Error", errorMsg);
                throw new Error(errorMsg);
            }

            const successfulUploads: string[] = [];
            const failedUploads: Array<{ fileName: string; error: string }> = [];

            for (const fileData of filesData) {
                const { file, fileName, originalFileName, fileType, patientId, visitId, sampleId } = fileData;

                // Get file path - in Electron, file.path might not be available for input[type=file]
                // So we use empty string as it's optional for V2 API
                // Declared outside try-catch so it's accessible in catch block for error logging
                const filePath = (file as File & { path?: string }).path || "";

                try {
                    // V2: Create file upload record (patient_id is optional)
                    const result = await createFileUploadV2({
                        file_name: fileName,
                        original_file_name: originalFileName || file.name,
                        local_file_path: filePath,
                        org_id: orgId,
                        patient_id: patientId || undefined,
                        sample_id: sampleId || undefined,
                        visit_id: visitId || undefined,
                        file_type: fileType,
                        file_size: file.size,
                    });

                    if (result.data?.success) {
                        const fileUploadId = result.data.data._id;

                        setIsUploading((prev) => {
                            const updated = { ...prev, [fileUploadId]: false };
                            updateIsUploading(updated);
                            return updated;
                        });

                        setIsCancelAvailable((prev) => ({ ...prev, [fileUploadId]: true }));

                        fileUploadQueue.current.enqueue({
                            file,
                            patientId,
                            fileUploadId,
                            fileName,
                        });
                        
                        successfulUploads.push(fileName);
                    } else {
                        const errorMsg = result.data?.message || "Failed to create file upload record";
                        failedUploads.push({ fileName, error: errorMsg });
                        console.error(`Failed to create upload for ${fileName}:`, result.data);
                    }
                } catch (error) {
                    console.error("Error creating file upload record:", error);
                    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
                    const errorMessage = axiosError.response?.data?.message 
                        || axiosError.response?.data?.error 
                        || axiosError.message 
                        || "Error while creating file upload";
                    
                    // Log detailed error to encrypted log
                    logger.error("Error creating file upload record", error as Error, {
                        fileName: fileName,
                        originalFileName: originalFileName,
                        fileType: fileType,
                        fileSize: file.size,
                        hasPath: !!filePath,
                        filePath: filePath,
                        orgId: orgId,
                        errorMessage: errorMessage,
                        response: axiosError.response?.data,
                        status: axiosError.response?.status,
                    });
                    
                    failedUploads.push({ fileName, error: errorMessage });
                }
            }

            // Show error if any files failed
            if (failedUploads.length > 0) {
                const errorDetails = failedUploads
                    .map(f => `${f.fileName}: ${f.error}`)
                    .join("\n");
                const errorMsg = failedUploads.length === filesData.length
                    ? `Failed to add all files:\n${errorDetails}`
                    : `Failed to add ${failedUploads.length} file(s):\n${errorDetails}`;
                
                window.electronAPI?.showErrorBox("File Upload Error", errorMsg);
                
                // If all files failed, throw error to prevent queue processing
                if (failedUploads.length === filesData.length) {
                    throw new Error(errorMsg);
                }
            }

            // Only start queue processing if we have successful uploads
            if (successfulUploads.length > 0 && !isUploadInProgressRef.current && !fileUploadQueue.current.isEmpty) {
                setIsUploadInProgress(true);
                processQueue();
            }
        },
        [processQueue, updateIsUploading]
    );

    /**
     * Resume an interrupted upload
     * 
     * NEW APPROACH (memory-efficient):
     * Instead of reading the entire file into memory (which causes crashes for large files),
     * we now store the file path and read chunks directly from disk during upload.
     * This works identically to normal multipart uploads - only difference is the chunk source.
     * 
     * Flow:
     * 1. Validate file exists at stored path
     * 2. Get file size for chunk calculation
     * 3. Store file path info in queue (NOT the file data)
     * 4. During upload, chunks are read on-demand from disk via Electron API
     * 
     * This approach works for files of ANY size without memory issues.
     */
    const resumeUpload = useCallback(
        async (fileInfo: ResumeUploadInfo): Promise<void> => {
            const { fileUploadId, fileName, filePath, uploadId, key, currentPartIndex, fileType } = fileInfo;

            try {
                // Validate that we have the required Electron APIs
                if (!window.electronAPI?.getFileStats || !window.electronAPI?.readFileChunk) {
                    throw new Error("File system access not available. Please restart the application.");
                }

                // Step 1: Validate file exists and get its size
                const statsResult = await window.electronAPI.getFileStats(filePath);
                if (!statsResult.success || !statsResult.exists) {
                    throw new Error("File not found at stored location. The file may have been moved or deleted.");
                }

                const fileSize = statsResult.size || 0;
                if (fileSize === 0) {
                    throw new Error("File is empty or could not determine file size.");
                }

                console.log(`Resume upload: ${fileName}, size=${fileSize}, path=${filePath}`);

                // Step 2: Update UI state
                setIsUploading((prev) => {
                    const updated = { ...prev, [fileUploadId]: false };
                    updateIsUploading(updated);
                    return updated;
                });

                setIsCancelAvailable((prev) => ({ ...prev, [fileUploadId]: true }));

                // Step 3: Update file upload status to QUEUED
                await updateFileUploadV2(fileUploadId, {
                    status: "QUEUED",
                    updateStatus: true,
                });

                // Step 4: Add to queue with file PATH info (NOT file data)
                // The queue processor will read chunks from disk on-demand
                fileUploadQueue.current.enqueue({
                    // No file object needed - we'll read from disk
                    key,
                    fileUploadId,
                    uploadId,
                    isFileResume: true,
                    currentPartIndex,
                    fileName,
                    // Disk-based upload fields
                    filePath,
                    fileSize,
                    fileType: fileType || "application/octet-stream",
                });

                if (!isUploadInProgressRef.current) {
                    setIsUploadInProgress(true);
                    processQueue();
                }
            } catch (error) {
                console.error("Resume error:", error);
                const errorMessage = error instanceof Error 
                    ? error.message 
                    : "File is not present in the stored location";
                
                // Update status to ERROR in database before re-throwing
                try {
                    await updateFileUploadV2(fileUploadId, {
                        status: "ERROR",
                    });
                } catch (updateError) {
                    console.error("Failed to update status to ERROR in resumeUpload:", updateError);
                }
                
                // Re-throw the error so the caller can handle it
                // This prevents silent failures that could cause crashes
                throw error;
            }
        },
        [processQueue, updateIsUploading]
    );

    /**
     * Cancel an upload (Resume-Safe)
     * V2: Uses the new cancel API and removes file from queue
     * 
     * IMPORTANT: This cancel is designed to preserve uploaded parts for resume capability.
     * 
     * Flow:
     * 1. Set cancel flag to stop further parts (current part will finish and save its tag)
     * 2. Remove file from queue to prevent further parts from being processed
     * 3. Update DB status to CANCEL (does NOT abort S3 multipart upload)
     * 4. Clean up local state
     * 
     * Resume-Safe Guarantees:
     * - We do NOT cancel the current part's HTTP request (cancelToken not used)
     * - Current uploading part completes and saves its ETag to the database
     * - S3 multipart upload is NOT aborted - uploaded parts remain on S3
     * - The cancelFileUploadV2 API only updates DB status, preserving aws_upload_id and tags
     * - On resume, existing parts are reused via their saved ETags
     */
    const cancelUpload = useCallback(
        async (fileUploadId: string, status: string): Promise<void> => {
            // Step 1: Set cancel flag first to stop further part uploads
            // This allows the current part (if uploading) to finish and save its tag
            setIsCancelAvailable((prev) => ({ ...prev, [fileUploadId]: false }));
            setIsUploading((prev) => {
                const updated = { ...prev, [fileUploadId]: true };
                updateIsUploading(updated);
                return updated;
            });

            try {
                // Step 2: Remove file from the upload queue if it's still queued
                // This prevents further parts from being processed
                const removedCount = fileUploadQueue.current.removeBy(
                    (item) => item.fileUploadId === fileUploadId
                );
                
                if (removedCount > 0) {
                    console.log(`Removed ${removedCount} item(s) from queue for fileUploadId: ${fileUploadId}`);
                }

                // Step 3: Update DB status to CANCEL via API
                // This happens after setting cancel flag, so current part can finish and save tags
                // The API will update the status and preserve current progress/tags
                await cancelFileUploadV2(fileUploadId);

                // Step 4: Clean up state after DB update
                setKeyObj((prev) => {
                    const updated = { ...prev };
                    delete updated[fileUploadId];
                    updateKeyObj(updated);
                    return updated;
                });

                // Clean up isUploading state
                setIsUploading((prev) => {
                    const updated = { ...prev };
                    delete updated[fileUploadId];
                    updateIsUploading(updated);
                    return updated;
                });

                // Note: We keep isCancelAvailable set to false for this fileUploadId
                // so that if the upload loop is still running, it will stop after current part
                // The cleanup will happen naturally when the upload loop completes

                console.log(`Cancel flag set for ${fileUploadId}. Current part will finish and save tag, then upload will stop. S3 multipart upload preserved for resume.`);

            } catch (error) {
                console.error("Cancel error:", error);
                // Even if API call fails, the cancel flag is set, so upload will stop
                // after current part completes
            }
        },
        [updateIsUploading, updateKeyObj]
    );

    // ==================== Upload Progress Callbacks ====================

    /**
     * Register a callback to be called when a part is uploaded
     * Returns an unsubscribe function
     */
    const onPartUploaded = useCallback((callback: () => void): (() => void) => {
        partUploadCallbacksRef.current.add(callback);
        return () => {
            partUploadCallbacksRef.current.delete(callback);
        };
    }, []);

    // ==================== V2 Status Tab Functions ====================

    /**
     * Get file uploads for Status tab with progress and actions
     */
    const getStatusList = useCallback(
        async (params?: { search?: string; file_type?: string; status?: string; limit?: number; skip?: number }): Promise<StatusListResponse> => {
            const response = await getStatusListV2(params);
            return response.data.data;
        },
        []
    );

    /**
     * Retry a failed or stalled upload
     */
    const retryUpload = useCallback(
        async (fileId: string): Promise<FileUpload> => {
            const response = await retryFileUploadV2(fileId);
            return response.data.data;
        },
        []
    );

    /**
     * Get download URLs for multiple files
     */
    const bulkDownload = useCallback(
        async (fileIds: string[]): Promise<Array<{ _id: string; file_name: string; download_url?: string; error?: string }>> => {
            const response = await bulkDownloadV2(fileIds);
            return response.data.data;
        },
        []
    );

    /**
     * Delete multiple file uploads
     */
    const bulkDelete = useCallback(
        async (fileIds: string[]): Promise<{ deleted_count: number }> => {
            const response = await bulkDeleteV2(fileIds);
            return response.data.data;
        },
        []
    );

    // ==================== V2 Assign Tab Functions ====================

    /**
     * Get completed file uploads without patient assignment
     */
    const getAssignList = useCallback(
        async (params?: { search?: string; file_type?: string; limit?: number; skip?: number }): Promise<AssignListResponse> => {
            const response = await getAssignListV2(params);
            return response.data.data;
        },
        []
    );

    /**
     * Assign a patient to an uploaded file
     */
    const assignPatient = useCallback(
        async (fileId: string, data: PatientAssignData): Promise<FileUpload> => {
            const response = await assignPatientV2(fileId, data);
            return response.data.data;
        },
        []
    );

    /**
     * Assign a patient to multiple file uploads
     */
    const bulkAssignPatient = useCallback(
        async (fileIds: string[], data: PatientAssignData): Promise<{ assigned_count: number; patient_id: string; visit_id: string; sample_id: string }> => {
            const response = await bulkAssignPatientV2(fileIds, data);
            return response.data.data;
        },
        []
    );

    // ==================== V2 Association Tab Functions ====================

    /**
     * Get file uploads with full association details (DataTables format)
     */
    const getAssociationList = useCallback(
        async (params: Record<string, unknown>): Promise<AssociationListResponse> => {
            return await getAssociationListV2(params);
        },
        []
    );

    // ==================== Context Value ====================

    const value: UploadContextV2Value = {
        // Core upload functions
        addFilesToQueue,
        resumeUpload,
        cancelUpload,
        
        // Status state
        isUploading,
        isCancelAvailable,
        isUploadInProgress,
        
        // Upload progress callbacks
        onPartUploaded,
        
        // V2 Status Tab functions
        getStatusList,
        retryUpload,
        bulkDownload,
        bulkDelete,
        
        // V2 Assign Tab functions
        getAssignList,
        assignPatient,
        bulkAssignPatient,
        
        // V2 Association Tab functions
        getAssociationList,
    };

    return <UploadContextV2.Provider value={value}>{children}</UploadContextV2.Provider>;
};

/**
 * Hook to access V2 upload context
 */
export const useUploadV2 = (): UploadContextV2Value => {
    const context = useContext(UploadContextV2);
    if (!context) {
        throw new Error("useUploadV2 must be used within an UploadProviderV2");
    }
    return context;
};

export default UploadContextV2;

