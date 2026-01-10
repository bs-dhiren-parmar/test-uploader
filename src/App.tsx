import React, { ReactNode, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { UploadProviderV2 } from "./context/UploadContextV2";
import { cleanupLogger } from "./utils/encryptedLogger";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import "./types/electron.d";

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

    return children;
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
        return <Navigate to="/dashboard" replace />;
    }

    return children;
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
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
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
    useEffect(() => {
        // Cleanup logger on app unmount
        return () => {
            cleanupLogger().catch((err) => {
                console.error("Error cleaning up logger:", err);
            });
        };
    }, []);

    return (
        <AuthProvider>
            <UploadProviderV2>
                <AppRoutes />
            </UploadProviderV2>
        </AuthProvider>
    );
};

export default App;
