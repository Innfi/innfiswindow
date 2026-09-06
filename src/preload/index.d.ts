import { ElectronAPI } from "@electron-toolkit/preload"
import {
  K8sEndpoint,
  K8sEndpointSlice,
  K8sEndpointSliceSummary,
  K8sEndpointSummary,
} from "@renderer/types/k8s"

import type {
  AccessReviewRequest,
  AccessReviewResult,
  AccessSubject,
  CRDInfo,
  CustomResourceDetail,
  CustomResourceInfo,
  CustomResourceRef,
  RoleSubjectBinding,
  SelfRulesResult,
  SubjectPermissions,
} from "../shared/k8s"
import type {
  WatchClosedMessage,
  WatchEventMessage,
  WatchSnapshot,
  WatchStartArgs,
} from "../shared/watch"

export interface K8sContext {
  name: string
  cluster: string
  user: string
  clusterType: "EKS" | "AKS" | "Local"
}

export interface K8sNamespace {
  name: string
  status: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sNodeCondition {
  type: string
  status: string
  reason: string
  message: string
}

export interface NodeMetric {
  nodeName: string
  cpuUsage: string
  memoryUsage: string
}

export interface ContainerMetric {
  name: string
  cpuNanocores: number
  memoryBytes: number
}

export interface PodMetric {
  podName: string
  namespace: string
  window: string
  timestamp: string
  cpuNanocores: number
  memoryBytes: number
  containers: ContainerMetric[]
}

export interface K8sJobCondition {
  type: string
  status: string
  reason: string
  message: string
}

export interface K8sJob {
  name: string
  namespace: string
  completions: number | null
  parallelism: number | null
  backoffLimit: number | null
  suspend: boolean
  succeeded: number
  failed: number
  active: number
  startTime: string
  completionTime: string
  duration: string
  conditions: K8sJobCondition[]
  selector: Record<string, string>
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sCronJob {
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

export interface K8sNodeAddress {
  type: string
  address: string
}

export interface K8sNodeTaint {
  key: string
  effect: string
  value: string
}

/** A label edit: keys to write, keys to drop. A rename is both. */
export interface NodeLabelUpdate {
  set: Record<string, string>
  remove: string[]
}

export interface K8sNodeSystemInfo {
  osImage: string
  architecture: string
  operatingSystem: string
  containerRuntimeVersion: string
  kubeletVersion: string
  kubeProxyVersion: string
}

export interface K8sNode {
  name: string
  status: string
  roles: string
  creationTimestamp: string
  version: string
  labels: Record<string, string>
  annotations: Record<string, string>
  capacity: Record<string, string>
  allocatable: Record<string, string>
  conditions: K8sNodeCondition[]
  addresses: K8sNodeAddress[]
  taints: K8sNodeTaint[]
  systemInfo: K8sNodeSystemInfo
  unschedulable: boolean
}

export interface DryRunResult {
  name: string
  namespace: string
  kind: string
  action: "create" | "update"
  diff: string
  rendered: string
}

/** Mirrors `V1DeleteOptions`' cascade and grace-period knobs — `kubectl
 *  delete --cascade/--grace-period/--force`. */
export interface DeleteResourceOptions {
  propagationPolicy?: PropagationPolicy
  /** `0` is a force delete; omit for the object's own grace period. */
  gracePeriodSeconds?: number
}

export type PropagationPolicy = "Background" | "Foreground" | "Orphan"

/** Delete options the Eviction subresource accepts. */
export interface EvictPodOptions {
  gracePeriodSeconds?: number
  dryRun?: boolean
}

/** What `kubectl debug` adds to a running pod. */
export interface DebugContainerRequest {
  image: string
  name?: string
  targetContainer?: string
  command?: string[]
}

export interface DebugContainerResult {
  success: boolean
  name?: string
  namespace?: string
  containerName: string
  /** False when the container exists but was not running before the wait
   *  expired — attaching a shell to it would fail. */
  running: boolean
  state: string
}

/** One `kubectl cp`. For a copy out, `localPath` is the directory the entry
 *  lands in; for a copy in, `remotePath` is the directory inside the container.
 *  Either way the entry keeps its own name. */
export interface PodCopyArgs {
  contextName?: string
  namespace: string
  podName: string
  containerName: string
  localPath: string
  remotePath: string
  /** Ties `onPodCopyProgress` events to the call that produced them. */
  transferId: string
}

export interface PodCopyResult {
  success: boolean
  /** Bytes of tar stream moved — larger than the payload by the tar headers. */
  bytes: number
}

export interface DrainOptions {
  force?: boolean
  gracePeriodSeconds?: number
  ignoreDaemonSets?: boolean
  deleteEmptyDirData?: boolean
  timeoutSeconds?: number
}

export interface DrainResult {
  success: boolean
  cordoned: boolean
  evicted: number
  skipped: string[]
  failed: { pod: string; error: string }[]
  pending: string[]
  timedOut: boolean
  error?: string
}

export interface K8sDeploymentCondition {
  type: string
  status: string
  reason: string
  message: string
}

export interface K8sContainerPort {
  name: string
  containerPort: number
  protocol: string
}

export interface K8sEnvVar {
  name: string
  value: string
  valueFrom?: string
}

export interface K8sResourceRequirements {
  requests: Record<string, string>
  limits: Record<string, string>
}

export interface K8sVolumeMount {
  name: string
  mountPath: string
  readOnly: boolean
}

export interface K8sProbeInfo {
  type: string
  description: string
  initialDelaySeconds: number
  periodSeconds: number
  timeoutSeconds: number
  failureThreshold: number
  successThreshold: number
}

export interface K8sDeploymentContainer {
  name: string
  image: string
  ports: K8sContainerPort[]
  env: K8sEnvVar[]
  resources: K8sResourceRequirements
  volumeMounts: K8sVolumeMount[]
  livenessProbe: K8sProbeInfo | null
  readinessProbe: K8sProbeInfo | null
  startupProbe: K8sProbeInfo | null
}

export interface K8sVolumeInfo {
  name: string
  type: string
  detail: string
}

export interface K8sDeploymentSummary {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  paused: boolean
  creationTimestamp: string
}

export interface K8sDeployment extends K8sDeploymentSummary {
  strategy: string
  rollingUpdate: { maxUnavailable: string; maxSurge: string } | null
  minReadySeconds: number
  labels: Record<string, string>
  annotations: Record<string, string>
  selector: Record<string, string>
  podTemplateLabels: Record<string, string>
  podTemplateAnnotations: Record<string, string>
  serviceAccountName: string
  containers: K8sDeploymentContainer[]
  initContainers: K8sDeploymentContainer[]
  volumes: K8sVolumeInfo[]
  conditions: K8sDeploymentCondition[]
}

export interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
  ports: K8sContainerPort[]
  env: K8sEnvVar[]
  resources: K8sResourceRequirements
  volumeMounts: K8sVolumeMount[]
  livenessProbe: K8sProbeInfo | null
  readinessProbe: K8sProbeInfo | null
  startupProbe: K8sProbeInfo | null
}

export interface K8sPodCondition {
  type: string
  status: string
  reason: string
  message: string
}

export interface K8sPodSummary {
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
}

export interface K8sPod extends K8sPodSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  serviceAccountName: string
  qosClass: string
  initContainers: K8sPodContainer[]
  containers: K8sPodContainer[]
  /** Debug containers added after the pod started; empty on almost every pod. */
  ephemeralContainers: K8sPodContainer[]
  volumes: K8sVolumeInfo[]
  conditions: K8sPodCondition[]
}

export interface K8sOwnerRef {
  kind: string
  name: string
}

export interface K8sReplicaSetContainer {
  name: string
  image: string
  ports: K8sContainerPort[]
  env: K8sEnvVar[]
  resources: K8sResourceRequirements
  volumeMounts: K8sVolumeMount[]
  livenessProbe: K8sProbeInfo | null
  readinessProbe: K8sProbeInfo | null
  startupProbe: K8sProbeInfo | null
}

export interface K8sReplicaSetSummary {
  name: string
  namespace: string
  desiredReplicas: number
  currentReplicas: number
  readyReplicas: number
  creationTimestamp: string
}

export interface K8sReplicaSet extends K8sReplicaSetSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  selector: Record<string, string>
  podTemplateLabels: Record<string, string>
  podTemplateAnnotations: Record<string, string>
  serviceAccountName: string
  containers: K8sReplicaSetContainer[]
  initContainers: K8sReplicaSetContainer[]
  volumes: K8sVolumeInfo[]
  ownerReferences: K8sOwnerRef[]
}

