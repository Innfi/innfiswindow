import { RouteObject, useRoutes } from 'react-router-dom';

import { dashboardRoutes } from '../dashboard/routes';
import { nsRoutes } from '../resource_namespace/routes';
import { deploymentRoutes } from '../resource_deployment/routes';
import { serviceRoutes } from '../resource_service/routes';
import { podRoutes } from '../resource_pod/routes';
import { ingressRoutes } from '../resource_ingress/routes';
import { eventRoutes } from '../resource_event/routes';
import { testRoutes } from '../resource_test/routes';
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
      ...eventRoutes,
      ...testRoutes,
    ],
  },
];

export function RenderRouter() {
  return useRoutes(routes);
}
