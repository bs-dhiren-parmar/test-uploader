import axios, { AxiosResponse, CancelToken } from "axios";
import api, { getBaseUrl, getApiKey } from "./api";
import type { ApiResponse, FileUploadsResponse, InitiateUploadResponse, FileUpload, KeyObj, StatusListResponse, AssignListResponse, AssociationListResponse } from "../types";

// ==================== V2 API Request Interfaces ====================

interface FileUploadCreateDataV2 {
    file_name: string;
    original_file_name?: string;
    local_file_path?: string;
    org_id: string;
    patient_id?: string;  // Optional in V2 - can be assigned later
    sample_id?: string;
    visit_id?: string;
    file_type?: string;
    file_size?: number;
}

interface FileUploadUpdateDataV2 {
    status?: string;
    file_progress?: string;
    file_name?: string;
    local_file_path?: string;
    remote_file_path?: string;
    currentIndex?: number;
    tag?: string;
    aws_upload_id?: string;
    aws_key?: string;
    updateStatus?: boolean;
}

interface PatientAssignData {
    patient_id: string;
    visit_id?: string;
    sample_id?: string;
}

// Helper function to convert object to query string
const objectToQueryString = (obj: Record<string, unknown>): string => {
    return Object.keys(obj)
        .map((key) => {
            if (typeof obj[key] === "object") {
                return `${key}=${JSON.stringify(obj[key])}`;
            }
            return `${key}=${obj[key]}`;
        })
        .join("&");
};

// ==================== V2 Core APIs ====================

/**
 * V2: Create a new file upload record (patient optional)
 * POST /api/v2/file-upload
 */
export const createFileUploadV2 = async (data: FileUploadCreateDataV2): Promise<AxiosResponse<ApiResponse<FileUpload>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/v2/file-upload`, data);
};

/**
 * V2: Update file upload status and progress
 * PUT /api/v2/file-upload/:fileId
 */
export const updateFileUploadV2 = async (fileId: string, data: FileUploadUpdateDataV2): Promise<AxiosResponse<ApiResponse<FileUpload>>> => {
    const baseUrl = getBaseUrl();
    return api.put(`${baseUrl}/api/v2/file-upload/${fileId}`, data);
};

// ==================== V2 Status Tab APIs ====================

/**
 * V2: Get file uploads for Status tab with progress and actions
 * GET /api/v2/file-upload/status/list
 */
export const getStatusListV2 = async (params?: {
    search?: string;
    file_type?: string;
    status?: string;
    limit?: number;
    skip?: number;
}): Promise<AxiosResponse<ApiResponse<StatusListResponse>>> => {
    const baseUrl = getBaseUrl();
    return api.get(`${baseUrl}/api/v2/file-upload/status/list`, { params });
};

/**
 * V2: Retry a failed or stalled upload
 * POST /api/v2/file-upload/status/retry/:fileId
 */
export const retryFileUploadV2 = async (fileId: string): Promise<AxiosResponse<ApiResponse<FileUpload>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/v2/file-upload/status/retry/${fileId}`);
};

/**
 * V2: Get download URLs for multiple files
 * POST /api/v2/file-upload/status/bulk-download
 */
export const bulkDownloadV2 = async (fileIds: string[]): Promise<AxiosResponse<ApiResponse<Array<{
    _id: string;
    file_name: string;
    download_url?: string;
    error?: string;
}>>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/v2/file-upload/status/bulk-download`, { file_ids: fileIds });
};

/**
 * V2: Delete multiple file uploads
 * POST /api/v2/file-upload/status/bulk-delete
 */
export const bulkDeleteV2 = async (fileIds: string[]): Promise<AxiosResponse<ApiResponse<{ deleted_count: number }>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/v2/file-upload/status/bulk-delete`, { file_ids: fileIds });
};

/**
 * V2: Cancel an in-progress upload
 * POST /api/v2/file-upload/status/cancel/:fileId
 */
