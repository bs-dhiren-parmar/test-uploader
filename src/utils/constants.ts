import type { SelectOption } from "../types";

/**
 * Application constants
 */

// Chunk size for multipart upload (100MB = 100 * 1024 * 1024 bytes)
export const CHUNK_SIZE: number = 100 * 1024 * 1024;

// Supported file types and their extensions
export const FILE_TYPE: Record<string, string[]> = {
    fastq: [".fq.gz", ".fastq.gz"],
    uncompressed_fastq: [".fq", ".fastq"],
    bam: [".bam"],
    bai: [".bai", ".bam.bai"],
    vcf: [".vcf", ".vcf.idx", ".vcf.gz"],
};

// Upload statuses
export const UPLOAD_STATUS = {
    QUEUED: "QUEUED",
    IN_PROGRESS: "IN_PROGRESS",
    COMPLETED: "COMPLETED",
    COMPLETED_WITH_ERROR: "COMPLETED_WITH_ERROR",
    ERROR: "ERROR",
    CANCEL: "CANCEL",
    RETRIED_IN_PROGRESS: "RETRIED_IN_PROGRESS",
} as const;

// File type options for dropdown
export const FILE_TYPE_OPTIONS: SelectOption[] = [
    { value: "", label: "Select file type" },
    { value: "fastq", label: "FASTQ" },
    { value: "bam", label: "BAM" },
    { value: "bai", label: "BAI" },
    { value: "vcf", label: "VCF" },
    { value: "others", label: "Others" },
];

// Month names for date formatting
export const MONTHS: string[] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Life status options
export const LIFE_STATUS_OPTIONS: SelectOption[] = [
    { value: "Alive", label: "Alive" },
    { value: "Dead", label: "Dead" },
    { value: "Unknown", label: "Unknown" },
];

// Gender options
export const GENDER_OPTIONS: SelectOption[] = [
    { value: "Male", label: "Male" },
    { value: "Female", label: "Female" },
    { value: "Unknown", label: "Unknown" },
];

// Marital status options
export const MARITAL_STATUS_OPTIONS: SelectOption[] = [
    { value: "Single", label: "Single" },
    { value: "Married", label: "Married" },
    { value: "Divorced", label: "Divorced" },
    { value: "Widowed", label: "Widowed" },
    { value: "Unknown", label: "Unknown" },
];

// Pregnancy options
export const PREGNANCY_OPTIONS: SelectOption[] = [
    { value: "Yes", label: "Yes" },
    { value: "No", label: "No" },
];

// Sample type options
export const SAMPLE_TYPE_OPTIONS: SelectOption[] = [
    { value: "Amniotic Fluid", label: "Amniotic Fluid" },
    { value: "Aqueous tap", label: "Aqueous tap" },
    { value: "Ascitic Fluid", label: "Ascitic Fluid" },
    { value: "BAL FLUID", label: "BAL FLUID" },
    { value: "Biological Indicator", label: "Biological Indicator" },
    { value: "Biopsy", label: "Biopsy" },
    { value: "block", label: "Block" },
    { value: "block/slide", label: "Block/Slide" },
    { value: "Blood", label: "Blood" },
    { value: "Blood Culture Bottle", label: "Blood Culture Bottle" },
    { value: "Body Fluid", label: "Body Fluid" },
    { value: "Bone", label: "Bone" },
    { value: "Bone Marrow", label: "Bone Marrow" },
    { value: "Bone marrow aspirate EDTA", label: "Bone marrow aspirate EDTA" },
    { value: "Bone marrow aspirate Heparin", label: "Bone marrow aspirate Heparin" },
    { value: "Bone Marrow Heparin - Na", label: "Bone Marrow Heparin - Na" },
    { value: "Bronchoalveolar lavage (BAL)", label: "Bronchoalveolar lavage (BAL)" },
    { value: "Buccal swab", label: "Buccal swab" },
    { value: "CSF", label: "CSF" },
    { value: "DNA", label: "DNA" },
    { value: "EDTA Blood", label: "EDTA Blood" },
    { value: "FFPE", label: "FFPE" },
    { value: "Fluid", label: "Fluid" },
    { value: "Fresh Tissue", label: "Fresh Tissue" },
    { value: "Hair", label: "Hair" },
    { value: "Nail", label: "Nail" },
    { value: "Plasma", label: "Plasma" },
    { value: "Pleural Fluid", label: "Pleural Fluid" },
    { value: "RNA", label: "RNA" },
    { value: "Saliva", label: "Saliva" },
    { value: "Serum", label: "Serum" },
    { value: "Skin", label: "Skin" },
    { value: "Sputum", label: "Sputum" },
    { value: "Stool", label: "Stool" },
    { value: "Swab", label: "Swab" },
    { value: "Tissue", label: "Tissue" },
    { value: "Urine", label: "Urine" },
    { value: "Whole Blood", label: "Whole Blood" },
    { value: "Other", label: "Other" },
];

