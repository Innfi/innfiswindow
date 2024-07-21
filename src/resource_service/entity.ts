// ServiceList
export interface ServiceList {
  kind: string;
  apiVersion: string;

  items: ServiceSummary[];
}

// ServiceItem
export interface ServiceSummary {
  metadata: {
    uid: string;
    name: string;
    namespace: string;
    creationTimestamp: string;
  };
  spec: {
    ports: ServicePortDetail[];
    selector: { [id: string]: string };
    clusterIP: string;
    clusterIPs: string[];
    type: string;
  };
}

export interface ServicePortDetail {
  name: string;
  protocol: string;
  port: number;
  targetPort: number;
}

// ServiceDetail
export interface ServiceDetail {
  // TODO
}
