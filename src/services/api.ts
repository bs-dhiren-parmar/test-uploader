import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from "axios";

// In-memory cache for API key (retrieved from secure storage)
let cachedApiKey: string | null = null;

// Set API key in memory cache (called after secure retrieval)
export const setApiKeyCache = (apiKey: string | null): void => {
    cachedApiKey = apiKey;
};

// Get API key from memory cache
export const getApiKey = (): string => cachedApiKey || "";

// Clear API key from memory cache
export const clearApiKeyCache = (): void => {
    cachedApiKey = null;
};

// Initialize API key from secure storage
export const initializeApiKey = async (): Promise<void> => {
    if (window.electronAPI?.secureRetrieve) {
        cachedApiKey = await window.electronAPI.secureRetrieve("apiKey");
    }
};

// Create axios instance with default config
const createApiInstance = (): AxiosInstance => {
    const instance = axios.create({
        timeout: 30000,
        headers: {
            "Content-Type": "application/json",
        },
    });

    // Request interceptor to add API key header
    instance.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            // Use cached API key from memory
            if (cachedApiKey && config.headers) {
                config.headers["api-key"] = cachedApiKey;
            }
            return config;
        },
        (error: AxiosError) => {
            return Promise.reject(error);
        }
    );

    // Response interceptor for error handling
    instance.interceptors.response.use(
        (response: AxiosResponse) => response,
        (error: AxiosError) => {
            if (error.response?.status === 401) {
                // Clear auth and redirect to login
                clearApiKeyCache();
                localStorage.removeItem("isUserActive");
                window.location.reload();
            }
            return Promise.reject(error);
        }
    );

    return instance;
};

// Get base URL from localStorage
export const getBaseUrl = (): string => localStorage.getItem("API_URL") || "";

// Create and export the API instance
const api = createApiInstance();

export default api;
