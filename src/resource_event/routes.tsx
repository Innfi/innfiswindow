import { RouteObject } from 'react-router-dom';

import { EventListPage } from './list';

export const eventRoutes: RouteObject[] = [
  {
    path: 'events',
    element: <EventListPage />,
  },
];
