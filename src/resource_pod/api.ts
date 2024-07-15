import { useQuery } from 'react-query';

import { axiosInstance } from '../common/axios.client';
import { PodList } from './entity';

export const useGetPodsByNamespace = (namespace: string) => {
  const url = `/api/v1/namespaces/${namespace}/pods`;

  const service = async () => {
    const response = await axiosInstance.get<PodList>(url);

    return response;
  };

  return useQuery(`getPodsByNamespace-${namespace}`, service);
};
