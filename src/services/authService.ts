import axios, { AxiosResponse, AxiosError } from 'axios';
import type { ApiResponse, AuthResponse } from '../types';

/**
 * Authenticate user with email and API key
 */
export const authenticateUser = async (
  email: string, 
  apiKey: string, 
  baseUrl: string
): Promise<AxiosResponse<ApiResponse<AuthResponse>>> => {
  try {
    const response = await axios({
      url: `${baseUrl}/api/users/authenticate/by-api-key`,
      method: 'post',
      data: {
        email,
        apiKey
      }
    });
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Logout user - cleanup API session
 */
export const logoutUser = async (
  baseUrl: string, 
  apiKey: string
): Promise<AxiosResponse | null> => {
  try {
    const response = await axios({
      url: `${baseUrl}/api/users/logout`,
      method: 'post',
      headers: {
        'api-key': apiKey
      }
    });
    return response;
  } catch (error) {
    // Silently fail on logout errors
    const axiosError = error as AxiosError;
    console.error('Logout error:', axiosError.message);
    return null;
  }
};
