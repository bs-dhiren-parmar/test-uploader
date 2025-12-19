import React, { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UploadProvider } from './context/UploadContext';
import Login from './pages/Login';
import Uploader from './pages/Uploader';
import FileList from './pages/FileList';
import './types/electron.d';

interface RouteWrapperProps {
  children: ReactNode;
}

// Protected route wrapper
const ProtectedRoute: React.FC<RouteWrapperProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public route wrapper (redirects to uploader if authenticated)
const PublicRoute: React.FC<RouteWrapperProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/uploader" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />

      {/* Protected routes */}
      <Route 
        path="/uploader" 
        element={
          <ProtectedRoute>
            <Uploader />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/file-list" 
        element={
          <ProtectedRoute>
            <FileList />
          </ProtectedRoute>
        } 
      />

      {/* Default route - redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Catch all - redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <UploadProvider>
        <AppRoutes />
      </UploadProvider>
    </AuthProvider>
  );
};

export default App;
