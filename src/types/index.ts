// ==================== Patient Types ====================

export interface Patient {
  _id: string;
  first_name: string;
  last_name?: string;
  mrn: string;
  roles?: Array<{ org_id: string }>;
}

export interface Visit {
  visit_id: string;
}

export interface PatientData {
  visits: Visit[];
  samples: Record<string, string[]>;
}

// ==================== User Types ====================

export interface User {
  name: string;
  email: string;
}

export interface UserData {
  first_name: string;
  last_name?: string;
  roles?: Array<{ org_id: string }>;
}

// ==================== File Upload Types ====================

export type UploadStatus = 
  | 'QUEUED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERROR'
  | 'ERROR'
  | 'CANCEL'
  | 'RETRIED_IN_PROGRESS';

export interface FileUpload {
  _id: string;
  file_name: string;
  original_file_name: string;
  upload_status: UploadStatus;
  file_progress: string;
  patient_name: string;
  visit_id: string;
  sample_id: string;
  created_at: string;
  upload_completed_at?: string;
  aws_key: string;
  aws_upload_id?: string;
  local_file_path: string;
  currentPartIndex?: number;
}

export interface FileUploadData {
  files: File[];
  patientId: string;
  visitId: string;
  sampleId: string;
  fileTypes: Record<string, string>;
  updatedFileNames: Record<string, string>;
  cardIndex: number;
}

export interface FileToUpload {
  file: File;
  fileName: string;
  originalFileName: string;
  fileType: string;
  patientId: string;
  visitId: string;
  sampleId: string;
}

export interface QueueItem {
  file: File;
  patientId?: string;
  fileUploadId: string;
  isFileResume?: boolean;
  key?: string;
  uploadId?: string;
  currentPartIndex?: number;
  fileName?: string;
}

export interface KeyObj {
  key: string;
  uplaodId: string;
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface AuthResponse {
  user: UserData;
}

export interface PatientsResponse {
  response: Patient[];
}

export interface FileUploadsResponse {
  data: FileUpload[];
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  iTotalRecords: number;
  iTotalDisplayRecord: number;
}

export interface InitiateUploadResponse {
  UploadId: string;
}

// ==================== Form Types ====================

export interface LoginFormData {
  baseUrl: string;
  email: string;
  apiKey: string;
  keepSignedIn: boolean;
}

export interface LoginFormErrors {
  baseUrl: string;
  email: string;
  apiKey: string;
}

// ==================== Component Props Types ====================

export interface SampleCardProps {
  index: number;
  patients: Patient[];
  onRemove: (index: number) => void;
  onFilesReady: (data: FileUploadData) => void;
  canRemove: boolean;
}

export interface FileDropZoneProps {
  onFilesDrop: (files: File[]) => void;
  files: File[];
  fileTypes: Record<string, string>;
  updatedFileNames: Record<string, string>;
  onFileTypeChange: (fileName: string, newType: string) => void;
  onRemoveFile: (fileName: string) => void;
}

export interface LayoutProps {
  children: React.ReactNode;
}

// ==================== Select Types ====================

export interface SelectOption {
  value: string;
  label: string;
}

// ==================== Resume Upload Types ====================

export interface ResumeUploadInfo {
  fileUploadId: string;
  fileName: string;
  filePath: string;
  uploadId: string;
  key: string;
  currentPartIndex: number;
}
