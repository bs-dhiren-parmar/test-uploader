import React, { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/layout.css';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [appVersion, setAppVersion] = useState<string>('');

  useEffect(() => {
    window.electronAPI?.getAppVersion().then(setAppVersion);
  }, []);

  const handleLogout = async (): Promise<void> => {
    // Check for active uploads before logout
    const result = await window.electronAPI?.showCloseConfirmBox();
    
    // If user clicks Cancel (result === 0), don't logout
    if (result === 0) {
      return;
    }

    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-left">
          <h1 className="header-title">Uploader</h1>
          {appVersion && <span className="version">(v{appVersion})</span>}
        </div>
        <div className="header-right">
          <div className="header-actions">
            <button 
              className="btn btn-secondary"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
          {user && (
            <div className="user-info">
              <span className="user-label">User: </span>
              <span className="user-name">{user.name}</span>
              <span className="user-email">({user.email})</span>
            </div>
          )}
        </div>
      </header>

      <nav className="nav-tabs">
        <NavLink 
          to="/uploader" 
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Uploader
        </NavLink>
        <NavLink 
          to="/file-list" 
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          File List
        </NavLink>
      </nav>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
