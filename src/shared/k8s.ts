// Canonical k8s resource shapes shared across the main process (IPC producers,
// see src/main/handlers/types.ts) and the renderer (IPC consumers, see
// src/preload/renderer/src/types/k8s.ts). Defined once here so the two sides
// can't drift out of sync.
//
// Resources with expensive detail (pod templates, rule sets, ConfigMap and
// Secret payloads) are split in two: `XxxSummary` is what a list row needs, and
// `XxxInfo extends XxxSummary` adds what only the detail panel shows. `list*`
// handlers return summaries — the full shape used to cross IPC for every row on
// every poll tick — and a `get<Xxx>` handler fetches one object's detail when a
// row is selected. Resources whose every field is already list-sized have no
// Summary and keep a single `XxxInfo`.

// ---------------------------------------------------------------------------
// Shared / primitive
// ---------------------------------------------------------------------------

export interface MutationResult {
  success: boolean
  error?: string
  name?: string
  namespace?: string
}

/** How a delete cascades to dependents. `Background` is the API server's
 *  default for most kinds and is what the detail panels use unless a view
 *  overrides it. */
export type PropagationPolicy = "Background" | "Foreground" | "Orphan"

/** The subset of `V1DeleteOptions` the generic delete exposes — the same knobs
 *  `kubectl delete` puts behind `--cascade`, `--grace-period` and `--force`. */
