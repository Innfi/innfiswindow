import { useRecoilState } from 'recoil';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

import { initialNamespace } from '../appstate/atom';

export function NamespaceSelectorPage() {
  const [currentNamespace, setCurrentNamespace] = useRecoilState(initialNamespace);

  return (
    <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
      <InputLabel>Namespace</InputLabel>
      <Select
        label="clusterNamespace"
        defaultValue={currentNamespace}
        onChange={(e) => setCurrentNamespace(e.target.value)}
      >
        <MenuItem value="default">default</MenuItem>
        <MenuItem value="kube-system">kube-system</MenuItem>
        <MenuItem value="aws-node">aws-node</MenuItem>
        <MenuItem value="istio-system">istio-system</MenuItem>
      </Select>
    </FormControl>
  );
}
