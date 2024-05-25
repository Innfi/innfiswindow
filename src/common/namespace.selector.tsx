import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useRecoilValue, useSetRecoilState } from 'recoil';

import { initialAppState } from '../appstate/atom';

export function NamespaceSelectorPage() {
  const appState = useRecoilValue(initialAppState);
  console.log(`appState: ${appState.namespace}`);

  const setAppState = useSetRecoilState(initialAppState);
  const setNamespace = (newNs: string) => {
    console.log(`setNamespace] newNs: ${newNs}`);

    setAppState((currentVal) => {
      return {
        namespace: newNs,
        placeholder: currentVal.placeholder,
      };
    });
  };
  return (
    <FormControl variant="standard" sx={{ m: 1, minWidth: 120 }}>
      <InputLabel>Namespace</InputLabel>
      <Select
        label="clusterNamespace"
        defaultValue=""
        onChange={(e) => setNamespace(e.target.value)}
      >
        <MenuItem value="default">default</MenuItem>
        <MenuItem value="kube-system">kube-system</MenuItem>
        <MenuItem value="aws-node">aws-node</MenuItem>
      </Select>
    </FormControl>
  );
}
