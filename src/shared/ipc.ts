// The IPC contract, written once. Every channel the renderer can reach is a
// key of one of the three maps below, with the arguments it takes and what it
// answers. The preload builds `window.api` from them (`src/preload/api.ts`) and
// main registers its handlers through `TypedIpcMain`
// (`src/main/ipc/typed-ipc.ts`), so a channel name, an argument shape or a
// result type that changes on one side stops compiling on the other.
import type {
  AccessReviewRequest,
  AccessReviewResult,
  AccessSubject,
  ApiResourceCatalog,
  ApplyResult,
  ClusterRoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleSummary,
  ConfigMapInfo,
  ConfigMapSummary,
  ContextInfo,
  CRDInfo,
  CronJobInfo,
  CustomResourceDetail,
  CustomResourceInfo,
  CustomResourceRef,
  DaemonSetInfo,
  DaemonSetSummary,
  DebugContainerRequest,
  DebugContainerResult,
  DeleteResourceOptions,
  DeploymentInfo,
  DeploymentRevision,
  DeploymentSummary,
  DrainOptions,
  DrainResult,
  DryRunResult,
  EditableManifest,
  EndpointInfo,
  EndpointSliceInfo,
  EndpointSliceSummary,
  EndpointSummary,
  EventInfo,
  EvictPodOptions,
  HelmRelease,
  HelmRepo,
  HPAInfo,
  HPAResourceMetricSpec,
  IngressClassInfo,
  IngressInfo,
  IngressSummary,
  JobInfo,
  LimitRangeInfo,
  MetricsUnavailable,
  MutationResult,
  NamespaceInfo,
  NetworkPolicyInfo,
  NetworkPolicySummary,
  NodeInfo,
  NodeLabelUpdate,
  NodeMetric,
  NodeTaint,
  PDBInfo,
  PodCopyRequest,
  PodCopyResult,
  PodInfo,
  PodMetric,
  PodSummary,
  PriorityClassInfo,
  PVCInfo,
  PVInfo,
  RbacRule,
  RbacSubject,
  ReplicaSetInfo,
  ReplicaSetSummary,
  ResourceQuotaInfo,
  ResourceRelations,
  RoleBindingInfo,
  RoleInfo,
  RoleSubjectBinding,
  RoleSummary,
  SecretInfo,
  SecretSummary,
  SelfRulesResult,
  ServiceAccountInfo,
  ServiceInfo,
  StatefulSetInfo,
  StatefulSetSummary,
  StorageClassInfo,
  SubjectPermissions,
  UpdateClusterRoleBindingResult,
  UpdateClusterRoleResult,
  UpdateRoleBindingResult,
  UpdateRoleResult,
  UpdateServiceAccountResult,
  VolumeSnapshotClassInfo,
  VolumeSnapshotInfo,
  WebhookConfigurationInfo,
  WebhookConfigurationSummary,
} from "./k8s"
import type {
  WatchClosedMessage,
  WatchEventMessage,
  WatchSnapshot,
  WatchStartArgs,
} from "./watch"

// ---------------------------------------------------------------------------
// Shapes that cross IPC but are not Kubernetes resources
// ---------------------------------------------------------------------------

export interface ConnectionStatus {
  connected: boolean
  /** Why the probe failed; omitted when connected. */
  reason?: "network" | "auth" | "unknown"
  error?: string
}

export interface AwsCredentialResult {
  valid: boolean
  type: "env" | "file" | "sso-cache" | "metadata" | "none"
  hasSessionToken?: boolean
  expiresAt?: string
  ssoSession?: string
}

export type AlarmSeverity = "critical" | "warning" | "info"

export interface AlarmRule {
  id: string
  name: string
  severity: AlarmSeverity
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
  severity: AlarmSeverity
  context: string
  sourceKind: string
  sourceName: string
  namespace: string | null
  message: string
  triggeredAt: string
}

