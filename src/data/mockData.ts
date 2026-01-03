// Mock data for Dashboard components

export interface MockPatient {
    id: string;
    name: string;
    mrn: string;
}

export interface MockVisit {
    id: string;
    patientId: string;
    visitId: string;
}

export interface MockSample {
    id: string;
    visitId: string;
    sampleId: string;
}

export interface MockFile {
    id: string;
    fileName: string;
    originalFileName: string;
    status: 'completed' | 'in_progress' | 'failed' | 'queued';
    progress?: number;
    size: string;
    patientMrn?: string;
    patientName?: string;
    visitId?: string;
    sampleId?: string;
    createdAt: string;
    uploadedAt?: string;
}

// Mock Patients
export const mockPatients: MockPatient[] = [
    { id: 'p1', name: 'John Smith', mrn: '123456' },
    { id: 'p2', name: 'Jane Doe', mrn: '789012' },
    { id: 'p3', name: 'Robert Johnson', mrn: '345678' },
    { id: 'p4', name: 'Emily Davis', mrn: '901234' },
    { id: 'p5', name: 'Michael Wilson', mrn: '567890' },
];

// Mock Visits
export const mockVisits: MockVisit[] = [
    { id: 'v1', patientId: 'p1', visitId: '1234567890' },
    { id: 'v2', patientId: 'p1', visitId: '9876543210000' },
    { id: 'v3', patientId: 'p2', visitId: '1111222233' },
    { id: 'v4', patientId: 'p2', visitId: '4444555566' },
    { id: 'v5', patientId: 'p3', visitId: '7777888899' },
    { id: 'v6', patientId: 'p4', visitId: '1010101010' },
    { id: 'v7', patientId: 'p5', visitId: '2020202020' },
];

// Mock Samples
export const mockSamples: MockSample[] = [
    { id: 's1', visitId: 'v1', sampleId: '1234567890' },
    { id: 's2', visitId: 'v1', sampleId: '0987654321' },
    { id: 's3', visitId: 'v2', sampleId: '1122334455' },
    { id: 's4', visitId: 'v3', sampleId: '5566778899' },
    { id: 's5', visitId: 'v4', sampleId: '9988776655' },
    { id: 's6', visitId: 'v5', sampleId: '1357924680' },
    { id: 's7', visitId: 'v6', sampleId: '2468013579' },
    { id: 's8', visitId: 'v7', sampleId: '1472583690' },
];

// Mock Files
export const mockFiles: MockFile[] = [
    {
        id: 'f1',
        fileName: '10800152917RNA-Mr-RAMCH..._001.fastq.gz.sha256sum',
        originalFileName: 'gfbfbdfb.cvf',
        status: 'completed',
        size: '2.03 GB',
        patientMrn: '123456',
        patientName: 'Patient Name',
        visitId: '1234567890\n9876543210000',
        sampleId: '1234567890',
        createdAt: '16-June-2025 16:04:10',
        uploadedAt: '16-June-2025 16:04:10',
    },
    {
        id: 'f2',
        fileName: '10800152917RNA-Mr-RAMCH..._001.fastq.gz.sha256sum',
        originalFileName: 'gfbfbdfb.cvf',
        status: 'completed',
        size: '2.03 GB',
        patientMrn: '123456',
        patientName: 'Patient Name',
        visitId: '1234567890\n9876543210000',
        sampleId: '1234567890',
        createdAt: '16-June-2025 16:04:10',
        uploadedAt: '16-June-2025 16:04:10',
    },
    {
        id: 'f3',
        fileName: '10800152917RNA-Mr-RAMCH..._001.fastq.gz.sha256sum',
        originalFileName: 'gfbfbdfb.cvf',
        status: 'failed',
        size: '',
        patientMrn: '123456',
        patientName: 'Patient Name',
        visitId: '1234567890\n9876543210000',
        sampleId: '1234567890',
        createdAt: '16-June-2025 16:04:10',
        uploadedAt: '16-June-2025 16:04:10',
    },
    {
        id: 'f4',
        fileName: '10800152917RNA-Mr-RAMCH..._001.fastq.gz.sha256sum',
        originalFileName: 'gfbfbdfb.cvf',
        status: 'failed',
        size: '',
        visitId: '1234567890\n9876543210000',
        sampleId: '1234567890',
        createdAt: '16-June-2025 16:04:10',
        uploadedAt: '16-June-2025 16:04:10',
    },
    {
        id: 'f5',
        fileName: '10800152917RNA-Mr-RAMCH..._001.fastq.gz.sha256sum',
        originalFileName: 'gfbfbdfb.cvf',
        status: 'in_progress',
        progress: 40,
        size: '',
        visitId: '1234567890\n9876543210000',
        sampleId: '1234567890',
        createdAt: '16-June-2025 16:04:10',
        uploadedAt: '16-June-2025 16:04:10',
    },
    {
        id: 'f6',
        fileName: '10800152917RNA-Mr-RAMCH..._001.fastq.gz.sha256sum',
        originalFileName: 'gfbfbdfb.cvf',
        status: 'in_progress',
        progress: 40,
        size: '',
        patientMrn: '123456',
        patientName: 'Patient Name',
        visitId: '1234567890\n9876543210000',
        sampleId: '1234567890',
        createdAt: '16-June-2025 16:04:10',
        uploadedAt: '16-June-2025 16:04:10',
    },
    {
        id: 'f7',
        fileName: '10800152917RNA-Mr-RAMCH..._001.fastq.gz.sha256sum',
        originalFileName: 'gfbfbdfb.cvf',
        status: 'completed',
        size: '2.03 GB',
        visitId: '1234567890\n9876543210000',
        sampleId: '1234567890',
        createdAt: '16-June-2025 16:04:10',
        uploadedAt: '16-June-2025 16:04:10',
    },
];

// File type options for filtering
export const fileTypeOptions = [
    { value: '', label: 'Filter by file type....' },
    { value: 'fastq', label: 'FASTQ' },
    { value: 'fastq.gz', label: 'FASTQ.GZ' },
    { value: 'vcf', label: 'VCF' },
    { value: 'bam', label: 'BAM' },
    { value: 'pdf', label: 'PDF' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
];

// Status options for filtering
export const statusFilterOptions = [
    { value: '', label: 'Filter by status....' },
    { value: 'CANCEL', label: 'Canceled' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'ERROR', label: 'Failed' },
    { value: 'STALLED', label: 'Stalled' },
    { value: 'COMPLETED_WITH_ERROR', label: 'Completed with Errors' },
];

// Helper function to get visits for a patient
export const getVisitsForPatient = (patientId: string): MockVisit[] => {
    return mockVisits.filter(v => v.patientId === patientId);
};

// Helper function to get samples for a visit
export const getSamplesForVisit = (visitId: string): MockSample[] => {
    return mockSamples.filter(s => s.visitId === visitId);
};

