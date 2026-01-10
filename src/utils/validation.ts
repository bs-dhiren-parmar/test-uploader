import * as yup from 'yup';
import type { PatientFormData, VisitFormData, SampleFormData, AgeData } from '../types';

/**
 * Validation schemas for Patient, Visit, and Sample forms
 */

// Age schema for nested validation
const ageSchema = yup.object().shape({
    y: yup.string(),
    m: yup.string()
        .test('valid-months', 'Months should be between 0 and 12', (value) => {
            if (!value || value === '') return true;
            const months = parseInt(value, 10);
            return !isNaN(months) && months >= 0 && months <= 11;
        }),
    d: yup.string()
        .test('valid-days', 'Days should be between 0 and 31', (value) => {
            if (!value || value === '') return true;
            const days = parseInt(value, 10);
            return !isNaN(days) && days >= 0 && days <= 31;
        }),
});

// MRN validation regex for real-time validation (allows empty during typing)
export const MRN_REGEX = /^[a-zA-Z0-9_-]*$/;
// MRN validation regex for schema validation (requires at least one character)
const MRN_REGEX_REQUIRED = /^[a-zA-Z0-9_-]+$/;

// Sample ID validation regex for real-time validation (allows empty during typing)
export const SAMPLE_ID_REGEX = /^[a-zA-Z0-9_-]*$/;
// Sample ID validation regex for schema validation (requires at least one character)
const SAMPLE_ID_REGEX_REQUIRED = /^[a-zA-Z0-9_-]+$/;

// Patient form validation schema
export const patientSchema = yup.object().shape({
    first_name: yup.string().required('Name is required'),
    last_name: yup.string(),
    mrn: yup.string()
        .required('MRN is required')
        .matches(MRN_REGEX_REQUIRED, 'MRN can only contain letters, numbers, underscores (_), and hyphens (-)'),
    life_status: yup.string().required('Life Status is required'),
    dob: yup.string().when('life_status', {
        is: 'Dead',
        then: (schema) => schema.required('Date of Birth is required when life status is Dead'),
        otherwise: (schema) => schema,
    }),
    age: ageSchema.when('life_status', {
        is: (val: string) => val === 'Dead' || val === 'Alive',
        then: (schema) => schema.test(
            'age-required',
            'Age is required when life status is Alive or Dead',
            (value): boolean => {
                if (!value) return false;
                const ageValue = value as { y?: string; m?: string; d?: string };
                const hasYear = Boolean(ageValue.y && ageValue.y !== '');
                const hasMonth = Boolean(ageValue.m && ageValue.m !== '');
                const hasDay = Boolean(ageValue.d && ageValue.d !== '');
                return hasYear || hasMonth || hasDay;
            }
        ),
        otherwise: (schema) => schema,
    }),
    sex: yup.string(),
    ethnicity: yup.string(),
    phone_number: yup.string(),
    location: yup.string(),
    clinical_history: yup.string(),
    family_history: yup.string(),
    diagnosis: yup.string(),
    weight: yup.string(),
    weight_unit: yup.string(),
    height: yup.string(),
    marital_status: yup.string(),
    reffering_doctor: yup.string(),
    genotype_information: yup.string(),
});

// Visit form validation schema
export const visitSchema = yup.object().shape({
    visit_id: yup.string()
        .required('Visit ID is required')
        .trim()
        .min(1, 'Visit ID cannot be empty'),
    clinical_history: yup.string(),
    pri_physician: yup.string(),
    location: yup.string(),
    pregnancy: yup.string(),
    cancer_type: yup.string().nullable(),
    visit_type: yup.string(),
    reason_visit: yup.string(),
    // Conditional validations for pregnancy fields
    lmp_date: yup.string().when('pregnancy', {
        is: 'Yes',
        then: (schema) => schema.required('LMP Date is required when pregnancy is Yes'),
        otherwise: (schema) => schema,
    }),
    sample_collection_date: yup.string().when('pregnancy', {
        is: 'Yes',
        then: (schema) => schema.required('Sample Collection Date is required when pregnancy is Yes'),
        otherwise: (schema) => schema,
    }),
    // Conditional validation for other clinical indication
    other_clinical_indication: yup.string().when('clinical_indication', {
        is: (val: string) => val && val.includes('Others'),
        then: (schema) => schema.required('Other Clinical Indication is required when "Others" is selected'),
        otherwise: (schema) => schema,
    }),
});

// Sample validation schema
export const sampleSchema = yup.object().shape({
    sample_id: yup.string()
        .required('Sample ID is required')
        .matches(SAMPLE_ID_REGEX_REQUIRED, 'Sample ID can only contain letters, numbers, underscores (_), and hyphens (-)'),
    sample_type: yup.string(),
    sample_quality: yup.string(),
    ref_id1: yup.string(),
    ref_id2: yup.string(),
});

/**
 * Validate patient form data
 */
