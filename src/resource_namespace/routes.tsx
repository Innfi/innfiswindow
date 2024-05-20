import { RouteObject } from 'react-router-dom';

import { NamespaceListPage } from './list';

export const nsRoutes: RouteObject[] = [
  {
    path: '/namespaces',
    element: <NamespaceListPage />,
  },
];
