import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { AxiosError } from "axios";
import { authenticateUser } from "../services/authService";
import { setApiKeyCache, clearApiKeyCache } from "../services/api";
import type { User } from "../types";

interface LoginResult {
    success: boolean;
    message?: string;
}

interface StoredCredentials {
    email: string;
    baseUrl: string;
}

interface AuthContextValue {
    isAuthenticated: boolean;
    user: User | null;
    loading: boolean;
    login: (email: string, apiKey: string, baseUrl: string, keepLoggedIn?: boolean) => Promise<LoginResult>;
    logout: () => Promise<void>;
    getStoredCredentials: () => StoredCredentials;
}

interface AuthProviderProps {
    children: ReactNode;
}

// Create the auth context
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider component to manage authentication state
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // Check if user is already logged in on mount
    useEffect(() => {
        const checkAuth = async (): Promise<void> => {
            const isUserActive = localStorage.getItem("isUserActive");
            const userName = localStorage.getItem("userName");
            const email = localStorage.getItem("email");

            // Retrieve API key from secure storage
            let apiKey: string | null = null;
            if (window.electronAPI?.secureRetrieve) {
                apiKey = await window.electronAPI.secureRetrieve("apiKey");
            }

            if (apiKey && isUserActive === "true") {
                // Cache the API key in memory for axios interceptor
                setApiKeyCache(apiKey);

                setIsAuthenticated(true);
                setUser({ name: userName || "", email: email || "" });

                // Notify main process of login details
                if (window.electronAPI?.keepLoginDetails) {
                    const baseUrl = localStorage.getItem("API_URL");
                    window.electronAPI.keepLoginDetails(apiKey, baseUrl || "");
                }
            } else {
                clearApiKeyCache();
                setIsAuthenticated(false);
                setUser(null);
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    /**
     * Login with email, API key, and base URL
     */
    const login = useCallback(async (email: string, apiKey: string, baseUrl: string, keepLoggedIn = false): Promise<LoginResult> => {
        try {
            const response = await authenticateUser(email, apiKey, baseUrl);

            if (response.data?.success) {
                const userData = response.data.data.user;

                // Build user name
                let userName = userData.first_name || "";
                if (userData.last_name) {
                    userName += ` ${userData.last_name}`;
                }

                // Get org_id from roles
                const orgId = userData.roles?.[0]?.org_id || "";

                // Store API key securely using Electron's safeStorage
                if (window.electronAPI?.secureStore) {
                    await window.electronAPI.secureStore("apiKey", apiKey);
                }

                // Cache the API key in memory for axios interceptor
                setApiKeyCache(apiKey);

                // Store non-sensitive data in localStorage
                localStorage.setItem("API_URL", baseUrl);
                localStorage.setItem("email", email);
                localStorage.setItem("isKeepLoginIn", String(keepLoggedIn));
                localStorage.setItem("isUserActive", "true");
                localStorage.setItem("userName", userName);
                localStorage.setItem("org_id", orgId);

                // Notify main process
                if (window.electronAPI?.keepLoginDetails) {
                    window.electronAPI.keepLoginDetails(apiKey, baseUrl);
                }

                // Update state
                setUser({ name: userName, email });
                setIsAuthenticated(true);

                return { success: true };
            } else {
                return { success: false, message: "Invalid credentials" };
            }
        } catch (error) {
            console.error("Login error:", error);
            const axiosError = error as AxiosError<{ message?: string }>;
            return {
                success: false,
                message: axiosError.response?.data?.message || "Authentication failed",
            };
        }
    }, []);

    /**
     * Logout and clear session
     */
    const logout = useCallback(async (): Promise<void> => {
        const keepLoggedIn = localStorage.getItem("isKeepLoginIn") === "true";

        // Clear session data
        if (!keepLoggedIn) {
            // Delete API key from secure storage
            if (window.electronAPI?.secureDelete) {
                await window.electronAPI.secureDelete("apiKey");
            }
            localStorage.removeItem("API_URL");
            localStorage.removeItem("org_id");
        }
        localStorage.removeItem("isUserActive");

        // Clear API key from memory cache
        clearApiKeyCache();

        // Notify main process
        if (window.electronAPI?.keepLoginDetails) {
            window.electronAPI.keepLoginDetails("", "");
        }

        // Update state
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    /**
     * Get stored credentials (for pre-filling login form)
     */
    const getStoredCredentials = useCallback((): StoredCredentials => {
        return {
            email: localStorage.getItem("email") || "",
            baseUrl: localStorage.getItem("API_URL") || "",
        };
    }, []);

    const value: AuthContextValue = {
        isAuthenticated,
        user,
        loading,
        login,
        logout,
        getStoredCredentials,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 */
export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

export default AuthContext;