export const validatePatientForm = async (data: PatientFormData): Promise<{ isValid: boolean; errors: Record<string, string> }> => {
    try {
        await patientSchema.validate(data, { abortEarly: false });
        
        // Additional validation for age/dob consistency
        const errors: Record<string, string> = {};
        
        if (data.life_status === 'Alive') {
            const hasAge = data.age && (data.age.y || data.age.m || data.age.d);
            const hasDob = data.dob && data.dob !== '';
            if (!hasAge && !hasDob) {
                errors.age = 'Either Age or Date of Birth is required for Alive status';
            }
        }
        
        if (data.life_status === 'Dead') {
            const hasAge = data.age && (data.age.y || data.age.m || data.age.d);
            if (!hasAge) {
                errors.age = 'Age is required for Dead status';
            }
            if (!data.dob || data.dob === '') {
                errors.dob = 'Date of Birth is required for Dead status';
            }
        }
        
        if (Object.keys(errors).length > 0) {
            return { isValid: false, errors };
        }
        
        return { isValid: true, errors: {} };
    } catch (err) {
        if (err instanceof yup.ValidationError) {
            const errors: Record<string, string> = {};
            err.inner.forEach((e) => {
                if (e.path) {
                    errors[e.path] = e.message;
                }
            });
            return { isValid: false, errors };
        }
        throw err;
    }
};

/**
 * Validate visit form data
 */
export const validateVisitForm = async (data: VisitFormData): Promise<{ isValid: boolean; errors: Record<string, string> }> => {
    try {
        // Trim visit_id before validation
        const dataToValidate = {
            ...data,
            visit_id: data.visit_id?.trim() || '',
            // Ensure clinical_indication is a string for validation
            clinical_indication: typeof data.clinical_indication === 'string' ? data.clinical_indication : '',
        };
        await visitSchema.validate(dataToValidate, { abortEarly: false });
        return { isValid: true, errors: {} };
    } catch (err) {
        if (err instanceof yup.ValidationError) {
            const errors: Record<string, string> = {};
            err.inner.forEach((e) => {
                if (e.path) {
                    errors[e.path] = e.message;
                }
            });
            return { isValid: false, errors };
        }
        throw err;
    }
};

/**
 * Validate samples in visit form
 */
export const validateSamples = async (samples: SampleFormData[]): Promise<{ isValid: boolean; errors: Record<string, string> }> => {
    const errors: Record<string, string> = {};
    
    if (samples.length === 0) {
        return { isValid: true, errors: {} };
    }
    
    // Check for duplicate sample IDs
    const sampleIds = samples.map(s => s.sample_id).filter(id => id !== '');
    const uniqueIds = new Set(sampleIds);
    if (uniqueIds.size !== sampleIds.length) {
        errors.samples = 'Sample IDs must be unique';
        return { isValid: false, errors };
    }
    
    // Validate each sample
    for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        
        // Validate sample_id is required if sample exists
        if (!sample.sample_id || sample.sample_id.trim() === '') {
            errors[`samples[${i}].sample_id`] = 'Sample ID is required';
            continue;
        }
        
        // Validate sample_id format
        if (!SAMPLE_ID_REGEX_REQUIRED.test(sample.sample_id)) {
            errors[`samples[${i}].sample_id`] = 'Sample ID can only contain letters, numbers, underscores (_), and hyphens (-)';
        }
        
        // Validate blocks
        if (sample.blocks && sample.blocks.length > 0) {
            for (let j = 0; j < sample.blocks.length; j++) {
                const block = sample.blocks[j];
                
                // Check if block has other values but no block_id
                const hasOtherBlockValues = block.surgical_id || block.tumor_per || block.Case_Block_ID ||
                    (block.slides && block.slides.some(slide => slide.slide_id || slide.storm || slide.cellularity));
                
                if (hasOtherBlockValues && !block.block_id) {
                    errors[`samples[${i}].blocks[${j}].block_id`] = 'Block ID is required';
                }
                
                // Validate slides within blocks
                if (block.slides && block.slides.length > 0) {
                    for (let k = 0; k < block.slides.length; k++) {
                        const slide = block.slides[k];
                        const hasOtherSlideValues = slide.storm || slide.cellularity;
                        
                        if (hasOtherSlideValues && !slide.slide_id) {
                            errors[`samples[${i}].blocks[${j}].slides[${k}].slide_id`] = 'Slide ID is required';
                        }
                    }
                }
            }
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
};

/**
 * Get age from date of birth
 */
export const getAgeFromDob = (dob: string): AgeData => {
    const birthDate = new Date(dob);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    if (days < 0) {
        months--;
        const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += lastMonth.getDate();
    }
    
    if (months < 0) {
        years--;
        months += 12;
    }
    
    return {
        y: years.toString(),
        m: months.toString(),
        d: days.toString(),
    };
};

/**
 * Generate default visit ID
 */
export const generateVisitId = (mrn: string): string => {
    return `${mrn}-${Date.now()}`;
};

