import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

import { setCurrentNamespace, toCurrentNamespace } from '../appstate/state.local';

export function NamespaceSelectorPage() {
  const namespace = toCurrentNamespace();
  const onChangeNamespace = (newNs: string) => {
    setCurrentNamespace(newNs);
  };

  return (
    <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
      <InputLabel>Namespace</InputLabel>
      <Select
        label="clusterNamespace"
        defaultValue={namespace}
        onChange={(e) => onChangeNamespace(e.target.value)}
      >
        <MenuItem value="default">default</MenuItem>
        <MenuItem value="kube-system">kube-system</MenuItem>
        <MenuItem value="aws-node">aws-node</MenuItem>
        <MenuItem value="istio-system">istio-system</MenuItem>
      </Select>
    </FormControl>
  );
}