export interface PrometheusConfig {
  namespace: string
  service: string
  port: number
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

export interface PodMetricsError {
  error: string
}

export interface PrometheusDiscoveryResult {
  ok: boolean
  endpoint: string
  error?: string
}

/**
 * The subset of the pod log API the panel drives. `null` for `tailLines`,
 * `sinceSeconds` or `sinceTime` means "no limit": the query parameter is left
 * off, which is how the API server spells "all of it".
 */
export interface PodLogOptions {
  follow?: boolean
  previous?: boolean
  timestamps?: boolean
  tailLines?: number | null
  sinceSeconds?: number | null
  /** An absolute cutoff, as anything `Date.parse` reads. Wins over
   *  `sinceSeconds`: the API server takes one or the other, never both. */
  sinceTime?: string | null
}

/** A local path picked in the OS file dialog, or null when it was cancelled. */
export interface SelectPathResult {
  path: string | null
}

// ---------------------------------------------------------------------------
// Argument shapes shared by many channels
// ---------------------------------------------------------------------------

export interface ContextArgs {
  contextName?: string
}

/** A list of a cluster-scoped kind. */
export interface ClusterListArgs extends ContextArgs {
  labelSelector?: string
}

/** A list of a namespaced kind; no namespace means every namespace. */
export interface ListArgs extends ClusterListArgs {
  namespace?: string
}

/** Only the fields the kind indexes; see FIELD_SELECTOR_FIELDS in
 *  src/shared/field-selector.ts. */
export interface FieldSelectorArgs {
  fieldSelector?: string
}

export interface ClusterObjectArgs extends ContextArgs {
  name: string
}

export interface ObjectArgs extends ClusterObjectArgs {
  namespace: string
}

/** An object addressed by GVK, the way the generic apply/delete path does. */
export interface ResourceTargetArgs extends ContextArgs {
  apiVersion: string
  kind: string
  name: string
  namespace?: string
}

export interface YamlArgs extends ContextArgs {
  yaml: string
}

/** A full PUT. Given the `resourceVersion` the manifest was read at, the write
 *  is refused (an `EditConflict:` error) if the object has changed since;
 *  without one it overwrites unconditionally. */
export interface ReplaceArgs extends YamlArgs {
  resourceVersion?: string
}

export interface CustomResourceListArgs extends ContextArgs {
  namespace?: string
  ref: CustomResourceRef
  /** JSONPaths from the CRD version's `additionalPrinterColumns`; each row
   *  comes back with one `columns` entry per path, in order. */
  printerColumns?: string[]
  labelSelector?: string
}

export interface CustomResourceGetArgs extends ContextArgs {
  namespace?: string
  name: string
  ref: CustomResourceRef
  printerColumns?: string[]
}

export interface PodCopyArgs extends PodCopyRequest, ContextArgs {
  /** Tags the `k8s:pod:copy:progress` events of this transfer. */
  transferId: string
}

export interface HelmReleaseArgs extends ContextArgs {
  releaseName: string
  chart: string
  namespace: string
  values?: string
}

export interface PortForwardArgs {
  resourceKind: "Pod" | "Service"
  namespace: string
  name: string
  localPort: number
  targetPort: number
  sessionId: string
}

export interface ServicePortSpec {
  protocol: string
  port: number
  targetPort: number | string
}

export interface IngressRuleSpec {
  host: string
  path: string
  pathType: string
  serviceName: string
  servicePort: number | string
}

export interface IngressTLSSpec {
  hosts: string[]
  secretName: string
}

// ---------------------------------------------------------------------------
// renderer → main, request/response (`ipcRenderer.invoke` / `ipcMain.handle`)
// ---------------------------------------------------------------------------

interface Call<Args extends unknown[], Result> {
  args: Args
  result: Result
}

export interface IpcInvokeMap {
  // cluster
  "k8s:contexts:list": Call<[], ContextInfo[]>
  "k8s:context:current": Call<[], string>
  "k8s:cluster:type": Call<[], ContextInfo["clusterType"]>
  "k8s:connection:check": Call<[args?: ContextArgs], ConnectionStatus>
  "k8s:connection:reconnect": Call<[args?: ContextArgs], ConnectionStatus>
  "k8s:namespaces:list": Call<
    [args?: ClusterListArgs & FieldSelectorArgs],
    NamespaceInfo[]
  >
  "k8s:nodes:list": Call<
    [args?: ClusterListArgs & FieldSelectorArgs],
    NodeInfo[]
  >
  "k8s:node:cordon": Call<
    [args: ClusterObjectArgs & { schedulable: boolean }],
    MutationResult
  >
  "k8s:node:drain": Call<
    [args: ClusterObjectArgs & { options?: DrainOptions }],
    DrainResult
  >
  "k8s:node:labels:update": Call<
    [args: ClusterObjectArgs & { update: NodeLabelUpdate }],
    MutationResult
  >
  "k8s:node:taints:update": Call<
    [args: ClusterObjectArgs & { taints: NodeTaint[] }],
    MutationResult
  >
  "k8s:node:metrics": Call<
    [args?: ContextArgs],
    NodeMetric[] | MetricsUnavailable
  >
  /** Every kind the cluster serves, as `kubectl api-resources` lists them,
   *  plus the groupVersions discovery could not read. */
  "k8s:apiresources:list": Call<[args?: ContextArgs], ApiResourceCatalog>

