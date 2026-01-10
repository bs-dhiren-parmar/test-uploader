import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FileDropTab from '../components/tabs/FileDropTab';
import StatusTab from '../components/tabs/StatusTab';
import AssignPatientsTab from '../components/tabs/AssignPatientsTab';
import FileAssociationTab from '../components/tabs/FileAssociationTab';
import '../styles/dashboard.css';
import Layout from '../components/Layout';

type TabType = 'file-drop' | 'status' | 'assign-patients' | 'file-association';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('file-drop');

    // Memoized handlers for tab switching
    const handleFileDropTab = useCallback(() => {
        setActiveTab('file-drop');
    }, []);

    const handleStatusTab = useCallback(() => {
        setActiveTab('status');
    }, []);

    const handleAssignPatientsTab = useCallback(() => {
        setActiveTab('assign-patients');
    }, []);

    const handleFileAssociationTab = useCallback(() => {
        setActiveTab('file-association');
    }, []);

    // Redirect if not authenticated
    React.useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, authLoading, navigate]);

    if (authLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'file-drop':
                return <FileDropTab />;
            case 'status':
                return <StatusTab />;
            case 'assign-patients':
                return <AssignPatientsTab />;
            case 'file-association':
                return <FileAssociationTab />;
            default:
                return null;
        }
    };

    return (
        <Layout>
            <div className="dashboard-container">
                <div className="dashboard-panel">
                    <nav className="dashboard-tabs">
                        <button
                            className={`dashboard-tab ${activeTab === 'file-drop' ? 'active' : ''}`}
                            onClick={handleFileDropTab}
                        >
                            File Drop
                        </button>
                        <button
                            className={`dashboard-tab ${activeTab === 'status' ? 'active' : ''}`}
                            onClick={handleStatusTab}
                        >
                            Status
                        </button>
                        <button
                            className={`dashboard-tab ${activeTab === 'assign-patients' ? 'active' : ''}`}
                            onClick={handleAssignPatientsTab}
                        >
                            Assign Patients
                        </button>
                        <button
                            className={`dashboard-tab ${activeTab === 'file-association' ? 'active' : ''}`}
                            onClick={handleFileAssociationTab}
                        >
                            File Association
                        </button>
                    </nav>

                    <div className="dashboard-content">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;

