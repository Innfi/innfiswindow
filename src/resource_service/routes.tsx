import { RouteObject } from 'react-router-dom';

import { ServiceListPage } from './list';

export const serviceRoutes: RouteObject[] = [
  {
    path: 'services',
    element: <ServiceListPage />,
  },
];