  // workloads
  "k8s:deployments:list": Call<[args?: ListArgs], DeploymentSummary[]>
  "k8s:deployment:get": Call<[args: ObjectArgs], DeploymentInfo>
  "k8s:deployment:create": Call<
    [namespace: string, name: string, image: string, replicas: number],
    ApplyResult
  >
  "k8s:deployment:update": Call<
    [namespace: string, name: string, yaml: string],
    ApplyResult
  >
  "k8s:deployment:restart": Call<[args: ObjectArgs], MutationResult>
  "k8s:deployment:pause": Call<
    [args: ObjectArgs & { paused: boolean }],
    MutationResult
  >
  "k8s:deployment:scale": Call<
    [args: ObjectArgs & { replicas: number }],
    MutationResult
  >
  "k8s:deployment:history": Call<
    [args: ObjectArgs & { selector: Record<string, string> }],
    DeploymentRevision[]
  >
  "k8s:deployment:rollback": Call<
    [args: ObjectArgs & { revision: number }],
    MutationResult
  >
  "k8s:replicasets:list": Call<[args?: ListArgs], ReplicaSetSummary[]>
  "k8s:replicaset:get": Call<[args: ObjectArgs], ReplicaSetInfo>
  "k8s:replicaset:scale": Call<
    [args: ObjectArgs & { replicas: number }],
    MutationResult
  >
  "k8s:statefulsets:list": Call<[args?: ListArgs], StatefulSetSummary[]>
  "k8s:statefulset:get": Call<[args: ObjectArgs], StatefulSetInfo>
  "k8s:statefulset:create": Call<
    [
      namespace: string,
      name: string,
      image: string,
      replicas: number,
      serviceName: string,
    ],
    ApplyResult
  >
  "k8s:statefulset:update": Call<
    [namespace: string, name: string, yaml: string],
    ApplyResult
  >
  "k8s:statefulset:restart": Call<[args: ObjectArgs], MutationResult>
  "k8s:statefulset:scale": Call<
    [args: ObjectArgs & { replicas: number }],
    MutationResult
  >
  "k8s:daemonsets:list": Call<[args?: ListArgs], DaemonSetSummary[]>
  "k8s:daemonset:get": Call<[args: ObjectArgs], DaemonSetInfo>
  "k8s:daemonset:create": Call<
    [namespace: string, name: string, image: string],
    ApplyResult
  >
  "k8s:daemonset:update": Call<
    [namespace: string, name: string, yaml: string],
    ApplyResult
  >
  "k8s:daemonset:restart": Call<[args: ObjectArgs], MutationResult>
  "k8s:pods:list": Call<[args?: ListArgs & FieldSelectorArgs], PodSummary[]>
  "k8s:pod:get": Call<[args: ObjectArgs], PodInfo>
  "k8s:pods:metrics": Call<
    [args?: ContextArgs & { namespace?: string }],
    PodMetric[] | MetricsUnavailable
  >
  "k8s:pod:metrics": Call<[args: ObjectArgs], PodMetric | MetricsUnavailable>
  "k8s:pod:evict": Call<
    [args: ObjectArgs & { options?: EvictPodOptions }],
    MutationResult
  >
  "k8s:pod:debug": Call<
    [args: ObjectArgs & { request: DebugContainerRequest }],
    DebugContainerResult
  >
  "k8s:pod:copy:to": Call<[args: PodCopyArgs], PodCopyResult>
  "k8s:pod:copy:from": Call<[args: PodCopyArgs], PodCopyResult>

  // batch
  "k8s:jobs:list": Call<[args?: ListArgs], JobInfo[]>
  "k8s:job:restart": Call<[args: ObjectArgs], MutationResult>
  "k8s:job:suspend": Call<
    [args: ObjectArgs & { suspend: boolean }],
    MutationResult
  >
  "k8s:cronjobs:list": Call<[args?: ListArgs], CronJobInfo[]>
  "k8s:cronjob:trigger": Call<[args: ObjectArgs], MutationResult>
  "k8s:cronjob:suspend": Call<
    [args: ObjectArgs & { suspend: boolean }],
    MutationResult
  >

