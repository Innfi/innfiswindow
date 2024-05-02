import { RouteObject, useRoutes } from 'react-router';

import { nsRoutes } from '../resource_namespace/routes';
import { deploymentRoutes } from '../resource_deployment/routes';
import { serviceRoutes } from '../resource_service/routes';

const routes: RouteObject[] = [
  {
    path: '/',
    // TODO
    children: [...nsRoutes, ...deploymentRoutes, ...serviceRoutes],
  },
];

export function RenderRouter() {
  return useRoutes(routes);
}
