export interface DeploymentList {
  kind: string;
  apiVersion: string;
  metadata: Metadata;
  items: DeploymentSummary[];
}

export interface Metadata {
  resourceVersion: string;
}

export interface DeploymentSummary {
  metadata: ItemMetadata;
}

export interface ItemMetadata {
  name: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  generation: number;
  creationTimestamp: string;
  managedFields: ManagedField[];
}
