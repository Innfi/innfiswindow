import { useQuery } from 'react-query';

import { axiosInstance } from '../common/axios.client';
import { EventList } from './entity';

export const useGetAllEvents = (limit: number, continueKey?: string) => {
  let url = `/apis/events.k8s.io/v1/events?limit=${limit}`;
  if (continueKey && continueKey.length > 0) {
    url = `${url}&contiunue=${continueKey}`;
  }

  const service = async () => {
    const response = await axiosInstance.get<EventList>(url);

    return response;
  };

  return useQuery('getEvents', service);
};
