import { AxiosResponse } from 'axios';
import api, { getBaseUrl } from './api';
import type { ApiResponse, PatientsResponse, PatientData } from '../types';

/**
 * Get all patients
 */
export const getPatients = async (): Promise<AxiosResponse<ApiResponse<PatientsResponse>>> => {
  const baseUrl = getBaseUrl();
  return api.get(`${baseUrl}/api/patients/patient`);
};

/**
 * Get patient by ID with visits and samples
 */
export const getPatientById = async (
  patientId: string
): Promise<AxiosResponse<ApiResponse<PatientData>>> => {
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
    sampleId
  });
};