export const cancelFileUploadV2 = async (fileId: string): Promise<AxiosResponse<ApiResponse<FileUpload>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/v2/file-upload/status/cancel/${fileId}`);
};

/**
 * V2: Cancel multiple in-progress uploads
 * POST /api/v2/file-upload/status/bulk-cancel
 */
export const bulkCancelV2 = async (fileIds: string[]): Promise<AxiosResponse<ApiResponse<{ cancelled_count: number }>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/v2/file-upload/status/bulk-cancel`, { file_ids: fileIds });
};

// ==================== V2 Assign Patients Tab APIs ====================

/**
 * V2: Get completed file uploads without patient assignment
 * GET /api/v2/file-upload/assign/list
 */
export const getAssignListV2 = async (params?: {
    search?: string;
    file_type?: string;
    limit?: number;
    skip?: number;
}): Promise<AxiosResponse<ApiResponse<AssignListResponse>>> => {
    const baseUrl = getBaseUrl();
    return api.get(`${baseUrl}/api/v2/file-upload/assign/list`, { params });
};

/**
 * V2: Assign a patient to an uploaded file
 * POST /api/v2/file-upload/assign/:fileId
 */
export const assignPatientV2 = async (fileId: string, data: PatientAssignData): Promise<AxiosResponse<ApiResponse<FileUpload>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/v2/file-upload/assign/${fileId}`, data);
};

/**
 * V2: Assign a patient to multiple file uploads
 * POST /api/v2/file-upload/assign/bulk
 */
export const bulkAssignPatientV2 = async (fileIds: string[], data: PatientAssignData): Promise<AxiosResponse<ApiResponse<{
    assigned_count: number;
    patient_id: string;
    visit_id: string;
    sample_id: string;
}>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/v2/file-upload/assign/bulk`, { file_ids: fileIds, ...data });
};

// ==================== V2 File Association Tab APIs ====================

/**
 * V2: Get file uploads with full association details (DataTables format)
 * GET /api/v2/file-upload/association/list
 */
export const getAssociationListV2 = async (params: Record<string, unknown>): Promise<AssociationListResponse> => {
    const baseUrl = getBaseUrl();
    const queryString = objectToQueryString(params);
    const response = await api.get<ApiResponse<AssociationListResponse>>(`${baseUrl}/api/v2/file-upload/association/list?${queryString}`);
    return response.data.data;
};

// ==================== Legacy V1 APIs (kept for compatibility) ====================

interface FileUploadCreateData {
    id?: string;
    file_name?: string;
    original_file_name?: string;
    local_file_path?: string;
    org_id?: string;
    patient_id?: string;
    sample_id?: string;
    visit_id?: string;
    file_type?: string;
    file_size?: number;
    status?: string;
    file_progress?: string;
    aws_upload_id?: string;
    aws_key?: string;
    remote_file_path?: string;
    tag?: string;
    currentIndex?: number;
    updateStatus?: boolean;
}

/**
 * @deprecated Use createFileUploadV2 and updateFileUploadV2 instead
 * Create or update a file upload record
 */
export const createOrUpdateFileUpload = async (data: FileUploadCreateData): Promise<AxiosResponse<ApiResponse<FileUpload>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/file-upload`, data);
};

/**
 * Get file uploads with DataTables format
 */
export const getFileUploads = async (params: Record<string, unknown>): Promise<FileUploadsResponse> => {
    const baseUrl = getBaseUrl();
    const queryString = objectToQueryString(params);
    const response = await api.get<FileUploadsResponse>(`${baseUrl}/api/file-upload/data-tables?${queryString}`);
    return response.data;
};

/**
 * Get pre-signed URL for single file upload
 */
export const getSignedUrl = async (key: string, mimetype: string): Promise<AxiosResponse<ApiResponse<string>>> => {
    const baseUrl = getBaseUrl();
    return api.get(`${baseUrl}/api/file-upload/pre-signed-url`, {
        params: { key, mimetype },
    });
};

/**
 * Initiate multipart upload
 */
export const initiateMultipartUpload = async (key: string): Promise<AxiosResponse<ApiResponse<InitiateUploadResponse>>> => {
    const baseUrl = getBaseUrl();
    return api.get(`${baseUrl}/api/file-upload/intiate-multipart-upload`, {
        params: { key },
    });
};

/**
 * Get signed URL for a specific part
 */
export const getSignedUrlsForAllPart = async (key: string, uploadId: string, partNumber: number): Promise<AxiosResponse<ApiResponse<string>>> => {
    const baseUrl = getBaseUrl();
    return api.get(`${baseUrl}/api/file-upload/genrate-signed-urls`, {
        params: { key, uploadId, PartNumber: partNumber },
    });
};

/**
 * Complete multipart upload
 */
export const completeSignedUrl = async (key: string, uploadId: string, fileUploadId: string): Promise<AxiosResponse<ApiResponse<unknown>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/file-upload/complete-signed-upload`, {
        key,
        uploadId,
        fileUploadId,
    });
};

