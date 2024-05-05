import { useEffect, useState } from 'react';
import { Grid, List, ListItem, ListItemText } from '@mui/material';

import { NamespaceUnit } from './entity';
import { useGetNamespaceUnit } from './api';

const placeholder: NamespaceUnit = {
  kind: '',
  apiVersion: '',
  metadata: {
    resourceVersion: '',
  },
  items: [],
};

export function NamespaceListPage() {
  const { data, isFetched } = useGetNamespaceUnit<NamespaceUnit>();
  const [namespaceUnit, setNamespaceUnit] = useState<NamespaceUnit>(placeholder);

  useEffect(() => {
    if (isFetched) {
      setNamespaceUnit(data?.data || placeholder);
    }
  }, [isFetched, data?.data]);

  return (
    <Grid container spacing={3}>
      <List sx={{ bgcolor: 'background.paper' }}>
        {namespaceUnit.items.map((item) => (
          <ListItem key={item.metadata.uid}>
            <ListItemText primary={item.metadata.name} />
          </ListItem>
        ))}
      </List>
    </Grid>
  );
}
