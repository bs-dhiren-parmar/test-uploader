import React, { useState, useEffect, useCallback } from 'react';
import { fileTypeOptions } from '../../data/mockData';
import Icon from '../Icon';
import Pagination from '../Pagination';
import { downloadFile } from '../../utils/helpers';
import { getAssociationListV2, bulkDownloadV2, bulkDeleteV2 } from '../../services/fileUploadService';
import type { AssociationListItem } from '../../types';

const FileAssociationTab: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [fileTypeFilter, setFileTypeFilter] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    
    // API state
    const [files, setFiles] = useState<AssociationListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());

    // Sorting state
    const [sortField, setSortField] = useState<string>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Helper function to get column index for sorting
    const getColumnIndex = (field: string): number => {
        const columns = ['file_name', 'original_file_name', 'upload_status', 'patient_mrn', 'visit_id', 'sample_id', 'created_at', 'upload_completed_at'];
        return columns.indexOf(field);
    };

    // Fetch files from API
    const fetchFiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, unknown> = {
                search: searchTerm ? { value: searchTerm } : undefined,
                file_type: fileTypeFilter || undefined,
                start: (currentPage - 1) * itemsPerPage,
                length: itemsPerPage,
                columns: [
                    { data: 'file_name' },
                    { data: 'original_file_name' },
                    { data: 'upload_status' },
                    { data: 'patient_mrn' },
                    { data: 'visit_id' },
                    { data: 'sample_id' },
                    { data: 'created_at' },
                    { data: 'upload_completed_at' }
                ],
                order: [{ column: getColumnIndex(sortField), dir: sortDirection }]
            };
            
            // Remove undefined values
            Object.keys(params).forEach(key => {
                if (params[key] === undefined) {
                    delete params[key];
                }
            });
            
            const response = await getAssociationListV2(params);
            
            if (response) {
                setFiles(response.data);
                setTotalCount(response.recordsTotal);
            }
        } catch (err) {
            console.error('Error fetching association list:', err);
            setError('Failed to fetch files. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, fileTypeFilter, currentPage, itemsPerPage, sortField, sortDirection]);

    // Fetch files on component mount and when dependencies change
    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, fileTypeFilter]);

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
            console.error('Error downloading files:', err);
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
                fetchFiles();
            }
        } catch (err) {
            console.error('Error deleting files:', err);
            setError('Failed to delete files. Please try again.');
        } finally {
            setActionLoading(null);
        }
    }, [selectedFiles, fetchFiles]);

    const handleSingleDownload = useCallback(async (file: AssociationListItem) => {
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
    }, []);

    const handleSingleDelete = useCallback(async (fileId: string) => {
        if (!confirm('Are you sure you want to delete this file?')) {
            return;
        }
        
        setActionLoading(fileId);
        try {
            await bulkDeleteV2([fileId]);
            fetchFiles();
        } catch (err) {
            console.error('Error deleting file:', err);
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

    const handleClearError = useCallback(() => {
        setError(null);
    }, []);

    const handleSortFileName = useCallback(() => {
        if (sortField === 'file_name') {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField('file_name');
            setSortDirection('asc');
        }
    }, [sortField, sortDirection]);

    const handleSortUploadStatus = useCallback(() => {
        if (sortField === 'upload_status') {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField('upload_status');
            setSortDirection('asc');
        }
    }, [sortField, sortDirection]);

    const handleSortCreatedAt = useCallback(() => {
        if (sortField === 'created_at') {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField('created_at');
            setSortDirection('asc');
        }
    }, [sortField, sortDirection]);

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

    // Get status display class
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
            default:
                return '';
        }
    };

    // Truncate file name for display
    const truncateFileName = (name: string, maxLength = 20): string => {
        if (!name) return '-';
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength) + '...';
    };

    return (
        <div>
            <div className="controls-row">
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by Filename, MRN, Visit ID..."
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
                <div className="error-message" style={{ color: 'red', padding: '10px', marginBottom: '10px' }}>
                    {error}
                    <button onClick={handleClearError} style={{ marginLeft: '10px' }}>✕</button>
                </div>
            )}

            <div className="table-header table-header-association">
                <span>
                    <input
                        type="checkbox"
                        checked={files.length > 0 && selectedFiles.size === files.length}
                        onChange={handleSelectAll}
                    />
                </span>
                <span 
                    className="sortable-header" 
                    onClick={handleSortFileName}
                    style={{ cursor: 'pointer' }}
                >
                    File Name {sortField === 'file_name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
                <span>Original File Name</span>
                <span 
                    className="sortable-header" 
                    onClick={handleSortUploadStatus}
                    style={{ cursor: 'pointer' }}
                >
                    Status {sortField === 'upload_status' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
                <span>Patient MRN</span>
                <span>Visit ID</span>
                <span>Sample ID</span>
                <span 
                    className="sortable-header" 
                    onClick={handleSortCreatedAt}
                    style={{ cursor: 'pointer' }}
                >
                    Created at {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                </span>
                <span>Uploaded At</span>
                <span>Action</span>
            </div>

            <div className="file-list-container">
                {loading ? (
                    <div className="loading-state" style={{ padding: '20px', textAlign: 'center' }}>
                        Loading...
                    </div>
                ) : (
                    files.map(file => (
                        <div 
                            key={file._id} 
                            className={`file-row file-row-association ${selectedFiles.has(file._id) ? 'row-selected' : ''} ${getStatusClass(file.upload_status)}`}
                        >
                            <div className="checkbox-wrapper">
                                <input
                                    type="checkbox"
                                    className="file-checkbox"
                                    data-file-id={file._id}
                                    checked={selectedFiles.has(file._id)}
                                    onChange={handleFileCheckboxChange}
                                />
                            </div>
                            <div className="table-cell" title={file.file_name}>
                                {truncateFileName(file.file_name)}
                                {downloadingFiles.has(file._id) && (
                                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#007bff' }}>
                                        (Downloading...)
                                    </span>
                                )}
                            </div>
                            <div className="table-cell" title={file.original_file_name}>
                                {truncateFileName(file.original_file_name)}
                            </div>
                            <div className={`table-cell status ${getStatusClass(file.upload_status)}`}>
                                {file.upload_status}
                            </div>
                            <div className="table-cell patient-mrn">
                                {file.patient_name && file.patient_mrn && file.patient_mrn !== '-' ? (
                                    <>
                                        {file.patient_name}<br />
                                        {file.patient_mrn}
                                    </>
                                ) : (file.patient_mrn || '-')}
                            </div>
                            <div className="table-cell visit-id">{file.visit_id || '-'}</div>
                            <div className="table-cell">{file.sample_id || '-'}</div>
                            <div className="table-cell">{file.created_at_display || file.created_at || '-'}</div>
                            <div className="table-cell">{file.upload_completed_at_display || file.upload_completed_at || '-'}</div>
                            <div className="action-icons">
                                {file.upload_status === 'COMPLETED' && (
                                    <>
                                        <button 
                                            className="action-icon download" 
                                            title={downloadingFiles.has(file._id) ? "Downloading..." : "Download"}
                                            data-file-id={file._id}
                                            onClick={handleSingleDownloadClick}
                                            disabled={actionLoading === file._id || downloadingFiles.has(file._id)}
                                        >
                                            {downloadingFiles.has(file._id) ? (
                                                <span style={{ fontSize: '12px', color: '#007bff' }}>⏳</span>
                                            ) : (
                                                <Icon name="download" size={18} />
                                            )}
                                        </button>
                                        <button 
                                            className="action-icon delete" 
                                            title="Delete"
                                            data-file-id={file._id}
                                            onClick={handleSingleDeleteClick}
                                            disabled={actionLoading === file._id}
                                        >
                                            <Icon name="trash" size={18} />
                                        </button>
                                    </>
                                )}
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

export default FileAssociationTab;
