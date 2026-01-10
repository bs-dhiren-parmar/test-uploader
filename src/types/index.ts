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

export type UploadStatus = "QUEUED" | "IN_PROGRESS" | "COMPLETED" | "COMPLETED_WITH_ERROR" | "ERROR" | "CANCEL" | "RETRIED_IN_PROGRESS" | "DELETED" | "NEW" | "STALLED";

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
    patientId?: string;  // Optional in V2 - can be assigned later
    visitId?: string;
    sampleId?: string;
}

export interface QueueItem {
    file?: File;  // Optional - not needed for disk-based resume uploads
    patientId?: string;
    fileUploadId: string;
    isFileResume?: boolean;
    key?: string;
    uploadId?: string;
    currentPartIndex?: number;
    fileName?: string;
    // For disk-based resume uploads (large files)
    filePath?: string;  // Local file path for reading chunks from disk
    fileSize?: number;  // File size in bytes
    fileType?: string;  // MIME type
}

export interface KeyObj {
    key: string;
    uploadId: string;
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

// ==================== V2 API Response Types ====================

export interface StatusListItem {
    _id: string;
    file_name: string;
    original_file_name: string;
    upload_status: UploadStatus;
    file_progress: string;
    file_size: string;
    file_size_display?: string;
    file_type: string;
    aws_key?: string;
    aws_upload_id?: string;
    local_file_path?: string;
    currentPartIndex?: number;
    created_at: string;
    actions: string[];
    status_color: "green" | "yellow" | "red" | "gray";
    download_url?: string;
}

export interface StatusListResponse {
    data: StatusListItem[];
    total: number;
    limit: number;
    skip: number;
}

export interface AssignListItem {
    _id: string;
    file_name: string;
    original_file_name: string;
    file_type: string;
    file_size: string;
    created_at: string;
}

export interface AssignListResponse {
    data: AssignListItem[];
    total: number;
    limit: number;
    skip: number;
}

export interface AssociationListItem {
    _id: string;
    file_name: string;
    original_file_name: string;
    upload_status: UploadStatus;
    file_type: string;
    file_size: string;
    patient_mrn: string;
    patient_name: string;
    patient_id: string;
    visit_id: string;
    sample_id: string;
    created_at: string;
    created_at_display?: string;
    upload_completed_at?: string;
    upload_completed_at_display?: string;
    aws_key?: string;
    patient_assigned: boolean;
    download_url?: string;
}

export interface AssociationListResponse {
    data: AssociationListItem[];
    draw?: string;
    recordsTotal: number;
    recordsFiltered: number;
    iTotalRecords: number;
    iTotalDisplayRecord: number;
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
    fileType?: string;  // Optional MIME type for the file
}

// ==================== Patient Form Types ====================

export interface AgeData {
    y: string;  // years
    m: string;  // months
    d: string;  // days
}

export interface GaData {
    w: string;  // weeks
    d: string;  // days
}

export interface SlideFormData {
    slide_id: string;
    storm: string;
    cellularity: string;
}

export interface BlockFormData {
    block_id: string;
    Case_Block_ID: string;
    surgical_id: string;
    tumor_per: string;
    slides: SlideFormData[];
}

export interface SampleFormData {
    sample_id: string;
    sample_type: string;
    sample_quality: string;
    sample_volume: string;
    ref_id1: string;
    ref_id2: string;
    sample_date_time: string;
    blocks: BlockFormData[];
}

export interface VisitFormData {
    visit_id: string;
    first_name: string;
    last_name: string | null;
    reason_visit: string;
    weight: string;
    weight_unit: string;
    height: string;
    diagnosis: string;
    pri_physician: string;
    location: string;
    lims_id: string;
    phone_number: string;
    sample_type: string;
    cancer_type: string | null;
    clinical_history: string;
    pregnancy: string;
    visit_type: string;
    registration_date_time: string;
    marker_report: string;
    no_of_fetus: string;
    nuchal_translucency: string;
    nt_unit: string;
    pregnancy_type: string;
    counselling_date: string;
    sample_collection_date: string;
    lmp_date: string;
    ga: GaData;
    clinical_indication: string;
    other_clinical_indication: string;
    report_findings: string;
    usg_findings: string;
    samples: SampleFormData[];
    hpo_terms: SelectOption[];
    disease_omim_list: SelectOption[];
    gene_list: SelectOption[];
    custom_forms: unknown;
    form_ids: unknown;
    ClnclHstryVrFlg: boolean;
    ClnclHstryVrAt: string;
    ClnclHstryVrBy: string;
    ClnclHstryVrByNm: string;
    VrExtrctFrmFls: boolean;
    VrExtrctHpTrms: boolean;
    ClnclHstryUpdtdBy: string;
    ClnclHstryUpdtdByNm: string;
    ClnclHstryUpdtdAt: string;
}

export interface PatientFormData {
    _id: string | null;
    first_name: string;
    last_name: string;
    mrn: string;
    reffering_doctor: string;
    ethnicity: string;
    sex: string;
    dob: string;
    age: AgeData;
    life_status: string;
    pri_physician: string;
    acc_remark: string;
    phone_number: string;
    location: string;
    clinical_history: string;
    family_history: string;
    diagnosis: string;
    weight: string;
    weight_unit: string;
    height: string;
    marital_status: string;
    genotype_information: string;
    counselling_date: string;
    pedigree: string;
    hpo_terms: SelectOption[];
    gene_list: SelectOption[];
    disease_omim_list: SelectOption[];
}

export interface PatientFormErrors {
    first_name?: string;
    last_name?: string;
    mrn?: string;
    life_status?: string;
    dob?: string;
    age?: string;
    sex?: string;
    [key: string]: string | undefined;
}

export interface VisitFormErrors {
    visit_id?: string;
    first_name?: string;
    samples?: string;
    [key: string]: string | undefined;
}

export interface CreatePatientResponse {
    patientId: string;
    augmetId: string;
    success: boolean;
}

export interface CreateVisitResponse {
    visitId: string;
    success: boolean;
}
