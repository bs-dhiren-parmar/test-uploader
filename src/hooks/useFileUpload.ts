import { useState, useRef, useCallback } from 'react';
import axios, { CancelTokenSource, AxiosError } from 'axios';
import Queue from '../utils/Queue';
import { CHUNK_SIZE } from '../utils/constants';
import { getCurrentDateTime, getCurrentChunk, getChunkCount } from '../utils/helpers';
import {
  createOrUpdateFileUpload,
  initiateMultipartUpload,
  getSignedUrlsForAllPart,
  completeSignedUrl,
  cancelDeleteFileUpload,
  uploadChunk
} from '../services/fileUploadService';
import type { QueueItem, KeyObj, FileToUpload, ResumeUploadInfo } from '../types';

interface UseFileUploadReturn {
  addFilesToQueue: (filesData: FileToUpload[]) => Promise<void>;
  resumeUpload: (fileInfo: ResumeUploadInfo) => Promise<void>;
  cancelUpload: (fileUploadId: string, status: string) => Promise<void>;
  isUploading: Record<string, boolean>;
  isCancelAvailable: Record<string, boolean>;
  isUploadInProgress: boolean;
}

/**
 * Custom hook for managing file uploads with multipart upload support
 */
export function useFileUpload(): UseFileUploadReturn {
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
  
  // Keep refs in sync with state
  isCancelAvailableRef.current = isCancelAvailable;
  keyObjRef.current = keyObj;
  isUploadInProgressRef.current = isUploadInProgress;

  // Update main process with upload status
  const updateIsUploading = useCallback((data: Record<string, boolean>): void => {
    window.electronAPI?.closeActionCheck(data);
  }, []);

  // Update main process with key objects
  const updateKeyObj = useCallback((data: Record<string, unknown>): void => {
    window.electronAPI?.keyObjUpdate(data);
  }, []);

  // Show network error
  const showNetworkError = useCallback((): void => {
    window.electronAPI?.showErrorBox('Network Error', 'Please connect to network');
  }, []);

  // Cancel upload with error
  const cancelWithError = useCallback(async (errorMessage: string, fileUploadId: string): Promise<void> => {
    try {
      setIsCancelAvailable(prev => ({ ...prev, [fileUploadId]: false }));
      setIsUploading(prev => {
        const updated = { ...prev, [fileUploadId]: true };
        updateIsUploading(updated);
        return updated;
      });

      console.error('Upload error:', errorMessage);
      // Use ref to get current keyObj value (avoids stale closure)
      await cancelDeleteFileUpload(fileUploadId, 'error', keyObjRef.current[fileUploadId], errorMessage);

      setKeyObj(prev => {
        const updated = { ...prev };
        delete updated[fileUploadId];
        updateKeyObj(updated);
        return updated;
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error cancelling upload:', axiosError.message);
    }
  }, [updateIsUploading, updateKeyObj]);

  // Upload a single part
  const handlePartUpload = useCallback(async (
    file: File, 
    partIndex: number, 
    chunkLen: number, 
    key: string, 
    uploadId: string, 
    fileUploadId: string
  ): Promise<boolean> => {
    try {
      const prog = parseFloat(String(((partIndex + 1) * 100) / chunkLen)).toFixed(2) + '%';
      
      const signedUploadResponse = await getSignedUrlsForAllPart(key, uploadId, partIndex + 1);
      
      if (signedUploadResponse.data?.success && signedUploadResponse.data?.data) {
        const fileData = getCurrentChunk(file, partIndex, CHUNK_SIZE);

        try {
          if (navigator.onLine) {
            cancelTokenSource.current = axios.CancelToken.source();
            const chunkUploadRes = await uploadChunk(
              signedUploadResponse.data.data,
              fileData,
              file.type || 'application/octet-stream',
              cancelTokenSource.current.token
            );

            if (navigator.onLine && chunkUploadRes?.headers?.etag) {
              await createOrUpdateFileUpload({
                id: fileUploadId,
                file_progress: prog,
                tag: chunkUploadRes.headers.etag.replace(/"/gi, ''),
                currentIndex: partIndex + 1
              });
              return true;
            }
          } else {
            showNetworkError();
            return false;
          }
        } catch (error) {
          const axiosError = error as AxiosError;
          if (axiosError.code !== 'ERR_CANCELED') {
            throw error;
          }
          return false;
        }
      } else {
        throw new Error('Error while getting signed URL');
      }
    } catch (error) {
      throw error;
    }
    return false;
  }, [showNetworkError]);

  // Complete upload with all tags
  const handleCompleteTags = useCallback(async (
    key: string, 
    uploadId: string, 
    fileUploadId: string, 
    fileName: string
  ): Promise<void> => {
    try {
      await completeSignedUrl(key, uploadId, fileUploadId);
      await createOrUpdateFileUpload({
        id: fileUploadId,
        status: 'COMPLETED',
        file_progress: '100%',
        remote_file_path: key
      });

      setIsUploading(prev => {
        const updated = { ...prev, [fileUploadId]: true };
        updateIsUploading(updated);
        return updated;
      });

      setKeyObj(prev => {
        const updated = { ...prev };
        delete updated[fileUploadId];
        updateKeyObj(updated);
        return updated;
      });

      window.electronAPI?.showNotification('File Upload', `${fileName} is uploaded.`);
    } catch (error) {
      console.error('Error completing upload:', error);
      const axiosError = error as AxiosError;
      
      await createOrUpdateFileUpload({
        id: fileUploadId,
        status: 'COMPLETED_WITH_ERROR',
        file_progress: '100%'
      });

      setIsUploading(prev => {
        const updated = { ...prev, [fileUploadId]: true };
        updateIsUploading(updated);
        return updated;
      });

      // Use ref to get current keyObj value (avoids stale closure)
      await cancelDeleteFileUpload(fileUploadId, 'COMPLETED_WITH_ERROR', keyObjRef.current[fileUploadId], axiosError.message);

      setKeyObj(prev => {
        const updated = { ...prev };
        delete updated[fileUploadId];
        updateKeyObj(updated);
        return updated;
      });

      window.electronAPI?.showNotification('File Upload', `${fileName} failed to upload.`);
    }
  }, [updateIsUploading, updateKeyObj]);

  // Handle file upload
  const handleFileUpload = useCallback(async (
    file: File, 
    patientId: string, 
    fileUploadId: string, 
    fileName?: string
  ): Promise<void> => {
    try {
      const s3FileName = fileName || file.name;
      const key = `augmet_uploader/${patientId}_${getCurrentDateTime()}/${s3FileName}`;
      const chunkLen = getChunkCount(file.size, CHUNK_SIZE);

      if (!navigator.onLine) {
        showNetworkError();
        return;
      }

      await createOrUpdateFileUpload({
        id: fileUploadId,
        status: 'IN_PROGRESS',
        file_progress: '0%'
      });

      const initialResponse = await initiateMultipartUpload(key);
      
      if (initialResponse.data?.success && initialResponse.data?.data) {
        const uploadId = initialResponse.data.data.UploadId;
        
        await createOrUpdateFileUpload({
          id: fileUploadId,
          aws_upload_id: uploadId,
          aws_key: key
        });

        setKeyObj(prev => {
          const updated = { ...prev, [fileUploadId]: { key, uplaodId: uploadId } };
          updateKeyObj(updated);
          return updated;
        });

        for (let partIndex = 0; partIndex < chunkLen; partIndex++) {
          if (!navigator.onLine) {
            showNetworkError();
            return;
          }

          // Use ref to get current isCancelAvailable value (avoids stale closure)
          if (!isCancelAvailableRef.current[fileUploadId]) {
            return;
          }

          const success = await handlePartUpload(file, partIndex, chunkLen, key, uploadId, fileUploadId);
          if (!success && !isCancelAvailableRef.current[fileUploadId]) {
            return;
          }
        }

        // Use ref to get current isCancelAvailable value (avoids stale closure)
        if (isCancelAvailableRef.current[fileUploadId]) {
          await handleCompleteTags(key, uploadId, fileUploadId, s3FileName);
        }
      } else {
        throw new Error('Error while initiating file upload');
      }
    } catch (error) {
      console.error('Upload error:', error);
      await cancelWithError('Error while processing file upload', fileUploadId);
    }
  }, [showNetworkError, handlePartUpload, handleCompleteTags, cancelWithError, updateKeyObj]);

  // Handle resume upload
  const handleFileUploadResume = useCallback(async (
    file: File, 
    fileUploadId: string, 
    key: string, 
    uploadId: string, 
    currentPartIndex: number | string
  ): Promise<void> => {
    const startPartIndex = typeof currentPartIndex === 'string' 
      ? parseInt(currentPartIndex) || 0 
      : currentPartIndex || 0;
    
    try {
      const chunkLen = getChunkCount(file.size, CHUNK_SIZE);

      if (!navigator.onLine) {
        showNetworkError();
        return;
      }

      await createOrUpdateFileUpload({
        id: fileUploadId,
        status: 'IN_PROGRESS',
        updateStatus: true
      });

      for (let partIndex = startPartIndex; partIndex < chunkLen; partIndex++) {
        if (!navigator.onLine) {
          showNetworkError();
          return;
        }

        // Use ref to get current isCancelAvailable value (avoids stale closure)
        if (!isCancelAvailableRef.current[fileUploadId]) {
          return;
        }

        await handlePartUpload(file, partIndex, chunkLen, key, uploadId, fileUploadId);
      }

      // Use ref to get current isCancelAvailable value (avoids stale closure)
      if (isCancelAvailableRef.current[fileUploadId]) {
        await handleCompleteTags(key, uploadId, fileUploadId, key);
      }
    } catch (error) {
      console.error('Resume upload error:', error);
      await cancelWithError('Error while processing file upload', fileUploadId);
    }
  }, [showNetworkError, handlePartUpload, handleCompleteTags, cancelWithError]);

  // Process upload queue
  const processQueue = useCallback(async (): Promise<void> => {
    try {
      while (!fileUploadQueue.current.isEmpty) {
        const item = fileUploadQueue.current.dequeue();
        if (!item) break;
        
        const { file, patientId, fileUploadId, isFileResume, key, uploadId, currentPartIndex, fileName } = item;

        try {
          if (isFileResume && key && uploadId) {
            await handleFileUploadResume(file, fileUploadId, key, uploadId, currentPartIndex || 0);
          } else if (patientId) {
            await handleFileUpload(file, patientId, fileUploadId, fileName);
          }
        } catch (error) {
          console.error('Queue processing error:', error);
          await cancelWithError('Error while processing file upload', fileUploadId);
        }
      }
      setIsUploadInProgress(false);
    } catch (error) {
      console.error('Queue loop error:', error);
      setIsUploadInProgress(false);
    }
  }, [handleFileUpload, handleFileUploadResume, cancelWithError]);

  // Add files to upload queue
  const addFilesToQueue = useCallback(async (filesData: FileToUpload[]): Promise<void> => {
    const orgId = localStorage.getItem('org_id');
    
    for (const fileData of filesData) {
      const { file, fileName, originalFileName, fileType, patientId, visitId, sampleId } = fileData;

      try {
        const result = await createOrUpdateFileUpload({
          file_name: fileName,
          original_file_name: originalFileName || file.name,
          local_file_path: (file as File & { path?: string }).path || '',
          org_id: orgId || '',
          patient_id: patientId,
          sample_id: sampleId || '',
          visit_id: visitId || '',
          file_type: fileType,
          file_size: file.size
        });

        if (result.data?.success) {
          const fileUploadId = result.data.data._id;

          setIsUploading(prev => {
            const updated = { ...prev, [fileUploadId]: false };
            updateIsUploading(updated);
            return updated;
          });

          setIsCancelAvailable(prev => ({ ...prev, [fileUploadId]: true }));

          fileUploadQueue.current.enqueue({
            file,
            patientId,
            fileUploadId,
            fileName
          });
        }
      } catch (error) {
        console.error('Error creating file upload record:', error);
        const axiosError = error as AxiosError<{ message?: string }>;
        const message = axiosError.response?.data?.message || 'Error while creating file upload';
        window.electronAPI?.showErrorBox('File Upload Error', message);
      }
    }

    // Use ref to get current isUploadInProgress value (avoids stale closure)
    if (!isUploadInProgressRef.current && !fileUploadQueue.current.isEmpty) {
      setIsUploadInProgress(true);
      processQueue();
    }
  }, [processQueue, updateIsUploading]);

  // Resume an interrupted upload
  const resumeUpload = useCallback(async (fileInfo: ResumeUploadInfo): Promise<void> => {
    const { fileUploadId, fileName, filePath, uploadId, key, currentPartIndex } = fileInfo;

    try {
      // Use Electron's file system API to read local files
      if (!window.electronAPI?.readLocalFile) {
        throw new Error('File system access not available');
      }

      // First check if file exists
      const statsResult = await window.electronAPI.getFileStats(filePath);
      if (!statsResult.success || !statsResult.exists) {
        throw new Error('File not found at stored location');
      }

      // Read file using Electron's file system API
      const fileResult = await window.electronAPI.readLocalFile(filePath);
      if (!fileResult.success || !fileResult.data) {
        throw new Error(fileResult.error || 'Failed to read file');
      }

      // Convert base64 data to Blob then File
      const binaryString = atob(fileResult.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes]);
      const file = new File([blob], fileName);

      setIsUploading(prev => {
        const updated = { ...prev, [fileUploadId]: false };
        updateIsUploading(updated);
        return updated;
      });

      setIsCancelAvailable(prev => ({ ...prev, [fileUploadId]: true }));

      await createOrUpdateFileUpload({
        id: fileUploadId,
        status: 'QUEUED',
        updateStatus: true
      });

      fileUploadQueue.current.enqueue({
        file,
        key,
        fileUploadId,
        uploadId,
        isFileResume: true,
        currentPartIndex,
        fileName
      });

      // Use ref to get current isUploadInProgress value (avoids stale closure)
      if (!isUploadInProgressRef.current) {
        setIsUploadInProgress(true);
        processQueue();
      }
    } catch (error) {
      console.error('Resume error:', error);
      window.electronAPI?.showErrorBox('File Not Found', 'File is not present in the stored location');
    }
  }, [processQueue, updateIsUploading]);

  // Cancel an upload
  const cancelUpload = useCallback(async (fileUploadId: string, status: string): Promise<void> => {
    setIsCancelAvailable(prev => ({ ...prev, [fileUploadId]: false }));
    setIsUploading(prev => {
      const updated = { ...prev, [fileUploadId]: true };
      updateIsUploading(updated);
      return updated;
    });

    try {
      // Use ref to get current keyObj value (avoids stale closure)
      const result = await cancelDeleteFileUpload(fileUploadId, 'cancel', keyObjRef.current[fileUploadId]);
      
      setKeyObj(prev => {
        const updated = { ...prev };
        delete updated[fileUploadId];
        updateKeyObj(updated);
        return updated;
      });

      if (result.data?.success) {
        if (cancelTokenSource.current && status === 'IN_PROGRESS') {
          cancelTokenSource.current.cancel();
          cancelTokenSource.current = null;
        }
      }
    } catch (error) {
      console.error('Cancel error:', error);
    }
  }, [updateIsUploading, updateKeyObj]);

  return {
    addFilesToQueue,
    resumeUpload,
    cancelUpload,
    isUploading,
    isCancelAvailable,
    isUploadInProgress
  };
}

export default useFileUpload;
