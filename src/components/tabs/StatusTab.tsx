import React, { useState, useEffect, useCallback, useRef } from 'react';
import { fileTypeOptions, statusFilterOptions } from '../../data/mockData';
import Icon from '../Icon';
import Pagination from '../Pagination';
import { useUploadV2 } from '../../context/UploadContextV2';
import { downloadFile } from '../../utils/helpers';
import { 
    getStatusListV2, 
    retryFileUploadV2, 
    bulkDownloadV2, 
    bulkDeleteV2,
    cancelFileUploadV2,
    bulkCancelV2
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

    // Upload context to listen for part upload events
    const { onPartUploaded } = useUploadV2();

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
            console.error('Error fetching status list:', err);
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

    const handleSelectFile = (fileId: string) => {
        setSelectedFiles(prev => {
            const newSet = new Set(prev);
            if (newSet.has(fileId)) {
                newSet.delete(fileId);
            } else {
                newSet.add(fileId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedFiles.size === files.length) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(files.map(f => f._id)));
        }
    };

    const handleDownload = async () => {
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
            console.error('Error downloading files:', err);
            setError('Failed to download files. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async () => {
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
            console.error('Error deleting files:', err);
            setError('Failed to delete files. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRetry = async (fileId: string) => {
        setActionLoading(fileId);
        try {
            const response = await retryFileUploadV2(fileId);
            if (response.data?.success) {
                fetchFiles(); // Refresh the list
            }
        } catch (err) {
            console.error('Error retrying upload:', err);
            setError('Failed to retry upload. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async (fileId: string) => {
        if (!confirm('Are you sure you want to cancel this upload?')) {
            return;
        }
        
        setActionLoading(fileId);
        try {
            const response = await cancelFileUploadV2(fileId);
            if (response.data?.success) {
                fetchFiles(); // Refresh the list
            } else {
                setError('Failed to cancel upload. Please try again.');
            }
        } catch (err) {
            console.error('Error cancelling upload:', err);
            setError('Failed to cancel upload. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRestart = async (fileId: string) => {
        if (!confirm('Are you sure you want to restart this upload?')) {
            return;
        }
        
        setActionLoading(fileId);
        try {
            const response = await retryFileUploadV2(fileId);
            if (response.data?.success) {
                fetchFiles(); // Refresh the list
            } else {
                setError('Failed to restart upload. Please try again.');
            }
        } catch (err) {
            console.error('Error restarting upload:', err);
            setError('Failed to restart upload. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleSingleDownload = async (file: StatusListItem) => {
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
                console.error('Error downloading file:', err);
                setError('Failed to download file. Please try again.');
            } finally {
                setActionLoading(null);
            }
        }
    };

    const handleSingleDelete = async (fileId: string) => {
        if (!confirm('Are you sure you want to delete this file?')) {
            return;
        }
        
        setActionLoading(fileId);
        try {
            await bulkDeleteV2([fileId]);
            fetchFiles(); // Refresh the list
        } catch (err) {
            console.error('Error deleting file:', err);
            setError('Failed to delete file. Please try again.');
        } finally {
            setActionLoading(null);
        }
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (items: number) => {
        setItemsPerPage(items);
        setCurrentPage(1);
    };

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
            return (
                <>
                    <button 
                        className="action-icon retry" 
                        title="Retry" 
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

        // Handle restart and delete actions for canceled files
        if (file.actions.includes('restart') && file.actions.includes('delete')) {
            return (
                <>
                    <button 
                        className="action-icon restart" 
                        title="Restart Upload" 
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
            return (
                <button 
                    className="action-icon restart" 
                    title="Restart Upload" 
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
                    files.map(file => (
                        <div key={file._id} className={`file-row ${getStatusClass(file.upload_status)}`}>
                            <div className="checkbox-wrapper">
                                <input
                                    type="checkbox"
                                    className="file-checkbox"
                                    data-file-id={file._id}
                                    checked={selectedFiles.has(file._id)}
                                    onChange={handleFileCheckboxChange}
                                />
                            </div>
                            <div className="file-name-cell" title={file.original_file_name || file.file_name}>
                                {file.file_name}
                                {downloadingFiles.has(file._id) && (
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
                    ))
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
