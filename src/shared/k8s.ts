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

export interface ContainerPort {
  name: string
  containerPort: number
  protocol: string
}

export interface EnvVar {
  name: string
  value: string
  valueFrom?: string
}

export interface ResourceRequirements {
  requests: Record<string, string>
  limits: Record<string, string>
}

export interface VolumeMount {
  name: string
  mountPath: string
  readOnly: boolean
}

export interface ProbeInfo {
  type: string
  description: string
  initialDelaySeconds: number
  periodSeconds: number
  timeoutSeconds: number
  failureThreshold: number
  successThreshold: number
}

export interface DetailedContainerInfo {
  name: string
  image: string
  ports: ContainerPort[]
  env: EnvVar[]
  resources: ResourceRequirements
  volumeMounts: VolumeMount[]
  livenessProbe: ProbeInfo | null
  readinessProbe: ProbeInfo | null
  startupProbe: ProbeInfo | null
}

export interface VolumeInfo {
  name: string
  type: string
  detail: string
}

export interface RollingUpdateStrategy {
  maxUnavailable: string
  maxSurge: string
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

export interface NodeAddress {
  type: string
  address: string
}

export interface NodeTaint {
  key: string
  effect: string
  value: string
}

export interface NodeSystemInfo {
  osImage: string
  architecture: string
  operatingSystem: string
  containerRuntimeVersion: string
  kubeletVersion: string
  kubeProxyVersion: string
}

export interface NodeInfo {
  name: string
  status: string
  roles: string
  creationTimestamp: string
  version: string
  labels: Record<string, string>
  annotations: Record<string, string>
  capacity: Record<string, string>
  allocatable: Record<string, string>
  conditions: Condition[]
  addresses: NodeAddress[]
  taints: NodeTaint[]
  systemInfo: NodeSystemInfo
  /** spec.unschedulable — true once the node is cordoned. */
  unschedulable: boolean
}

/** Outcome of draining a node: how many pods were evicted, which were skipped
 *  (DaemonSet/mirror pods that drain leaves in place), and which evictions the
 *  API rejected (e.g. a PodDisruptionBudget blocking one). */
export interface DrainResult {
  success: boolean
  cordoned: boolean
  evicted: number
  skipped: string[]
  failed: { pod: string; error: string }[]
  error?: string
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
  rollingUpdate: RollingUpdateStrategy | null
  minReadySeconds: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  selector: Record<string, string>
  podTemplateLabels: Record<string, string>
  podTemplateAnnotations: Record<string, string>
  serviceAccountName: string
  containers: DetailedContainerInfo[]
  initContainers: DetailedContainerInfo[]
  volumes: VolumeInfo[]
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
  labels: Record<string, string>
  annotations: Record<string, string>
  selector: Record<string, string>
  podTemplateLabels: Record<string, string>
  podTemplateAnnotations: Record<string, string>
  serviceAccountName: string
  containers: DetailedContainerInfo[]
  initContainers: DetailedContainerInfo[]
  volumes: VolumeInfo[]
  ownerReferences: OwnerRef[]
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
  labels: Record<string, string>
  annotations: Record<string, string>
  serviceName: string
  updateStrategy: string
  selector: Record<string, string>
  podTemplateLabels: Record<string, string>
  podTemplateAnnotations: Record<string, string>
  serviceAccountName: string
  containers: DetailedContainerInfo[]
  initContainers: DetailedContainerInfo[]
  volumes: VolumeInfo[]
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
  labels: Record<string, string>
  annotations: Record<string, string>
  updateStrategy: string
  selector: Record<string, string>
  nodeSelector: Record<string, string>
  podTemplateLabels: Record<string, string>
  podTemplateAnnotations: Record<string, string>
  serviceAccountName: string
  containers: DetailedContainerInfo[]
  initContainers: DetailedContainerInfo[]
  volumes: VolumeInfo[]
  tolerations: TolerationInfo[]
}

export interface PodContainerInfo {
  name: string
  image: string
  restartCount: number
  ports: ContainerPort[]
  env: EnvVar[]
  resources: ResourceRequirements
  volumeMounts: VolumeMount[]
  livenessProbe: ProbeInfo | null
  readinessProbe: ProbeInfo | null
  startupProbe: ProbeInfo | null
}

export interface PodInfo {
  name: string
  namespace: string
  deployment: string
  ownerKind: string
  ownerName: string
  app: string
  status: string
  restarts: number
  creationTimestamp: string
  nodeName: string
  labels: Record<string, string>
  annotations: Record<string, string>
  serviceAccountName: string
  qosClass: string
  initContainers: PodContainerInfo[]
  containers: PodContainerInfo[]
  volumes: VolumeInfo[]
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
  sessionAffinity: string
  externalTrafficPolicy: string
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
  labels: Record<string, string>
  annotations: Record<string, string>
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
  labels: Record<string, string>
  annotations: Record<string, string>
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

export interface PVSourceInfo {
  type: string
  detail: string
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
  source: PVSourceInfo
}

export interface PVCInfo {
  name: string
  namespace: string
  status: string
  volumeName: string
  capacity: string
  accessModes: string[]
  storageClass: string
  volumeMode: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface StorageClassInfo {
  name: string
  provisioner: string
  reclaimPolicy: string
  volumeBindingMode: string
  allowVolumeExpansion: boolean
  parameters: Record<string, string>
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface VolumeSnapshotInfo {
  name: string
  namespace: string
  volumeSnapshotClassName: string
  sourcePVCName: string
  readyToUse: boolean | null
  restoreSize: string
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
  labels: Record<string, string>
  annotations: Record<string, string>
  rules: RbacRule[]
}

export interface ClusterRoleInfo {
  name: string
  rulesCount: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  rules: RbacRule[]
}

export interface RoleBindingInfo {
  name: string
  namespace: string
  roleRef: RoleRef
  subjects: RbacSubject[]
  subjectsCount: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface ClusterRoleBindingInfo {
  name: string
  roleRef: RoleRef
  subjects: RbacSubject[]
  subjectsCount: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
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
  labels: Record<string, string>
  annotations: Record<string, string>
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
  labels: Record<string, string>
  annotations: Record<string, string>
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
  parallelism: number | null
  backoffLimit: number | null
  succeeded: number
  failed: number
  active: number
  startTime: string
  completionTime: string
  duration: string
  conditions: Condition[]
  selector: Record<string, string>
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
  successfulJobsHistoryLimit: number | null
  failedJobsHistoryLimit: number | null
  startingDeadlineSeconds: number | null
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
