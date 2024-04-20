import { useQuery } from 'react-query';

export const useGetNamespaceList = () => {
  return useQuery('getNamespaceList', async () => {
    return fetch('https://github.com/Innfi').then((res) => res.json());
    // return fetch('http://localhost:3000').then((res) => res.json());
  });
};

