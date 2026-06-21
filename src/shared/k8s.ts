// Canonical k8s resource shapes shared across the main process (IPC producers,
// see src/main/handlers/types.ts) and the renderer (IPC consumers, see
// src/preload/renderer/src/types/k8s.ts). Defined once here so the two sides
// can't drift out of sync.

// ---------------------------------------------------------------------------
// Shared / primitive
// ---------------------------------------------------------------------------

export interface MutationResult {
  success: boolean
  error?: string
  name?: string
  namespace?: string
}

export interface ResourceRef {
  name: string
  namespace: string
}

export interface Condition {
  type: string
  status: string
  reason: string
  message: string
}

export interface ContainerInfo {
  name: string
  image: string
}

export interface RbacRule {
  apiGroups: string[]
  resources: string[]
  verbs: string[]
}

export interface RbacSubject {
  kind: string
  name: string
  namespace: string
}

export interface RoleRef {
  kind: string
  name: string
}

export interface ContextInfo {
  name: string
  cluster: string
  user: string
  clusterType: "EKS" | "AKS" | "Local"
}

// ---------------------------------------------------------------------------
// apply.ts
// ---------------------------------------------------------------------------

export interface ApplyResult {
  name: string
  namespace: string
}

// ---------------------------------------------------------------------------
// cluster.ts
// ---------------------------------------------------------------------------

