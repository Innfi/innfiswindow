// ServiceList
export interface ServiceList {
  kind: string;
  apiVersion: string;

  items: ServiceItem[];
}

// ServiceItem
export interface ServiceItem {
  spec: {
    ports: [
      {
        name: string;
        protocol: string;
        port: number;
        targetPort: number;
      },
    ];
    selector: { [id: string]: string };
    clusterIP: string;
    clusterIPs: string[];
    type: string;
  };
}

// ServiceDetail
export interface ServiceDetail {
  // TODO
}
