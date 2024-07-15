// PodList
export interface PodList {
  kind: string;
  apiVersion: string;
  items: PodSummary[];
}

export interface PodSummary {
  metadata: {
    uid: string;
    name: string;
    namespace: string;
    ownerReferences: {
      name: string;
      kind: string;
    }[];
  };
  status: {
    phase: string;
    startTime: Date;
  };
}
