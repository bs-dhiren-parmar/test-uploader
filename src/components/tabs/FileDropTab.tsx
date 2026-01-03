import React, { useState, useRef, DragEvent, ChangeEvent, useCallback } from "react";
import Icon from "../Icon";
import { useUploadV2 } from "../../context/UploadContextV2";
import { checkFileExtension, sanitizeFileName, formatFileSize } from "../../utils/helpers";
import { FILE_TYPE_OPTIONS } from "../../utils/constants";
import "../../styles/fileDropTab.css";

/**
 * Processed file interface for tracking validation status
 */
interface ProcessedFile {
    id: string;
    file: File;
    originalName: string;
    sanitizedName: string;
    detectedType: string;
    selectedType: string;
    isValid: boolean;
    isUncompressedFastq: boolean;
}

/**
 * FileDropTab - File drop zone with validation, sanitization, and queue integration
 * 
 * Features:
 * - Drag & drop or browse file selection
 * - Filename sanitization (replaces special characters with _)
 * - File type detection using checkFileExtension()
 * - Visual status indicators (green for valid, red for needs attention)
 * - File type dropdown for unrecognized files
 * - Integration with UploadContextV2 for queue management
 */
const FileDropTab: React.FC = () => {
    const [isDragOver, setIsDragOver] = useState(false);
    const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
    const [isAddingToQueue, setIsAddingToQueue] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { addFilesToQueue } = useUploadV2();

    /**
     * Generate unique ID for file tracking
     */
    const generateFileId = (): string => {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    /**
     * Process dropped/selected files
     * - Sanitize filename
     * - Detect file type
     * - Determine validation status
     */
    const processFiles = useCallback((files: File[]): void => {
        const newProcessedFiles: ProcessedFile[] = [];

        for (const file of files) {
            const originalName = file.name;
            const sanitizedName = sanitizeFileName(originalName);
            const detectedType = checkFileExtension(sanitizedName);
            const isUncompressedFastq = detectedType === "uncompressed_fastq";

            // File is valid if:
            // - Type is detected and not uncompressed_fastq
            // - OR if it's uncompressed_fastq but user can select type via dropdown
            const isValid = !!detectedType && !isUncompressedFastq;

            newProcessedFiles.push({
                id: generateFileId(),
                file,
                originalName,
                sanitizedName,
                detectedType,
                selectedType: isValid ? detectedType : "",
                isValid,
                isUncompressedFastq,
            });
        }

        setProcessedFiles((prev) => [...prev, ...newProcessedFiles]);
    }, []);

    // Drag handlers
    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length > 0) {
            processFiles(droppedFiles);
        }
    }, [processFiles]);

    const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            processFiles(selectedFiles);
        }
        e.target.value = "";
    }, [processFiles]);

    const handleBrowseClick = useCallback((): void => {
        fileInputRef.current?.click();
    }, []);

    /**
     * Handle file type selection from dropdown
     */
    const handleFileTypeChange = useCallback((fileId: string, newType: string): void => {
        setProcessedFiles((prev) =>
            prev.map((pf) => {
                if (pf.id === fileId) {
                    return {
                        ...pf,
                        selectedType: newType,
                        isValid: !!newType && newType !== "uncompressed_fastq",
                    };
                }
                return pf;
            })
        );
    }, []);

    // Memoized handlers for JSX props
    const handleFileTypeSelectChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
        const fileId = e.target.dataset.fileId;
        if (fileId) {
            handleFileTypeChange(fileId, e.target.value);
        }
    }, [handleFileTypeChange]);

    /**
     * Remove a file from the list
     */
    const handleRemoveFile = useCallback((fileId: string): void => {
        setProcessedFiles((prev) => prev.filter((pf) => pf.id !== fileId));
    }, []);
    
    const handleRemoveFileClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        const fileId = e.currentTarget.dataset.fileId;
        if (fileId) {
            handleRemoveFile(fileId);
        }
    }, [handleRemoveFile]);

    /**
     * Clear all files from the list
     */
    const handleClearAll = useCallback((): void => {
        setProcessedFiles([]);
    }, []);

    /**
     * Add valid files to upload queue
     */
    const handleAddToQueue = useCallback(async (): Promise<void> => {
        const filesToUpload = processedFiles.filter((pf) => pf.isValid && pf.selectedType);

        if (filesToUpload.length === 0) {
            return;
        }

        setIsAddingToQueue(true);

        try {
            const filesData = filesToUpload.map((pf) => ({
                file: pf.file,
                fileName: pf.sanitizedName,
                originalFileName: pf.originalName,
                fileType: pf.selectedType,
                // No patient/visit/sample - will be assigned later
            }));

            await addFilesToQueue(filesData);

            // Remove successfully queued files from the list
            const queuedFileIds = new Set(filesToUpload.map((pf) => pf.id));
            setProcessedFiles((prev) => prev.filter((pf) => !queuedFileIds.has(pf.id)));

            window.electronAPI?.showNotification(
                "Files Added to Queue",
                `${filesToUpload.length} file(s) added to upload queue.`
            );
        } catch (error) {
            console.error("Error adding files to queue:", error);
            window.electronAPI?.showErrorBox(
                "Queue Error",
                "Failed to add files to upload queue. Please try again."
            );
        } finally {
            setIsAddingToQueue(false);
        }
    }, [processedFiles, addFilesToQueue]);

    // Calculate summary stats
    const validFilesCount = processedFiles.filter((pf) => pf.isValid && pf.selectedType).length;
    const invalidFilesCount = processedFiles.filter((pf) => !pf.isValid || !pf.selectedType).length;
    const hasFiles = processedFiles.length > 0;
    const canAddToQueue = validFilesCount > 0 && !isAddingToQueue;

    /**
     * Get dropdown options (exclude uncompressed_fastq)
     */
    const getFileTypeOptions = () => {
        return FILE_TYPE_OPTIONS.filter((opt) => opt.value !== "uncompressed_fastq");
    };

    return (
        <div className="file-drop-tab-container">
            {/* Drop Zone */}
            <div
                className={`file-drop-zone-new ${isDragOver ? "drag-over" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onClick={handleBrowseClick}
            >
                <div className="drop-icon-cloud">
                    <Icon name="cloud-upload" size={64} color="primary" />
                </div>
                <p className="drop-text-main">
                    Drag & drop files or <span className="browse-link">Browse</span>
                </p>
                <p className="drop-text-formats">
                    Supported formats: FASTQ (.fastq.gz, .fq.gz), BAM, BAI, VCF
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                    accept=".fastq,.fastq.gz,.fq,.fq.gz,.vcf,.vcf.gz,.vcf.idx,.bam,.bai"
                />
            </div>

            {/* Processed Files Section */}
            {hasFiles && (
                <div className="processed-files-section">
                    <div className="processed-files-header">
                        <h3>Selected Files</h3>
                        <span className="files-count">{processedFiles.length} file(s)</span>
                    </div>

                    {/* Summary Stats */}
                    <div className="files-summary">
                        <div className="summary-item valid">
                            <span className="count">{validFilesCount}</span>
                            <span>Ready to upload</span>
                        </div>
                        <div className="summary-item invalid">
                            <span className="count">{invalidFilesCount}</span>
                            <span>Need attention</span>
                        </div>
                    </div>

                    {/* File Table */}
                    <div className="processed-files-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>File Name</th>
                                    <th>Size</th>
                                    <th>Status</th>
                                    <th>File Type</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedFiles.map((pf) => (
                                    <tr key={pf.id}>
                                        <td>
                                            <div className="file-name-cell">
                                                <span className="file-name-original">{pf.originalName}</span>
                                                {pf.originalName !== pf.sanitizedName && (
                                                    <span className="file-name-sanitized">{pf.sanitizedName}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="file-size">{formatFileSize(pf.file.size)}</span>
                                        </td>
                                        <td>
                                            <div className="status-indicator">
                                                <span className={`status-icon ${pf.isValid && pf.selectedType ? "valid" : "invalid"}`}>
                                                    {pf.isValid && pf.selectedType ? "✓" : "!"}
                                                </span>
                                                <span className={`status-text ${pf.isValid && pf.selectedType ? "text-success" : "text-danger"}`}>
                                                    {pf.isValid && pf.selectedType
                                                        ? "Ready"
                                                        : pf.isUncompressedFastq
                                                        ? "Compress required"
                                                        : "Select type"}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="file-type-select-wrapper">
                                                {pf.isValid && pf.selectedType && !pf.isUncompressedFastq ? (
                                                    <span className="file-type-badge">{pf.selectedType}</span>
                                                ) : (
                                                    <select
                                                        className={`file-type-select ${!pf.selectedType ? "invalid" : ""}`}
                                                        data-file-id={pf.id}
                                                        value={pf.selectedType}
                                                        onChange={handleFileTypeSelectChange}
                                                    >
                                                        {getFileTypeOptions().map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-remove-file"
                                                data-file-id={pf.id}
                                                onClick={handleRemoveFileClick}
                                                title="Remove file"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Action Buttons */}
                    <div className="file-drop-actions">
                        <button type="button" className="btn-clear-all" onClick={handleClearAll}>
                            Clear All
                        </button>
                        <button
                            type="button"
                            className="btn-add-to-queue"
                            onClick={handleAddToQueue}
                            disabled={!canAddToQueue}
                        >
                            {isAddingToQueue
                                ? "Adding..."
                                : `Add to Queue (${validFilesCount})`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileDropTab;
