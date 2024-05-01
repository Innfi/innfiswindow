import axios from 'axios';
import { useQuery } from 'react-query';

export const useGetNamespaceUnit = <T>() => {
  const url = import.meta.env.VITE_APP_BACKEND_URL
    ? `${import.meta.env.VITE_APP_BACKEND_URL}/api/v1/namespaces`
    : '/namespace';

  const service = async () => {
    return await axios.get<T>(url);
  };

  return useQuery('getNamespaceList', service);
};
