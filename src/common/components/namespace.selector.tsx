import { useRecoilState } from 'recoil';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';

import { namespaceSelector } from '../app.state';

export function NamespaceSelectorPage() {
  const [currentNamespace, setCurrentNamespace] = useRecoilState(namespaceSelector);

  const onChangeNamespace = (newNs: string) => {
    if (newNs === currentNamespace) return;

    setCurrentNamespace(newNs);
  };

  return (
    <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
      <InputLabel>Namespace</InputLabel>
      <Select
        label="clusterNamespace"
        value={currentNamespace}
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
