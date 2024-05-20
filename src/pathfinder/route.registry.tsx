import { RouteObject, useRoutes } from 'react-router-dom';

import { Sidebar } from '../common/sidebar';
import { dashboardRoutes } from '../dashboard/routes';
import { nsRoutes } from '../resource_namespace/routes';
import { deploymentRoutes } from '../resource_deployment/routes';
import { serviceRoutes } from '../resource_service/routes';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Sidebar />,
    children: [...dashboardRoutes, ...nsRoutes, ...deploymentRoutes, ...serviceRoutes],
  },
];

export function RenderRouter() {
  return useRoutes(routes);
}
