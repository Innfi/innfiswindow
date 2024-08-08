import { RouteObject } from 'react-router-dom';

import { TestListPage } from './list';

export const testRoutes: RouteObject[] = [
  {
    path: '/tests',
    element: <TestListPage />,
  },
];
