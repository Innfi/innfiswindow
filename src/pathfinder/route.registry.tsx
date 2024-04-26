import { RouteObject, useRoutes } from "react-router";

import { nsRoutes } from "../resource_namespace/routes";
import { deploymentRoutes } from "../resource_deployment/routes";

const routes: RouteObject[] = [
  {
    path: '/',
    // TODO
    children: [
      ...nsRoutes,
      ...deploymentRoutes,
    ],
  },
];

export function RenderRouter() {
  return useRoutes(routes);
}
