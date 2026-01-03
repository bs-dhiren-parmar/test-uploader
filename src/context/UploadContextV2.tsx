import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import axios, { CancelTokenSource, AxiosError } from "axios";
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
    FileToUpload,
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
                const prog = parseFloat(String(((partIndex + 1) * 100) / chunkLen)).toFixed(2) + "%";

                const signedUploadResponse = await getSignedUrlsForAllPart(key, uploadId, partIndex + 1);

                if (signedUploadResponse.data?.success && signedUploadResponse.data?.data) {
                    const fileData = getCurrentChunk(file, partIndex, CHUNK_SIZE);
                    console.log("signedUploadResponse", signedUploadResponse);
                    console.log("navigator.onLine: ", navigator.onLine);
                    try {
                        if (navigator.onLine) {
                            cancelTokenSource.current = axios.CancelToken.source();
                            const chunkUploadRes = await uploadChunk(
                                signedUploadResponse.data.data,
                                fileData,
                                file.type || "application/octet-stream",
                                cancelTokenSource.current.token
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
                                
                                // V2: Update file upload progress
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
                                
                                return true;
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
                        const updated = { ...prev, [fileUploadId]: { key, uplaodId: uploadId } };
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
                        if (!success && !isCancelAvailableRef.current[fileUploadId]) {
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

    // ==================== Resume Upload Handler ====================

    const handleFileUploadResume = useCallback(
        async (file: File, fileUploadId: string, key: string, uploadId: string, currentPartIndex: number | string): Promise<void> => {
            const startPartIndex = typeof currentPartIndex === "string" ? parseInt(currentPartIndex) || 0 : currentPartIndex || 0;

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

                for (let partIndex = startPartIndex; partIndex < chunkLen; partIndex++) {
                    if (!navigator.onLine) {
                        showNetworkError();
                        return;
                    }

                    if (!isCancelAvailableRef.current[fileUploadId]) {
                        return;
                    }

                    await handlePartUpload(file, partIndex, chunkLen, key, uploadId, fileUploadId);
                }

                if (isCancelAvailableRef.current[fileUploadId]) {
                    await handleCompleteTags(key, uploadId, fileUploadId, key);
                }
            } catch (error) {
                console.error("Resume upload error:", error);
                await cancelWithError("Error while processing file upload", fileUploadId);
            }
        },
        [showNetworkError, handlePartUpload, handleCompleteTags, cancelWithError]
    );

    // ==================== Queue Processing ====================

    const processQueue = useCallback(async (): Promise<void> => {
        try {
            while (!fileUploadQueue.current.isEmpty) {
                const item = fileUploadQueue.current.dequeue();
                if (!item) break;

                const { file, patientId, fileUploadId, isFileResume, key, uploadId, currentPartIndex, fileName } = item;

                try {
                    if (isFileResume && key && uploadId) {
                        await handleFileUploadResume(file, fileUploadId, key, uploadId, currentPartIndex || 0);
                    } else {
                        // V2: Support uploads without patient
                        await handleFileUpload(file, patientId, fileUploadId, fileName);
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
    }, [handleFileUpload, handleFileUploadResume, cancelWithError]);

    // ==================== Core Upload Functions ====================

    /**
     * Add files to upload queue
     * V2: patient_id is optional - files can be uploaded without patient assignment
     */
    const addFilesToQueue = useCallback(
        async (filesData: FileToUploadV2[]): Promise<void> => {
            const orgId = localStorage.getItem("org_id");

            for (const fileData of filesData) {
                const { file, fileName, originalFileName, fileType, patientId, visitId, sampleId } = fileData;

                try {
                    // V2: Create file upload record (patient_id is optional)
                    const result = await createFileUploadV2({
                        file_name: fileName,
                        original_file_name: originalFileName || file.name,
                        local_file_path: (file as File & { path?: string }).path || "",
                        org_id: orgId || "",
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
                    }
                } catch (error) {
                    console.error("Error creating file upload record:", error);
                    const axiosError = error as AxiosError<{ message?: string }>;
                    const message = axiosError.response?.data?.message || "Error while creating file upload";
                    window.electronAPI?.showErrorBox("File Upload Error", message);
                }
            }

            if (!isUploadInProgressRef.current && !fileUploadQueue.current.isEmpty) {
                setIsUploadInProgress(true);
                processQueue();
            }
        },
        [processQueue, updateIsUploading]
    );

    /**
     * Resume an interrupted upload
     */
    const resumeUpload = useCallback(
        async (fileInfo: ResumeUploadInfo): Promise<void> => {
            const { fileUploadId, fileName, filePath, uploadId, key, currentPartIndex } = fileInfo;

            try {
                if (!window.electronAPI?.readLocalFile) {
                    throw new Error("File system access not available");
                }

                const statsResult = await window.electronAPI.getFileStats(filePath);
                if (!statsResult.success || !statsResult.exists) {
                    throw new Error("File not found at stored location");
                }

                const fileResult = await window.electronAPI.readLocalFile(filePath);
                if (!fileResult.success || !fileResult.data) {
                    throw new Error(fileResult.error || "Failed to read file");
                }

                const binaryString = atob(fileResult.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes]);
                const file = new File([blob], fileName);

                setIsUploading((prev) => {
                    const updated = { ...prev, [fileUploadId]: false };
                    updateIsUploading(updated);
                    return updated;
                });

                setIsCancelAvailable((prev) => ({ ...prev, [fileUploadId]: true }));

                // V2: Update file upload status to QUEUED
                await updateFileUploadV2(fileUploadId, {
                    status: "QUEUED",
                    updateStatus: true,
                });

                fileUploadQueue.current.enqueue({
                    file,
                    key,
                    fileUploadId,
                    uploadId,
                    isFileResume: true,
                    currentPartIndex,
                    fileName,
                });

                if (!isUploadInProgressRef.current) {
                    setIsUploadInProgress(true);
                    processQueue();
                }
            } catch (error) {
                console.error("Resume error:", error);
                window.electronAPI?.showErrorBox("File Not Found", "File is not present in the stored location");
            }
        },
        [processQueue, updateIsUploading]
    );

    /**
     * Cancel an upload
     * V2: Uses the new cancel API and removes file from queue
     */
    const cancelUpload = useCallback(
        async (fileUploadId: string, status: string): Promise<void> => {
            setIsCancelAvailable((prev) => ({ ...prev, [fileUploadId]: false }));
            setIsUploading((prev) => {
                const updated = { ...prev, [fileUploadId]: true };
                updateIsUploading(updated);
                return updated;
            });

            try {
                // Remove file from the upload queue if it's still queued
                const removedCount = fileUploadQueue.current.removeBy(
                    (item) => item.fileUploadId === fileUploadId
                );
                
                if (removedCount > 0) {
                    console.log(`Removed ${removedCount} item(s) from queue for fileUploadId: ${fileUploadId}`);
                }

                // V2: Use the new cancel API to mark as CANCEL status
                const result = await cancelFileUploadV2(fileUploadId);

                setKeyObj((prev) => {
                    const updated = { ...prev };
                    delete updated[fileUploadId];
                    updateKeyObj(updated);
                    return updated;
                });

                if (result.data?.success) {
                    // Cancel the ongoing chunk upload if in progress
                    if (cancelTokenSource.current && status === "IN_PROGRESS") {
                        cancelTokenSource.current.cancel();
                        cancelTokenSource.current = null;
                    }
                }

                // Clean up isUploading state
                setIsUploading((prev) => {
                    const updated = { ...prev };
                    delete updated[fileUploadId];
                    updateIsUploading(updated);
                    return updated;
                });

                // Clean up isCancelAvailable state
                setIsCancelAvailable((prev) => {
                    const updated = { ...prev };
                    delete updated[fileUploadId];
                    return updated;
                });

            } catch (error) {
                console.error("Cancel error:", error);
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

