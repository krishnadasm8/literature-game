import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { useAuthStore } from "../store/authStore";
import { deleteToken, getToken, saveToken } from "../utils/storage";

type RefreshResponse = {
  accessToken: string;
  refreshToken?: string;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api/v1";
const REFRESH_ENDPOINT = "/auth/refresh";

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = await getToken(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      throw new Error("Missing refresh token");
    }

    const response = await axios.post<RefreshResponse>(`${BASE_URL}${REFRESH_ENDPOINT}`, {
      refreshToken,
    });

    const nextAccessToken = response.data.accessToken;
    await saveToken(ACCESS_TOKEN_KEY, nextAccessToken);
    if (response.data.refreshToken) {
      await saveToken(REFRESH_TOKEN_KEY, response.data.refreshToken);
    }
    return nextAccessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
};

api.interceptors.request.use(async (config) => {
  const token = useAuthStore.getState().accessToken ?? (await getToken(ACCESS_TOKEN_KEY));
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;

    const requestUrl = originalRequest?.url ?? "";

    // Never try refresh for auth endpoints or refresh endpoint itself.
    if (
      !originalRequest ||
      status !== 401 ||
      originalRequest._retry ||
      requestUrl.includes(REFRESH_ENDPOINT) ||
      requestUrl.includes("/auth/google")
    ) {
      throw error;
    }

    originalRequest._retry = true;

    try {
      // If we don't have a refresh token yet (e.g. during first sign-in), don't mask the real 401.
      const existingRefreshToken = await getToken(REFRESH_TOKEN_KEY);
      if (!existingRefreshToken) {
        throw error;
      }

      const nextToken = await refreshAccessToken();
      useAuthStore.setState((state) => ({
        ...state,
        accessToken: nextToken,
        isAuthenticated: true,
      }));
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return await api.request(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().clearAuth();
      await deleteToken(ACCESS_TOKEN_KEY);
      await deleteToken(REFRESH_TOKEN_KEY);
      throw refreshError;
    }
  },
);
