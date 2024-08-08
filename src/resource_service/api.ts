import { useQuery } from 'react-query';

import { axiosInstance } from '../common/axios.client';
import { ServiceDetail, ServiceList } from './entity';

export const useGetServicesByNamespace = (namespace: string) => {
  const url = `/api/v1/namespaces/${namespace}/services`;
  console.log(`url: ${url}`);

  const service = async () => {
    const response = await axiosInstance.get<ServiceList>(url);

    return response;
  };

  return useQuery(`getServicesByNamespace-${namespace}`, service);
};

export const useGetServiceDetail = (namespace: string, name: string) => {
  const url = `/api/v1/namespaces/${namespace}/services/${name}`;

  const service = async () => {
    return await axiosInstance.get<ServiceDetail>(url);
  };

  return useQuery(`getServiceDetail-${namespace}-${name}`, service);
};
