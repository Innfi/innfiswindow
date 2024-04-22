import axios from 'axios';
import { useQuery } from 'react-query';
import fs from 'fs';

export const useGetNamespaceUnit = <T>() => {
  const url = process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/namespace` : '/namespace';

  const cacert = fs.readFileSync('~/.minikube/ca.crt', 'utf8');
  const clientcrt = fs.readFileSync('~/.minikube/client.crt', 'utf8');
  const clientKey = fs.readFileSync('~/.minikube/client.key', 'utf8');

  const service = async () => {
    return await axios.get<T>(url, {
      httpsAgent: {
        ca: cacert,
        cert: clientcrt,
        key: clientKey,
      },
    });
  };

  return useQuery('getNamespaceList', service);
};

