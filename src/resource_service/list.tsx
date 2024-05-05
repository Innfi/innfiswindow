import { useEffect, useState } from 'react';

import { ServiceList } from './entity';
import { useGetServicesByNamespace } from './api';

export function ServiceListPage() {
  const { data, isFetched } = useGetServicesByNamespace('default');

  return <div>service list page</div>;
}
