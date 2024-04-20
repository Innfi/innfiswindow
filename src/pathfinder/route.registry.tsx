import { RouteObject, useRoutes } from "react-router";
import { nsRoutes } from "../resource_namespace/routes";

const routes: RouteObject[] = [
  {
    path: '/',
    // TODO
    children: [
      ...nsRoutes,
    ],
  },
];

export function RenderRouter() {
  return useRoutes(routes);
}