  // config
  "k8s:configmaps:list": Call<[args?: ListArgs], ConfigMapSummary[]>
  "k8s:configmap:get": Call<[args: ObjectArgs], ConfigMapInfo>
  "k8s:configmap:update": Call<
    [namespace: string, name: string, yaml: string],
    ApplyResult
  >
  "k8s:secrets:list": Call<
    [args?: ListArgs & FieldSelectorArgs],
    SecretSummary[]
  >
  "k8s:secret:get": Call<[args: ObjectArgs], SecretInfo>
  "k8s:secret:update": Call<
    [namespace: string, name: string, yaml: string],
    ApplyResult
  >

  // networking
  "k8s:services:list": Call<[args?: ListArgs], ServiceInfo[]>
  "k8s:service:create": Call<
    [
      namespace: string,
      name: string,
      type: string,
      ports: ServicePortSpec[],
      selector: Record<string, string>,
    ],
    ApplyResult
  >
  "k8s:service:update": Call<
    [namespace: string, name: string, yaml: string],
    ApplyResult
  >
  "k8s:ingresses:list": Call<[args?: ListArgs], IngressSummary[]>
  "k8s:ingress:get": Call<[args: ObjectArgs], IngressInfo>
  "k8s:ingress:create": Call<
    [
      namespace: string,
      name: string,
      ingressClassName: string,
      rules: IngressRuleSpec[],
      tls: IngressTLSSpec[],
    ],
    ApplyResult
  >
  "k8s:ingress:update": Call<
    [namespace: string, name: string, yaml: string],
    ApplyResult
  >
  "k8s:ingressclasses:list": Call<[args?: ClusterListArgs], IngressClassInfo[]>
  "k8s:networkpolicies:list": Call<[args?: ListArgs], NetworkPolicySummary[]>
  "k8s:networkpolicy:get": Call<[args: ObjectArgs], NetworkPolicyInfo>
  "k8s:endpoints:list": Call<[args?: ListArgs], EndpointSummary[]>
  "k8s:endpoint:get": Call<[args: ObjectArgs], EndpointInfo>
  "k8s:endpointslices:list": Call<[args?: ListArgs], EndpointSliceSummary[]>
  "k8s:endpointslice:get": Call<[args: ObjectArgs], EndpointSliceInfo>

  // rbac
  "k8s:serviceaccounts:list": Call<[args?: ListArgs], ServiceAccountInfo[]>
  "k8s:serviceaccount:update": Call<
    [
      namespace: string,
      name: string,
      metadata: {
        labels?: Record<string, string>
        annotations?: Record<string, string>
      },
    ],
    UpdateServiceAccountResult
  >
  "k8s:roles:list": Call<[args?: ListArgs], RoleSummary[]>
  "k8s:role:get": Call<[args: ObjectArgs], RoleInfo>
  "k8s:role:update": Call<
    [namespace: string, name: string, rules: RbacRule[]],
    UpdateRoleResult
  >
  "k8s:clusterroles:list": Call<[args?: ClusterListArgs], ClusterRoleSummary[]>
  "k8s:clusterrole:get": Call<[args: ClusterObjectArgs], ClusterRoleInfo>
  "k8s:clusterrole:update": Call<
    [name: string, rules: RbacRule[]],
    UpdateClusterRoleResult
  >
  "k8s:rolebindings:list": Call<[args?: ListArgs], RoleBindingInfo[]>
  "k8s:rolebinding:update": Call<
    [namespace: string, name: string, subjects: RbacSubject[]],
    UpdateRoleBindingResult
  >
  "k8s:clusterrolebindings:list": Call<
    [args?: ClusterListArgs],
    ClusterRoleBindingInfo[]
  >
  "k8s:clusterrolebinding:update": Call<
    [name: string, subjects: RbacSubject[]],
    UpdateClusterRoleBindingResult
  >
  "k8s:access:review": Call<
    [args: ContextArgs & { request: AccessReviewRequest }],
    AccessReviewResult
  >
  "k8s:access:selfrules": Call<
    [args: ContextArgs & { namespace: string }],
    SelfRulesResult
  >
  "k8s:access:subject": Call<
    [args: ContextArgs & { subject: AccessSubject }],
    SubjectPermissions
  >
  "k8s:access:rolesubjects": Call<
    [
      args: ContextArgs & {
        kind: "Role" | "ClusterRole"
        name: string
        namespace: string
      },
    ],
    RoleSubjectBinding[]
  >
  "k8s:references:get": Call<[args: ResourceTargetArgs], ResourceRelations>

