import { RouteObject } from 'react-router-dom';

import { IngressListPage } from './list';

export const ingressRoutes: RouteObject[] = [
  {
    path: 'ingresses',
    element: <IngressListPage />,
  },
];
