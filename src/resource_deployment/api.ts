import { useQuery } from 'react-query';

import { axiosInstance } from '../common/axios.client';
import { DeploymentDetail, DeploymentList } from './entity';
import { AxiosError } from 'axios';

export const useGetDeploymentsByNamespace = (namespace: string) => {
  const url = `/apis/apps/v1/namespaces/${namespace}/deployments`;

  const service = async () => {
    const response = await axiosInstance.get<DeploymentList>(url);

    return response;
  };

  return useQuery('getDeploymentsByNamespace', service, {
    onError: (err: AxiosError) => {
      console.log(`useQuery error: ${err.code}`);

      return [];
    },
  });
};

export const useGetDeploymentDetail = (namespace: string, name: string) => {
  const url = `/apis/apps/v1/namespaces/${namespace}/deployments/${name}`;

  const service = async () => {
    return await axiosInstance.get<DeploymentDetail>(url);
  };

  return useQuery(`getDeploymentDetail-${name}`, service);
};
