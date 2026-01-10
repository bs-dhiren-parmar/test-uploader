import React, { useState, useMemo, useEffect } from 'react';
import { AsyncPaginate, LoadOptions } from 'react-select-async-paginate';
import Select from 'react-select';
import type { SingleValue, GroupBase } from 'react-select';
import { searchPatients, getPatientById, addSampleId } from '../../services/patientService';
import type { Patient, PatientData } from '../../types';
import { reactSelectStyles } from '../../utils/reactSelectStyles';
import { SAMPLE_ID_REGEX } from '../../utils/validation';
import { logger } from '../../utils/encryptedLogger';

// Regex for final validation (requires at least one character)
const SAMPLE_ID_REGEX_REQUIRED = /^[a-zA-Z0-9_-]+$/;

interface PatientOption {
    value: string;
    label: string;
    mrn: string;
    patient_id: string;
}

interface SelectOption {
    value: string;
    label: string;
}

interface Additional {
    page: number;
}

interface AssignPatientsModalProps {
    onClose: () => void;
    onSubmit: (data: { patientId: string; visitId: string; sampleId: string }) => void;
    isSubmitting?: boolean;
}

const AssignPatientsModal: React.FC<AssignPatientsModalProps> = ({ onClose, onSubmit, isSubmitting = false }) => {
    const [selectedPatientOption, setSelectedPatientOption] = useState<PatientOption | null>(null);
    const [selectedVisitOption, setSelectedVisitOption] = useState<SelectOption | null>(null);
    const [selectedSampleOption, setSelectedSampleOption] = useState<SelectOption | null>(null);
    const [newSampleName, setNewSampleName] = useState('');
    const [sampleNameError, setSampleNameError] = useState<string | null>(null);
    
    // API state
    const [patientData, setPatientData] = useState<PatientData | null>(null);
    const [loadingVisits, setLoadingVisits] = useState(false);
    const [creatingSimple, setCreatingSample] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper function to get full name
    const getFullName = (firstName?: string, lastName?: string): string => {
        return [firstName, lastName].filter(Boolean).join(' ') || '';
    };

    // Load patients for AsyncPaginate with pagination
    const loadPatientOptions: LoadOptions<PatientOption, GroupBase<PatientOption>, Additional> = async (
        inputValue,
        _loadedOptions,
        additional
    ) => {
        const page = additional?.page ?? 1;
        
        try {
            const response = await searchPatients(inputValue, page);
            
            if (response.data?.success && response.data.data?.response) {
                const patients = response.data.data.response;
                const options: PatientOption[] = patients.map((patient: Patient) => ({
                    value: patient._id,
                    patient_id: patient._id,
                    label: `${getFullName(patient.first_name, patient.last_name)} (${patient.mrn})`,
                    mrn: patient.mrn,
                }));
                
                return {
                    options,
                    hasMore: response.data.data.hasMore ?? false,
                    additional: {
                        page: page + 1,
                    },
                };
            }
            
            return {
                options: [],
                hasMore: false,
                additional: {
                    page: page + 1,
                },
            };
        } catch (err) {
            logger.error('Error fetching patients', err as Error, {
                searchInput: inputValue,
                page,
            });
            return {
                options: [],
                hasMore: false,
                additional: {
                    page: page + 1,
                },
            };
        }
    };

    // Fetch visits when patient is selected
    useEffect(() => {
        const fetchVisits = async () => {
            if (!selectedPatientOption) {
                setPatientData(null);
                return;
            }
            
            setLoadingVisits(true);
            try {
                const response = await getPatientById(selectedPatientOption.value);
                if (response.data?.success) {
                    setPatientData(response.data.data);
                }
            } catch (err) {
                logger.error('Error fetching patient visits', err as Error, {
                    patientId: selectedPatientOption?.value,
                });
                setError('Failed to load visits');
            } finally {
                setLoadingVisits(false);
            }
        };
        fetchVisits();
    }, [selectedPatientOption]);

    const visitOptions = useMemo((): SelectOption[] => {
        if (!patientData?.visits) return [];
        return patientData.visits.map(visit => ({
            value: visit.visit_id,
            label: visit.visit_id,
        }));
    }, [patientData]);

    const sampleOptions = useMemo((): SelectOption[] => {
        if (!selectedVisitOption || !patientData?.samples) return [];
        const samples = patientData.samples[selectedVisitOption.value] || [];
        return samples.map(sampleId => ({
            value: sampleId,
            label: sampleId,
        }));
    }, [selectedVisitOption, patientData]);

    const handlePatientChange = (option: SingleValue<PatientOption>) => {
        setSelectedPatientOption(option);
        setSelectedVisitOption(null);
        setSelectedSampleOption(null);
        setError(null);
    };

    const handleVisitChange = (option: SingleValue<SelectOption>) => {
        setSelectedVisitOption(option);
        setSelectedSampleOption(null);
    };

    const handleSampleChange = (option: SingleValue<SelectOption>) => {
        setSelectedSampleOption(option);
    };

    const handleSampleNameChange = (value: string) => {
        setNewSampleName(value);
        
        // Real-time validation for sample ID
        if (value && !SAMPLE_ID_REGEX.test(value)) {
            setSampleNameError('Sample ID can only contain letters, numbers, underscores (_), and hyphens (-)');
        } else {
            setSampleNameError(null);
        }
    };

    const handleCreateSample = async () => {
        if (!newSampleName.trim() || !selectedPatientOption || !selectedVisitOption) return;
        
        // Validate sample name format before creating
        if (!SAMPLE_ID_REGEX_REQUIRED.test(newSampleName.trim())) {
            setSampleNameError('Sample ID can only contain letters, numbers, underscores (_), and hyphens (-)');
            return;
        }
        
        setCreatingSample(true);
        setError(null);
        setSampleNameError(null);
        
        try {
            const response = await addSampleId(selectedPatientOption.value, selectedVisitOption.value, newSampleName.trim());
            if (response.data?.success) {
                // Refresh patient data to get the new sample
                const patientResponse = await getPatientById(selectedPatientOption.value);
                if (patientResponse.data?.success) {
                    setPatientData(patientResponse.data.data);
                }
                // Select the newly created sample
                const newSample = newSampleName.trim();
                setSelectedSampleOption({ value: newSample, label: newSample });
                setNewSampleName('');
                setSampleNameError(null);
            }
        } catch (err) {
            logger.error('Error creating sample', err as Error, {
                patientId: selectedPatientOption?.value,
                visitId: selectedVisitOption?.value,
                sampleId: newSampleName,
            });
            setError('Failed to create sample');
        } finally {
            setCreatingSample(false);
        }
    };

    const handleSubmit = () => {
        if (selectedPatientOption) {
            onSubmit({
                patientId: selectedPatientOption.value,
                visitId: selectedVisitOption?.value || '',
                sampleId: selectedSampleOption?.value || '',
            });
        }
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">Assign Patients</h2>
                    <button className="modal-close" onClick={onClose} disabled={isSubmitting}>
                        ×
                    </button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div className="modal-error" style={{ color: 'red', marginBottom: '15px' }}>
                            {error}
                            <button onClick={() => setError(null)} style={{ marginLeft: '10px' }}>✕</button>
                        </div>
                    )}
                    
                    <div className="modal-form-row">
                        <div className="form-group">
                            <label className="form-label">
                                Patients<span className="required"></span>
                            </label>
                            <AsyncPaginate<PatientOption, GroupBase<PatientOption>, Additional>
                                loadOptions={loadPatientOptions}
                                value={selectedPatientOption}
                                onChange={handlePatientChange}
                                placeholder="Search patients..."
                                isDisabled={isSubmitting}
                                isClearable
                                debounceTimeout={300}
                                additional={{ page: 1 }}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                styles={reactSelectStyles<PatientOption, false, GroupBase<PatientOption>>()}
                                classNamePrefix="react-select"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Patient Visits
                            </label>
                            <Select<SelectOption>
                                options={visitOptions}
                                value={selectedVisitOption}
                                onChange={handleVisitChange}
                                placeholder={loadingVisits ? 'Loading...' : 'Select (optional)'}
                                isDisabled={!selectedPatientOption || loadingVisits || isSubmitting}
                                isClearable
                                isLoading={loadingVisits}
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                styles={reactSelectStyles<SelectOption>()}
                                classNamePrefix="react-select"
                            />
                            <small style={{ color: '#666', fontSize: '12px' }}>
                                Leave empty to create a new visit automatically
                            </small>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Sample ID
                            </label>
                            <Select<SelectOption>
                                options={sampleOptions}
                                value={selectedSampleOption}
                                onChange={handleSampleChange}
                                placeholder="Select (optional)"
                                isDisabled={!selectedVisitOption || isSubmitting}
                                isClearable
                                menuPortalTarget={document.body}
                                menuPosition="fixed"
                                styles={reactSelectStyles<SelectOption>()}
                                classNamePrefix="react-select"
                            />
                            <small style={{ color: '#666', fontSize: '12px' }}>
                                Leave empty to create a new sample automatically OR
                            </small>
                            <div className="create-sample-group">
                                <input
                                    type="text"
                                    className={`create-sample-input ${sampleNameError ? 'error' : ''}`}
                                    placeholder="Create New Sample"
                                    value={newSampleName}
                                    onChange={(e) => handleSampleNameChange(e.target.value)}
                                    disabled={!selectedVisitOption || !!selectedSampleOption || creatingSimple || isSubmitting}
                                />
                                <button 
                                    className="btn-create" 
                                    onClick={handleCreateSample}
                                    disabled={!newSampleName.trim() || !selectedVisitOption || !!selectedSampleOption || creatingSimple || isSubmitting || !!sampleNameError}
                                >
                                    {creatingSimple ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                            {sampleNameError && (
                                <span className="field-error" style={{ display: 'block', marginTop: '5px', color: 'red', fontSize: '12px' }}>
                                    {sampleNameError}
                                </span>
                            )}
                        </div>

                        {/* <div className="form-group">
                            <label className="form-label">&nbsp;</label>
                            <div className="create-sample-group">
                                <input
                                    type="text"
                                    className="create-sample-input"
                                    placeholder="Create New Sample"
                                    value={newSampleName}
                                    onChange={(e) => setNewSampleName(e.target.value)}
                                    disabled={!selectedVisit || creatingSimple || isSubmitting}
                                />
                                <button 
                                    className="btn-create" 
                                    onClick={handleCreateSample}
                                    disabled={!newSampleName.trim() || !selectedVisit || creatingSimple || isSubmitting}
                                >
                                    {creatingSimple ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </div> */}
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        className="btn-submit"
                        onClick={handleSubmit}
                        disabled={!selectedPatientOption || isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignPatientsModal;
