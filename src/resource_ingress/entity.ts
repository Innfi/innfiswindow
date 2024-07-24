// IngressList
export interface IngressList {
  kind: string;
  apiVersion: string;

  items: IngressSummary[];
}

export interface IngressSummary {
  metadata: {
    name: string;
    creationTimestamp: string;
  };
  spec: {
    rules: {
      host: string;
      http: {
        paths: {
          path: string;
          pathType: string;
          backend: {
            service: {
              name: string;
              port: {
                number: number;
              };
            };
          };
        }[];
      };
    }[];
  };
  status: {
    loaBalancer: {
      ingress: {
        hostname: string;
      }[];
    };
  };
}
