import { RouteObject } from 'react-router-dom';

import { PodListPage } from './list';

export const podRoutes: RouteObject[] = [
  {
    path: '/pods',
    element: <PodListPage />,
  },
];
