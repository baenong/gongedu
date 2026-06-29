import axios from "axios";
import { useAuthStore } from "../store/authStore";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      console.warn("인증 필요 (토큰 없음)");
      useAuthStore.getState().logout();
    } else if (status === 403 && (data?.code === "TOKEN_EXPIRED" || data?.code === "INVALID_TOKEN")) {
      console.warn("세션 만료");
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  }
);

export default api;
