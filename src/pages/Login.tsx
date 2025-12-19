import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validateUrl } from '../utils/helpers';
import type { LoginFormData, LoginFormErrors } from '../types';
import '../styles/login.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, getStoredCredentials } = useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    baseUrl: '',
    email: '',
    apiKey: '',
    keepSignedIn: false
  });

  const [errors, setErrors] = useState<LoginFormErrors>({
    baseUrl: '',
    email: '',
    apiKey: ''
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Pre-fill form with stored credentials
  useEffect(() => {
    const stored = getStoredCredentials();
    setFormData(prev => ({
      ...prev,
      email: stored.email,
      baseUrl: stored.baseUrl
    }));
  }, [getStoredCredentials]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/uploader');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user types
    if (errors[name as keyof LoginFormErrors]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: LoginFormErrors = { baseUrl: '', email: '', apiKey: '' };
    let isValid = true;

    // Validate email
    if (!formData.email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please provide a valid email';
      isValid = false;
    }

    // Validate API key
    if (!formData.apiKey) {
      newErrors.apiKey = 'API Key is required';
      isValid = false;
    }

    // Validate base URL
    if (!formData.baseUrl) {
      newErrors.baseUrl = 'Base URL is required';
      isValid = false;
    } else if (!validateUrl(formData.baseUrl)) {
      newErrors.baseUrl = 'Please provide a valid URL';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!navigator.onLine) {
      window.electronAPI?.showErrorBox('Network Error', 'Please connect to network');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Remove trailing slash from base URL
      let baseUrl = formData.baseUrl;
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }

      const result = await login(
        formData.email,
        formData.apiKey,
        baseUrl,
        formData.keepSignedIn
      );

      if (result.success) {
        navigate('/uploader');
      } else {
        window.electronAPI?.showErrorBox(
          'Login Failed',
          result.message || 'Credentials provided are not correct'
        );
      }
    } catch (error) {
      window.electronAPI?.showErrorBox(
        'Login Error',
        'An error occurred during login. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <main className="login-main">
        <div className="login-container">
          <div className="login-card">
            <div className="login-image-section">
              <div className="login-image-placeholder">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <div className="login-form-section">
              <div className="login-form-content">
                <div className="brand-wrapper">
                  <h1 className="brand-title">Augmet Uploader</h1>
                </div>

                <h2 className="login-heading">Login to your account</h2>

                <form onSubmit={handleSubmit} className="login-form">
                  <div className="form-group">
                    <label htmlFor="baseUrl" className="form-label">
                      <span className="required">AUGMET Base URL</span>
                    </label>
                    <input
                      type="text"
                      name="baseUrl"
                      id="baseUrl"
                      className={`form-input ${errors.baseUrl ? 'error' : ''}`}
                      value={formData.baseUrl}
                      onChange={handleChange}
                      placeholder="e.g. https://xyz.augmet.ai/"
                    />
                    {errors.baseUrl && (
                      <span className="error-message">{errors.baseUrl}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="email" className="form-label">
                      <span className="required">AUGMET User Name (Email)</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      className={`form-input ${errors.email ? 'error' : ''}`}
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="e.g. john@example.com"
                    />
                    {errors.email && (
                      <span className="error-message">{errors.email}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="apiKey" className="form-label">
                      <span className="required">API Key</span>
                      <span className="tooltip-icon" title="API key can be copied from my profile section in AUGMET">
                        <svg fill="currentColor" viewBox="0 0 20 20" width="16" height="16">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </span>
                    </label>
                    <input
                      type="password"
                      name="apiKey"
                      id="apiKey"
                      className={`form-input ${errors.apiKey ? 'error' : ''}`}
                      value={formData.apiKey}
                      onChange={handleChange}
                    />
                    {errors.apiKey && (
                      <span className="error-message">{errors.apiKey}</span>
                    )}
                  </div>

                  <div className="form-group checkbox-group">
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

                  <button
                    type="submit"
                    className="submit-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Logging in...' : 'Login'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