export interface K8sStatefulSetContainer {
  name: string
  image: string
  ports: K8sContainerPort[]
  env: K8sEnvVar[]
  resources: K8sResourceRequirements
  volumeMounts: K8sVolumeMount[]
  livenessProbe: K8sProbeInfo | null
  readinessProbe: K8sProbeInfo | null
  startupProbe: K8sProbeInfo | null
}

export interface K8sStatefulSetVolumeClaimTemplate {
  name: string
  storage: string
}

export interface K8sDaemonSetContainer {
  name: string
  image: string
  ports: K8sContainerPort[]
  env: K8sEnvVar[]
  resources: K8sResourceRequirements
  volumeMounts: K8sVolumeMount[]
  livenessProbe: K8sProbeInfo | null
  readinessProbe: K8sProbeInfo | null
  startupProbe: K8sProbeInfo | null
}

export interface K8sDaemonSetToleration {
  key: string
  operator: string
  value: string
  effect: string
}

export interface K8sDaemonSetSummary {
  name: string
  namespace: string
  desiredNumberScheduled: number
  currentNumberScheduled: number
  numberReady: number
  updatedNumberScheduled: number
  numberAvailable: number
  creationTimestamp: string
}

export interface K8sDaemonSet extends K8sDaemonSetSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  updateStrategy: string
  selector: Record<string, string>
  nodeSelector: Record<string, string>
  podTemplateLabels: Record<string, string>
  podTemplateAnnotations: Record<string, string>
  serviceAccountName: string
  containers: K8sDaemonSetContainer[]
  initContainers: K8sDaemonSetContainer[]
  volumes: K8sVolumeInfo[]
  tolerations: K8sDaemonSetToleration[]
}

