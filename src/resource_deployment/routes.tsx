import { RouteObject } from 'react-router-dom';

import { DeploymentListPage } from './list';
import { DeploymentDetailPage } from './detail';

export const deploymentRoutes: RouteObject[] = [
  {
    path: '/deployments',
    element: <DeploymentListPage />,
  },
  {
    path: '/deployment/:name',
    element: <DeploymentDetailPage />,
  },
];
