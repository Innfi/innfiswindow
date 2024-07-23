import { RouteObject, useRoutes } from 'react-router-dom';

import { dashboardRoutes } from '../dashboard/routes';
import { nsRoutes } from '../resource_namespace/routes';
import { deploymentRoutes } from '../resource_deployment/routes';
import { serviceRoutes } from '../resource_service/routes';
import { podRoutes } from '../resource_pod/routes';
import { ingressRoutes } from '../resource_ingress/routes';
import { Sidebar } from './sidebar';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Sidebar />,
    children: [
      ...dashboardRoutes,
      ...nsRoutes,
      ...deploymentRoutes,
      ...serviceRoutes,
      ...podRoutes,
      ...ingressRoutes,
    ],
  },
];

export function RenderRouter() {
  return useRoutes(routes);
}