/**
 * Cancel or delete a file upload
 */
export const cancelDeleteFileUpload = async (
    id: string,
    status: string,
    uploadData: KeyObj | null | undefined,
    errorMessage?: string | null
): Promise<AxiosResponse<ApiResponse<unknown>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/file-upload/cancel-delete/${id}`, {
        status,
        key: uploadData?.key || null,
        uploadId: uploadData?.uplaodId || null,
        errorMessage,
    });
};

/**
 * Cancel all file uploads
 */
export const cancelAllFileUpload = async (ids: string[], keyObj: Record<string, KeyObj>): Promise<AxiosResponse> => {
    const baseUrl = getBaseUrl();
    const apiKey = getApiKey();
    return axios.post(
        `${baseUrl}/api/file-upload/cancel-all`,
        {
            ids,
            keyObj,
        },
        {
            headers: { "api-key": apiKey },
        }
    );
};

/**
 * Upload a chunk to S3 using signed URL
 */
export const uploadChunk = async (signedUrl: string, data: Blob, contentType: string, cancelToken?: CancelToken): Promise<AxiosResponse> => {
    console.log("uploadChunk: Starting upload to S3", {
        signedUrlPrefix: signedUrl,
        dataSize: data.size,
        contentType,
    });
    
    try {
        const response = await axios({
            method: "PUT",
            url: signedUrl,
            data,
            headers: { "Content-Type": contentType },
            cancelToken,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            maxRedirects: 0,
        });
        
        console.log("uploadChunk: S3 upload success", {
            status: response.status,
            headers: response.headers,
            etag: response.headers?.etag,
            // Debug: Check all available headers
            allHeaderKeys: Object.keys(response.headers || {}),
        });
        
        // Debug: Check if ETag is missing due to CORS
        if (!response.headers?.etag) {
            console.warn(
                "uploadChunk: ETag header is missing from S3 response. " +
                "This is typically a CORS issue. The S3 bucket CORS configuration must include: " +
                "ExposeHeaders: ['ETag']. " +
                "Check AWS S3 Console > Bucket > Permissions > CORS configuration."
            );
            console.warn("uploadChunk: Available headers:", Object.keys(response.headers || {}));
        }
        
        return response;
    } catch (error: unknown) {
        const axiosError = error as { 
            message?: string; 
            code?: string; 
            response?: { status?: number; data?: unknown };
            request?: unknown;
        };
        
        console.error("uploadChunk: S3 upload failed", {
            message: axiosError.message,
            code: axiosError.code,
            response: axiosError.response ? {
                status: axiosError.response.status,
                data: axiosError.response.data,
            } : "No response (likely CORS or network error)",
            hasRequest: !!axiosError.request,
        });
        
        // If no response, it's likely a CORS issue
        if (!axiosError.response && axiosError.request) {
            console.error(
                "uploadChunk: CORS ERROR - The S3 bucket likely does not have CORS configured. " +
                "Please add CORS configuration to expose headers: ETag, Content-Length, Content-Type"
            );
        }
        
        throw error;
    }
};
