import axios, { AxiosError } from 'axios';

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_APP_BACKEND_URL,
  timeout: 1000,
});

axiosInstance.interceptors.response.use(
  (res) => res.data,
  (err: AxiosError) => {
    return err;
  }
);