export interface K8sStatefulSetSummary {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  creationTimestamp: string
  serviceName: string
}

export interface K8sStatefulSet extends K8sStatefulSetSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  updateStrategy: string
  selector: Record<string, string>
  podTemplateLabels: Record<string, string>
  podTemplateAnnotations: Record<string, string>
  serviceAccountName: string
  containers: K8sStatefulSetContainer[]
  initContainers: K8sStatefulSetContainer[]
  volumes: K8sVolumeInfo[]
  volumeClaimTemplates: K8sStatefulSetVolumeClaimTemplate[]
}

export interface K8sConfigMapSummary {
  name: string
  namespace: string
  creationTimestamp: string
  keys: string[]
}

export interface K8sConfigMap extends K8sConfigMapSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
  binaryData: Record<string, number>
}

export interface K8sServicePort {
  name: string
  protocol: string
  port: number
  targetPort: string
  nodePort: number | null
}

export interface K8sService {
  name: string
  namespace: string
  type: string
  clusterIP: string
  externalIP: string
  ports: K8sServicePort[]
  creationTimestamp: string
  selector: Record<string, string>
  labels: Record<string, string>
  annotations: Record<string, string>
  sessionAffinity: string
  externalTrafficPolicy: string
}

export interface K8sNetworkPolicyPeer {
  ipBlock?: { cidr: string; except: string[] }
  namespaceSelector?: Record<string, string>
  podSelector?: Record<string, string>
}

export interface K8sNetworkPolicyPort {
  protocol?: string
  port?: string
}

export interface K8sNetworkPolicyRule {
  peers: K8sNetworkPolicyPeer[]
  ports: K8sNetworkPolicyPort[]
}

export interface K8sNetworkPolicySummary {
  name: string
  namespace: string
  podSelector: string
  policyTypes: string[]
  ingressRuleCount: number
  egressRuleCount: number
  creationTimestamp: string
}

export interface K8sNetworkPolicy extends K8sNetworkPolicySummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  ingressRules: K8sNetworkPolicyRule[]
  egressRules: K8sNetworkPolicyRule[]
}

export interface K8sIngressTLS {
  secretName: string
  hosts: string[]
}

export interface K8sIngressPath {
  path: string
  pathType: string
  serviceName: string
  servicePort: string | number
}

export interface K8sIngressRule {
  host: string
  paths: K8sIngressPath[]
}

export interface K8sIngressSummary {
  name: string
  namespace: string
  ingressClassName: string
  hosts: string
  address: string
  ports: string
  creationTimestamp: string
}

