import { RouteObject } from 'react-router-dom';

import { DashboardPage } from './page';

export const dashboardRoutes: RouteObject[] = [
  {
    path: '/dashboard',
    element: <DashboardPage />,
  },
];
