import { AxiosResponse } from "axios";
import api, { getBaseUrl } from "./api";
import type { 
    ApiResponse, 
    PatientsResponse, 
    PatientData, 
    PatientFormData, 
    VisitFormData, 
    CreatePatientResponse, 
    CreateVisitResponse 
} from "../types";

/**
 * Get all patients
 */
export const getPatients = async (): Promise<AxiosResponse<ApiResponse<PatientsResponse>>> => {
    const baseUrl = getBaseUrl();
    return api.get(`${baseUrl}/api/patients/patient`);
};

/**
 * Search patients with pagination
 */
export const searchPatients = async (
    search = '',
    page = 1
): Promise<AxiosResponse<ApiResponse<PatientsResponse & { hasMore: boolean }>>> => {
    const baseUrl = getBaseUrl();
    return api.get(`${baseUrl}/api/patients/patient?search=${encodeURIComponent(search)}&page=${page}`);
};

/**
 * Get patient by ID with visits and samples
 */
export const getPatientById = async (patientId: string): Promise<AxiosResponse<ApiResponse<PatientData>>> => {
    const baseUrl = getBaseUrl();
    return api.get(`${baseUrl}/api/patients/visits/${patientId}`);
};

/**
 * Add a new sample ID to a patient visit
 */
export const addSampleId = async (
    patientId: string,
    visitId: string,
    sampleId: string
): Promise<AxiosResponse<ApiResponse<{ samples: Record<string, string[]> }>>> => {
    const baseUrl = getBaseUrl();
    return api.post(`${baseUrl}/api/patients/add-sample-id`, {
        patientId,
        visitId,
        sampleId,
    });
};

/**
 * Create a new patient
 */
export const createPatient = async (
    patientData: PatientFormData
): Promise<AxiosResponse<ApiResponse<CreatePatientResponse>>> => {
    const baseUrl = getBaseUrl();
    
    const patientInfo = {
        id: patientData._id,
        first_name: patientData.first_name,
        last_name: patientData.last_name,
        mrn: patientData.mrn,
        reffering_doctor: patientData.reffering_doctor,
        ethnicity: patientData.ethnicity,
        sex: patientData.sex,
        dob: patientData.dob,
        age: patientData.age,
        life_status: patientData.life_status,
        pri_physician: patientData.pri_physician,
        acc_remark: patientData.acc_remark,
        phone_number: patientData.phone_number,
        location: patientData.location,
        clinical_history: patientData.clinical_history,
        hpo_terms: patientData.hpo_terms,
        gene_list: patientData.gene_list,
        disease_omim_list: patientData.disease_omim_list,
        family_history: patientData.family_history,
        diagnosis: patientData.diagnosis,
        weight: patientData.weight,
        height: patientData.height,
        genotype_information: patientData.genotype_information,
        marital_status: patientData.marital_status,
        weight_unit: patientData.weight_unit,
        counselling_date: patientData.counselling_date,
        pedigree: patientData.pedigree,
    };
    
    if (patientData._id) {
        return api.post(`${baseUrl}/api/patients/update`, patientInfo);
    }
    return api.post(`${baseUrl}/api/patients`, patientInfo);
};

/**
 * Create a patient visit with samples
 */
