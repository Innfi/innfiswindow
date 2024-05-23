import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";

export function NamespaceSelectorPage() {
  return (
    <FormControl variant="standard" sx={{ m:1, minWidth: 120 }}>
      <InputLabel>Namespace</InputLabel>
      <Select label="clusterNamespace" defaultValue="">
        <MenuItem value="default">default</MenuItem>
        <MenuItem value="kube-system">kube-system</MenuItem>
        <MenuItem value="aws-node">aws-node</MenuItem>
      </Select>
    </FormControl>
  );
}