export interface NamespaceInfo {
  name: string
  status: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface NodeInfo {
  name: string
  status: string
  roles: string
  creationTimestamp: string
  version: string
  labels: Record<string, string>
  capacity: Record<string, string>
  allocatable: Record<string, string>
  conditions: Condition[]
}

// ---------------------------------------------------------------------------
// workload.ts
// ---------------------------------------------------------------------------

export interface DeploymentInfo {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  strategy: string
  creationTimestamp: string
  selector: Record<string, string>
  containers: ContainerInfo[]
  conditions: Condition[]
}

export interface OwnerRef {
  kind: string
  name: string
}

export interface ReplicaSetInfo {
  name: string
  namespace: string
  desiredReplicas: number
  currentReplicas: number
  readyReplicas: number
  creationTimestamp: string
  selector: Record<string, string>
  containers: ContainerInfo[]
  ownerReferences: OwnerRef[]
  podTemplateLabels: Record<string, string>
}

export interface VolumeClaimTemplateInfo {
  name: string
  storage: string
}

export interface StatefulSetInfo {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  creationTimestamp: string
  serviceName: string
  updateStrategy: string
  selector: Record<string, string>
  containers: ContainerInfo[]
  volumeClaimTemplates: VolumeClaimTemplateInfo[]
}

export interface TolerationInfo {
  key: string
  operator: string
  value: string
  effect: string
}

export interface DaemonSetInfo {
  name: string
  namespace: string
  desiredNumberScheduled: number
  currentNumberScheduled: number
  numberReady: number
  updatedNumberScheduled: number
  numberAvailable: number
  creationTimestamp: string
  updateStrategy: string
  selector: Record<string, string>
  nodeSelector: Record<string, string>
  containers: ContainerInfo[]
  tolerations: TolerationInfo[]
}

export interface PodContainerInfo {
  name: string
  image: string
  restartCount: number
}

export interface PodInfo {
  name: string
  namespace: string
  deployment: string
  app: string
  status: string
  restarts: number
  creationTimestamp: string
  nodeName: string
  containers: PodContainerInfo[]
  conditions: Condition[]
}

export interface DeploymentRevision {
  revision: number
  changeCause: string
  images: string[]
  creationTimestamp: string
}

// ---------------------------------------------------------------------------
// networking.ts
// ---------------------------------------------------------------------------

export interface ServicePortInfo {
  name: string
  protocol: string
  port: number
  targetPort: string
  nodePort: number | null
}

export interface ServiceInfo {
  name: string
  namespace: string
  type: string
  clusterIP: string
  externalIP: string
  ports: ServicePortInfo[]
  creationTimestamp: string
  selector: Record<string, string>
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface IngressTLSInfo {
  secretName: string
  hosts: string[]
}

export interface IngressPathInfo {
  path: string
  pathType: string
  serviceName: string
  servicePort: number | string
}

export interface IngressRuleInfo {
  host: string
  paths: IngressPathInfo[]
}

export interface IngressInfo {
  name: string
  namespace: string
  ingressClassName: string
  hosts: string
  address: string
  ports: string
  creationTimestamp: string
  tls: IngressTLSInfo[]
  rules: IngressRuleInfo[]
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface EndpointAddress {
  ip: string
  targetPodName: string | null
  targetPodNamespace: string | null
}

export interface EndpointPortInfo {
  name: string
  port: number
  protocol: string
}

export interface EndpointSubset {
  readyAddresses: EndpointAddress[]
  notReadyAddresses: EndpointAddress[]
  ports: EndpointPortInfo[]
}

export interface EndpointInfo {
  name: string
  namespace: string
  readyAddressCount: number
  notReadyAddressCount: number
  ports: string
  creationTimestamp: string
  subsets: EndpointSubset[]
}

export interface NetworkPolicyPeer {
  ipBlock?: { cidr: string; except: string[] }
  namespaceSelector?: Record<string, string>
  podSelector?: Record<string, string>
}

export interface NetworkPolicyPortInfo {
  protocol?: string
  port?: string
}

export interface NetworkPolicyRule {
  peers: NetworkPolicyPeer[]
  ports: NetworkPolicyPortInfo[]
}

export interface NetworkPolicyInfo {
  name: string
  namespace: string
  podSelector: string
  policyTypes: string[]
  ingressRuleCount: number
  egressRuleCount: number
  creationTimestamp: string
  ingressRules: NetworkPolicyRule[]
  egressRules: NetworkPolicyRule[]
}

// ---------------------------------------------------------------------------
// storage.ts
// ---------------------------------------------------------------------------

export interface PVClaimRef {
  namespace: string
  name: string
}

export interface PVInfo {
  name: string
  capacity: string
  accessModes: string[]
  reclaimPolicy: string
  status: string
  claimRef: PVClaimRef | null
  storageClass: string
  volumeMode: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface PVCInfo {
  name: string
  namespace: string
  status: string
  volumeName: string
  capacity: string
  accessModes: string[]
  storageClass: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

// ---------------------------------------------------------------------------
// config.ts
// ---------------------------------------------------------------------------

export interface ConfigMapInfo {
  name: string
  namespace: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
  binaryData: Record<string, number>
  keys: string[]
}

export interface SecretInfo {
  name: string
  namespace: string
  type: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
  keys: string[]
}

export interface ServiceAccountInfo {
  name: string
  namespace: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  secrets: string[]
  imagePullSecrets: string[]
}

// ---------------------------------------------------------------------------
// events.ts
// ---------------------------------------------------------------------------

export interface EventInfo {
  name: string
  namespace: string
  type: string
  reason: string
  involvedObjectKind: string
  involvedObjectName: string
  message: string
  count: number
  firstTimestamp: string
  lastTimestamp: string
  creationTimestamp: string
}

// ---------------------------------------------------------------------------
// rbac.ts
// ---------------------------------------------------------------------------

export interface RoleInfo {
  name: string
  namespace: string
  rulesCount: number
  creationTimestamp: string
  rules: RbacRule[]
}

export interface ClusterRoleInfo {
  name: string
  rulesCount: number
  creationTimestamp: string
  rules: RbacRule[]
}

export interface RoleBindingInfo {
  name: string
  namespace: string
  roleRef: RoleRef
  subjects: RbacSubject[]
  subjectsCount: number
  creationTimestamp: string
}

export interface ClusterRoleBindingInfo {
  name: string
  roleRef: RoleRef
  subjects: RbacSubject[]
  subjectsCount: number
  creationTimestamp: string
}

export interface UpdateRoleResult {
  name: string
  namespace: string
  rules: RbacRule[]
}

export interface UpdateClusterRoleResult {
  name: string
  rules: RbacRule[]
}

export interface UpdateRoleBindingResult {
  name: string
  namespace: string
  subjects: RbacSubject[]
}

export interface UpdateClusterRoleBindingResult {
  name: string
  subjects: RbacSubject[]
}

export interface UpdateServiceAccountResult {
  name: string
  namespace: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

// ---------------------------------------------------------------------------
// governance.ts
// ---------------------------------------------------------------------------

export interface ResourceQuotaInfo {
  name: string
  namespace: string
  hard: Record<string, string>
  used: Record<string, string>
  creationTimestamp: string
}

export interface LimitRangeLimit {
  type: string
  max: Record<string, string>
  min: Record<string, string>
  default: Record<string, string>
  defaultRequest: Record<string, string>
}

export interface LimitRangeInfo {
  name: string
  namespace: string
  limits: LimitRangeLimit[]
  creationTimestamp: string
}

export interface PDBInfo {
  name: string
  namespace: string
  minAvailable: string | null
  maxUnavailable: string | null
  currentHealthy: number
  desiredHealthy: number
  disruptionsAllowed: number
  expectedPods: number
  selector: Record<string, string>
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

// ---------------------------------------------------------------------------
// batch.ts
// ---------------------------------------------------------------------------

export interface JobInfo {
  name: string
  namespace: string
  completions: number | null
  succeeded: number
  failed: number
  active: number
  startTime: string
  completionTime: string
  duration: string
  conditions: Condition[]
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface CronJobInfo {
  name: string
  namespace: string
  schedule: string
  concurrencyPolicy: string
  suspend: boolean
  lastScheduleTime: string
  activeCount: number
  activeJobNames: string[]
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

// ---------------------------------------------------------------------------
// autoscaling.ts
// ---------------------------------------------------------------------------

export interface HPAMetric {
  type: string
  target: string
  current: string
}

export interface HPAInfo {
  name: string
  namespace: string
  targetRef: { kind: string; name: string }
  minReplicas: number
  maxReplicas: number
  currentReplicas: number
  desiredReplicas: number
  conditions: Condition[]
  metrics: HPAMetric[]
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

// ---------------------------------------------------------------------------
// metrics.ts
// ---------------------------------------------------------------------------

export interface NodeMetric {
  nodeName: string
  cpuUsage: string
  memoryUsage: string
}

export interface MetricsUnavailable {
  unavailable: true
}

// ---------------------------------------------------------------------------
// helm.ts
// ---------------------------------------------------------------------------

export interface HelmRepo {
  name: string
  url: string
}

export interface HelmRelease {
  name: string
  namespace: string
  chart: string
  chartVersion: string
  appVersion: string
  status: string
  updated: string
}
