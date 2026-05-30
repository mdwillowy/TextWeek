import axios from 'axios';

function resolveApiBaseUrl() {
  const configuredBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  return configuredBase ? configuredBase.replace(/\/+$/, '') : '/api';
}

const apiBaseUrl = resolveApiBaseUrl();

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

let onAuthFailed = null;
let onTokenReceived = null;
let refreshPromise = null;

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function configureAuthInterceptor({ onAuthFailure, onNewAccessToken }) {
  onAuthFailed = onAuthFailure;
  onTokenReceived = onNewAccessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const requestUrl = originalRequest?.url || '';

    if (!originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    const isAuthPath =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/signup') ||
      requestUrl.includes('/auth/refresh');

    if (!isAuthPath && (status === 401 || status === 419)) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshClient.post('/auth/refresh', {});
        }

        const refreshResponse = await refreshPromise;
        const nextAccessToken = refreshResponse?.data?.data?.accessToken;

        if (!nextAccessToken) {
          throw new Error('Missing access token from refresh response');
        }

        setAuthToken(nextAccessToken);
        if (onTokenReceived) {
          onTokenReceived(nextAccessToken);
        }

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        if (onAuthFailed) {
          onAuthFailed();
        }
        return Promise.reject(refreshError);
      } finally {
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