export interface DeleteResourceOptions {
  propagationPolicy?: PropagationPolicy
  /** Seconds the object gets to shut down. `0` deletes immediately, which is
   *  what `kubectl delete --force --grace-period=0` does. Omit to use the
   *  object's own grace period. */
  gracePeriodSeconds?: number
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

export interface DryRunResult {
  name: string
  namespace: string
  kind: string
  /** What the real apply would do: create the object, or patch the one that's
   *  already there. */
  action: "create" | "update"
  /** Unified diff from the live object to what the server said it would
   *  become. Empty when the apply is a no-op (or on a create, where there is
   *  no "before" — read `rendered` instead). */
  diff: string
  /** The server's own rendering of the result as YAML, after defaulting,
   *  admission webhooks and validation have run. */
  rendered: string
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

/** A label edit expressed the way `kubectl label` expresses it: keys to write
 *  (adding or overwriting) and keys to drop. Renaming a key is a `remove` of
 *  the old plus a `set` of the new. */
export interface NodeLabelUpdate {
  set: Record<string, string>
  remove: string[]
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
/** Mirrors the `kubectl drain` flags. Every one of these guards a case where
 *  evicting a pod loses something the cluster can't recreate, so they are all
 *  opt-in. */
export interface DrainOptions {
  /** Evict pods no controller owns. Without it the drain refuses, because
   *  nothing would recreate such a pod elsewhere. (`--force`) */
  force?: boolean
  /** Override each pod's own terminationGracePeriodSeconds.
   *  (`--grace-period`) */
  gracePeriodSeconds?: number
  /** Leave DaemonSet pods where they are instead of refusing. Defaults to
   *  true, since a DaemonSet pod is expected on every node.
   *  (`--ignore-daemonsets`) */
  ignoreDaemonSets?: boolean
  /** Evict pods with emptyDir volumes, discarding that data.
   *  (`--delete-emptydir-data`) */
  deleteEmptyDirData?: boolean
  /** How long to wait for evicted pods to actually terminate. 0 issues the
   *  evictions and returns immediately. (`--timeout`) */
  timeoutSeconds?: number
}

export interface DrainResult {
  success: boolean
  cordoned: boolean
  evicted: number
  skipped: string[]
  failed: { pod: string; error: string }[]
  /** Evicted pods still running when the wait deadline passed. Non-empty
   *  exactly when `timedOut` is true. */
  pending: string[]
  timedOut: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// workload.ts
// ---------------------------------------------------------------------------

export interface DeploymentSummary {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  creationTimestamp: string
}

export interface DeploymentInfo extends DeploymentSummary {
  strategy: string
  rollingUpdate: RollingUpdateStrategy | null
  minReadySeconds: number
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

export interface ReplicaSetSummary {
  name: string
  namespace: string
  desiredReplicas: number
  currentReplicas: number
  readyReplicas: number
  creationTimestamp: string
}

export interface ReplicaSetInfo extends ReplicaSetSummary {
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

export interface StatefulSetSummary {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  creationTimestamp: string
  serviceName: string
}

export interface StatefulSetInfo extends StatefulSetSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
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

export interface DaemonSetSummary {
  name: string
  namespace: string
  desiredNumberScheduled: number
  currentNumberScheduled: number
  numberReady: number
  updatedNumberScheduled: number
  numberAvailable: number
  creationTimestamp: string
}

export interface DaemonSetInfo extends DaemonSetSummary {
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

export interface PodSummary {
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

export interface PodInfo extends PodSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  serviceAccountName: string
  qosClass: string
  initContainers: PodContainerInfo[]
  containers: PodContainerInfo[]
  /** Debug containers added after the pod started. Empty on almost every pod:
   *  they only exist once someone has run a debug session against it. */
  ephemeralContainers: PodContainerInfo[]
  volumes: VolumeInfo[]
  conditions: Condition[]
}

/** What `kubectl debug` adds to a running pod: a container that shares the
 *  pod's network (and, with a target, another container's process namespace)
 *  so a shell can be opened against an image that has the tools the workload
 *  image lacks. Ephemeral containers cannot be removed or restarted. */
export interface DebugContainerRequest {
  /** Image to run, e.g. `busybox:1.36`. Required. */
  image: string
  /** Container name. Generated (`debugger-xxxxx`) when blank. */
  name?: string
  /** Share this container's process namespace, so its processes and its
   *  `/proc/<pid>/root` filesystem are visible. Requires cluster support for
   *  `EphemeralContainers` targeting; left off, the debug container only
   *  shares the pod's network and volumes. */
  targetContainer?: string
  /** Entrypoint override. Empty runs the image's own entrypoint, which is what
   *  `kubectl debug` does. */
  command?: string[]
}

export interface DebugContainerResult extends MutationResult {
  /** The name the container ended up with, generated or not — the caller needs
   *  it to attach a shell. */
  containerName: string
  /** False when the wait expired before the kubelet reported it running: the
   *  container exists, but attaching to it now would fail. */
  running: boolean
  /** Why it is not running yet (`ContainerCreating`, an image pull failure, an
   *  exit code), when `running` is false. */
  state: string
}

/** One `kubectl cp`. `localPath` is a file or directory on this machine;
 *  `remotePath` is the path inside the container. Both directions shell out to
 *  `tar` inside the container, so the container image must have it. */
export interface PodCopyRequest {
  namespace: string
  podName: string
  containerName: string
  localPath: string
  remotePath: string
}

export interface PodCopyResult {
  success: boolean
  /** Bytes of tar stream moved — larger than the payload by the tar headers. */
  bytes: number
}

/** Options for the Eviction API, which takes the same delete options a pod
 *  delete does. Unlike a delete, the API server refuses the call when a
 *  PodDisruptionBudget would be violated. */
export interface EvictPodOptions {
  /** Override the pod's own terminationGracePeriodSeconds. 0 kills it without
   *  waiting for the container to shut down. */
  gracePeriodSeconds?: number
  /** Ask the API server to run the admission and PDB checks and then discard
   *  the eviction — the way to test whether a pod can be evicted right now. */
  dryRun?: boolean
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

export interface IngressSummary {
  name: string
  namespace: string
  ingressClassName: string
  hosts: string
  address: string
  ports: string
  creationTimestamp: string
}

export interface IngressInfo extends IngressSummary {
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

export interface EndpointSummary {
  name: string
  namespace: string
  readyAddressCount: number
  notReadyAddressCount: number
  ports: string
  creationTimestamp: string
}

export interface EndpointInfo extends EndpointSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  subsets: EndpointSubset[]
}

export interface EndpointSlicePortInfo {
  name: string
  /** Null is the API's "all ports" wildcard, not a missing value. */
  port: number | null
  protocol: string
  appProtocol: string | null
}

export interface EndpointSliceEndpoint {
  addresses: string[]
  /** The conditions are tri-state: unset means the publisher did not say, and
   *  the API tells consumers to read an unset `ready` as true. */
  ready: boolean | null
  serving: boolean | null
  terminating: boolean | null
  hostname: string | null
  nodeName: string | null
  zone: string | null
  targetKind: string | null
  targetName: string | null
  targetNamespace: string | null
}

export interface EndpointSliceSummary {
  name: string
  namespace: string
  /** Owning Service, from the `kubernetes.io/service-name` label. Empty for a
   *  slice published by something other than the EndpointSlice controller. */
  serviceName: string
  addressType: string
  endpointCount: number
  readyCount: number
  ports: string
  creationTimestamp: string
}

export interface EndpointSliceInfo extends EndpointSliceSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  endpoints: EndpointSliceEndpoint[]
  endpointPorts: EndpointSlicePortInfo[]
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

export interface NetworkPolicySummary {
  name: string
  namespace: string
  podSelector: string
  policyTypes: string[]
  ingressRuleCount: number
  egressRuleCount: number
  creationTimestamp: string
}

export interface NetworkPolicyInfo extends NetworkPolicySummary {
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
  /** status.capacity — the size the bound volume actually provides. During an
   *  expansion it trails `requestedStorage` until the resize finishes. */
  capacity: string
  /** spec.resources.requests.storage — the size asked for. */
  requestedStorage: string
  accessModes: string[]
  storageClass: string
  volumeMode: string
  /** allowVolumeExpansion of the claim's StorageClass. null when the class
   *  could not be resolved — no class on the claim, or no RBAC to read it —
   *  in which case expansion is offered but may be rejected by the server. */
  allowVolumeExpansion: boolean | null
  /** status.conditions: `Resizing` and `FileSystemResizePending` are how an
   *  in-flight expansion reports itself. */
  conditions: Condition[]
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

export interface VolumeSnapshotClassInfo {
  name: string
  /** The CSI driver that takes the snapshot. */
  driver: string
  /** `Delete` or `Retain` — what happens to the underlying VolumeSnapshotContent
   *  when the VolumeSnapshot that bound it is deleted. */
  deletionPolicy: string
  /** True when the class carries
   *  `snapshot.storage.kubernetes.io/is-default-class: "true"`, which is what a
   *  VolumeSnapshot with no `volumeSnapshotClassName` falls back to. */
  isDefault: boolean
  parameters: Record<string, string>
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

// ---------------------------------------------------------------------------
// config.ts
// ---------------------------------------------------------------------------

export interface ConfigMapSummary {
  name: string
  namespace: string
  creationTimestamp: string
  keys: string[]
}

export interface ConfigMapInfo extends ConfigMapSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
  /** Key to byte length — binary values are never sent over IPC. */
  binaryData: Record<string, number>
}

export interface SecretSummary {
  name: string
  namespace: string
  type: string
  creationTimestamp: string
  keys: string[]
}

/** `data` holds the base64 values verbatim, so this shape only ever leaves the
 *  main process for the one Secret whose detail panel is open. */
export interface SecretInfo extends SecretSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
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

export interface RoleSummary {
  name: string
  namespace: string
  rulesCount: number
  creationTimestamp: string
}

export interface RoleInfo extends RoleSummary {
  labels: Record<string, string>
  annotations: Record<string, string>
  rules: RbacRule[]
}

export interface ClusterRoleSummary {
  name: string
  rulesCount: number
  creationTimestamp: string
}

export interface ClusterRoleInfo extends ClusterRoleSummary {
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
  suspend: boolean
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

/** How a metric target is expressed: a percentage of the pod's request
 *  (`Utilization`), a per-pod average (`AverageValue`), or a total (`Value`).
 *  Resource metrics take the first two; `Value` belongs to Object/External. */
export type HPAMetricTargetType = "Utilization" | "AverageValue" | "Value"

/**
 * A `Resource` or `ContainerResource` entry of `spec.metrics`, structured
 * rather than flattened into `HPAMetric`'s display strings, so the metric
 * editor can round-trip it. Pods/Object/External metrics carry a metric
 * selector and stay in YAML; `HPAInfo.otherMetricCount` counts them.
 */
export interface HPAResourceMetricSpec {
  kind: "Resource" | "ContainerResource"
  /** `cpu`, `memory`, or an extended resource name. */
  name: string
  /** The container the reading comes from; "" for a whole-pod `Resource`. */
  container: string
  targetType: HPAMetricTargetType
  /** Percent of the pod's request, when `targetType` is `Utilization`. */
  averageUtilization: number | null
  /** Quantity, when `targetType` is `AverageValue`. */
  value: string
}

/** A metric spec paired with what the HPA last read for it. The write path
 *  takes the spec alone — status is the API server's to fill. */
export interface HPAResourceMetric extends HPAResourceMetricSpec {
  /** `status.currentMetrics` for this metric as a percentage, or null when
   *  the metric has no reading yet. */
  currentUtilization: number | null
  /** `status.currentMetrics` for this metric as a quantity, or "". */
  currentValue: string
}

/** New `spec.minReplicas`/`spec.maxReplicas` for one HPA. */
export interface HPAReplicaBounds {
  minReplicas: number
  maxReplicas: number
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
  /** The editable subset of `metrics`, in structured form. */
  resourceMetrics: HPAResourceMetric[]
  /** Pods/Object/External metrics on this HPA. The metric editor cannot
   *  represent them and leaves them untouched; the count is shown so the user
   *  knows the list they are editing is not the whole of `spec.metrics`. */
  otherMetricCount: number
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

/** metrics-server usage for one container. Numeric so the renderer formats
 *  without re-parsing quantity strings over IPC. */
export interface ContainerMetric {
  name: string
  cpuNanocores: number
  memoryBytes: number
}

/** metrics-server usage for one pod: the container readings plus their sum,
 *  which is what `kubectl top pod` prints. */
export interface PodMetric {
  podName: string
  namespace: string
  /** Sampling window the reading covers, e.g. `30s`. */
  window: string
  timestamp: string
  cpuNanocores: number
  memoryBytes: number
  containers: ContainerMetric[]
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

// ---------------------------------------------------------------------------
// customresources.ts
// ---------------------------------------------------------------------------

/** One entry of a CRD version's `additionalPrinterColumns`. `jsonPath` is
 *  evaluated against each object by `evaluateJsonPath`. */
export interface CRDPrinterColumn {
  name: string
  type: string
  jsonPath: string
  description: string
  /** Columns above 0 are the ones `kubectl get -o wide` hides by default. */
  priority: number
}

export interface CRDVersionInfo {
  name: string
  served: boolean
  storage: boolean
  deprecated: boolean
  deprecationWarning: string
  printerColumns: CRDPrinterColumn[]
  /** Whether this version exposes the `scale` subresource, which is what
   *  makes a CR scalable by an HPA. */
  hasScale: boolean
  hasStatus: boolean
}

export interface CRDInfo {
  /** `plural.group`, the CRD object's own name. */
  name: string
  group: string
  kind: string
  listKind: string
  singular: string
  plural: string
  shortNames: string[]
  categories: string[]
  scope: CustomResourceScope
  versions: CRDVersionInfo[]
  /** The one version with `storage: true` — the version to read and write. */
  storageVersion: string
  /** Every version with `served: true`, in the order the CRD declares them. */
  servedVersions: string[]
  established: boolean
  conditions: Condition[]
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

export type CustomResourceScope = "Namespaced" | "Cluster"

/** Addresses one CRD version's objects. Everything the generic browser needs
 *  to list, read, edit and delete a kind it has no compiled-in knowledge of. */
export interface CustomResourceRef {
  group: string
  version: string
  plural: string
  kind: string
  scope: CustomResourceScope
}

export interface CustomResourceInfo {
  name: string
  namespace: string
  /** Cluster-scoped kinds report `""`, matching the other cluster-scoped
   *  list shapes. */
  apiVersion: string
  kind: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  /** One entry per requested printer column, in order. `null` where the
   *  JSONPath did not resolve, so the view renders a dash rather than "". */
  columns: (string | null)[]
}

/** A row plus the object behind it — the detail panel renders the whole
 *  manifest, since nothing here knows the kind's schema. */
export interface CustomResourceDetail {
  info: CustomResourceInfo
  object: Record<string, unknown>
}
