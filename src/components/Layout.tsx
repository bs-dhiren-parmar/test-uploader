import React, { ReactNode, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "./Icon";
import AddPatientsModal from "./modals/AddPatientsModal";
import "../styles/layout.css";

interface LayoutProps {
    children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [appVersion, setAppVersion] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    useEffect(() => {
        window.electronAPI?.getAppVersion().then(setAppVersion);
    }, []);

    const handleAddPatients = useCallback(() => {
        setIsModalOpen(true);
    }, []);

    const handleModalClose = useCallback(() => {
        setIsModalOpen(false);
    }, []);

    const handleLogout = useCallback(async (): Promise<void> => {
        // Check for active uploads before logout
        const result = await window.electronAPI?.showCloseConfirmBox();

        // If user clicks Cancel (result === 0), don't logout
        if (result === 0) {
            return;
        }

        await logout();
        navigate("/login");
    }, [logout, navigate]);

    return (
        <div className="layout">
            <header className="header">
                <div className="header-left d-flex align-items-center gap-2">
                    <div className="brand-wrapper">
                        <Icon name="augmet-logo" size={27} />
                        <h1 className="header-title text-primary">A U G M E T<span className="superscript">TM</span> Uploader</h1>
                    </div>
                    {appVersion && <div className="version-wrapper">
                        <div className="user-info">
                            <span className="user-label">Version: </span>
                            <span className="version">v{appVersion}</span>
                        </div>
                        {user && (
                            <div className="user-info">
                                <span className="user-label">User: </span>
                                <span className="version">{user.name}</span>
                                <span className="version">({user.email})</span>
                            </div>
                        )}
                    </div>}
                </div>
                <div className="header-right">
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={handleLogout}>
                            <Icon name="logout" size={16} color="white" />
                            Logout
                        </button>
                        <button className="btn btn-primary" onClick={handleAddPatients}>
                            <Icon name="user-plus" size={16} color="white" />
                            Add Patients
                        </button>
                    </div>
                    
                </div>
            </header>

            <main className="main-content">{children}</main>
            {/* Add Patients Modal */}
            <AddPatientsModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
            />
        </div>
    );
};

export default Layout;
