import axios from 'axios';
import { useQuery } from 'react-query';
import { DeploymentDetail, DeploymentList } from './entity';

export const useGetDeploymentsByNamespace = (namespace: string) => {
  const url = import.meta.env.VITE_APP_BACKEND_URL
    ? `${import.meta.env.VITE_APP_BACKEND_URL}/apis/apps/v1/namespaces/${namespace}/deployments`
    : '/deployments';

  const service = async () => {
    return await axios.get<DeploymentList>(url);
  };

  return useQuery('getDeploymentsByNamespace', service);
};

export const useGetDeploymentDetail = (namespace: string, name: string) => {
  const url = import.meta.env.VITE_APP_BACKEND_URL
    ? `${import.meta.env.VITE_APP_BACKEND_URL}/apis/apps/v1/namespaces/${namespace}/deployments/${name}`
    : `/deployment/${name}`;

  const service = async () => {
    return await axios.get<DeploymentDetail>(url);
  };

  return useQuery(`getDeploymentDetail-${name}`, service);
};
