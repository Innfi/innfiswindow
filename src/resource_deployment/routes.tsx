import { RouteObject } from 'react-router';

import { DeploymentListPage } from './list';

export const deploymentRoutes: RouteObject[] = [
  {
    path: '/deployments',
    element: <DeploymentListPage />,
  },
];