// Cancer type options
export const CANCER_TYPE_OPTIONS: SelectOption[] = [
    { value: "Chronic Myeloid Leukemia", label: "Chronic Myeloid Leukemia" },
    { value: "Acute Lymphoblastic Leukemia", label: "Acute Lymphoblastic Leukemia" },
    { value: "Acute Myeloid Leukemia", label: "Acute Myeloid Leukemia" },
    { value: "Thyroid Gland Anaplastic Carcinoma", label: "Thyroid Gland Anaplastic Carcinoma" },
    { value: "Angioimmunoblastic T-cell Lymphoma", label: "Angioimmunoblastic T-cell Lymphoma" },
    { value: "B-cell Lymphoma", label: "B-cell Lymphoma" },
    { value: "B-cell Adult Acute Lymphocytic Leukemia", label: "B-cell Adult Acute Lymphocytic Leukemia" },
    { value: "B-lymphoblastic Leukemia/lymphoma", label: "B-lymphoblastic Leukemia/lymphoma" },
    { value: "Basal Cell Carcinoma", label: "Basal Cell Carcinoma" },
    { value: "Blastic Plasmacytoid Dendritic Cell Neoplasm", label: "Blastic Plasmacytoid Dendritic Cell Neoplasm" },
    { value: "Breast Cancer", label: "Breast Cancer" },
    { value: "Burkitt Lymphoma", label: "Burkitt Lymphoma" },
    { value: "Prostate Cancer", label: "Prostate Cancer" },
    { value: "Cervical Cancer", label: "Cervical Cancer" },
    { value: "Cholangiocarcinoma", label: "Cholangiocarcinoma" },
    { value: "Chronic Eosinophilic Leukemia", label: "Chronic Eosinophilic Leukemia" },
    { value: "Chronic Lymphocytic Leukemia", label: "Chronic Lymphocytic Leukemia" },
    { value: "Hodgkin's Lymphoma", label: "Hodgkin's Lymphoma" },
    { value: "Non-Hodgkin Lymphoma", label: "Non-Hodgkin Lymphoma" },
    { value: "Colorectal Cancer", label: "Colorectal Cancer" },
    { value: "Endometrial Cancer", label: "Endometrial Cancer" },
    { value: "Esophageal Cancer", label: "Esophageal Cancer" },
    { value: "Gastric Cancer", label: "Gastric Cancer" },
    { value: "Glioblastoma", label: "Glioblastoma" },
    { value: "Head and Neck Cancer", label: "Head and Neck Cancer" },
    { value: "Hepatocellular Carcinoma", label: "Hepatocellular Carcinoma" },
    { value: "Kidney Cancer", label: "Kidney Cancer" },
    { value: "Lung Cancer", label: "Lung Cancer" },
    { value: "Melanoma", label: "Melanoma" },
    { value: "Multiple Myeloma", label: "Multiple Myeloma" },
    { value: "Neuroblastoma", label: "Neuroblastoma" },
    { value: "Ovarian Cancer", label: "Ovarian Cancer" },
    { value: "Pancreatic Cancer", label: "Pancreatic Cancer" },
    { value: "Sarcoma", label: "Sarcoma" },
    { value: "Thyroid Cancer", label: "Thyroid Cancer" },
    { value: "Urothelial Carcinoma", label: "Urothelial Carcinoma" },
    { value: "Other", label: "Other" },
];

// Weight unit options
export const WEIGHT_UNIT_OPTIONS: SelectOption[] = [
    { value: "kg", label: "kg" },
    { value: "lb", label: "lb" },
];

// NT (Nuchal Translucency) unit options
export const NT_UNIT_OPTIONS: SelectOption[] = [
    { value: "cm", label: "cm" },
    { value: "mm", label: "mm" },
];

// Fetus count options
export const FETUS_OPTIONS: SelectOption[] = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
];

// Pregnancy type options
export const PREGNANCY_TYPE_OPTIONS: SelectOption[] = [
    { value: "Spontaneous", label: "Spontaneous" },
    { value: "IVF", label: "IVF" },
    { value: "ICSI", label: "ICSI" },
    { value: "Donor Egg", label: "Donor Egg" },
    { value: "Donor Sperm", label: "Donor Sperm" },
    { value: "Unknown", label: "Unknown" },
];

// Clinical indication options
export const CLINICAL_INDICATION_OPTIONS: SelectOption[] = [
    { value: "AMA", label: "AMA (Advanced Maternal Age)" },
    { value: "Abnormal Serum Screen", label: "Abnormal Serum Screen" },
    { value: "Abnormal Ultrasound", label: "Abnormal Ultrasound" },
    { value: "Family History", label: "Family History" },
    { value: "Previous Affected Pregnancy", label: "Previous Affected Pregnancy" },
    { value: "Consanguinity", label: "Consanguinity" },
    { value: "Anxiety", label: "Anxiety" },
    { value: "Others", label: "Others" },
];
