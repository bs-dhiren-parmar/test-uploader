import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { getFileUploads, cancelDeleteFileUpload } from '../services/fileUploadService';
import { getLocalDateTime } from '../utils/helpers';
import { UPLOAD_STATUS } from '../utils/constants';
import type { FileUpload, ResumeUploadInfo } from '../types';
import '../styles/fileList.css';

interface PaginationState {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

const FileList: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { resumeUpload, cancelUpload, isUploading, isCancelAvailable } = useUpload();

  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    pageSize: 10,
    totalRecords: 0,
    totalPages: 0
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    column: 'created_at',
    direction: 'desc'
  });
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Get column index for DataTables
  const getColumnIndex = (columnName: string): number => {
    const columns = ['file_name', 'original_file_name', 'upload_status', 'file_progress', 
                     'patient_name', 'visit_id', 'sample_id', 'created_at', 'upload_completed_at'];
    return columns.indexOf(columnName);
  };

  // Fetch file uploads
  const fetchFiles = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        draw: 1,
        start: pagination.page * pagination.pageSize,
        length: pagination.pageSize,
        'order[0][column]': getColumnIndex(sortConfig.column),
        'order[0][dir]': sortConfig.direction,
        'search[value]': searchTerm,
        'search[regex]': false
      };

      const result = await getFileUploads(params);
      if (result?.data) {
        setFiles(result.data);
        setPagination(prev => ({
          ...prev,
          totalRecords: result.recordsTotal || 0,
          totalPages: Math.ceil((result.recordsTotal || 0) / prev.pageSize)
        }));
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      // Don't logout on network errors - only on explicit auth failures
      // The API interceptor handles real 401 errors
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, sortConfig, searchTerm]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles();
    }
  }, [isAuthenticated, fetchFiles]);

  // Refresh periodically when uploads are in progress
  useEffect(() => {
    if (Object.keys(isUploading).length > 0) {
      const interval = setInterval(fetchFiles, 5000);
      return () => clearInterval(interval);
    }
  }, [isUploading, fetchFiles]);

  // Handle sort
  const handleSort = (column: string): void => {
    setSortConfig(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Handle page change
  const handlePageChange = (newPage: number): void => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Handle search
  const handleSearch = (e: ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
    setPagination(prev => ({ ...prev, page: 0 }));
  };

  // Handle delete
  const handleDelete = async (fileId: string): Promise<void> => {
    try {
      const result = await cancelDeleteFileUpload(fileId, 'delete', null, null);
      if (result.data?.success) {
        fetchFiles();
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  // Handle cancel
  const handleCancel = async (fileId: string, status: string): Promise<void> => {
    await cancelUpload(fileId, status);
    fetchFiles();
  };

  // Handle resume
  const handleResume = async (file: ResumeUploadInfo): Promise<void> => {
    await resumeUpload(file);
    fetchFiles();
  };

  // Show file path info
  const handleShowFilePath = (filePath: string): void => {
    window.electronAPI?.showInfoBox(
      `The file uploaded by user is at ${filePath} of users machine.`,
      'info',
      ['Ok']
    );
  };

  // Get status badge class
  const getStatusClass = (status: string): string => {
    switch (status) {
      case UPLOAD_STATUS.COMPLETED:
        return 'status-completed';
      case UPLOAD_STATUS.IN_PROGRESS:
      case UPLOAD_STATUS.RETRIED_IN_PROGRESS:
        return 'status-progress';
      case UPLOAD_STATUS.ERROR:
      case UPLOAD_STATUS.COMPLETED_WITH_ERROR:
        return 'status-error';
      case UPLOAD_STATUS.CANCEL:
        return 'status-cancelled';
      case UPLOAD_STATUS.QUEUED:
        return 'status-queued';
      default:
        return '';
    }
  };

  // Render action buttons
  const renderActions = (file: FileUpload): React.ReactNode => {
    const { _id, upload_status, aws_key, local_file_path, file_name, aws_upload_id, currentPartIndex } = file;

    if (upload_status === UPLOAD_STATUS.COMPLETED) {
      return (
        <div className="action-buttons">
          <a
            href={aws_key}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-small"
          >
            Download
          </a>
          <button
            className="btn btn-danger btn-small"
            onClick={() => handleDelete(_id)}
          >
            Delete
          </button>
        </div>
      );
    }

    return (
      <div className="action-buttons">
        <button
          className="btn btn-outline btn-small"
          onClick={() => handleShowFilePath(local_file_path)}
        >
          File Path
        </button>
        
        {(upload_status === UPLOAD_STATUS.ERROR || upload_status === UPLOAD_STATUS.CANCEL) && (
          <button
            className="btn btn-warning btn-small"
            onClick={() => handleResume({
              fileUploadId: _id,
              fileName: file_name,
              filePath: local_file_path,
              uploadId: aws_upload_id || '',
              key: aws_key,
              currentPartIndex: currentPartIndex || 0
            })}
          >
            Resume
          </button>
        )}

        {upload_status !== UPLOAD_STATUS.RETRIED_IN_PROGRESS &&
         upload_status !== UPLOAD_STATUS.COMPLETED_WITH_ERROR &&
         isCancelAvailable[_id] && (
          <button
            className="btn btn-danger btn-small"
            onClick={() => handleCancel(_id, upload_status)}
          >
            Cancel
          </button>
        )}
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="file-list-page">
        <div className="file-list-header">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={handleSearch}
              className="search-input"
            />
          </div>
          <button 
            className="btn btn-secondary"
            onClick={fetchFiles}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="table-container">
          {loading && files.length === 0 ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading files...</p>
            </div>
          ) : (
            <>
              <table className="file-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('file_name')}>
                      File Name
                      {sortConfig.column === 'file_name' && (
                        <span className="sort-indicator">
                          {sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}
                        </span>
                      )}
                    </th>
                    <th onClick={() => handleSort('original_file_name')}>
                      Original File Name
                    </th>
                    <th onClick={() => handleSort('upload_status')}>
                      Status
                    </th>
                    <th>Progress</th>
                    <th onClick={() => handleSort('patient_name')}>
                      Patient-MRN
                    </th>
                    <th onClick={() => handleSort('visit_id')}>
                      Visit Id
                    </th>
                    <th onClick={() => handleSort('sample_id')}>
                      Sample Id
                    </th>
                    <th onClick={() => handleSort('created_at')}>
                      Created At
                      {sortConfig.column === 'created_at' && (
                        <span className="sort-indicator">
                          {sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}
                        </span>
                      )}
                    </th>
                    <th onClick={() => handleSort('upload_completed_at')}>
                      Upload Completed At
                    </th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="no-data">
                        No files found
                      </td>
                    </tr>
                  ) : (
                    files?.length > 0 && files?.map((file) => (
                      <tr key={file._id}>
                        <td>{file.file_name}</td>
                        <td>{file.original_file_name}</td>
                        <td>
                          <span className={`status-badge ${getStatusClass(file.upload_status)}`}>
                            {file.upload_status}
                          </span>
                        </td>
                        <td>{file.file_progress || '0%'}</td>
                        <td>{file.patient_name}</td>
                        <td>{file.visit_id}</td>
                        <td>{file.sample_id}</td>
                        <td>{getLocalDateTime(file.created_at)}</td>
                        <td>{getLocalDateTime(file.upload_completed_at)}</td>
                        <td>{renderActions(file)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {pagination.totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="btn btn-small"
                    onClick={() => handlePageChange(0)}
                    disabled={pagination.page === 0}
                  >
                    First
                  </button>
                  <button
                    className="btn btn-small"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 0}
                  >
                    Previous
                  </button>
                  <span className="page-info">
                    Page {pagination.page + 1} of {pagination.totalPages}
                  </span>
                  <button
                    className="btn btn-small"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages - 1}
                  >
                    Next
                  </button>
                  <button
                    className="btn btn-small"
                    onClick={() => handlePageChange(pagination.totalPages - 1)}
                    disabled={pagination.page >= pagination.totalPages - 1}
                  >
                    Last
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default FileList;