  // autoscaling
  "k8s:hpas:list": Call<[args?: ListArgs], HPAInfo[]>
  "k8s:hpa:get": Call<[args: ObjectArgs], HPAInfo>
  "k8s:hpa:replicas:update": Call<
    [args: ObjectArgs & { minReplicas: number; maxReplicas: number }],
    MutationResult
  >
  "k8s:hpa:metrics:update": Call<
    [args: ObjectArgs & { metrics: HPAResourceMetricSpec[] }],
    MutationResult
  >

  // storage
  "k8s:pvs:list": Call<[args?: ClusterListArgs], PVInfo[]>
  "k8s:pvcs:list": Call<[args?: ListArgs], PVCInfo[]>
  "k8s:pvc:expand": Call<
    [args: ObjectArgs & { storage: string }],
    MutationResult
  >
  "k8s:storageclasses:list": Call<[args?: ClusterListArgs], StorageClassInfo[]>
  "k8s:volumesnapshots:list": Call<[args?: ListArgs], VolumeSnapshotInfo[]>
  "k8s:volumesnapshotclasses:list": Call<
    [args?: ClusterListArgs],
    VolumeSnapshotClassInfo[]
  >

  // custom resources
  "k8s:crds:list": Call<[args?: ClusterListArgs], CRDInfo[]>
  "k8s:customresources:list": Call<
    [args: CustomResourceListArgs],
    CustomResourceInfo[]
  >
  "k8s:customresource:get": Call<
    [args: CustomResourceGetArgs],
    CustomResourceDetail
  >

  // governance
  "k8s:resourcequotas:list": Call<[args?: ListArgs], ResourceQuotaInfo[]>
  "k8s:limitranges:list": Call<[args?: ListArgs], LimitRangeInfo[]>
  "k8s:pdbs:list": Call<[args?: ListArgs], PDBInfo[]>
  "k8s:priorityclasses:list": Call<
    [args?: ClusterListArgs],
    PriorityClassInfo[]
  >
  "k8s:validatingwebhookconfigurations:list": Call<
    [args?: ClusterListArgs],
    WebhookConfigurationSummary[]
  >
  "k8s:validatingwebhookconfiguration:get": Call<
    [args: ClusterObjectArgs],
    WebhookConfigurationInfo
  >
  "k8s:mutatingwebhookconfigurations:list": Call<
    [args?: ClusterListArgs],
    WebhookConfigurationSummary[]
  >
  "k8s:mutatingwebhookconfiguration:get": Call<
    [args: ClusterObjectArgs],
    WebhookConfigurationInfo
  >

  // generic apply / edit / delete
  "k8s:resource:apply": Call<[args: YamlArgs], ApplyResult>
  "k8s:resource:dryRun": Call<[args: YamlArgs], DryRunResult>
  "k8s:resource:replace": Call<[args: ReplaceArgs], ApplyResult>
  /** The diff a Save from the YAML editor would make to the live object, after
   *  the server's defaulting and admission. Refused the same way the replace is
   *  on a stale `resourceVersion`. */
  "k8s:resource:replace:dryRun": Call<[args: ReplaceArgs], DryRunResult>
  "k8s:resource:read": Call<[args: ResourceTargetArgs], EditableManifest>
  "k8s:resource:delete": Call<
    [args: ResourceTargetArgs & { options?: DeleteResourceOptions }],
    ApplyResult
  >

  // events
  "k8s:events:list": Call<[args?: ListArgs & FieldSelectorArgs], EventInfo[]>
  "k8s:events:for-resource": Call<
    [args: ObjectArgs & { kind: string }],
    EventInfo[]
  >

  // watch-backed lists
  /**
   * Subscribes to a main-process informer. The resolved `items` are the same
   * summaries the matching `list*` call returns, so the item type follows from
   * `args.resource` and the caller narrows it. Rejects when the watch can't be
   * established, which means "poll instead".
   */
  "k8s:watch:start": Call<[args: WatchStartArgs], WatchSnapshot<unknown>>
  "k8s:watch:stop": Call<[args: { subId: string }], { success: boolean }>

