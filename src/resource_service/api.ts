import axios from 'axios';
import { useQuery } from 'react-query';

import { ServiceList } from './entity';

export const useGetServicesByNamespace = (namespace: string) => {
  const url = import.meta.env.VITE_APP_BACKEND_URL
    ? `${import.meta.env.VITE_APP_BACKEND_URL}/api/v1/namespaces/${namespace}/services`
    : '/services';

  const service = async () => {
    return await axios.get<ServiceList>(url);
  };

  return useQuery('getServicesByNamespace', service);
};
