import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { validateEmail, validateUrl } from "../utils/helpers";
import type { LoginFormData, LoginFormErrors } from "../types";
import Icon from "../components/Icon";
import Tooltip from "../components/Tooltip";
import "../styles/login.css";

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated, getStoredCredentials } = useAuth();

    const [formData, setFormData] = useState<LoginFormData>({
        baseUrl: "",
        email: "",
        apiKey: "",
        keepSignedIn: false,
    });

    const [errors, setErrors] = useState<LoginFormErrors>({
        baseUrl: "",
        email: "",
        apiKey: "",
    });

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Pre-fill form with stored credentials
    useEffect(() => {
        const stored = getStoredCredentials();
        setFormData((prev) => ({
            ...prev,
            email: stored.email,
            baseUrl: stored.baseUrl,
        }));
    }, [getStoredCredentials]);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate("/dashboard");
        }
    }, [isAuthenticated, navigate]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));

        // Clear error when user types
        if (errors[name as keyof LoginFormErrors]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const validateForm = (): boolean => {
        const newErrors: LoginFormErrors = { baseUrl: "", email: "", apiKey: "" };
        let isValid = true;

        // Validate email
        if (!formData.email) {
            newErrors.email = "Email is required";
            isValid = false;
        } else if (!validateEmail(formData.email)) {
            newErrors.email = "Please provide a valid email";
            isValid = false;
        }

        // Validate API key
        if (!formData.apiKey) {
            newErrors.apiKey = "API Key is required";
            isValid = false;
        }

        // Validate base URL
        if (!formData.baseUrl) {
            newErrors.baseUrl = "Base URL is required";
            isValid = false;
        } else if (!validateUrl(formData.baseUrl)) {
            newErrors.baseUrl = "Please provide a valid URL";
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        if (!navigator.onLine) {
            window.electronAPI?.showErrorBox("Network Error", "Please connect to network");
            return;
        }

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            // Remove trailing slash from base URL
            let baseUrl = formData.baseUrl;
            if (baseUrl.endsWith("/")) {
                baseUrl = baseUrl.slice(0, -1);
            }

            const result = await login(formData.email, formData.apiKey, baseUrl, formData.keepSignedIn);

            if (result.success) {
                navigate("/dashboard");
            } else {
                window.electronAPI?.showErrorBox("Login Failed", result.message || "Credentials provided are not correct");
            }
        } catch (error) {
            window.electronAPI?.showErrorBox("Login Error", "An error occurred during login. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <main className="login-main">
                <div className="login-container">
                    <div className="login-card">
                        <div className="login-form-section">
                            <div className="login-form-content">
                                <div className="brand-wrapper">
                                    <Icon name="augmet-logo" size={27} />
                                    <h1 className="header-title text-primary">A U G M E T<span className="superscript">TM</span> Uploader</h1>
                                </div>

                                <h2 className="login-heading">Login into your account</h2>

                                <form onSubmit={handleSubmit} className="login-form">
                                    <div className="form-group">
                                        <label htmlFor="baseUrl" className="form-label">
                                            <span className="required">AUGMET Base URL</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="baseUrl"
                                            id="baseUrl"
                                            className={`form-input ${errors.baseUrl ? "error" : ""}`}
                                            value={formData.baseUrl}
                                            onChange={handleChange}
                                            placeholder="e.g. https://xyz.augmet.ai/"
                                        />
                                        {errors.baseUrl && <span className="error-message">{errors.baseUrl}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="email" className="form-label">
                                            <span className="required">AUGMET User Name (Email)</span>
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            id="email"
                                            className={`form-input ${errors.email ? "error" : ""}`}
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="e.g. john@example.com"
                                        />
                                        {errors.email && <span className="error-message">{errors.email}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="apiKey" className="form-label">
                                            <span className="required">API Key</span>
                                            <Tooltip content="API key can be copied from my profile section in AUGMET" position="right">
                                                <span className="tooltip-icon">
                                                    <Icon name="info" size={16} />
                                                </span>
                                            </Tooltip>
                                        </label>
                                        <input
                                            type="password"
                                            name="apiKey"
                                            id="apiKey"
                                            className={`form-input ${errors.apiKey ? "error" : ""}`}
                                            value={formData.apiKey}
                                            onChange={handleChange}
                                        />
                                        {errors.apiKey && <span className="error-message">{errors.apiKey}</span>}
                                    </div>

                                    <div className="form-group checkbox-group keep-signed-in">
                                        <input
                                            type="checkbox"
                                            name="keepSignedIn"
                                            id="keepSignedIn"
                                            className="form-checkbox"
                                            checked={formData.keepSignedIn}
                                            onChange={handleChange}
                                        />
                                        <label htmlFor="keepSignedIn" className="checkbox-label">
                                            Keep me logged in
                                        </label>
                                    </div>

                                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                        {isSubmitting ? "Logging in..." : "Login"}
                                    </button>
                                </form>

                                <div className="login-footer">
                                    <p className="mandatory-note"><span>*</span> Mandatory fields</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Login;