  // pod logs / exec
  /** `contextName` is the context the tab was opened against; omitted, the
   *  read falls back to the kubeconfig's current context. */
  "k8s:pod:log:start": Call<
    [
      args: ContextArgs & {
        namespace: string
        podName: string
        containerName?: string
        tabKey?: string
        options?: PodLogOptions
      },
    ],
    { success: boolean }
  >
  /** Asks for a file in the save dialog and writes the containers' logs to it
   *  with a one-off, non-following read. `path` is null when the dialog was
   *  cancelled. */
  "k8s:pod:log:save": Call<
    [
      args: ContextArgs & {
        namespace: string
        podName: string
        containers: string[]
        options?: PodLogOptions
      },
    ],
    { path: string | null; bytes?: number }
  >
  "k8s:pod:log:stop": Call<
    [args: { namespace: string; podName: string }],
    { success: boolean }
  >
  "k8s:pod:log:stop:session": Call<
    [args: { sessionId: string }],
    { success: boolean }
  >
  "k8s:pod:exec": Call<
    [
      args: ContextArgs & {
        sessionId: string
        namespace: string
        podName: string
        containerName: string
      },
    ],
    { success: boolean }
  >

  // local streams, port-forwards, dialogs
  "stream:socket:start": Call<
    [args: { socketPath: string; sessionId: string }],
    { success: boolean }
  >
  "stream:socket:stop": Call<
    [args: { sessionId: string }],
    { success: boolean }
  >
  "portforward:start": Call<
    [args: PortForwardArgs],
    { success: boolean; error?: string }
  >
  "portforward:stop": Call<[args: { sessionId: string }], { success: boolean }>
  /** Opens the OS file picker; resolves `{ path: null }` when it is dismissed. */
  "dialog:path:select": Call<
    [args: { mode: "file" | "directory"; title?: string }],
    SelectPathResult
  >

  // prometheus, aws, alarms, helm
  "prometheus:connectivity:check": Call<[], PrometheusDiscoveryResult>
  "prometheus:config:get": Call<[], PrometheusConfig>
  "prometheus:config:set": Call<
    [config: PrometheusConfig],
    { success: boolean }
  >
  "prometheus:pod:metrics": Call<
    [
      args: {
        namespace: string
        podName: string
        step?: number
        rangeMinutes?: number
      },
    ],
    PodMetricsResult | PodMetricsError
  >
  "aws:credentials:check": Call<[], AwsCredentialResult>
  "alarm:evaluate": Call<[args: { rule: AlarmRule }], AlarmEntry[]>
  "helm:repo:add": Call<[args: { name: string; url: string }], MutationResult>
  "helm:repo:list": Call<[], HelmRepo[]>
  "helm:release:list": Call<
    [args?: ContextArgs & { namespace?: string }],
    HelmRelease[]
  >
  "helm:release:install": Call<[args: HelmReleaseArgs], MutationResult>
  "helm:release:upgrade": Call<[args: HelmReleaseArgs], MutationResult>
  "helm:release:uninstall": Call<
    [args: ContextArgs & { releaseName: string; namespace: string }],
    MutationResult
  >
}

export type IpcInvokeChannel = keyof IpcInvokeMap
export type IpcInvokeArgs<C extends IpcInvokeChannel> = IpcInvokeMap[C]["args"]
export type IpcInvokeResult<C extends IpcInvokeChannel> =
  IpcInvokeMap[C]["result"]

// ---------------------------------------------------------------------------
// renderer → main, fire and forget (`ipcRenderer.send` / `ipcMain.on`)
// ---------------------------------------------------------------------------

export interface IpcSendMap {
  "k8s:pod:exec:input": { sessionId: string; data: string }
  "k8s:pod:exec:close": { sessionId: string }
}

export type IpcSendChannel = keyof IpcSendMap

// ---------------------------------------------------------------------------
// main → renderer (`webContents.send` / `ipcRenderer.on`)
// ---------------------------------------------------------------------------

export interface IpcEventMap {
  "k8s:pod:log:data": { tabKey: string; line: string }
  /** Fires when a non-following read runs out of log; never for an aborted one. */
  "k8s:pod:log:end": { tabKey: string }
  "k8s:pod:exec:output": { sessionId: string; data: string }
  "k8s:pod:copy:progress": { transferId: string; bytes: number }
  "k8s:watch:event": WatchEventMessage
  "k8s:watch:closed": WatchClosedMessage
  "stream:socket:data": { sessionId: string; line: string }
  "stream:socket:end": { sessionId: string; reason: string }
}

export type IpcEventChannel = keyof IpcEventMap
