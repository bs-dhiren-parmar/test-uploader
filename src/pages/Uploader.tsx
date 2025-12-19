import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import Layout from '../components/Layout';
import SampleCard from '../components/SampleCard';
import { useAuth } from '../context/AuthContext';
import { useUpload } from '../context/UploadContext';
import { getPatients } from '../services/patientService';
import type { Patient, FileUploadData, FileToUpload } from '../types';
import '../styles/uploader.css';

interface SampleCardItem {
  id: number;
}

interface UploadMessageData {
  uploadedFiles: Array<{ fileName: string }>;
  notUploadedFiles: Array<{ name: string; reason: string }>;
}

const Uploader: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { addFilesToQueue } = useUpload();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState<boolean>(true);
  const [sampleCards, setSampleCards] = useState<SampleCardItem[]>([{ id: 0 }]);
  const [nextCardId, setNextCardId] = useState<number>(1);
  const [uploadMessage, setUploadMessage] = useState<UploadMessageData | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Fetch patients on mount
  const fetchPatients = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      window.electronAPI?.showErrorBox('Network Error', 'Please connect to network');
      setLoadingPatients(false);
      return;
    }

    setLoadingPatients(true);
    try {
      const result = await getPatients();
      if (result.data?.data?.response) {
        setPatients(result.data.data.response);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        localStorage.removeItem('isUserActive');
        window.location.reload();
      }
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPatients();
    }
  }, [isAuthenticated, fetchPatients]);

  // Add new sample card
  const handleAddCard = (): void => {
    setSampleCards(prev => [...prev, { id: nextCardId }]);
    setNextCardId(prev => prev + 1);
  };

  // Remove sample card
  const handleRemoveCard = (index: number): void => {
    setSampleCards(prev => prev.filter((_, i) => i !== index));
  };

  // Handle files ready for upload
  const handleFilesReady = async (data: FileUploadData): Promise<void> => {
    const { files, patientId, visitId, sampleId, fileTypes, updatedFileNames } = data;

    const uploadedFiles: FileToUpload[] = [];
    const notUploadedFiles: Array<{ name: string; reason: string }> = [];

    for (const file of files) {
      const originalFileName = file.name;
      const fileName = updatedFileNames[originalFileName] || originalFileName;
      const fileType = fileTypes[fileName] || '';

      // Check for uncompressed fastq
      if (fileType === 'uncompressed_fastq') {
        notUploadedFiles.push({
          name: originalFileName,
          reason: 'Please compress file and upload.'
        });
        continue;
      }

      // Check if file type is set
      if (!fileType) {
        notUploadedFiles.push({
          name: originalFileName,
          reason: 'File type not selected'
        });
        continue;
      }

      uploadedFiles.push({
        file,
        fileName,
        originalFileName,
        fileType,
        patientId,
        visitId,
        sampleId
      });
    }

    // Add files to upload queue
    if (uploadedFiles.length > 0) {
      await addFilesToQueue(uploadedFiles);
    }

    // Set structured message data (avoiding XSS by not using dangerouslySetInnerHTML)
    setUploadMessage({
      uploadedFiles: uploadedFiles.map(f => ({ fileName: f.fileName })),
      notUploadedFiles
    });
  };

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Layout>
      <div className="uploader-page">
        <div className="uploader-header">
          <button 
            className="btn btn-primary"
            onClick={fetchPatients}
            disabled={loadingPatients}
          >
            {loadingPatients ? 'Loading...' : 'Refetch Patients'}
          </button>
        </div>

        {loadingPatients ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading patients...</p>
          </div>
        ) : (
          <div className="uploader-content">
            <div className="sample-cards">
              {sampleCards.map((card, index) => (
                <SampleCard
                  key={card.id}
                  index={index}
                  patients={patients}
                  onRemove={handleRemoveCard}
                  onFilesReady={handleFilesReady}
                  canRemove={sampleCards.length > 1}
                />
              ))}
            </div>

            <div className="add-card-container">
              <button
                type="button"
                className="btn btn-link"
                onClick={handleAddCard}
              >
                + Add More Sample
              </button>
            </div>

            {uploadMessage && (
              <div className="upload-message">
                {uploadMessage.uploadedFiles.length > 0 && (
                  <>
                    <h5>For status update of files added to queue visit "File List" Tab</h5>
                    <h6>Files successfully added to queue:</h6>
                    {uploadMessage.uploadedFiles.map((f, idx) => (
                      <p key={idx} className="text-success">* {f.fileName}</p>
                    ))}
                  </>
                )}
                {uploadMessage.notUploadedFiles.length > 0 && (
                  <>
                    <h6>Files not added to queue:</h6>
                    {uploadMessage.notUploadedFiles.map((f, idx) => (
                      <p key={idx} className="text-danger">* {f.name} - {f.reason}</p>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Uploader;
