import React, { useState, useCallback } from 'react';
import Select from 'react-select';
import type { SingleValue } from 'react-select';
import { reactSelectStyles } from '../../utils/reactSelectStyles';
import { createPatient, createPatientVisit, fetchPatientFromLims } from '../../services/patientService';
import { validatePatientForm, validateVisitForm, validateSamples, generateVisitId, getAgeFromDob } from '../../utils/validation';
import {
    LIFE_STATUS_OPTIONS,
    GENDER_OPTIONS,
    MARITAL_STATUS_OPTIONS,
    SAMPLE_TYPE_OPTIONS,
    CANCER_TYPE_OPTIONS,
    PREGNANCY_OPTIONS,
    WEIGHT_UNIT_OPTIONS,
    NT_UNIT_OPTIONS,
    FETUS_OPTIONS,
    PREGNANCY_TYPE_OPTIONS,
    CLINICAL_INDICATION_OPTIONS,
} from '../../utils/constants';
import type {
    PatientFormData,
    VisitFormData,
    SampleFormData,
    BlockFormData,
    SlideFormData,
    SelectOption,
    PatientFormErrors,
    VisitFormErrors,
    AgeData,
    GaData,
} from '../../types';

interface AddPatientsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

type WizardStep = 1 | 2 | 3;

const getDefaultPatientForm = (): PatientFormData => ({
    _id: null,
    first_name: '',
    last_name: '',
    mrn: '',
    reffering_doctor: '',
    ethnicity: '',
    sex: '',
    dob: '',
    age: { y: '', m: '', d: '' },
    life_status: '',
    pri_physician: '',
    acc_remark: '',
    phone_number: '',
    location: '',
    clinical_history: '',
    family_history: '',
    diagnosis: '',
    weight: '',
    weight_unit: 'kg',
    height: '',
    marital_status: '',
    genotype_information: '',
    counselling_date: '',
    pedigree: '',
    hpo_terms: [],
    gene_list: [],
    disease_omim_list: [],
});

const getDefaultVisitForm = (mrn: string): VisitFormData => ({
    visit_id: generateVisitId(mrn),
    first_name: '',
    last_name: null,
    reason_visit: '',
    weight: '',
    weight_unit: 'kg',
    height: '',
    diagnosis: '',
    pri_physician: '',
    location: '',
    lims_id: '',
    phone_number: '',
    sample_type: '',
    cancer_type: null,
    clinical_history: '',
    pregnancy: 'No',
    visit_type: '',
    registration_date_time: '',
    marker_report: '',
    no_of_fetus: '',
    nuchal_translucency: '',
    nt_unit: 'cm',
    pregnancy_type: '',
    counselling_date: '',
    sample_collection_date: '',
    lmp_date: '',
    ga: { w: '', d: '' },
    clinical_indication: '',
    other_clinical_indication: '',
    report_findings: '',
    usg_findings: '',
    samples: [],
    hpo_terms: [],
    disease_omim_list: [],
    gene_list: [],
    custom_forms: null,
    form_ids: null,
    ClnclHstryVrFlg: false,
    ClnclHstryVrAt: '',
    ClnclHstryVrBy: '',
    ClnclHstryVrByNm: '',
    VrExtrctFrmFls: false,
    VrExtrctHpTrms: false,
    ClnclHstryUpdtdBy: '',
    ClnclHstryUpdtdByNm: '',
    ClnclHstryUpdtdAt: '',
});

const getDefaultSample = (): SampleFormData => ({
    sample_id: '',
    sample_type: '',
    sample_quality: '',
    sample_volume: '',
    ref_id1: '',
    ref_id2: '',
    sample_date_time: '',
    blocks: [],
});

const getDefaultSlide = (): SlideFormData => ({
    slide_id: '',
    storm: '',
    cellularity: '',
});

const getDefaultBlock = (): BlockFormData => ({
    block_id: '',
    Case_Block_ID: '',
    surgical_id: '',
    tumor_per: '',
    slides: [getDefaultSlide()],
});

