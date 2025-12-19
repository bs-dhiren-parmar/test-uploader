import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { checkFileExtension } from '../utils/helpers';
import { FILE_TYPE_OPTIONS } from '../utils/constants';
import '../styles/fileDropZone.css';

interface FileDropZoneProps {
  onFilesDrop: (files: File[]) => void;
  files: File[];
  fileTypes: Record<string, string>;
  updatedFileNames: Record<string, string>;
  onFileTypeChange: (fileName: string, newType: string) => void;
  onRemoveFile: (fileName: string) => void;
}

const FileDropZone: React.FC<FileDropZoneProps> = ({ 
  onFilesDrop, 
  files, 
  fileTypes, 
  updatedFileNames,
  onFileTypeChange, 
  onRemoveFile 
}) => {
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFilesDrop(droppedFiles);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>): void => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      onFilesDrop(selectedFiles);
    }
    // Reset input
    e.target.value = '';
  };

  const handleBrowseClick = (): void => {
    fileInputRef.current?.click();
  };

  const getDisplayFileName = (file: File): string => {
    return updatedFileNames[file.name] || file.name;
  };

  const getFileType = (file: File): string => {
    const displayName = getDisplayFileName(file);
    return fileTypes[displayName] || '';
  };

  const isUncompressedFastq = (file: File): boolean => {
    const displayName = getDisplayFileName(file);
    return fileTypes[displayName] === 'uncompressed_fastq';
  };

  const needsTypeSelection = (file: File): boolean => {
    const displayName = getDisplayFileName(file);
    const detectedType = checkFileExtension(displayName);
    return !detectedType || detectedType === '';
  };

  return (
    <div className="file-drop-container">
      <div 
        className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <div className="drop-icon">
          <svg viewBox="0 0 384 512" width="60" height="60">
            <path
              fill="currentColor"
              d="M224 136V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zm65.18 216.01H224v80c0 8.84-7.16 16-16 16h-32c-8.84 0-16-7.16-16-16v-80H94.82c-14.28 0-21.41-17.29-11.27-27.36l96.42-95.7c6.65-6.61 17.39-6.61 24.04 0l96.42 95.7c10.15 10.07 3.03 27.36-11.25 27.36zM377 105L279.1 7c-4.5-4.5-10.6-7-17-7H256v128h128v-6.1c0-6.3-2.5-12.4-7-16.9z"
            />
          </svg>
        </div>
        <p className="drop-text">Drag & Drop to Upload File</p>
        <p className="drop-subtext">or</p>
        <button 
          type="button" 
          className="btn btn-outline"
          onClick={handleBrowseClick}
        >
          Browse Files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="file-input-hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((file, idx) => {
            const displayName = getDisplayFileName(file);
            const fileType = getFileType(file);
            const isUncompressed = isUncompressedFastq(file);
            const needsType = needsTypeSelection(file);

            return (
              <div key={idx} className="file-item">
                <span className={`file-name ${isUncompressed ? 'text-danger' : 'text-success'}`}>
                  {displayName}
                </span>

                {needsType ? (
                  <select
                    className="file-type-select"
                    value={fileType}
                    onChange={(e) => onFileTypeChange(displayName, e.target.value)}
                  >
                    {FILE_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="file-type-badge">
                    {fileType === 'uncompressed_fastq' ? 'fastq (uncompressed)' : fileType}
                  </span>
                )}

                {isUncompressed && (
                  <span className="compress-warning">
                    Please compress file before upload
                  </span>
                )}

                <button
                  type="button"
                  className="btn btn-remove"
                  onClick={() => onRemoveFile(file.name)}
                >
                  X
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FileDropZone;
