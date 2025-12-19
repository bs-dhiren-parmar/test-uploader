import type { SelectOption } from '../types';

/**
 * Application constants
 */

// Chunk size for multipart upload (100MB = 100 * 1024 * 1024 bytes)
export const CHUNK_SIZE: number = 100 * 1024 * 1024;

// Supported file types and their extensions
export const FILE_TYPE: Record<string, string[]> = {
  fastq: ['.fq.gz', '.fastq.gz'],
  uncompressed_fastq: ['.fq', '.fastq'],
  bam: ['.bam'],
  bai: ['.bai', '.bam.bai'],
  vcf: ['.vcf', '.vcf.idx', '.vcf.gz']
};

// Upload statuses
export const UPLOAD_STATUS = {
  QUEUED: 'QUEUED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_ERROR: 'COMPLETED_WITH_ERROR',
  ERROR: 'ERROR',
  CANCEL: 'CANCEL',
  RETRIED_IN_PROGRESS: 'RETRIED_IN_PROGRESS'
} as const;

// File type options for dropdown
export const FILE_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select file type' },
  { value: 'fastq', label: 'FASTQ' },
  { value: 'bam', label: 'BAM' },
  { value: 'bai', label: 'BAI' },
  { value: 'vcf', label: 'VCF' },
  { value: 'others', label: 'Others' }
];

// Month names for date formatting
export const MONTHS: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
