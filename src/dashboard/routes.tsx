import { RouteObject } from 'react-router';

import { DashboardPage } from './page';

export const dashboardRoutes: RouteObject[] = [
  {
    path: '/dashboard',
    element: <DashboardPage />,
  },
];
