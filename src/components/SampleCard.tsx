import React, { useState, ChangeEvent } from 'react';
import Select, { SingleValue } from 'react-select';
import { AxiosError } from 'axios';
import FileDropZone from './FileDropZone';
import { getPatientById, addSampleId } from '../services/patientService';
import { validateSampleId, getPatientDisplayName, checkFileExtension } from '../utils/helpers';
import type { Patient, SelectOption, FileUploadData, Visit } from '../types';
import '../styles/sampleCard.css';

interface SampleCardProps {
  index: number;
  patients: Patient[];
  onRemove: (index: number) => void;
  onFilesReady: (data: FileUploadData) => void;
  canRemove: boolean;
}

const SampleCard: React.FC<SampleCardProps> = ({ 
  index, 
  patients, 
  onRemove, 
  onFilesReady,
  canRemove 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPatient, setSelectedPatient] = useState<SelectOption | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<SelectOption | null>(null);
  const [selectedSample, setSelectedSample] = useState<SelectOption | null>(null);
  
  const [visits, setVisits] = useState<Visit[]>([]);
  const [samples, setSamples] = useState<Record<string, string[]>>({});
  
  const [newSampleId, setNewSampleId] = useState<string>('');
  const [sampleError, setSampleError] = useState<string>('');
  const [addingSample, setAddingSample] = useState<boolean>(false);
  
  const [files, setFiles] = useState<File[]>([]);
  const [fileTypes, setFileTypes] = useState<Record<string, string>>({});
  const [updatedFileNames, setUpdatedFileNames] = useState<Record<string, string>>({});

  // Format patients for react-select
  const patientOptions: SelectOption[] = patients.map(p => ({
    value: p._id,
    label: getPatientDisplayName(p)
  }));

  // Format visits for react-select
  const visitOptions: SelectOption[] = visits.map(v => ({
    value: v.visit_id,
    label: v.visit_id
  }));

  // Format samples for react-select
  const sampleOptions: SelectOption[] = selectedVisit && samples[selectedVisit.value]
    ? samples[selectedVisit.value].map(s => ({ value: s, label: s }))
    : [];

  // Handle patient selection
  const handlePatientChange = async (option: SingleValue<SelectOption>): Promise<void> => {
    setSelectedPatient(option);
    setSelectedVisit(null);
    setSelectedSample(null);
    setVisits([]);
    setSamples({});
    setFiles([]);
    setFileTypes({});
    setUpdatedFileNames({});

    if (!option) return;

    if (!navigator.onLine) {
      window.electronAPI?.showErrorBox('Network Error', 'Please connect to network');
      return;
    }

    setLoading(true);
    try {
      const result = await getPatientById(option.value);
      if (result.data?.data) {
        const { visits: patientVisits, samples: patientSamples } = result.data.data;
        setVisits(patientVisits || []);
        setSamples(patientSamples || {});
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        localStorage.removeItem('isUserActive');
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle visit selection
  const handleVisitChange = (option: SingleValue<SelectOption>): void => {
    setSelectedVisit(option);
    setSelectedSample(null);
    setFiles([]);
    setFileTypes({});
    setUpdatedFileNames({});
  };

  // Handle sample selection
  const handleSampleChange = (option: SingleValue<SelectOption>): void => {
    setSelectedSample(option);
    setFiles([]);
    setFileTypes({});
    setUpdatedFileNames({});
  };

  // Handle new sample ID input
  const handleNewSampleInput = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setNewSampleId(value);

    if (value && !validateSampleId(value)) {
      setSampleError('Sample ID can only contain letters, numbers, hyphens (-) and underscores (_). No spaces or special characters allowed.');
    } else {
      setSampleError('');
    }
  };

  // Add new sample ID
  const handleAddSampleId = async (): Promise<void> => {
    if (!newSampleId || !validateSampleId(newSampleId) || !selectedPatient || !selectedVisit) return;

    const currentSamples = samples[selectedVisit.value] || [];
    if (currentSamples.includes(newSampleId)) {
      setSampleError(`${newSampleId} already exists in samples`);
      return;
    }

    setAddingSample(true);
    try {
      const response = await addSampleId(
        selectedPatient.value,
        selectedVisit.value,
        newSampleId
      );

      if (response.data?.success && response.data?.data) {
        const updatedSamples = response.data.data.samples;
        setSamples(updatedSamples);
        setSelectedSample({ value: newSampleId, label: newSampleId });
        setNewSampleId('');
        setSampleError('');
      } else {
        setSampleError('Failed to add sample ID');
      }
    } catch (error) {
      console.error('Error adding sample ID:', error);
      const axiosError = error as AxiosError;
      window.electronAPI?.showErrorBox('Add Sample ID Failed', axiosError.message);
    } finally {
      setAddingSample(false);
    }
  };

  // Handle files dropped
  const handleFilesDrop = async (droppedFiles: File[]): Promise<void> => {
    if (!selectedSample) {
      window.electronAPI?.showErrorBox(
        'Sample ID missing',
        `Please select or create a new sample for card ${index + 1}.`
      );
      return;
    }

    const validFiles: File[] = [];
    const erroredFileNames: string[] = [];
    const newUpdatedFileNames: Record<string, string> = { ...updatedFileNames };
    const newFileTypes: Record<string, string> = { ...fileTypes };
    let isUpdateFileName = false;
    let fileNameChangeMessage = 'We are going to update the following file names as:\n';

    for (const file of droppedFiles) {
      const fileName = file.name;
      
      if (fileName.includes(' ')) {
        erroredFileNames.push(fileName);
        continue;
      }

      validFiles.push(file);
      
      // Check if sample ID matches file name prefix
      const sampleId = selectedSample.value;
      const fileSampleId = fileName.split('-')[0];
      
      if (fileSampleId !== sampleId) {
        const newFileName = `${sampleId}-${fileName}`;
        newUpdatedFileNames[fileName] = newFileName;
        isUpdateFileName = true;
        fileNameChangeMessage += `* ${fileName} => ${newFileName}\n`;
      }

      // Detect file type
      const effectiveFileName = newUpdatedFileNames[fileName] || fileName;
      const detectedType = checkFileExtension(effectiveFileName);
      newFileTypes[effectiveFileName] = detectedType;
    }

    // Confirm file name changes
    if (isUpdateFileName) {
      const confirmed = await window.electronAPI?.showFileNameChangeConformation(fileNameChangeMessage);
      if (!confirmed) {
        return;
      }
    }

    // Show error for files with spaces
    if (erroredFileNames.length > 0) {
      window.electronAPI?.showErrorBox(
        'File name contains spaces',
        `Please rename the following files and try again: ${erroredFileNames.join(', ')}.`
      );
    }

    setUpdatedFileNames(newUpdatedFileNames);
    setFileTypes(newFileTypes);
    setFiles(prev => [...prev, ...validFiles]);
  };

  // Handle file type change
  const handleFileTypeChange = (fileName: string, newType: string): void => {
    setFileTypes(prev => ({
      ...prev,
      [fileName]: newType
    }));
  };

  // Remove a file
  const handleRemoveFile = (fileName: string): void => {
    setFiles(prev => prev.filter(f => f.name !== fileName));
    setFileTypes(prev => {
      const newTypes = { ...prev };
      delete newTypes[fileName];
      delete newTypes[updatedFileNames[fileName]];
      return newTypes;
    });
    setUpdatedFileNames(prev => {
      const newNames = { ...prev };
      delete newNames[fileName];
      return newNames;
    });
  };

  // Handle upload
  const handleUpload = (): void => {
    if (!selectedPatient || !selectedVisit || !selectedSample) {
      window.electronAPI?.showErrorBox(
        'Missing Selection',
        'Please select patient, visit, and sample before uploading.'
      );
      return;
    }

    onFilesReady({
      files,
      patientId: selectedPatient.value,
      visitId: selectedVisit.value,
      sampleId: selectedSample.value,
      fileTypes,
      updatedFileNames,
      cardIndex: index
    });
  };

  const showDropZone = selectedSample !== null;
  const canUpload = files.length > 0;

  return (
    <div className="sample-card">
      {loading && (
        <div className="card-loading">
          <div className="spinner"></div>
        </div>
      )}

      <div className="card-header">
        <div className="card-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Patients</label>
              <Select
                value={selectedPatient}
                onChange={handlePatientChange}
                options={patientOptions}
                placeholder="Select patient..."
                isClearable
                className="react-select"
                classNamePrefix="select"
                menuPortalTarget={document.body}
                menuPosition="fixed"
                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Patient Visits</label>
              <Select
                value={selectedVisit}
                onChange={handleVisitChange}
                options={visitOptions}
                placeholder="Select visit..."
                isClearable
                isDisabled={!selectedPatient}
                className="react-select"
                classNamePrefix="select"
                menuPortalTarget={document.body}
                menuPosition="fixed"
                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
              />
            </div>

            <div className="form-group sample-group">
              <label className="form-label required">Sample Id</label>
              <Select
                value={selectedSample}
                onChange={handleSampleChange}
                options={sampleOptions}
                placeholder="Select sample..."
                isClearable
                isDisabled={!selectedVisit}
                className="react-select"
                classNamePrefix="select"
                menuPortalTarget={document.body}
                menuPosition="fixed"
                styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
              />
              
              <div className="sample-divider">
                <span>or</span>
              </div>

              <div className="new-sample-row">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Create New Sample"
                  value={newSampleId}
                  onChange={handleNewSampleInput}
                  disabled={!selectedVisit}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddSampleId}
                  disabled={!newSampleId || !validateSampleId(newSampleId) || addingSample}
                >
                  + Sample Id
                </button>
              </div>
              {sampleError && (
                <span className="error-message">{sampleError}</span>
              )}
            </div>

            {canRemove && (
              <div className="form-group close-group">
                <button
                  type="button"
                  className="btn btn-close"
                  onClick={() => onRemove(index)}
                >
                  <span>X</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDropZone && (
        <div className="card-body">
          <FileDropZone
            onFilesDrop={handleFilesDrop}
            files={files}
            fileTypes={fileTypes}
            updatedFileNames={updatedFileNames}
            onFileTypeChange={handleFileTypeChange}
            onRemoveFile={handleRemoveFile}
          />

          {canUpload && (
            <div className="upload-actions">
              <button
                type="button"
                className="btn btn-success"
                onClick={handleUpload}
              >
                Upload files
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SampleCard;
