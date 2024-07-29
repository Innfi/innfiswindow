import { useQuery } from 'react-query';

import { axiosInstance } from '../common/axios.client';
import { EventList } from './entity';

export const useGetAllEvents = (limit: number, continueFlag?: string) => {
  let url = `/apis/events.k8s.io/v1/events?limit=${limit}`;
  if (continueFlag && continueFlag.length > 0) {
    url = `${url}&contiunue=${continueFlag}`;
  }

  const service = async () => {
    const response = await axiosInstance.get<EventList>(url);

    return response;
  };

  return useQuery('getEvents', service);
};
