import { RouteObject } from 'react-router';

import { NamespaceListPage } from './list';

export const nsRoutes: RouteObject[] = [
  {
    path: '/namespace',
    element: <NamespaceListPage />,
  },
];