export const createPatientVisit = async (
    patientId: string,
    mrn: string,
    augmetId: string,
    visitData: VisitFormData
): Promise<AxiosResponse<ApiResponse<CreateVisitResponse>>> => {
    const baseUrl = getBaseUrl();
    
    const body = {
        visitData: {
            visit_id: visitData.visit_id,
            first_name: visitData.first_name,
            last_name: visitData.last_name || null,
            reason_visit: visitData.reason_visit,
            weight: visitData.weight,
            weight_unit: visitData.weight_unit,
            height: visitData.height,
            diagnosis: visitData.diagnosis,
            pri_physician: visitData.pri_physician,
            location: visitData.location,
            lims_id: visitData.lims_id,
            phone_number: visitData.phone_number,
            sample_type: visitData.sample_type,
            cancer_type: visitData.cancer_type || null,
            clinical_history: visitData.clinical_history,
            pregnancy: visitData.pregnancy,
            visit_type: visitData.visit_type,
            registration_date_time: visitData.registration_date_time,
            marker_report: visitData.marker_report,
            no_of_fetus: visitData.no_of_fetus,
            nuchal_translucency: visitData.nuchal_translucency,
            nt_unit: visitData.nt_unit,
            pregnancy_type: visitData.pregnancy_type,
            counselling_date: visitData.counselling_date,
            sample_collection_date: visitData.sample_collection_date,
            lmp_date: visitData.lmp_date,
            ga: visitData.ga,
            clinical_indication: visitData.clinical_indication,
            other_clinical_indication: visitData.other_clinical_indication,
            report_findings: visitData.report_findings,
            usg_findings: visitData.usg_findings,
            samples: visitData.samples,
            hpo_terms: visitData.hpo_terms || [],
            disease_omim_list: visitData.disease_omim_list,
            gene_list: visitData.gene_list,
            custom_forms: visitData.custom_forms,
            form_ids: visitData.form_ids,
            ClnclHstryVrFlg: visitData.ClnclHstryVrFlg,
            ClnclHstryVrAt: visitData.ClnclHstryVrAt,
            ClnclHstryVrBy: visitData.ClnclHstryVrBy,
            ClnclHstryVrByNm: visitData.ClnclHstryVrByNm,
            VrExtrctFrmFls: visitData.VrExtrctFrmFls,
            VrExtrctHpTrms: visitData.VrExtrctHpTrms,
            ClnclHstryUpdtdBy: visitData.ClnclHstryUpdtdBy,
            ClnclHstryUpdtdByNm: visitData.ClnclHstryUpdtdByNm,
            ClnclHstryUpdtdAt: visitData.ClnclHstryUpdtdAt,
        },
        patient_id: patientId,
        mrn,
        augmet_id: augmetId,
    };
    
    return api.post(`${baseUrl}/api/patients/visit`, body);
};

/**
 * Validate if a sample ID already exists
 */
export const validateSampleId = async (
    sampleId: string,
    visitId: string,
    patientId: string
): Promise<AxiosResponse<ApiResponse<{ isExist: boolean }>>> => {
    const baseUrl = getBaseUrl();
    return api.get(
        `${baseUrl}/api/patients/validate-sample-id?sample_id=${encodeURIComponent(sampleId)}&visit_id=${encodeURIComponent(visitId)}&patient_id=${encodeURIComponent(patientId)}`
    );
};

/**
 * Fetch patient details from LIMS using MRN
 */
export interface LimsPatientDetails {
    mrn: string;
    first_name?: string;
    last_name?: string;
    sex?: string;
    dob?: string;
    age?: { y: string; m: string; d: string };
    phone_number?: string;
    ethnicity?: string;
    location?: string;
    life_status?: string;
    clinical_history?: string;
    reffering_doctor?: string;
    pri_physician?: string;
    acc_remark?: string;
    family_history?: string;
    diagnosis?: string;
    weight?: string;
    height?: string;
    marital_status?: string;
    genotype_information?: string;
    counselling_date?: string;
    pedigree?: string;
    [key: string]: unknown;
}

export interface FetchFromLimsResponse {
    patientDetail: LimsPatientDetails;
    originalPatientDetail?: LimsPatientDetails;
    patientVisitDetails?: unknown;
    isTempPatientCreated?: boolean;
    redirect?: boolean;
    patientId?: string;
    tempPatientDetails?: { Dt?: { _id: string } };
}

export const fetchPatientFromLims = async (
    mrn: string,
    addNewPatient = true,
    patientId?: string
): Promise<AxiosResponse<ApiResponse<FetchFromLimsResponse>>> => {
    const baseUrl = getBaseUrl();
    const params = new URLSearchParams({
        limsId: mrn,
        addNewPatient: String(addNewPatient),
    });
    if (patientId) {
        params.append('patientID', patientId);
    }
    return api.get(`${baseUrl}/api/patients/get-patient-details-limsId?${params.toString()}`);
};
