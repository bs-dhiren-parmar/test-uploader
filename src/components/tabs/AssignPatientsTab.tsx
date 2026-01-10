import React, { useState, useEffect, useCallback } from 'react';
import { fileTypeOptions } from '../../data/mockData';
import AssignPatientsModal from '../modals/AssignPatientsModal';
import Pagination from '../Pagination';
import { getAssignListV2, bulkAssignPatientV2 } from '../../services/fileUploadService';
import { logger } from '../../utils/encryptedLogger';
import type { AssignListItem } from '../../types';

const AssignPatientsTab: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [fileTypeFilter, setFileTypeFilter] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    
    // API state
    const [files, setFiles] = useState<AssignListItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Fetch files from API
    const fetchFiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getAssignListV2({
                search: searchTerm || undefined,
                file_type: fileTypeFilter || undefined,
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
            logger.error('Error fetching assign list', err as Error, {
                searchTerm,
                fileTypeFilter,
                page: currentPage,
            });
            setError('Failed to fetch files. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, fileTypeFilter, currentPage, itemsPerPage]);

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

    const handleAssign = useCallback(() => {
        if (selectedFiles.size > 0) {
            setIsModalOpen(true);
        }
    }, [selectedFiles]);

    const handleModalClose = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const handleModalSubmit = useCallback(async (data: { patientId: string; visitId: string; sampleId: string }) => {
        setSubmitting(true);
        setError(null);
        
        try {
            const response = await bulkAssignPatientV2(
                Array.from(selectedFiles),
                {
                    patient_id: data.patientId,
                    visit_id: data.visitId || undefined,
                    sample_id: data.sampleId || undefined
                }
            );
            
            if (response.data?.success) {
                setIsModalOpen(false);
                setSelectedFiles(new Set());
                fetchFiles(); // Refresh the list - assigned files should no longer appear
            } else {
                setError('Failed to assign patient. Please try again.');
            }
        } catch (err) {
            logger.error('Error assigning patient', err as Error, {
                fileIds: Array.from(selectedFiles),
                patientId: assignData.patient_id,
                sampleId: assignData.sample_id,
            });
            setError('Failed to assign patient. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }, [selectedFiles, fetchFiles]);

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

    // Format file size for display
    const formatFileSize = (bytes: string | number): string => {
        const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
        if (isNaN(numBytes) || numBytes === 0) return '-';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(numBytes) / Math.log(k));
        return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
                <div className="controls-spacer" />
                <div className="action-buttons-group">
                    <button 
                        className="btn btn-primary" 
                        onClick={handleAssign}
                        disabled={selectedFiles.size === 0 || submitting}
                    >
                        {submitting ? 'Assigning...' : 'Assign'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="wizard-error">
                    {error}
                    <button onClick={handleClearError}>×</button>
                </div>
            )}

            <div className="table-header table-header-assign">
                <span>
                    <input
                        type="checkbox"
                        checked={files.length > 0 && selectedFiles.size === files.length}
                        onChange={handleSelectAll}
                    />
                </span>
                <span>File Name</span>
                <span>File Type</span>
                <span>Size</span>
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
                            className={`file-row file-row-assign ${selectedFiles.has(file._id) ? 'status-completed' : ''}`}
                        >
                            <div className="table-cell">
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
                            </div>
                            <div className="table-cell">{file.file_type || '-'}</div>
                            <div className="table-cell">{formatFileSize(file.file_size)}</div>
                        </div>
                    ))
                )}
            </div>

            {!loading && files.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📁</div>
                    <p className="empty-state-text">No unassigned files found</p>
                    <p className="empty-state-subtext" style={{ color: '#666', fontSize: '14px' }}>
                        All completed uploads have been assigned to patients
                    </p>
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

            {isModalOpen && (
                <AssignPatientsModal
                    onClose={handleModalClose}
                    onSubmit={handleModalSubmit}
                    isSubmitting={submitting}
                />
            )}
        </div>
    );
};

export default AssignPatientsTab;