export interface K8sIngress extends K8sIngressSummary {
  tls: K8sIngressTLS[]
  rules: K8sIngressRule[]
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sIngressClassParametersRef {
  apiGroup: string
  kind: string
  name: string
  /** `Cluster` (the default) or `Namespace`. */
  scope: string
  /** Set only when scope is `Namespace`. */
  namespace: string
}

export interface K8sIngressClass {
  name: string
  controller: string
  parameters: K8sIngressClassParametersRef | null
  /** Carries `ingressclass.kubernetes.io/is-default-class: "true"`. */
  isDefault: boolean
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sEvent {
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

export interface K8sHPAMetric {
  type: string
  target: string
  current: string
}

export interface K8sHPACondition {
  type: string
  status: string
  reason: string
  message: string
}

export type K8sHPAMetricTargetType = "Utilization" | "AverageValue" | "Value"

export interface K8sHPAResourceMetricSpec {
  kind: "Resource" | "ContainerResource"
  /** `cpu`, `memory`, or an extended resource name. */
  name: string
  /** The container the reading comes from; "" for a whole-pod `Resource`. */
  container: string
  targetType: K8sHPAMetricTargetType
  /** Percent of the pod's request, when `targetType` is `Utilization`. */
  averageUtilization: number | null
  /** Quantity, when `targetType` is `AverageValue`. */
  value: string
}

export interface K8sHPAResourceMetric extends K8sHPAResourceMetricSpec {
  /** status.currentMetrics as a percentage, or null with no reading yet. */
  currentUtilization: number | null
  /** status.currentMetrics as a quantity, or "". */
  currentValue: string
}

export interface K8sHPA {
  name: string
  namespace: string
  targetRef: { kind: string; name: string }
  minReplicas: number
  maxReplicas: number
  currentReplicas: number
  desiredReplicas: number
  conditions: K8sHPACondition[]
  metrics: K8sHPAMetric[]
  /** The editable subset of `metrics`, in structured form. */
  resourceMetrics: K8sHPAResourceMetric[]
  /** Pods/Object/External metrics, which the metric editor leaves alone. */
  otherMetricCount: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sPV {
  name: string
  capacity: string
  accessModes: string[]
  reclaimPolicy: string
  status: string
  claimRef: { namespace: string; name: string } | null
  storageClass: string
  volumeMode: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  source: { type: string; detail: string }
}

export interface K8sPVCCondition {
  type: string
  status: string
  reason: string
  message: string
}

export interface K8sPVC {
  name: string
  namespace: string
  status: string
  volumeName: string
  /** status.capacity — trails `requestedStorage` while an expansion runs. */
  capacity: string
  /** spec.resources.requests.storage — the size asked for. */
  requestedStorage: string
  accessModes: string[]
  storageClass: string
  volumeMode: string
  /** allowVolumeExpansion of the claim's StorageClass; null when unresolved. */
  allowVolumeExpansion: boolean | null
  conditions: K8sPVCCondition[]
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sStorageClass {
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

export interface K8sVolumeSnapshot {
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

export interface K8sVolumeSnapshotClass {
  name: string
  driver: string
  deletionPolicy: string
  /** Carries `snapshot.storage.kubernetes.io/is-default-class: "true"`. */
  isDefault: boolean
  parameters: Record<string, string>
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

// CRDs and their objects are described by the canonical shapes rather than
// re-declared here: the generic browser is driven by the CRD's own metadata,
// so the two sides drifting would be a silent wrong-column bug.
export type K8sCRD = CRDInfo
export type K8sCustomResource = CustomResourceInfo
export type K8sCustomResourceDetail = CustomResourceDetail
export type K8sCustomResourceRef = CustomResourceRef

export interface K8sServiceAccount {
  name: string
  namespace: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  secrets: string[]
  imagePullSecrets: string[]
}

export interface K8sSecretSummary {
  name: string
  namespace: string
  type: string
  creationTimestamp: string
  keys: string[]
}

export interface K8sSecret extends K8sSecretSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
}

export interface K8sRoleRule {
  apiGroups: string[]
  resources: string[]
  verbs: string[]
}

export interface K8sRoleSummary {
  name: string
  namespace: string
  rulesCount: number
  creationTimestamp: string
}

export interface K8sRole extends K8sRoleSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  rules: K8sRoleRule[]
}

export interface K8sClusterRoleSummary {
  name: string
  rulesCount: number
  creationTimestamp: string
}

export interface K8sClusterRole extends K8sClusterRoleSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  rules: K8sRoleRule[]
}

export interface K8sBindingSubject {
  kind: string
  name: string
  namespace: string
}

export interface K8sRoleRef {
  kind: string
  name: string
}

export interface K8sRoleBinding {
  name: string
  namespace: string
  roleRef: K8sRoleRef
  subjects: K8sBindingSubject[]
  subjectsCount: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sClusterRoleBinding {
  name: string
  roleRef: K8sRoleRef
  subjects: K8sBindingSubject[]
  subjectsCount: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface DataPoint {
  timestamp: number
  value: number
}

export interface PodMetricsResult {
  cpu: DataPoint[]
  memory: DataPoint[]
  networkRx: DataPoint[]
  networkTx: DataPoint[]
  diskRead: DataPoint[]
  diskWrite: DataPoint[]
}

export interface ConnectionStatus {
  connected: boolean
  reason?: "network" | "auth" | "unknown"
  error?: string
}

export interface K8sAPI {
  listContexts: () => Promise<K8sContext[]>
  getCurrentContext: () => Promise<string>
  listNamespaces: (args?: { contextName?: string }) => Promise<K8sNamespace[]>
  listNodes: (args?: { contextName?: string }) => Promise<K8sNode[]>
  cordonNode: (args: {
    contextName?: string
    name: string
    schedulable: boolean
  }) => Promise<{ success: boolean; name: string }>
  drainNode: (args: {
    contextName?: string
    name: string
    options?: DrainOptions
  }) => Promise<DrainResult>
  updateNodeLabels: (args: {
    contextName?: string
    name: string
    update: NodeLabelUpdate
  }) => Promise<{ success: boolean; name: string }>
  updateNodeTaints: (args: {
    contextName?: string
    name: string
    taints: K8sNodeTaint[]
  }) => Promise<{ success: boolean; name: string }>
  evictPod: (args: {
    contextName?: string
    namespace: string
    name: string
    options?: EvictPodOptions
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  debugPod: (args: {
    contextName?: string
    namespace: string
    name: string
    request: DebugContainerRequest
  }) => Promise<DebugContainerResult>
  copyToPod: (args: PodCopyArgs) => Promise<PodCopyResult>
  copyFromPod: (args: PodCopyArgs) => Promise<PodCopyResult>
  checkConnection: (args?: {
    contextName?: string
  }) => Promise<ConnectionStatus>
  reconnect: (args?: { contextName?: string }) => Promise<ConnectionStatus>
  listDeployments: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sDeploymentSummary[]>
  getDeployment: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sDeployment>
  listReplicaSets: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sReplicaSetSummary[]>
  getReplicaSet: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sReplicaSet>
  listStatefulSets: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sStatefulSetSummary[]>
  getStatefulSet: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sStatefulSet>
  listDaemonSets: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sDaemonSetSummary[]>
  getDaemonSet: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sDaemonSet>
  listConfigMaps: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sConfigMapSummary[]>
  getConfigMap: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sConfigMap>
  listSecrets: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sSecretSummary[]>
  getSecret: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sSecret>
  listServiceAccounts: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sServiceAccount[]>
  listRoles: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sRoleSummary[]>
  getRole: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sRole>
  listClusterRoles: (args?: {
    contextName?: string
  }) => Promise<K8sClusterRoleSummary[]>
  getClusterRole: (args: {
    contextName?: string
    name: string
  }) => Promise<K8sClusterRole>
  listRoleBindings: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sRoleBinding[]>
  listClusterRoleBindings: (args?: {
    contextName?: string
  }) => Promise<K8sClusterRoleBinding[]>
  checkAccess: (args: {
    contextName?: string
    request: AccessReviewRequest
  }) => Promise<AccessReviewResult>
  listSelfRules: (args: {
    contextName?: string
    namespace: string
  }) => Promise<SelfRulesResult>
  getSubjectPermissions: (args: {
    contextName?: string
    subject: AccessSubject
  }) => Promise<SubjectPermissions>
  getRoleSubjects: (args: {
    contextName?: string
    kind: "Role" | "ClusterRole"
    name: string
    namespace: string
  }) => Promise<RoleSubjectBinding[]>
  listHPAs: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sHPA[]>
  getHPA: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sHPA>
  updateHPAReplicas: (args: {
    contextName?: string
    namespace: string
    name: string
    minReplicas: number
    maxReplicas: number
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  updateHPAMetrics: (args: {
    contextName?: string
    namespace: string
    name: string
    metrics: K8sHPAResourceMetricSpec[]
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  listPVs: (args?: { contextName?: string }) => Promise<K8sPV[]>
  listStorageClasses: (args?: {
    contextName?: string
  }) => Promise<K8sStorageClass[]>
  listVolumeSnapshots: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sVolumeSnapshot[]>
  listVolumeSnapshotClasses: (args?: {
    contextName?: string
  }) => Promise<K8sVolumeSnapshotClass[]>
  listCRDs: (args?: { contextName?: string }) => Promise<K8sCRD[]>
  listCustomResources: (args: {
    contextName?: string
    namespace?: string
    ref: K8sCustomResourceRef
    /** JSONPaths from the CRD version's `additionalPrinterColumns`; each row
     *  comes back with one `columns` entry per path, in order. */
    printerColumns?: string[]
  }) => Promise<K8sCustomResource[]>
  getCustomResource: (args: {
    contextName?: string
    namespace?: string
    name: string
    ref: K8sCustomResourceRef
    printerColumns?: string[]
  }) => Promise<K8sCustomResourceDetail>
  listJobs: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sJob[]>
  listCronJobs: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sCronJob[]>
  restartJob: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  restartCronJob: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  setJobSuspend: (args: {
    contextName?: string
    namespace: string
    name: string
    suspend: boolean
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  setCronJobSuspend: (args: {
    contextName?: string
    namespace: string
    name: string
    suspend: boolean
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  getNodeMetrics: (args?: {
    contextName?: string
  }) => Promise<NodeMetric[] | { unavailable: true }>
  getPodMetrics: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<PodMetric[] | { unavailable: true }>
  getPodMetric: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<PodMetric | { unavailable: true }>
  listPVCs: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sPVC[]>
  expandPVC: (args: {
    contextName?: string
    namespace: string
    name: string
    storage: string
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  listResourceQuotas: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sResourceQuota[]>
  listLimitRanges: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sLimitRange[]>
  listPDBs: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sPDB[]>
  listPriorityClasses: (args?: {
    contextName?: string
  }) => Promise<K8sPriorityClass[]>
  listPods: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sPodSummary[]>
  getPod: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sPod>
  listServices: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sService[]>
  listIngresses: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sIngressSummary[]>
  getIngress: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sIngress>
  listIngressClasses: (args?: {
    contextName?: string
  }) => Promise<K8sIngressClass[]>
  listNetworkPolicies: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sNetworkPolicySummary[]>
  getNetworkPolicy: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sNetworkPolicy>
  listEndpoints: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sEndpointSummary[]>
  getEndpoint: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sEndpoint>
  listEndpointSlices: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sEndpointSliceSummary[]>
  getEndpointSlice: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<K8sEndpointSlice>
  getClusterType: () => Promise<"EKS" | "AKS" | "Local">
  createDeployment: (
    namespace: string,
    name: string,
    image: string,
    replicas: number,
  ) => Promise<{ name: string; namespace: string }>
  updateDeployment: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  restartDeployment: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  setDeploymentPaused: (args: {
    contextName?: string
    namespace: string
    name: string
    paused: boolean
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  scaleDeployment: (args: {
    contextName?: string
    namespace: string
    name: string
    replicas: number
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  scaleStatefulSet: (args: {
    contextName?: string
    namespace: string
    name: string
    replicas: number
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  scaleReplicaSet: (args: {
    contextName?: string
    namespace: string
    name: string
    replicas: number
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  getDeploymentHistory: (args: {
    contextName?: string
    namespace: string
    name: string
    selector: Record<string, string>
  }) => Promise<
    Array<{
      revision: number
      changeCause: string
      images: string[]
      creationTimestamp: string
    }>
  >
  rollbackDeployment: (args: {
    contextName?: string
    namespace: string
    name: string
    revision: number
  }) => Promise<{ success: boolean }>
  createStatefulSet: (
    namespace: string,
    name: string,
    image: string,
    replicas: number,
    serviceName: string,
  ) => Promise<{ name: string; namespace: string }>
  updateStatefulSet: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  restartStatefulSet: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  createDaemonSet: (
    namespace: string,
    name: string,
    image: string,
  ) => Promise<{ name: string; namespace: string }>
  updateDaemonSet: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  restartDaemonSet: (args: {
    contextName?: string
    namespace: string
    name: string
  }) => Promise<{ success: boolean; name: string; namespace: string }>
  createService: (
    namespace: string,
    name: string,
    type: string,
    ports: Array<{
      protocol: string
      port: number
      targetPort: number | string
    }>,
    selector: Record<string, string>,
  ) => Promise<{ name: string; namespace: string }>
  updateService: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  createIngress: (
    namespace: string,
    name: string,
    ingressClassName: string,
    rules: Array<{
      host: string
      path: string
      pathType: string
      serviceName: string
      servicePort: number | string
    }>,
    tls: Array<{ hosts: string[]; secretName: string }>,
  ) => Promise<{ name: string; namespace: string }>
  updateIngress: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  applyResource: (yaml: string) => Promise<{ name: string; namespace: string }>
  dryRunResource: (yaml: string) => Promise<DryRunResult>
  deleteResource: (args: {
    apiVersion: string
    kind: string
    name: string
    namespace?: string
    contextName?: string
    options?: DeleteResourceOptions
  }) => Promise<{ name: string; namespace: string }>
  replaceResource: (
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  readResource: (
    apiVersion: string,
    kind: string,
    name: string,
    namespace?: string,
  ) => Promise<Record<string, unknown>>
  updateConfigMap: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  updateSecret: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  updateRole: (
    namespace: string,
    name: string,
    rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>,
  ) => Promise<{ name: string; namespace: string; rules: K8sRoleRule[] }>
  updateClusterRole: (
    name: string,
    rules: Array<{ apiGroups: string[]; resources: string[]; verbs: string[] }>,
  ) => Promise<{ name: string; rules: K8sRoleRule[] }>
  updateRoleBinding: (
    namespace: string,
    name: string,
    subjects: Array<{ kind: string; name: string; namespace?: string }>,
  ) => Promise<{
    name: string
    namespace: string
    subjects: K8sBindingSubject[]
  }>
  updateClusterRoleBinding: (
    name: string,
    subjects: Array<{ kind: string; name: string; namespace?: string }>,
  ) => Promise<{ name: string; subjects: K8sBindingSubject[] }>
  updateServiceAccount: (
    namespace: string,
    name: string,
    metadata: {
      labels?: Record<string, string>
      annotations?: Record<string, string>
    },
  ) => Promise<{
    name: string
    namespace: string
    labels: Record<string, string>
    annotations: Record<string, string>
  }>
}

export interface K8sResourceQuota {
  name: string
  namespace: string
  hard: Record<string, string>
  used: Record<string, string>
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sLimitRangeItem {
  type: string
  max: Record<string, string>
  min: Record<string, string>
  default: Record<string, string>
  defaultRequest: Record<string, string>
}

export interface K8sLimitRange {
  name: string
  namespace: string
  limits: K8sLimitRangeItem[]
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface K8sPDB {
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

export interface K8sPriorityClass {
  name: string
  value: number
  /** True for the class a pod with no `priorityClassName` gets. */
  globalDefault: boolean
  description: string
  /** `PreemptLowerPriority` (the default) or `Never`. */
  preemptionPolicy: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export interface AwsCredentialResult {
  valid: boolean
  type: "env" | "file" | "sso-cache" | "metadata" | "none"
  hasSessionToken?: boolean
  expiresAt?: string
  ssoSession?: string
}

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

export interface AlarmRule {
  id: string
  name: string
  severity: "critical" | "warning" | "info"
  conditionType:
    | "pod-not-running"
    | "deployment-unavailable"
    | "warning-event"
    | "node-not-ready"
  context: string
  namespace?: string
  resourceNameFilter?: string
}

export interface AlarmEntry {
  id: string
  ruleId: string
  ruleName: string
  severity: "critical" | "warning" | "info"
  context: string
  sourceKind: string
  sourceName: string
  namespace: string | null
  message: string
  triggeredAt: string
}

export interface AlarmAPI {
  evaluate: (rule: AlarmRule) => Promise<AlarmEntry[]>
}

export interface HelmAPI {
  repoAdd: (
    name: string,
    url: string,
  ) => Promise<{ success: boolean; error?: string }>
  repoList: () => Promise<HelmRepo[]>
  releaseList: (args?: {
    namespace?: string
    contextName?: string
  }) => Promise<HelmRelease[]>
  releaseInstall: (args: {
    releaseName: string
    chart: string
    namespace: string
    values?: string
    contextName?: string
  }) => Promise<{ success: boolean; error?: string }>
  releaseUpgrade: (args: {
    releaseName: string
    chart: string
    namespace: string
    values?: string
    contextName?: string
  }) => Promise<{ success: boolean; error?: string }>
  releaseUninstall: (args: {
    releaseName: string
    namespace: string
    contextName?: string
  }) => Promise<{ success: boolean; error?: string }>
}

/** Options for a pod log read. `null` tailLines/sinceSeconds mean "no limit". */
export interface PodLogOptions {
  follow?: boolean
  previous?: boolean
  timestamps?: boolean
  tailLines?: number | null
  sinceSeconds?: number | null
}

export interface API {
  k8s: K8sAPI
  checkAwsCredentials: () => Promise<AwsCredentialResult>
  startPodLog: (
    namespace: string,
    podName: string,
    containerName?: string,
    tabKey?: string,
    options?: PodLogOptions,
  ) => Promise<{ success: boolean }>
  stopPodLog: (
    namespace: string,
    podName: string,
  ) => Promise<{ success: boolean }>
  stopPodLogSession: (sessionId: string) => Promise<{ success: boolean }>
  onPodLogData: (
    callback: (data: { tabKey: string; line: string }) => void,
  ) => () => void
  /** Fires when a non-following read runs out of log; never for an aborted one. */
  onPodLogEnd: (callback: (data: { tabKey: string }) => void) => () => void
  getPrometheusConfig: () => Promise<{
    namespace: string
    service: string
    port: number
  }>
  setPrometheusConfig: (config: {
    namespace: string
    service: string
    port: number
  }) => Promise<{ success: boolean }>
  getPrometheusPodMetrics: (args: {
    namespace: string
    podName: string
    step?: number
    rangeMinutes?: number
  }) => Promise<PodMetricsResult | { error: string }>
  listEvents: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sEvent[]>
  listEventsForResource: (args: {
    contextName?: string
    namespace: string
    name: string
    kind: string
  }) => Promise<K8sEvent[]>
  /**
   * Subscribes to a main-process informer. The resolved `items` are the same
   * summaries the matching `list*` call returns, so the item type follows from
   * `args.resource` and the caller narrows it. Rejects when the watch can't be
   * established, which means "poll instead".
   */
  startWatch: (args: WatchStartArgs) => Promise<WatchSnapshot<unknown>>
  stopWatch: (args: { subId: string }) => Promise<{ success: boolean }>
  onWatchEvent: (callback: (message: WatchEventMessage) => void) => () => void
  onWatchClosed: (callback: (message: WatchClosedMessage) => void) => () => void
  startPodExec: (
    sessionId: string,
    namespace: string,
    podName: string,
    containerName: string,
    contextName?: string,
  ) => Promise<{ success: boolean }>
  /** Opens the OS file picker; resolves `{ path: null }` when it is dismissed. */
  selectLocalPath: (args: {
    mode: "file" | "directory"
    title?: string
  }) => Promise<{ path: string | null }>
  onPodCopyProgress: (
    callback: (data: { transferId: string; bytes: number }) => void,
  ) => () => void
  sendPodExecInput: (sessionId: string, data: string) => void
  closePodExec: (sessionId: string) => void
  onPodExecOutput: (
    callback: (data: { sessionId: string; data: string }) => void,
  ) => () => void
  startSocketStream: (
    socketPath: string,
    sessionId: string,
  ) => Promise<{ success: boolean }>
  stopSocketStream: (sessionId: string) => Promise<{ success: boolean }>
  onSocketData: (
    callback: (data: { sessionId: string; line: string }) => void,
  ) => () => void
  onSocketEnd: (
    callback: (data: { sessionId: string; reason: string }) => void,
  ) => () => void
  startPortForward: (args: {
    resourceKind: "Pod" | "Service"
    namespace: string
    name: string
    localPort: number
    targetPort: number
    sessionId: string
  }) => Promise<{ success: boolean; error?: string }>
  stopPortForward: (sessionId: string) => Promise<{ success: boolean }>
  helm: HelmAPI
  alarm: AlarmAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
