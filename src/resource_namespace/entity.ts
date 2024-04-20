interface NamespaceList {
  kind: string;
  apiVersion: string;
  metadata: Metadata;
  items: Item[];
}

interface Metadata {
  resourceVersion: string;
}

interface Item {
  metadata: ItemMetadata;
  spec: Spec;
  status: Status;
}

interface ItemMetadata {
  name: string;
  uid: string;
  resourceVersion: string;
  creationTimestamp: string;
  labels: Labels;
  managedFields: ManagedField[];
}

interface Labels {
  [id: string]: string;
}

interface ManagedField {
  manager: string;
  operation: string;
  apiVersion: string;
  time: string;
  fieldsType: string;
  fieldsV1: any;
}

interface Spec {
  finalizers: string[];
}

interface Status {
  phase: string;
}