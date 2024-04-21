import axios from 'axios';
import { useQuery } from 'react-query';

export const useGetNamespaceList = () => {
  const url = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/namespace` : '/namespace';

  return useQuery('getNamespaceList', async () => {
    axios.get(url).then((res) => {
      return res.data as NamespaceUnit;
    });
  });
};

