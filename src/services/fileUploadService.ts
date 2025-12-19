import axios, { AxiosResponse, CancelToken } from 'axios';
import api, { getBaseUrl, getApiKey } from './api';
import type { 
  ApiResponse, 
  FileUploadsResponse, 
  InitiateUploadResponse,
  FileUpload,
  KeyObj 
} from '../types';

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
 * Create or update a file upload record
 */
export const createOrUpdateFileUpload = async (
  data: FileUploadCreateData
): Promise<AxiosResponse<ApiResponse<FileUpload>>> => {
  const baseUrl = getBaseUrl();
  return api.post(`${baseUrl}/api/file-upload`, data);
};

/**
 * Get file uploads with DataTables format
 */
export const getFileUploads = async (
  params: Record<string, unknown>
): Promise<FileUploadsResponse> => {
  const baseUrl = getBaseUrl();
  const queryString = objectToQueryString(params);
  const response = await api.get<FileUploadsResponse>(`${baseUrl}/api/file-upload/data-tables?${queryString}`);
  return response.data;
};

/**
 * Get pre-signed URL for single file upload
 */
export const getSignedUrl = async (
  key: string, 
  mimetype: string
): Promise<AxiosResponse<ApiResponse<string>>> => {
  const baseUrl = getBaseUrl();
  return api.get(`${baseUrl}/api/file-upload/pre-signed-url`, {
    params: { key, mimetype }
  });
};

/**
 * Initiate multipart upload
 */
export const initiateMultipartUpload = async (
  key: string
): Promise<AxiosResponse<ApiResponse<InitiateUploadResponse>>> => {
  const baseUrl = getBaseUrl();
  return api.get(`${baseUrl}/api/file-upload/intiate-multipart-upload`, {
    params: { key }
  });
};

/**
 * Get signed URL for a specific part
 */
export const getSignedUrlsForAllPart = async (
  key: string, 
  uploadId: string, 
  partNumber: number
): Promise<AxiosResponse<ApiResponse<string>>> => {
  const baseUrl = getBaseUrl();
  return api.get(`${baseUrl}/api/file-upload/genrate-signed-urls`, {
    params: { key, uploadId, PartNumber: partNumber }
  });
};

/**
 * Complete multipart upload
 */
export const completeSignedUrl = async (
  key: string, 
  uploadId: string, 
  fileUploadId: string
): Promise<AxiosResponse<ApiResponse<unknown>>> => {
  const baseUrl = getBaseUrl();
  return api.post(`${baseUrl}/api/file-upload/complete-signed-upload`, {
    key,
    uploadId,
    fileUploadId
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
    errorMessage
  });
};

/**
 * Cancel all file uploads
 */
export const cancelAllFileUpload = async (
  ids: string[], 
  keyObj: Record<string, KeyObj>
): Promise<AxiosResponse> => {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();
  return axios.post(`${baseUrl}/api/file-upload/cancel-all`, {
    ids,
    keyObj
  }, {
    headers: { 'api-key': apiKey }
  });
};

/**
 * Upload a chunk to S3 using signed URL
 */
export const uploadChunk = async (
  signedUrl: string, 
  data: Blob, 
  contentType: string, 
  cancelToken?: CancelToken
): Promise<AxiosResponse> => {
  return axios({
    method: 'PUT',
    url: signedUrl,
    data,
    headers: { 'Content-Type': contentType },
    cancelToken,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    maxRedirects: 0
  });
};

// Helper function to convert object to query string
const objectToQueryString = (obj: Record<string, unknown>): string => {
  return Object.keys(obj)
    .map((key) => {
      if (typeof obj[key] === 'object') {
        return `${key}=${JSON.stringify(obj[key])}`;
      }
      return `${key}=${obj[key]}`;
    })
    .join('&');
};
