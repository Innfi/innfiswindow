import { useEffect, useState } from 'react';
import { AxiosError } from 'axios';
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

// is namespace list page necessary in the first place?
export function NamespaceListPage() {
  const { data: response, isFetched } = useGetNamespaceUnit<NamespaceUnit>();
  const [namespaceUnit, setNamespaceUnit] = useState<NamespaceUnit>(placeholder);

  useEffect(() => {
    if (response instanceof AxiosError) {
      return;
    }

    if (response?.data?.items) {
      setNamespaceUnit(response?.data ? response?.data : placeholder);
    }
  }, [isFetched, response]);

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <List sx={{ bgcolor: 'background.paper' }}>
          {namespaceUnit.items.map((item) => (
            <ListItem key={item.metadata.uid}>
              <ListItemText primary={item.metadata.name} />
            </ListItem>
          ))}
        </List>
      </Grid>
    </Grid>
  );
}
