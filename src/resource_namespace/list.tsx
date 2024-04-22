import { useEffect, useState } from "react";
import { useGetNamespaceUnit } from "./api";
import { Grid } from "@mui/material";

const placeholder: NamespaceUnit = {
  kind: "",
  apiVersion: "",
  metadata: {
    resourceVersion: "",
  },
  items: [],
};

export function NamespaceListPage() {
  const { data, isFetched } = useGetNamespaceUnit<NamespaceUnit>();
  console.log(`data: ${JSON.stringify(data)}`);

  const [namespaceUnit, setNamespaceUnit] = useState<NamespaceUnit>(placeholder);
  useEffect(() => {
    if (isFetched) {
      setNamespaceUnit(data?.data || placeholder);
    }
  });

  return (
    <Grid container spacing={3}>
      {namespaceUnit.items.map((item) => {
        return (
          <Grid item xs={12} key={item.metadata.uid}>
            {item.metadata.name}
          </Grid>
        );
      })}
    </Grid>
  );
}