import { useQuery } from 'react-query';

import { axiosInstance } from '../common/axios.client';
import { IngressList } from './entity';

export const useGetIngressesByNamespace = (namespace: string) => {
  const url = `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses`;

  const service = async () => {
    const response = await axiosInstance.get<IngressList>(url);

    return response;
  };

  return useQuery(`getIngressesByNamespace-${namespace}`, service);
};