const AddPatientsModal: React.FC<AddPatientsModalProps> = ({ isOpen, onClose, onSuccess }) => {
    // Wizard state
    const [currentStep, setCurrentStep] = useState<WizardStep>(1);
    
    // Form states
    const [patientForm, setPatientForm] = useState<PatientFormData>(getDefaultPatientForm());
    const [visitForm, setVisitForm] = useState<VisitFormData>(getDefaultVisitForm(''));
    
    // Error states
    const [patientErrors, setPatientErrors] = useState<PatientFormErrors>({});
    const [visitErrors, setVisitErrors] = useState<VisitFormErrors>({});
    const [sampleErrors, setSampleErrors] = useState<Record<string, string>>({});
    
    // Loading states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isFetchingFromLims, setIsFetchingFromLims] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [fetchSuccess, setFetchSuccess] = useState<string | null>(null);
    
    // Expanded sample state for accordion
    const [expandedSample, setExpandedSample] = useState<number>(-1);

    // Reset form when modal closes
    const resetForm = useCallback(() => {
        setCurrentStep(1);
        setPatientForm(getDefaultPatientForm());
        setVisitForm(getDefaultVisitForm(''));
        setPatientErrors({});
        setVisitErrors({});
        setSampleErrors({});
        setSubmitError(null);
        setExpandedSample(-1);
        setFetchError(null);
        setFetchSuccess(null);
    }, []);

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    // Patient form handlers
    const handlePatientChange = (field: keyof PatientFormData, value: string | SelectOption[] | AgeData) => {
        setPatientForm(prev => ({ ...prev, [field]: value }));
        // Clear error when field is edited
        if (patientErrors[field]) {
            setPatientErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleAgeChange = (field: keyof AgeData, value: string) => {
        setPatientForm(prev => ({
            ...prev,
            age: { ...prev.age, [field]: value },
        }));
        if (patientErrors.age) {
            setPatientErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.age;
                return newErrors;
            });
        }
    };

    const handleDobChange = (value: string) => {
        setPatientForm(prev => {
            const newForm = { ...prev, dob: value };
            // Auto-calculate age from DOB
            if (value) {
                newForm.age = getAgeFromDob(value);
            }
            return newForm;
        });
        if (patientErrors.dob) {
            setPatientErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.dob;
                return newErrors;
            });
        }
    };

    // Fetch patient details from LIMS using MRN
    const handleFetchFromLims = async () => {
        if (!patientForm.mrn.trim()) {
            setFetchError('Please enter MRN to fetch details');
            return;
        }

        setIsFetchingFromLims(true);
        setFetchError(null);
        setFetchSuccess(null);

        try {
            const response = await fetchPatientFromLims(patientForm.mrn.trim(), true);
            
            if (response.data?.success) {
                const patientDetail = response.data.data?.patientDetail;
                
                if (!patientDetail?.mrn) {
                    setFetchError(`Patient with MRN ${patientForm.mrn} not found in LIMS`);
                    return;
                }

                // Calculate age from DOB if available, otherwise use LIMS age data
                const limsAge = patientDetail.age && typeof patientDetail.age === 'object' 
                    ? patientDetail.age 
                    : null;
                const calculatedAge = patientDetail.dob 
                    ? getAgeFromDob(patientDetail.dob) 
                    : limsAge;

                // Populate form with fetched data
                setPatientForm(prev => ({
                    ...prev,
                    first_name: patientDetail.first_name ?? prev.first_name,
                    last_name: patientDetail.last_name ?? prev.last_name,
                    reffering_doctor: patientDetail.reffering_doctor ?? prev.reffering_doctor,
                    ethnicity: patientDetail.ethnicity ?? prev.ethnicity,
                    sex: patientDetail.sex ?? prev.sex,
                    dob: patientDetail.dob ?? prev.dob,
                    age: calculatedAge ?? prev.age,
                    life_status: patientDetail.life_status ?? prev.life_status,
                    pri_physician: patientDetail.pri_physician ?? prev.pri_physician,
                    acc_remark: patientDetail.acc_remark ?? prev.acc_remark,
                    phone_number: patientDetail.phone_number ?? prev.phone_number,
                    location: patientDetail.location ?? prev.location,
                    clinical_history: patientDetail.clinical_history ?? prev.clinical_history,
                    family_history: patientDetail.family_history ?? prev.family_history,
                    diagnosis: patientDetail.diagnosis ?? prev.diagnosis,
                    weight: patientDetail.weight ?? prev.weight,
                    height: patientDetail.height ?? prev.height,
                    marital_status: patientDetail.marital_status ?? prev.marital_status,
                    genotype_information: patientDetail.genotype_information ?? prev.genotype_information,
                    counselling_date: patientDetail.counselling_date ?? prev.counselling_date,
                    pedigree: patientDetail.pedigree ?? prev.pedigree,
                }));

                setFetchSuccess('Patient details fetched successfully from LIMS');
                
                // Clear success message after 3 seconds
                setTimeout(() => setFetchSuccess(null), 3000);
            } else {
                setFetchError(response.data?.message || 'Failed to fetch patient details from LIMS');
            }
        } catch (error) {
            console.error('Error fetching from LIMS:', error);
            setFetchError('An error occurred while fetching from LIMS for MRN: ' + patientForm.mrn);
            setPatientForm({
                ...patientForm,
                mrn: '',
            })
        } finally {
            setIsFetchingFromLims(false);
        }
    };

    // Visit form handlers
    const handleVisitChange = (field: keyof VisitFormData, value: string | SelectOption[] | GaData) => {
        setVisitForm(prev => ({ ...prev, [field]: value }));
        if (visitErrors[field]) {
            setVisitErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    // GA (Gestational Age) change handler
    const handleGAChange = (field: 'w' | 'd', value: string) => {
        setVisitForm(prev => ({
            ...prev,
            ga: { ...prev.ga, [field]: value },
        }));
    };

    // Calculate GA from LMP and sample collection date
    const calculateGA = (lmpDate: string, collectionDate: string): GaData => {
        if (!lmpDate || !collectionDate) return { w: '', d: '' };
        
        const lmp = new Date(lmpDate);
        const collection = new Date(collectionDate);
        
        if (isNaN(lmp.getTime()) || isNaN(collection.getTime())) return { w: '', d: '' };
        
        const diffMs = collection.getTime() - lmp.getTime();
        if (diffMs < 0) return { w: '', d: '' };
        
        const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const weeks = Math.floor(totalDays / 7);
        const days = totalDays % 7;
        
        return { w: weeks.toString(), d: days.toString() };
    };

    // Handle LMP date change with GA calculation
    const handleLmpDateChange = (value: string) => {
        const ga = calculateGA(value, visitForm.sample_collection_date);
        setVisitForm(prev => ({ ...prev, lmp_date: value, ga }));
    };

    // Handle Sample Collection date change with GA calculation
    const handleSampleCollectionDateChange = (value: string) => {
        const ga = calculateGA(visitForm.lmp_date, value);
        setVisitForm(prev => ({ ...prev, sample_collection_date: value, ga }));
    };

    // Check if pregnancy fields should be shown (only for Female patients)
    const showPregnancyField = patientForm.sex === 'Female';
    const showPregnancyDetails = showPregnancyField && visitForm.pregnancy === 'Yes';

    // Check if clinical indication includes "Others"
    const showOtherClinicalIndication = visitForm.clinical_indication.includes('Others');

    // Sample handlers
    const addSample = () => {
        setVisitForm(prev => ({
            ...prev,
            samples: [...prev.samples, getDefaultSample()],
        }));
        setExpandedSample(visitForm.samples.length);
    };

    const removeSample = (index: number) => {
        setVisitForm(prev => ({
            ...prev,
            samples: prev.samples.filter((_, i) => i !== index),
        }));
        if (expandedSample === index) {
            setExpandedSample(-1);
        } else if (expandedSample > index) {
            setExpandedSample(expandedSample - 1);
        }
    };

    const handleSampleChange = (index: number, field: keyof SampleFormData, value: string) => {
        setVisitForm(prev => ({
            ...prev,
            samples: prev.samples.map((sample, i) =>
                i === index ? { ...sample, [field]: value } : sample
            ),
        }));
        // Clear sample error
        const errorKey = `samples[${index}].${field}`;
        if (sampleErrors[errorKey]) {
            setSampleErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    // Block handlers
    const addBlock = (sampleIndex: number) => {
        setVisitForm(prev => ({
            ...prev,
            samples: prev.samples.map((sample, i) =>
                i === sampleIndex
                    ? { ...sample, blocks: [...sample.blocks, getDefaultBlock()] }
                    : sample
            ),
        }));
    };

    const removeBlock = (sampleIndex: number, blockIndex: number) => {
        setVisitForm(prev => ({
            ...prev,
            samples: prev.samples.map((sample, i) =>
                i === sampleIndex
                    ? { ...sample, blocks: sample.blocks.filter((_, bi) => bi !== blockIndex) }
                    : sample
            ),
        }));
    };

    const handleBlockChange = (sampleIndex: number, blockIndex: number, field: keyof BlockFormData, value: string) => {
        setVisitForm(prev => ({
            ...prev,
            samples: prev.samples.map((sample, si) =>
                si === sampleIndex
                    ? {
                        ...sample,
                        blocks: sample.blocks.map((block, bi) =>
                            bi === blockIndex ? { ...block, [field]: value } : block
                        ),
                    }
                    : sample
            ),
        }));
    };

    // Slide handlers
    const addSlide = (sampleIndex: number, blockIndex: number) => {
        setVisitForm(prev => ({
            ...prev,
            samples: prev.samples.map((sample, si) =>
                si === sampleIndex
                    ? {
                        ...sample,
                        blocks: sample.blocks.map((block, bi) =>
                            bi === blockIndex
                                ? { ...block, slides: [...block.slides, getDefaultSlide()] }
                                : block
                        ),
                    }
                    : sample
            ),
        }));
    };

    const removeSlide = (sampleIndex: number, blockIndex: number, slideIndex: number) => {
        setVisitForm(prev => ({
            ...prev,
            samples: prev.samples.map((sample, si) =>
                si === sampleIndex
                    ? {
                        ...sample,
                        blocks: sample.blocks.map((block, bi) =>
                            bi === blockIndex
                                ? { ...block, slides: block.slides.filter((_, sli) => sli !== slideIndex) }
                                : block
                        ),
                    }
                    : sample
            ),
        }));
    };

    const handleSlideChange = (
        sampleIndex: number,
        blockIndex: number,
        slideIndex: number,
        field: keyof SlideFormData,
        value: string
    ) => {
        setVisitForm(prev => ({
            ...prev,
            samples: prev.samples.map((sample, si) =>
                si === sampleIndex
                    ? {
                        ...sample,
                        blocks: sample.blocks.map((block, bi) =>
                            bi === blockIndex
                                ? {
                                    ...block,
                                    slides: block.slides.map((slide, sli) =>
                                        sli === slideIndex ? { ...slide, [field]: value } : slide
                                    ),
                                }
                                : block
                        ),
                    }
                    : sample
            ),
        }));
    };

    // Navigation handlers
    const handleNext = async () => {
        if (currentStep === 1) {
            const { isValid, errors } = await validatePatientForm(patientForm);
            if (!isValid) {
                setPatientErrors(errors);
                return;
            }
            // Update visit form with MRN-based visit ID
            setVisitForm(prev => ({
                ...prev,
                visit_id: generateVisitId(patientForm.mrn),
            }));
            setCurrentStep(2);
        } else if (currentStep === 2) {
            const { isValid, errors } = await validateVisitForm(visitForm);
            if (!isValid) {
                setVisitErrors(errors);
                return;
            }
            setCurrentStep(3);
        }
    };

    const handleBack = () => {
        if (currentStep === 2) {
            setCurrentStep(1);
        } else if (currentStep === 3) {
            setCurrentStep(2);
        }
    };

    const handleSave = async () => {
        // Validate samples
        const { isValid: samplesValid, errors: samplesErrors } = await validateSamples(visitForm.samples);
        if (!samplesValid) {
            setSampleErrors(samplesErrors);
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Step 1: Create patient
            const patientResponse = await createPatient(patientForm);
            
            if (!patientResponse.data?.success) {
                throw new Error(patientResponse.data?.message || 'Failed to create patient');
            }

            const { patientId, augmetId } = patientResponse.data.data;

            // Step 2: Create visit with samples if there are samples
            if (visitForm.samples.length > 0 || visitForm.visit_id) {
                const visitResponse = await createPatientVisit(
                    patientId,
                    patientForm.mrn,
                    augmetId,
                    visitForm
                );

                if (!visitResponse.data?.success) {
                    throw new Error(visitResponse.data?.message || 'Failed to create visit');
                }
            }

            // Success
            handleClose();
            onSuccess?.();
        } catch (error) {
            console.error('Error creating patient:', error);
            setSubmitError(error instanceof Error ? error.message : 'An error occurred while saving');
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleSampleExpand = (index: number) => {
        setExpandedSample(expandedSample === index ? -1 : index);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content modal-large">
                <div className="modal-header">
                    <h2 className="modal-title">Add Patient</h2>
                    {/* Wizard Steps Indicator */}
                    <div className="wizard-steps">
                        <div className={`wizard-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
                            <span className="wizard-step-number">1</span>
                            <span className="wizard-step-label">Patient Info</span>
                        </div>
                        <div className="wizard-step-connector" />
                        <div className={`wizard-step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
                            <span className="wizard-step-number">2</span>
                            <span className="wizard-step-label">Visit Info</span>
                        </div>
                        <div className="wizard-step-connector" />
                        <div className={`wizard-step ${currentStep >= 3 ? 'active' : ''}`}>
                            <span className="wizard-step-number">3</span>
                            <span className="wizard-step-label">Samples</span>
                        </div>
                    </div>
                    <button className="modal-close" onClick={handleClose} disabled={isSubmitting}>
                        ×
                    </button>
                </div>


                <div className="modal-body wizard-body">
                    {submitError && (
                        <div className="wizard-error">
                            {submitError}
                            <button onClick={() => setSubmitError(null)}>×</button>
                        </div>
                    )}

                    {/* Step 1: Patient Info */}
                    {currentStep === 1 && (
                        <div className="wizard-form-section">
                            {/* Fetch status messages */}
                            {fetchError && (
                                <div className="wizard-error" style={{ marginBottom: '1rem' }}>
                                    {fetchError}
                                    <button onClick={() => setFetchError(null)}>×</button>
                                </div>
                            )}
                            {fetchSuccess && (
                                <div className="wizard-success" style={{ marginBottom: '1rem' }}>
                                    {fetchSuccess}
                                </div>
                            )}

                            {/* Row 1: First Name, Last Name */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        First Name <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={`form-input ${patientErrors.first_name ? 'error' : ''}`}
                                        value={patientForm.first_name}
                                        onChange={(e) => handlePatientChange('first_name', e.target.value)}
                                        placeholder="Enter first name"
                                    />
                                    {patientErrors.first_name && (
                                        <span className="field-error">{patientErrors.first_name}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Last Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={patientForm.last_name}
                                        onChange={(e) => handlePatientChange('last_name', e.target.value)}
                                        placeholder="Enter last name"
                                    />
                                </div>
                            </div>

                            {/* Row 2: MRN, Referring Doctor */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        MRN <span className="required">*</span>
                                    </label>
                                    <div className="input-with-button">
                                        <input
                                            type="text"
                                            className={`form-input ${patientErrors.mrn ? 'error' : ''}`}
                                            value={patientForm.mrn}
                                            onChange={(e) => handlePatientChange('mrn', e.target.value)}
                                            placeholder="Enter MRN"
                                        />
                                        <button 
                                            type="button"
                                            className="btn-fetch"
                                            onClick={handleFetchFromLims}
                                            disabled={isFetchingFromLims || !patientForm.mrn.trim()}
                                        >
                                            {isFetchingFromLims ? 'Fetching...' : 'Fetch'}
                                        </button>
                                    </div>
                                    {patientErrors.mrn && (
                                        <span className="field-error">{patientErrors.mrn}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Referring Doctor</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={patientForm.reffering_doctor}
                                        onChange={(e) => handlePatientChange('reffering_doctor', e.target.value)}
                                        placeholder="Enter referring doctor"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Ethnicity, Sex */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Ethnicity</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={patientForm.ethnicity}
                                        onChange={(e) => handlePatientChange('ethnicity', e.target.value)}
                                        placeholder="Enter ethnicity"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Sex</label>
                                    <Select<SelectOption>
                                        options={GENDER_OPTIONS}
                                        value={GENDER_OPTIONS.find(o => o.value === patientForm.sex) || null}
                                        onChange={(option: SingleValue<SelectOption>) => 
                                            handlePatientChange('sex', option?.value || '')
                                        }
                                        placeholder="Select sex"
                                        isClearable
                                        styles={reactSelectStyles<SelectOption>()}
                                        classNamePrefix="react-select"
                                    />
                                </div>
                            </div>

                            {/* Row 4: DOB, Age */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        Date of Birth {patientForm.life_status === 'Dead' && <span className="required">*</span>}
                                    </label>
                                    <input
                                        type="date"
                                        className={`form-input ${patientErrors.dob ? 'error' : ''}`}
                                        value={patientForm.dob}
                                        onChange={(e) => handleDobChange(e.target.value)}
                                    />
                                    {patientErrors.dob && (
                                        <span className="field-error">{patientErrors.dob}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        Age {(patientForm.life_status === 'Alive' || patientForm.life_status === 'Dead') && 
                                            <span className="required">*</span>}
                                    </label>
                                    <div className="age-input-group">
                                        <div className="age-field">
                                            <input
                                                type="number"
                                                className="form-input age-input"
                                                value={patientForm.age.y}
                                                onChange={(e) => handleAgeChange('y', e.target.value)}
                                                placeholder="0"
                                                min="0"
                                                disabled={true}
                                            />
                                            <span className="age-label">Years</span>
                                        </div>
                                        <div className="age-field">
                                            <input
                                                type="number"
                                                className="form-input age-input"
                                                value={patientForm.age.m}
                                                onChange={(e) => handleAgeChange('m', e.target.value)}
                                                placeholder="0"
                                                min="0"
                                                max="12"
                                                disabled={true}
                                            />
                                            <span className="age-label">Months</span>
                                        </div>
                                        <div className="age-field">
                                            <input
                                                type="number"
                                                className="form-input age-input"
                                                value={patientForm.age.d}
                                                onChange={(e) => handleAgeChange('d', e.target.value)}
                                                placeholder="0"
                                                min="0"
                                                max="31"
                                                disabled={true}
                                            />
                                            <span className="age-label">Days</span>
                                        </div>
                                    </div>
                                    {patientErrors.age && (
                                        <span className="field-error">{patientErrors.age}</span>
                                    )}
                                </div>
                            </div>

                            {/* Row 5: Life Status, Primary Physician */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        Life Status <span className="required">*</span>
                                    </label>
                                    <Select<SelectOption>
                                        options={LIFE_STATUS_OPTIONS}
                                        value={LIFE_STATUS_OPTIONS.find(o => o.value === patientForm.life_status) || null}
                                        onChange={(option: SingleValue<SelectOption>) => 
                                            handlePatientChange('life_status', option?.value || '')
                                        }
                                        placeholder="Select life status"
                                        isClearable
                                        styles={reactSelectStyles<SelectOption>()}
                                        classNamePrefix="react-select"
                                    />
                                    {patientErrors.life_status && (
                                        <span className="field-error">{patientErrors.life_status}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Primary Physician</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={patientForm.pri_physician}
                                        onChange={(e) => handlePatientChange('pri_physician', e.target.value)}
                                        placeholder="Enter primary physician"
                                    />
                                </div>
                            </div>

                            {/* Row 6: Acc Remark */}
                            <div className="form-row full-width">
                                <div className="form-group">
                                    <label className="form-label">Acc Remark</label>
                                    <textarea
                                        className="form-textarea"
                                        value={patientForm.acc_remark}
                                        onChange={(e) => handlePatientChange('acc_remark', e.target.value)}
                                        placeholder="Enter acc remark"
                                        rows={2}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Visit Info */}
                    {currentStep === 2 && (
                        <div className="wizard-form-section">
                            {/* Row 1: Visit ID, Reason for Visit */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">
                                        Visit ID <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className={`form-input ${visitErrors.visit_id ? 'error' : ''}`}
                                        value={visitForm.visit_id}
                                        onChange={(e) => handleVisitChange('visit_id', e.target.value)}
                                        placeholder="Enter visit ID"
                                    />
                                    {visitErrors.visit_id && (
                                        <span className="field-error">{visitErrors.visit_id}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reason for Visit</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={visitForm.reason_visit}
                                        onChange={(e) => handleVisitChange('reason_visit', e.target.value)}
                                        placeholder="Enter reason for visit"
                                    />
                                </div>
                            </div>

                            {/* Row 2: Weight, Height */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Weight</label>
                                    <div className="input-with-select">
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={visitForm.weight}
                                            onChange={(e) => handleVisitChange('weight', e.target.value)}
                                            placeholder="0"
                                        />
                                        <Select<SelectOption>
                                            options={WEIGHT_UNIT_OPTIONS}
                                            value={WEIGHT_UNIT_OPTIONS.find(o => o.value === visitForm.weight_unit) || WEIGHT_UNIT_OPTIONS[0]}
                                            onChange={(option: SingleValue<SelectOption>) => 
                                                handleVisitChange('weight_unit', option?.value || 'kg')
                                            }
                                            styles={reactSelectStyles<SelectOption>()}
                                            classNamePrefix="react-select"
                                            className="unit-select"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Height (cm)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={visitForm.height}
                                        onChange={(e) => handleVisitChange('height', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Diagnosis, Primary Physician */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Diagnosis</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={visitForm.diagnosis}
                                        onChange={(e) => handleVisitChange('diagnosis', e.target.value)}
                                        placeholder="Enter diagnosis"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Primary Physician</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={visitForm.pri_physician}
                                        onChange={(e) => handleVisitChange('pri_physician', e.target.value)}
                                        placeholder="Enter primary physician"
                                    />
                                </div>
                            </div>

                            {/* Row 4: Location, Cancer Type */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={visitForm.location}
                                        onChange={(e) => handleVisitChange('location', e.target.value)}
                                        placeholder="Enter location"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cancer Type</label>
                                    <Select<SelectOption>
                                        options={CANCER_TYPE_OPTIONS}
                                        value={CANCER_TYPE_OPTIONS.find(o => o.value === visitForm.cancer_type) || null}
                                        onChange={(option: SingleValue<SelectOption>) => 
                                            handleVisitChange('cancer_type', option?.value || '')
                                        }
                                        placeholder="Select cancer type"
                                        isClearable
                                        styles={reactSelectStyles<SelectOption>()}
                                        classNamePrefix="react-select"
                                    />
                                </div>
                            </div>

                            {/* Additional Visit Fields Section */}
                            <h4 className="form-subsection-title">Additional Information</h4>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Visit Type</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={visitForm.visit_type}
                                        onChange={(e) => handleVisitChange('visit_type', e.target.value)}
                                        placeholder="Enter visit type"
                                    />
                                </div>
                                {showPregnancyField && (
                                    <div className="form-group">
                                        <label className="form-label">Pregnant</label>
                                        <Select<SelectOption>
                                            options={PREGNANCY_OPTIONS}
                                            value={PREGNANCY_OPTIONS.find(o => o.value === visitForm.pregnancy) || PREGNANCY_OPTIONS[1]}
                                            onChange={(option: SingleValue<SelectOption>) => 
                                                handleVisitChange('pregnancy', option?.value || 'No')
                                            }
                                            styles={reactSelectStyles<SelectOption>()}
                                            classNamePrefix="react-select"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Counselling Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={visitForm.counselling_date}
                                        onChange={(e) => handleVisitChange('counselling_date', e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    {/* Empty for alignment */}
                                </div>
                            </div>

                            {/* Pregnancy Details Section - Only shown when pregnancy=Yes and gender=Female */}
                            {showPregnancyDetails && (
                                <>
                                    <h4 className="form-subsection-title">Pregnancy Details</h4>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">LMP Date</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={visitForm.lmp_date}
                                                onChange={(e) => handleLmpDateChange(e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Sample Collection Date</label>
                                            <input
                                                type="date"
                                                className="form-input"
                                                value={visitForm.sample_collection_date}
                                                onChange={(e) => handleSampleCollectionDateChange(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">GA (Gestational Age)</label>
                                            <div className="ga-input-group">
                                                <div className="ga-field">
                                                    <input
                                                        type="number"
                                                        className="form-input ga-input"
                                                        value={visitForm.ga?.w || ''}
                                                        onChange={(e) => handleGAChange('w', e.target.value)}
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                    <span className="ga-label">Weeks</span>
                                                </div>
                                                <div className="ga-field">
                                                    <input
                                                        type="number"
                                                        className="form-input ga-input"
                                                        value={visitForm.ga?.d || ''}
                                                        onChange={(e) => handleGAChange('d', e.target.value)}
                                                        placeholder="0"
                                                        min="0"
                                                        max="6"
                                                    />
                                                    <span className="ga-label">Days</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">No. of Fetus</label>
                                            <Select<SelectOption>
                                                options={FETUS_OPTIONS}
                                                value={FETUS_OPTIONS.find(o => o.value === visitForm.no_of_fetus) || null}
                                                onChange={(option: SingleValue<SelectOption>) => 
                                                    handleVisitChange('no_of_fetus', option?.value || '')
                                                }
                                                placeholder="Select"
                                                isClearable
                                                styles={reactSelectStyles<SelectOption>()}
                                                classNamePrefix="react-select"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Pregnancy Type</label>
                                            <Select<SelectOption>
                                                options={PREGNANCY_TYPE_OPTIONS}
                                                value={PREGNANCY_TYPE_OPTIONS.find(o => o.value === visitForm.pregnancy_type) || null}
                                                onChange={(option: SingleValue<SelectOption>) => 
                                                    handleVisitChange('pregnancy_type', option?.value || '')
                                                }
                                                placeholder="Select pregnancy type"
                                                isClearable
                                                styles={reactSelectStyles<SelectOption>()}
                                                classNamePrefix="react-select"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Marker Report</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={visitForm.marker_report}
                                                onChange={(e) => handleVisitChange('marker_report', e.target.value)}
                                                placeholder="Enter marker report"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">N.T - Nuchal Translucency</label>
                                            <div className="input-with-select">
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    value={visitForm.nuchal_translucency}
                                                    onChange={(e) => handleVisitChange('nuchal_translucency', e.target.value)}
                                                    placeholder="0"
                                                />
                                                <Select<SelectOption>
                                                    options={NT_UNIT_OPTIONS}
                                                    value={NT_UNIT_OPTIONS.find(o => o.value === visitForm.nt_unit) || NT_UNIT_OPTIONS[0]}
                                                    onChange={(option: SingleValue<SelectOption>) => 
                                                        handleVisitChange('nt_unit', option?.value || 'cm')
                                                    }
                                                    styles={reactSelectStyles<SelectOption>()}
                                                    classNamePrefix="react-select"
                                                    className="unit-select"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Report Findings</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={visitForm.report_findings}
                                                onChange={(e) => handleVisitChange('report_findings', e.target.value)}
                                                placeholder="Enter report findings"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">USG Findings</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={visitForm.usg_findings}
                                                onChange={(e) => handleVisitChange('usg_findings', e.target.value)}
                                                placeholder="Enter USG findings"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Clinical Indication</label>
                                            <Select<SelectOption, true>
                                                options={CLINICAL_INDICATION_OPTIONS}
                                                value={CLINICAL_INDICATION_OPTIONS.filter(o => 
                                                    visitForm.clinical_indication.split(',').includes(o.value)
                                                )}
                                                onChange={(options) => {
                                                    const values = options ? options.map(o => o.value).join(',') : '';
                                                    handleVisitChange('clinical_indication', values);
                                                }}
                                                placeholder="Select clinical indication"
                                                isMulti
                                                isClearable
                                                styles={reactSelectStyles<SelectOption, true>()}
                                                classNamePrefix="react-select"
                                            />
                                        </div>
                                    </div>

                                    {showOtherClinicalIndication && (
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Other Clinical Indication</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={visitForm.other_clinical_indication}
                                                    onChange={(e) => handleVisitChange('other_clinical_indication', e.target.value)}
                                                    placeholder="Enter other clinical indication"
                                                />
                                            </div>
                                            <div className="form-group">
                                                {/* Empty for alignment */}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="form-row full-width">
                                <div className="form-group">
                                    <label className="form-label">Clinical History</label>
                                    <textarea
                                        className="form-textarea"
                                        value={visitForm.clinical_history}
                                        onChange={(e) => handleVisitChange('clinical_history', e.target.value)}
                                        placeholder="Enter clinical history for this visit"
                                        rows={4}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Samples */}
                    {currentStep === 3 && (
                        <div className="wizard-form-section">
                            <div className="section-header">
                                {/* <h3 className="form-section-title">Samples</h3> */}
                                <button 
                                    type="button" 
                                    className="btn-add-sample"
                                    onClick={addSample}
                                >
                                    + Add Sample
                                </button>
                            </div>

                            {sampleErrors.samples && (
                                <div className="wizard-error">{sampleErrors.samples}</div>
                            )}

                            {visitForm.samples.length === 0 ? (
                                <div className="empty-samples">
                                    <p>No samples added yet. Click &quot;Add Sample&quot; to add samples to this visit.</p>
                                    <p className="empty-samples-hint">Samples are optional. You can save without adding any samples.</p>
                                </div>
                            ) : (
                                <div className="samples-list">
                                    {visitForm.samples.map((sample, sampleIndex) => (
                                        <div key={sampleIndex} className={`sample-card ${expandedSample === sampleIndex ? 'expanded' : ''}`}>
                                            <div 
                                                className="sample-card-header"
                                                onClick={() => toggleSampleExpand(sampleIndex)}
                                            >
                                                <div className="sample-header-left">
                                                    <span className="sample-expand-icon">{expandedSample === sampleIndex ? '▼' : '▶'}</span>
                                                    <span className="sample-card-title">
                                                        Sample {sampleIndex + 1}
                                                        {sample.sample_id && ` - ${sample.sample_id}`}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn-remove-sample"
                                                    onClick={(e) => { e.stopPropagation(); removeSample(sampleIndex); }}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                            
                                            {expandedSample === sampleIndex && (
                                                <div className="sample-card-body">
                                                    <div className="form-row">
                                                        <div className="form-group">
                                                            <label className="form-label">
                                                                Sample ID <span className="required">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className={`form-input ${sampleErrors[`samples[${sampleIndex}].sample_id`] ? 'error' : ''}`}
                                                                value={sample.sample_id}
                                                                onChange={(e) => handleSampleChange(sampleIndex, 'sample_id', e.target.value)}
                                                                placeholder="Enter sample ID"
                                                            />
                                                            {sampleErrors[`samples[${sampleIndex}].sample_id`] && (
                                                                <span className="field-error">
                                                                    {sampleErrors[`samples[${sampleIndex}].sample_id`]}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="form-group">
                                                            <label className="form-label">Sample Type</label>
                                                            <Select<SelectOption>
                                                                options={SAMPLE_TYPE_OPTIONS}
                                                                value={SAMPLE_TYPE_OPTIONS.find(o => o.value === sample.sample_type) || null}
                                                                onChange={(option: SingleValue<SelectOption>) => 
                                                                    handleSampleChange(sampleIndex, 'sample_type', option?.value || '')
                                                                }
                                                                placeholder="Select sample type"
                                                                isClearable
                                                                styles={reactSelectStyles<SelectOption>()}
                                                                classNamePrefix="react-select"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="form-row">
                                                        <div className="form-group">
                                                            <label className="form-label">Sample Quality</label>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                value={sample.sample_quality}
                                                                onChange={(e) => handleSampleChange(sampleIndex, 'sample_quality', e.target.value)}
                                                                placeholder="Enter sample quality"
                                                            />
                                                        </div>
                                                        {/* Sample Volume - only shown for FFPE sample type */}
                                                        {sample.sample_type === 'FFPE' && (
                                                            <div className="form-group">
                                                                <label className="form-label">Sample Volume</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-input"
                                                                    value={sample.sample_volume}
                                                                    onChange={(e) => handleSampleChange(sampleIndex, 'sample_volume', e.target.value)}
                                                                    placeholder="Enter sample volume"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="form-row">
                                                        <div className="form-group">
                                                            <label className="form-label">Ref ID 1</label>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                value={sample.ref_id1}
                                                                onChange={(e) => handleSampleChange(sampleIndex, 'ref_id1', e.target.value)}
                                                                placeholder="Enter ref ID 1"
                                                            />
                                                        </div>
                                                        <div className="form-group">
                                                            <label className="form-label">Ref ID 2</label>
                                                            <input
                                                                type="text"
                                                                className="form-input"
                                                                value={sample.ref_id2}
                                                                onChange={(e) => handleSampleChange(sampleIndex, 'ref_id2', e.target.value)}
                                                                placeholder="Enter ref ID 2"
                                                            />
                                                        </div>
                                                        <div className="form-group">
                                                            <label className="form-label">Sample Date/Time</label>
                                                            <input
                                                                type="datetime-local"
                                                                className="form-input"
                                                                value={sample.sample_date_time}
                                                                onChange={(e) => handleSampleChange(sampleIndex, 'sample_date_time', e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Blocks Section - Only shown for FFPE sample type */}
                                                    {sample.sample_type === 'FFPE' && (
                                                    <div className="blocks-section">
                                                        <div className="blocks-header">
                                                            <span className="blocks-title">Blocks</span>
                                                            <button
                                                                type="button"
                                                                className="btn-add-block"
                                                                onClick={() => addBlock(sampleIndex)}
                                                            >
                                                                + Add Block
                                                            </button>
                                                        </div>

                                                        {sample.blocks.length === 0 && (
                                                            <div className="empty-blocks">
                                                                <p>No blocks added. Click &quot;Add Block&quot; to add blocks to this sample.</p>
                                                            </div>
                                                        )}

                                                        {sample.blocks.map((block, blockIndex) => (
                                                            <div key={blockIndex} className="block-card">
                                                                <div className="block-card-header">
                                                                    <span>Block {blockIndex + 1}</span>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-remove-block"
                                                                        onClick={() => removeBlock(sampleIndex, blockIndex)}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                                <div className="form-row">
                                                                    <div className="form-group">
                                                                        <label className="form-label">Block ID</label>
                                                                        <input
                                                                            type="text"
                                                                            className={`form-input ${sampleErrors[`samples[${sampleIndex}].blocks[${blockIndex}].block_id`] ? 'error' : ''}`}
                                                                            value={block.block_id}
                                                                            onChange={(e) => handleBlockChange(sampleIndex, blockIndex, 'block_id', e.target.value)}
                                                                            placeholder="Enter block ID"
                                                                        />
                                                                        {sampleErrors[`samples[${sampleIndex}].blocks[${blockIndex}].block_id`] && (
                                                                            <span className="field-error">
                                                                                {sampleErrors[`samples[${sampleIndex}].blocks[${blockIndex}].block_id`]}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="form-group">
                                                                        <label className="form-label">Case Block ID</label>
                                                                        <input
                                                                            type="text"
                                                                            className="form-input"
                                                                            value={block.Case_Block_ID}
                                                                            onChange={(e) => handleBlockChange(sampleIndex, blockIndex, 'Case_Block_ID', e.target.value)}
                                                                            placeholder="Enter case block ID"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="form-row">
                                                                    <div className="form-group">
                                                                        <label className="form-label">Surgical ID</label>
                                                                        <input
                                                                            type="text"
                                                                            className="form-input"
                                                                            value={block.surgical_id}
                                                                            onChange={(e) => handleBlockChange(sampleIndex, blockIndex, 'surgical_id', e.target.value)}
                                                                            placeholder="Enter surgical ID"
                                                                        />
                                                                    </div>
                                                                    <div className="form-group">
                                                                        <label className="form-label">Tumor %</label>
                                                                        <input
                                                                            type="text"
                                                                            className="form-input"
                                                                            value={block.tumor_per}
                                                                            onChange={(e) => handleBlockChange(sampleIndex, blockIndex, 'tumor_per', e.target.value)}
                                                                            placeholder="Enter tumor %"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Slides Section */}
                                                                <div className="slides-section">
                                                                    <div className="slides-header">
                                                                        <span className="slides-title">Slides</span>
                                                                        <button
                                                                            type="button"
                                                                            className="btn-add-slide"
                                                                            onClick={() => addSlide(sampleIndex, blockIndex)}
                                                                        >
                                                                            + Add Slide
                                                                        </button>
                                                                    </div>

                                                                    {block.slides.map((slide, slideIndex) => (
                                                                        <div key={slideIndex} className="slide-row">
                                                                            <div className="slide-fields">
                                                                                <div className="form-group slide-field">
                                                                                    <label className="form-label-inline">Slide ID {slideIndex + 1}</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        className={`form-input ${sampleErrors[`samples[${sampleIndex}].blocks[${blockIndex}].slides[${slideIndex}].slide_id`] ? 'error' : ''}`}
                                                                                        value={slide.slide_id}
                                                                                        onChange={(e) => handleSlideChange(sampleIndex, blockIndex, slideIndex, 'slide_id', e.target.value)}
                                                                                        placeholder="Enter slide ID"
                                                                                    />
                                                                                </div>
                                                                                <div className="form-group slide-field">
                                                                                    <label className="form-label-inline">Storm</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        className="form-input"
                                                                                        value={slide.storm}
                                                                                        onChange={(e) => handleSlideChange(sampleIndex, blockIndex, slideIndex, 'storm', e.target.value)}
                                                                                        placeholder="Enter storm"
                                                                                    />
                                                                                </div>
                                                                                <div className="form-group slide-field">
                                                                                    <label className="form-label-inline">Cellularity</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        className="form-input"
                                                                                        value={slide.cellularity}
                                                                                        onChange={(e) => handleSlideChange(sampleIndex, blockIndex, slideIndex, 'cellularity', e.target.value)}
                                                                                        placeholder="Enter cellularity"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            {block.slides.length > 1 && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn-remove-slide"
                                                                                    onClick={() => removeSlide(sampleIndex, blockIndex, slideIndex)}
                                                                                >
                                                                                    ×
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer modal-footer-spaced">
                    <div className="footer-left">
                        {currentStep > 1 && (
                            <button 
                                className="btn btn-secondary" 
                                onClick={handleBack}
                                disabled={isSubmitting}
                            >
                                Back
                            </button>
                        )}
                    </div>
                    <div className="footer-right">
                        <button className="btn btn-secondary" onClick={handleClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        {currentStep < 3 ? (
                            <button className="btn btn-primary" onClick={handleNext}>
                                Next
                            </button>
                        ) : (
                            <button 
                                className="btn btn-primary" 
                                onClick={handleSave}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Saving...' : 'Save'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddPatientsModal;
