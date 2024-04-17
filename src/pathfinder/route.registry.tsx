import { RouteObject, useRoutes } from "react-router";

const routes: RouteObject[] = [
  {
    path: '/',
    // TODO
    children: [

    ],
  },
];

export function RenderRouter() {
  return useRoutes(routes);
}
