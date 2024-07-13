import axios, { AxiosError } from 'axios';

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_APP_BACKEND_URL,
  timeout: 1000,
});

axiosInstance.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    return new ApiError(err.code);
  }
);

export class ApiError {
  errMsg: string | undefined;

  constructor(msg: string | undefined) {
    this.errMsg = msg;
  }
}
