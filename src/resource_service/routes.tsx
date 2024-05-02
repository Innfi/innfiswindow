import { RouteObject } from 'react-router';

import { ServiceListPage } from './list';

export const serviceRoutes: RouteObject[] = [
  {
    path: 'services',
    element: <ServiceListPage />,
  },
];