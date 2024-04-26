import axios from 'axios';
import { useQuery } from 'react-query';

export const useGetDeploymentsByNamespace = <T>(namespace: string) => {
  const url = import.meta.env.VITE_APP_BACKEND_URL ? 
    `${import.meta.env.VITE_APP_BACKEND_URL}/apis/apps/v1/namespaces/${namespace}/deployments` : 
    '/deployments';

  const service = async () => {
    return await axios.get<T>(url);
  };

  return useQuery('getDeploymentsByNamespace', service);
};