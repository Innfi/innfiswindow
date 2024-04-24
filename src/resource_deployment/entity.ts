interface Deployment {
  initialDelaySeconds: number;
  timeoutSeconds: number;
  periodSeconds: number;
  successThreshold: number;
  failureThreshold: number;
  readinessProbe: ReadinessProbe;
  terminationMessagePath: string;
  terminationMessagePolicy: string;
  imagePullPolicy: string;
  securityContext: SecurityContext;
  restartPolicy: string;
  terminationGracePeriodSeconds: number;
  dnsPolicy: string;
  serviceAccountName: string;
  serviceAccount: string;
  schedulerName: string;
  strategy: Strategy;
  revisionHistoryLimit: number;
  progressDeadlineSeconds: number;
}

interface ReadinessProbe {
  grpc: Grpc;
  initialDelaySeconds: number;
  timeoutSeconds: number;
  periodSeconds: number;
  successThreshold: number;
  failureThreshold: number;
}

interface Grpc {
  port: number;
  service: string;
}

interface SecurityContext {
  capabilities: Capabilities;
  privileged: boolean;
  readOnlyRootFilesystem: boolean;
  allowPrivilegeEscalation: boolean;
  runAsUser?: number;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  fsGroup?: number;
}

interface Capabilities {
  drop: string[];
}

interface Strategy {
  type: string;
  rollingUpdate: RollingUpdate;
}

interface RollingUpdate {
  maxUnavailable: string;
  maxSurge: string;
}