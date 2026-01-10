import React, { useState, useEffect, useCallback } from 'react';
import { fileTypeOptions, statusFilterOptions } from '../../data/mockData';
import Icon from '../Icon';
import Pagination from '../Pagination';
import { useUploadV2 } from '../../context/UploadContextV2';
import { downloadFile } from '../../utils/helpers';
import { logger } from '../../utils/encryptedLogger';
import { 
    getStatusListV2, 
    retryFileUploadV2, 
    bulkDownloadV2, 
    bulkDeleteV2,
    cancelFileUploadV2,
    updateFileUploadV2,
} from '../../services/fileUploadService';
import type { StatusListItem } from '../../types';

const StatusTab: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [fileTypeFilter, setFileTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    
    // API state
    const [files, setFiles] = useState<StatusListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

    // Upload context to listen for part upload events and access resume functionality
    const { onPartUploaded, resumeUpload, addFilesToQueue, cancelUpload } = useUploadV2();

    // Fetch files from API
    const fetchFiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getStatusListV2({
                search: searchTerm || undefined,
                file_type: fileTypeFilter || undefined,
                status: statusFilter || undefined,
                limit: itemsPerPage,
                skip: (currentPage - 1) * itemsPerPage
            });
            
            if (response.data?.success) {
                setFiles(response?.data?.data?.data ?? []);
                setTotalCount(response?.data?.data?.total ?? 0);
            } else {
                setError('Failed to fetch files');
            }
        } catch (err) {
            logger.error('Error fetching status list', err as Error, {
                searchTerm,
                fileTypeFilter,
                statusFilter,
                page: currentPage,
            });
            setError('Failed to fetch files. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, fileTypeFilter, statusFilter, currentPage, itemsPerPage]);

    // Fetch files on component mount and when dependencies change
    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fileTypeFilter, statusFilter]);

    // Refresh table when a part is uploaded
    useEffect(() => {
        const unsubscribe = onPartUploaded(() => {
            fetchFiles();
        });

        return () => {
            unsubscribe();
        };
    }, [onPartUploaded, fetchFiles]);

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const handleSelectAll = useCallback(() => {
        if (selectedFiles.size === files.length) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(files.map(f => f._id)));
        }
    }, [selectedFiles, files]);

    const handleDownload = useCallback(async () => {
        if (selectedFiles.size === 0) return;
        
        setActionLoading('download');
        try {
            const response = await bulkDownloadV2(Array.from(selectedFiles));
            if (response.data?.success) {
                const downloadData = response.data.data;
                const successfulDownloads = downloadData.filter(item => item.download_url);
                
                // Mark files as downloading
                const downloadingIds = new Set(successfulDownloads.map(item => item._id));
                setDownloadingFiles(prev => {
                    const newSet = new Set(prev);
                    downloadingIds.forEach(id => newSet.add(id));
                    return newSet;
                });
                
                // Download files without opening white windows
                successfulDownloads.forEach((item) => {
                    if (item.download_url) {
                        downloadFile(item.download_url, item.file_name);
                    }
                });
                
                // Show success notification
                const fileCount = successfulDownloads.length;
                window.electronAPI?.showNotification(
                    'Download Started',
                    `${fileCount} file(s) download${fileCount > 1 ? 's' : ''} started successfully.`
                );
                
                // Clear downloading state after 3 seconds (browser download should be initiated by then)
                setTimeout(() => {
                    setDownloadingFiles(prev => {
                        const newSet = new Set(prev);
                        downloadingIds.forEach(id => newSet.delete(id));
                        return newSet;
                    });
                }, 3000);
            }
        } catch (err) {
            logger.error('Error downloading files', err as Error, {
                fileIds: Array.from(selectedFiles),
                count: selectedFiles.size,
            });
            setError('Failed to download files. Please try again.');
        } finally {
            setActionLoading(null);
        }
    }, [selectedFiles]);

    const handleDelete = useCallback(async () => {
        if (selectedFiles.size === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${selectedFiles.size} file(s)?`)) {
            return;
        }
        
        setActionLoading('delete');
        try {
            const response = await bulkDeleteV2(Array.from(selectedFiles));
            if (response.data?.success) {
                setSelectedFiles(new Set());
                fetchFiles(); // Refresh the list
            }
        } catch (err) {
            logger.error('Error deleting files', err as Error, {
                fileIds: Array.from(selectedFiles),
                count: selectedFiles.size,
            });
            setError('Failed to delete files. Please try again.');
        } finally {
            setActionLoading(null);
        }
    }, [selectedFiles, fetchFiles]);

    // Check if resume is possible for a file
    const canResume = useCallback((file: StatusListItem): boolean => {
        console.log('file', file);
        return !!(
            file.local_file_path &&
            file.aws_upload_id &&
            file.aws_key &&
            file.currentPartIndex !== undefined &&
            file.currentPartIndex > 0
        );
    }, []);

    // Helper function to add file back to queue after retry (for full restart)
    const addFileToQueueAfterRetry = useCallback(async (file: StatusListItem): Promise<void> => {
        if (!file.local_file_path) {
            logger.warn('Cannot add file to queue: local_file_path not available', {
                fileId: file._id,
                fileName: file.file_name,
            });
            return;
        }

        try {
            // Check if file exists
            if (!window.electronAPI?.getFileStats) {
                logger.warn('File system access not available', {
                    fileId: file._id,
                });
                return;
            }

            const statsResult = await window.electronAPI.getFileStats(file.local_file_path);
            if (!statsResult.success || !statsResult.exists) {
                logger.warn('File not found at stored location', {
                    fileId: file._id,
                    filePath: file.local_file_path,
                });
                window.electronAPI?.showErrorBox(
                    'File Not Found',
                    `File is not present at: ${file.local_file_path}`
                );
                return;
            }

            // Note: We'll handle large files by using optimized chunked conversion
            // No size limit - we'll process files of any size using memory-efficient methods

            // For full restart, we need to initiate a NEW multipart upload
            // The old uploadId might be invalid if the upload was aborted
            // Use resumeUpload which will handle reading the file and initiating a new upload if needed
            // Note: resumeUpload will read the file itself, so we don't need to read it here
            // This avoids reading the file twice and prevents memory issues with large files
            
            if (file.aws_upload_id && file.aws_key) {
                try {
                    // Try to resume with existing uploadId - resumeUpload will handle file reading
                    // If uploadId is invalid, resumeUpload will initiate a new multipart upload
                    await resumeUpload({
                        fileUploadId: file._id,
                        fileName: file.file_name,
                        filePath: file.local_file_path,
                        uploadId: file.aws_upload_id,
                        key: file.aws_key,
                        currentPartIndex: 0, // Start from beginning
                    });
                } catch (resumeError) {
                    // If resume fails, log the error and re-throw so caller can handle it
                    logger.error('Resume failed in addFileToQueueAfterRetry', resumeError as Error, {
                        fileId: file._id,
                        fileName: file.file_name,
                        filePath: file.local_file_path,
                        uploadId: file.aws_upload_id,
                    });
                    // Re-throw so the caller can show appropriate error message
                    throw resumeError;
                }
            } else {
                // No aws_upload_id - cannot resume, need new upload
                logger.warn('No aws_upload_id found, cannot add to queue. File needs to be re-uploaded', {
                    fileId: file._id,
                    fileName: file.file_name,
                });
                window.electronAPI?.showErrorBox(
                    'Cannot Resume',
                    'Cannot resume upload: multipart upload information is missing. Please re-upload the file.'
                );
                throw new Error('Cannot resume upload: multipart upload information is missing.');
            }
        } catch (error) {
            logger.error('Error adding file to queue after retry', error as Error, {
                fileId: file._id,
                fileName: file.file_name,
            });
            // Update status to ERROR in database before re-throwing
            try {
                await updateFileUploadV2(file._id, {
                    status: 'ERROR',
                });
            } catch (updateError) {
                logger.error('Failed to update status to ERROR in addFileToQueueAfterRetry', updateError as Error, {
                    fileId: file._id,
                });
            }
            // Re-throw to let the caller handle it
            throw error;
        }
    }, [resumeUpload]);

    const handleRetry = useCallback(async (fileId: string) => {
        setActionLoading(fileId);
        try {
            const file = files.find(f => f._id === fileId);
            if (!file) {
                setError('File not found.');
                setActionLoading(null);
                return;
            }

            // For cancelled files, always call retry API first to reset status
            // Then resume or restart based on whether resume is possible
            const isCancelled = file.upload_status === 'CANCEL';
            
            if (isCancelled) {
                // Call retry API first to reset status
                const response = await retryFileUploadV2(fileId);
                if (!response.data?.success) {
                    setError('Failed to retry upload. Please try again.');
                    return;
                }
                
                // Refresh the list to get updated file data
                await fetchFiles();
                
                // Get the updated file data after refresh
                const updatedFilesResponse = await getStatusListV2({
                    search: searchTerm || undefined,
                    file_type: fileTypeFilter || undefined,
                    status: statusFilter || undefined,
                    limit: itemsPerPage,
                    skip: (currentPage - 1) * itemsPerPage
                });
                
                const updatedFile = updatedFilesResponse.data?.data?.data?.find(f => f._id === fileId) || file;
                
                // Check if resume is possible after retry
                if (canResume(updatedFile)) {
                    // Use resume functionality
                    try {
                        await resumeUpload({
                            fileUploadId: updatedFile._id,
                            fileName: updatedFile.file_name,
                            filePath: updatedFile.local_file_path!,
                            uploadId: updatedFile.aws_upload_id!,
                            key: updatedFile.aws_key!,
                            currentPartIndex: updatedFile.currentPartIndex || 0,
                        });
                        window.electronAPI?.showNotification(
                            'Upload Resumed',
                            `Resuming upload for ${updatedFile.file_name} from part ${updatedFile.currentPartIndex}`
                        );
                    } catch (resumeError) {
                        logger.error('Error resuming upload after retry', resumeError as Error, {
                            fileId: updatedFile._id,
                            fileName: updatedFile.file_name,
                        });
                        // Update status to ERROR in database
                        try {
                            await updateFileUploadV2(updatedFile._id, {
                                status: 'ERROR',
                            });
                        } catch (updateError) {
                            logger.error('Failed to update status to ERROR', updateError as Error, {
                                fileId: updatedFile._id,
                            });
                        }
                        setError('Failed to resume upload. File may not be available locally.');
                    }
                } else {
                    // Full restart - add to queue
                    if (updatedFile.local_file_path && updatedFile.aws_upload_id && updatedFile.aws_key) {
                        try {
                            await addFileToQueueAfterRetry(updatedFile);
                            window.electronAPI?.showNotification(
                                'Upload Retried',
                                `Retrying upload for ${updatedFile.file_name}`
                            );
                        } catch (queueError) {
                            logger.error('Error adding file to queue after retry', queueError as Error, {
                                fileId: updatedFile._id,
                                fileName: updatedFile.file_name,
                            });
                            // Update status to ERROR in database
                            try {
                                await updateFileUploadV2(updatedFile._id, {
                                    status: 'ERROR',
                                });
                            } catch (updateError) {
                                logger.error('Failed to update status to ERROR', updateError as Error, {
                                    fileId: updatedFile._id,
                                });
                            }
                            setError('Failed to add file to queue. The multipart upload may have been aborted. Please try again.');
                        }
                    } else {
                        window.electronAPI?.showNotification(
                            'Upload Retried',
                            `Retrying upload for ${updatedFile.file_name}`
                        );
                    }
                }
            } else {
                // For non-cancelled files (ERROR, STALLED), check if resume is possible
                if (canResume(file)) {
                    // Use resume functionality directly
                    try {
                        await resumeUpload({
                            fileUploadId: file._id,
                            fileName: file.file_name,
                            filePath: file.local_file_path!,
                            uploadId: file.aws_upload_id!,
                            key: file.aws_key!,
                            currentPartIndex: file.currentPartIndex || 0,
                        });
                        fetchFiles(); // Refresh the list
                        window.electronAPI?.showNotification(
                            'Upload Resumed',
                            `Resuming upload for ${file.file_name} from part ${file.currentPartIndex}`
                        );
                    } catch (resumeError) {
                        console.error('Error resuming upload:', resumeError);
                        // Update status to ERROR in database
                        try {
                            await updateFileUploadV2(file._id, {
                                status: 'ERROR',
                            });
                        } catch (updateError) {
                            logger.error('Failed to update status to ERROR', updateError as Error, {
                                fileId: file._id,
                            });
                        }
                        setError('Failed to resume upload. File may not be available locally.');
                    }
                } else {
                    // Use retry API (full restart) and add to queue
                    const response = await retryFileUploadV2(fileId);
                    if (response.data?.success) {
                        // Refresh the list to get updated file data
                        await fetchFiles();
                        
                        // Try to add file back to queue if we have the required data
                        if (file.local_file_path && file.aws_upload_id && file.aws_key) {
                            try {
                                await addFileToQueueAfterRetry(file);
                                window.electronAPI?.showNotification(
                                    'Upload Retried',
                                    `Retrying upload for ${file.file_name}`
                                );
                            } catch (queueError) {
                                console.error('Error adding file to queue:', queueError);
                                // Update status to ERROR in database
                                try {
                                    await updateFileUploadV2(file._id, {
                                        status: 'ERROR',
                                    });
                                } catch (updateError) {
                                    logger.error('Failed to update status to ERROR', updateError as Error, {
                                        fileId: file._id,
                                    });
                                }
                                setError('Failed to add file to queue. The multipart upload may have been aborted. Please try again.');
                            }
                        } else {
                            window.electronAPI?.showNotification(
                                'Upload Retried',
                                `Retrying upload for ${file.file_name}`
                            );
                        }
                    } else {
                        setError('Failed to retry upload. Please try again.');
                    }
                }
            }
        } catch (err) {
            const file = files.find(f => f._id === fileId);
            logger.error('Error retrying upload', err as Error, {
                fileId: fileId,
                fileName: file?.file_name || 'unknown',
                errorMessage: err instanceof Error ? err.message : String(err),
                errorStack: err instanceof Error ? err.stack : undefined,
            });
            
            // Update status to ERROR in database
            if (file) {
                try {
                    await updateFileUploadV2(fileId, {
                        status: 'ERROR',
                    });
                } catch (updateError) {
                    logger.error('Failed to update status to ERROR', updateError as Error, {
                        fileId: fileId,
                    });
                }
            }
            
            // Show user-friendly error message
            const errorMessage = err instanceof Error 
                ? err.message 
                : 'Failed to retry upload. Please try again.';
            
            setError(errorMessage);
            
            // Show error notification
            window.electronAPI?.showErrorBox(
                'Retry Failed',
                errorMessage
            );
        } finally {
            setActionLoading(null);
        }
    }, [files, fetchFiles, canResume, resumeUpload, addFileToQueueAfterRetry, searchTerm, fileTypeFilter, statusFilter, currentPage, itemsPerPage]);

    const handleCancel = useCallback(async (fileId: string) => {
        if (!confirm('Are you sure you want to cancel this upload?')) {
            return;
        }
        
        setActionLoading(fileId);
        try {
            const file = files.find(f => f._id === fileId);
            if (!file) {
                setError('File not found.');
                return;
            }

            // Use context's cancelUpload which:
            // 1. Sets cancel flag to stop further parts (after current part finishes and saves tag)
            // 2. Cancels ongoing chunk upload token
            // 3. Removes file from queue to prevent further parts
            // 4. Updates DB status to CANCEL via API
            await cancelUpload(fileId, file.upload_status);
            
            // Refresh the list to show updated status
            fetchFiles();
            
            window.electronAPI?.showNotification(
                'Upload Cancelled',
                `Upload cancelled for ${file.file_name}. Current part will finish and save its tag.`
            );
        } catch (err) {
            const file = files.find(f => f._id === fileId);
            logger.error('Error cancelling upload', err as Error, {
                fileId: fileId,
                fileName: file?.file_name || 'unknown',
            });
            setError('Failed to cancel upload. Please try again.');
        } finally {
            setActionLoading(null);
        }
    }, [fetchFiles, files, cancelUpload]);

    const handleRestart = useCallback(async (fileId: string) => {
        if (!confirm('Are you sure you want to restart this upload?')) {
            return;
        }
        
        setActionLoading(fileId);
        try {
            const file = files.find(f => f._id === fileId);
            if (!file) {
                setError('File not found.');
                return;
            }

            // For cancelled files, always call retry API first to reset status
            const isCancelled = file.upload_status === 'CANCEL';
            
            if (isCancelled) {
                // Call retry API first to reset status
                const response = await retryFileUploadV2(fileId);
                if (!response.data?.success) {
                    setError('Failed to restart upload. Please try again.');
                    return;
                }
                
                // Refresh the list to get updated file data
                await fetchFiles();
                
                // Get the updated file data after refresh
                const updatedFilesResponse = await getStatusListV2({
                    search: searchTerm || undefined,
                    file_type: fileTypeFilter || undefined,
                    status: statusFilter || undefined,
                    limit: itemsPerPage,
                    skip: (currentPage - 1) * itemsPerPage
                });
                
                const updatedFile = updatedFilesResponse.data?.data?.data?.find(f => f._id === fileId) || file;
                
                // Check if resume is possible after retry
                console.log('updatedFile', updatedFile, canResume(updatedFile));
                if (canResume(updatedFile)) {
                    // Use resume functionality
                    try {
                        await resumeUpload({
                            fileUploadId: updatedFile._id,
                            fileName: updatedFile.file_name,
                            filePath: updatedFile.local_file_path!,
                            uploadId: updatedFile.aws_upload_id!,
                            key: updatedFile.aws_key!,
                            currentPartIndex: updatedFile.currentPartIndex || 0,
                        });
                        window.electronAPI?.showNotification(
                            'Upload Resumed',
                            `Resuming upload for ${updatedFile.file_name} from part ${updatedFile.currentPartIndex}`
                        );
                    } catch (resumeError) {
                        logger.error('Error resuming upload after restart', resumeError as Error, {
                            fileId: updatedFile._id,
                            fileName: updatedFile.file_name,
                        });
                        // Update status to ERROR in database
                        try {
                            await updateFileUploadV2(updatedFile._id, {
                                status: 'ERROR',
                            });
                        } catch (updateError) {
                            logger.error('Failed to update status to ERROR', updateError as Error, {
                                fileId: updatedFile._id,
                            });
                        }
                        setError('Failed to resume upload. File may not be available locally.');
                    }
                } else {
                    // Full restart - add to queue
                    if (updatedFile.local_file_path && updatedFile.aws_upload_id && updatedFile.aws_key) {
                        try {
                            await addFileToQueueAfterRetry(updatedFile);
                            window.electronAPI?.showNotification(
                                'Upload Restarted',
                                `Restarting upload for ${updatedFile.file_name}`
                            );
                        } catch (queueError) {
                            logger.error('Error adding file to queue after restart', queueError as Error, {
                                fileId: updatedFile._id,
                                fileName: updatedFile.file_name,
                            });
                            // Update status to ERROR in database
                            try {
                                await updateFileUploadV2(updatedFile._id, {
                                    status: 'ERROR',
                                });
                            } catch (updateError) {
                                logger.error('Failed to update status to ERROR', updateError as Error, {
                                    fileId: updatedFile._id,
                                });
                            }
                            setError('Failed to add file to queue. The multipart upload may have been aborted. Please try again.');
                        }
                    } else {
                        window.electronAPI?.showNotification(
                            'Upload Restarted',
                            `Restarting upload for ${updatedFile.file_name}`
                        );
                    }
                }
            } else {
                // For non-cancelled files, check if resume is possible
                if (canResume(file)) {
                    // Use resume functionality directly
                    try {
                        await resumeUpload({
                            fileUploadId: file._id,
                            fileName: file.file_name,
                            filePath: file.local_file_path!,
                            uploadId: file.aws_upload_id!,
                            key: file.aws_key!,
                            currentPartIndex: file.currentPartIndex || 0,
                        });
                        fetchFiles(); // Refresh the list
                        window.electronAPI?.showNotification(
                            'Upload Resumed',
                            `Resuming upload for ${file.file_name} from part ${file.currentPartIndex}`
                        );
                    } catch (resumeError) {
                        console.error('Error resuming upload:', resumeError);
                        setError('Failed to resume upload. File may not be available locally.');
                    }
                } else {
                    // Use retry API (full restart) and add to queue
                    const response = await retryFileUploadV2(fileId);
                    if (response.data?.success) {
                        // Refresh the list to get updated file data
                        await fetchFiles();
                        
                        // Try to add file back to queue if we have the required data
                        if (file.local_file_path && file.aws_upload_id && file.aws_key) {
                            try {
                                await addFileToQueueAfterRetry(file);
                                window.electronAPI?.showNotification(
                                    'Upload Restarted',
                                    `Restarting upload for ${file.file_name}`
                                );
                            } catch (queueError) {
                                console.error('Error adding file to queue:', queueError);
                                // Update status to ERROR in database
                                try {
                                    await updateFileUploadV2(file._id, {
                                        status: 'ERROR',
                                    });
                                } catch (updateError) {
                                    logger.error('Failed to update status to ERROR', updateError as Error, {
                                        fileId: file._id,
                                    });
                                }
                                setError('Failed to add file to queue. The multipart upload may have been aborted. Please try again.');
                            }
                        } else {
                            window.electronAPI?.showNotification(
                                'Upload Restarted',
                                `Restarting upload for ${file.file_name}`
                            );
                        }
                    } else {
                        setError('Failed to restart upload. Please try again.');
                    }
                }
            }
        } catch (err) {
            const file = files.find(f => f._id === fileId);
            logger.error('Error restarting upload', err as Error, {
                fileId: fileId,
                fileName: file?.file_name || 'unknown',
            });
            // Update status to ERROR in database
            if (file) {
                try {
                    await updateFileUploadV2(fileId, {
                        status: 'ERROR',
                    });
                } catch (updateError) {
                    logger.error('Failed to update status to ERROR', updateError as Error, {
                        fileId: fileId,
                    });
                }
            }
            setError('Failed to restart upload. Please try again.');
        } finally {
            setActionLoading(null);
        }
    }, [files, fetchFiles, canResume, resumeUpload, addFileToQueueAfterRetry]);

    const handleSingleDownload = useCallback(async (file: StatusListItem) => {
        if (file.download_url) {
            // Mark file as downloading
            setDownloadingFiles(prev => new Set(prev).add(file._id));
            
            downloadFile(file.download_url, file.file_name);
            window.electronAPI?.showNotification(
                'Download Started',
                `Download started for ${file.file_name}`
            );
            
            // Clear downloading state after 3 seconds
            setTimeout(() => {
                setDownloadingFiles(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(file._id);
                    return newSet;
                });
            }, 3000);
        } else if (file.aws_key) {
            setActionLoading(file._id);
            try {
                const response = await bulkDownloadV2([file._id]);
                if (response.data?.success && response.data.data[0]?.download_url) {
                    // Mark file as downloading
                    setDownloadingFiles(prev => new Set(prev).add(file._id));
                    
                    downloadFile(response.data.data[0].download_url, file.file_name);
                    window.electronAPI?.showNotification(
                        'Download Started',
                        `Download started for ${file.file_name}`
                    );
                    
                    // Clear downloading state after 3 seconds
                    setTimeout(() => {
                        setDownloadingFiles(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(file._id);
                            return newSet;
                        });
                    }, 3000);
                }
            } catch (err) {
                logger.error('Error downloading file', err as Error, {
                    fileId: file._id,
                    fileName: file.file_name,
                });
                setError('Failed to download file. Please try again.');
            } finally {
                setActionLoading(null);
            }
        }
    }, []);

    const handleSingleDelete = useCallback(async (fileId: string) => {
        if (!confirm('Are you sure you want to delete this file?')) {
            return;
        }
        
        setActionLoading(fileId);
        try {
            await bulkDeleteV2([fileId]);
            fetchFiles(); // Refresh the list
        } catch (err) {
            logger.error('Error deleting file', err as Error, {
                fileId,
            });
            setError('Failed to delete file. Please try again.');
        } finally {
            setActionLoading(null);
        }
    }, [fetchFiles]);

    const handlePageChange = useCallback((page: number) => {
        setCurrentPage(page);
    }, []);

    const handleItemsPerPageChange = useCallback((items: number) => {
        setItemsPerPage(items);
        setCurrentPage(1);
    }, []);

    // Memoized handlers for JSX props
    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }, []);

    const handleFileTypeFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setFileTypeFilter(e.target.value);
    }, []);

    const handleStatusFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setStatusFilter(e.target.value);
    }, []);

    const handleClearError = useCallback(() => {
        setError(null);
    }, []);

    const handleFileCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const fileId = e.target.dataset.fileId;
        if (fileId) {
            setSelectedFiles(prev => {
                const newSet = new Set(prev);
                if (newSet.has(fileId)) {
                    newSet.delete(fileId);
                } else {
                    newSet.add(fileId);
                }
                return newSet;
            });
        }
    }, []);

    const handleSingleDownloadClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const fileId = e.currentTarget.dataset.fileId;
        if (fileId) {
            const file = files.find(f => f._id === fileId);
            if (file) {
                handleSingleDownload(file);
            }
        }
    }, [files, handleSingleDownload]);

    const handleSingleDeleteClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const fileId = e.currentTarget.dataset.fileId;
        if (fileId) {
            handleSingleDelete(fileId);
        }
    }, [handleSingleDelete]);

    const handleRetryClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const fileId = e.currentTarget.dataset.fileId;
        if (fileId) {
            handleRetry(fileId);
        }
    }, [handleRetry]);

    const handleCancelClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const fileId = e.currentTarget.dataset.fileId;
        if (fileId) {
            handleCancel(fileId);
        }
    }, [handleCancel]);

    const handleRestartClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const fileId = e.currentTarget.dataset.fileId;
        if (fileId) {
            handleRestart(fileId);
        }
    }, [handleRestart]);

    // Map API status to UI status
    const getStatusClass = (status: string): string => {
        switch (status) {
            case 'COMPLETED':
                return 'status-completed';
            case 'IN_PROGRESS':
            case 'NEW':
            case 'RETRIED_IN_PROGRESS':
                return 'status-in_progress';
            case 'ERROR':
            case 'STALLED':
            case 'COMPLETED_WITH_ERROR':
                return 'status-failed';
            case 'CANCEL':
            case 'DELETED':
                return 'status-cancelled';
            default:
                return '';
        }
    };

    const renderActionIcons = (file: StatusListItem) => {
        const isLoading = actionLoading === file._id;
        const isDownloading = downloadingFiles.has(file._id);
        
        if (file.actions.includes('download') && file.actions.includes('delete')) {
            return (
                <>
                    <button 
                        className="action-icon download" 
                        title={isDownloading ? "Downloading..." : "Download"}
                        data-file-id={file._id}
                        onClick={handleSingleDownloadClick}
                        disabled={isLoading || isDownloading}
                    >
                        {isDownloading ? (
                            <span style={{ fontSize: '12px', color: '#007bff' }}>⏳</span>
                        ) : (
                            <Icon name="download" size={20} color="primary" />
                        )}
                    </button>
                    <button 
                        className="action-icon delete" 
                        title="Delete"
                        data-file-id={file._id}
                        onClick={handleSingleDeleteClick}
                        disabled={isLoading}
                    >
                        <Icon name="trash" size={20} color="danger" />
                    </button>
                </>
            );
        }

        if (file.actions.includes('retry') && file.actions.includes('cancel')) {
            const canResumeFile = canResume(file);
            return (
                <>
                    <button 
                        className="action-icon retry" 
                        title={canResumeFile ? "Resume Upload" : "Retry Upload"} 
                        data-file-id={file._id}
                        onClick={handleRetryClick}
                        disabled={isLoading}
                    >
                        <Icon name="refresh" size={20} color="primary" />
                    </button>
                    <button 
                        className="action-icon cancel" 
                        title="Cancel" 
                        data-file-id={file._id}
                        onClick={handleCancelClick}
                        disabled={isLoading}
                    >
                        <Icon name="close" size={16} color="danger" />
                    </button>
                </>
            );
        }

        // Handle restart/resume and delete actions for canceled files
        if (file.actions.includes('restart') && file.actions.includes('delete')) {
            const canResumeFile = canResume(file);
            return (
                <>
                    <button 
                        className="action-icon restart" 
                        title={canResumeFile ? "Resume Upload" : "Restart Upload"} 
                        data-file-id={file._id}
                        onClick={handleRestartClick}
                        disabled={isLoading}
                    >
                        <Icon name="refresh" size={20} color="primary" />
                    </button>
                    <button 
                        className="action-icon delete" 
                        title="Delete"
                        data-file-id={file._id}
                        onClick={handleSingleDeleteClick}
                        disabled={isLoading}
                    >
                        <Icon name="trash" size={20} color="danger" />
                    </button>
                </>
            );
        }

        if (file.actions.includes('restart')) {
            const canResumeFile = canResume(file);
            return (
                <button 
                    className="action-icon restart" 
                    title={canResumeFile ? "Resume Upload" : "Restart Upload"} 
                    data-file-id={file._id}
                    onClick={handleRestartClick}
                    disabled={isLoading}
                >
                    <Icon name="refresh" size={20} color="primary" />
                </button>
            );
        }

        if (file.actions.includes('cancel')) {
            return (
                <button 
                    className="action-icon cancel" 
                    title="Cancel" 
                    data-file-id={file._id}
                    onClick={handleCancelClick}
                    disabled={isLoading}
                >
                    <Icon name="close" size={16} color="danger" />
                </button>
            );
        }

        if (file.actions.includes('delete')) {
            return (
                <button 
                    className="action-icon delete" 
                    title="Delete"
                    data-file-id={file._id}
                    onClick={handleSingleDeleteClick}
                    disabled={isLoading}
                >
                    <Icon name="trash" size={20} color="danger" />
                </button>
            );
        }

        return null;
    };

    return (
        <div>
            <div className="controls-row">
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by Filename.."
                        value={searchTerm}
                        onChange={handleSearchChange}
                    />
                </div>
                <div className="filter-select-wrapper">
                    <select
                        className="filter-select"
                        value={fileTypeFilter}
                        onChange={handleFileTypeFilterChange}
                    >
                        {fileTypeOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-select-wrapper">
                    <select
                        className="filter-select"
                        value={statusFilter}
                        onChange={handleStatusFilterChange}
                    >
                        {statusFilterOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div className="controls-spacer" />
                <div className="action-buttons-group">
                    <button 
                        className="btn btn-primary" 
                        onClick={handleDownload}
                        disabled={selectedFiles.size === 0 || actionLoading === 'download'}
                    >
                        <Icon name="download" size={16} color="white" />
                        {actionLoading === 'download' ? 'Downloading...' : 'Download'}
                    </button>
                    <button 
                        className="btn btn-danger" 
                        onClick={handleDelete}
                        disabled={selectedFiles.size === 0 || actionLoading === 'delete'}
                    >
                        <Icon name="trash" size={16} color="white" />
                        {actionLoading === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="wizard-error">
                    {error}
                    <button onClick={handleClearError}>×</button>
                </div>
            )}

            <div className="table-header">
                <span>
                    <input
                        type="checkbox"
                        checked={files.length > 0 && selectedFiles.size === files.length}
                        onChange={handleSelectAll}
                    />
                </span>
                <span>File Name</span>
                <span style={{ textAlign: 'center' }}>Action</span>
                <span style={{ textAlign: 'right' }}>Size</span>
            </div>

            <div className="file-list-container">
                {loading ? (
                    <div className="loading-state" style={{ padding: '20px', textAlign: 'center' }}>
                        Loading...
                    </div>
                ) : (
                    files.map(file => {
                        const isRowProcessing = actionLoading === file._id;
                        return (
                            <div 
                                key={file._id} 
                                className={`file-row ${getStatusClass(file.upload_status)} ${isRowProcessing ? 'row-processing' : ''}`}
                                style={isRowProcessing ? { opacity: 0.6, pointerEvents: 'none' } : {}}
                            >
                                <div className="checkbox-wrapper">
                                    <input
                                        type="checkbox"
                                        className="file-checkbox"
                                        data-file-id={file._id}
                                        checked={selectedFiles.has(file._id)}
                                        onChange={handleFileCheckboxChange}
                                        disabled={isRowProcessing}
                                    />
                                </div>
                                <div className="file-name-cell" title={file.original_file_name || file.file_name}>
                                    {file.file_name}
                                    {isRowProcessing && (
                                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#007bff', display: 'inline-flex', alignItems: 'center' }}>
                                            <span style={{ 
                                                display: 'inline-block', 
                                                width: '12px', 
                                                height: '12px', 
                                                border: '2px solid #007bff', 
                                                borderTopColor: 'transparent', 
                                                borderRadius: '50%', 
                                                animation: 'spin 0.8s linear infinite',
                                                marginRight: '4px'
                                            }}></span>
                                            Processing...
                                        </span>
                                    )}
                                    {downloadingFiles.has(file._id) && !isRowProcessing && (
                                        <span style={{ marginLeft: '8px', fontSize: '12px', color: '#007bff' }}>
                                            (Downloading...)
                                        </span>
                                    )}
                                </div>
                                <div className="action-icons">
                                    {renderActionIcons(file)}
                                </div>
                                <div className="size-cell">
                                    {file.upload_status === 'IN_PROGRESS' || file.upload_status === 'RETRIED_IN_PROGRESS' 
                                        ? file.file_progress 
                                        : (file.file_size_display || file.file_size)}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {!loading && files.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📁</div>
                    <p className="empty-state-text">No files found</p>
                </div>
            )}

            {!loading && totalCount > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalCount}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                />
            )}
        </div>
    );
};

export default StatusTab;
