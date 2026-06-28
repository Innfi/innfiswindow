import { ElectronAPI } from "@electron-toolkit/preload"
import { K8sEndpoint } from "@renderer/types/k8s"

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

export interface K8sDeployment {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  strategy: string
  rollingUpdate: { maxUnavailable: string; maxSurge: string } | null
  minReadySeconds: number
  creationTimestamp: string
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

export interface K8sPod {
  name: string
  namespace: string
  deployment: string
  app: string
  status: string
  restarts: number
  creationTimestamp: string
  nodeName: string
  labels: Record<string, string>
  annotations: Record<string, string>
  serviceAccountName: string
  qosClass: string
  initContainers: K8sPodContainer[]
  containers: K8sPodContainer[]
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

export interface K8sReplicaSet {
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

export interface K8sDaemonSet {
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
  containers: K8sDaemonSetContainer[]
  initContainers: K8sDaemonSetContainer[]
  volumes: K8sVolumeInfo[]
  tolerations: K8sDaemonSetToleration[]
}

export interface K8sStatefulSet {
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
  containers: K8sStatefulSetContainer[]
  initContainers: K8sStatefulSetContainer[]
  volumes: K8sVolumeInfo[]
  volumeClaimTemplates: K8sStatefulSetVolumeClaimTemplate[]
}

export interface K8sConfigMap {
  name: string
  namespace: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
  binaryData: Record<string, number>
  keys: string[]
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

export interface K8sNetworkPolicy {
  name: string
  namespace: string
  podSelector: string
  policyTypes: string[]
  ingressRuleCount: number
  egressRuleCount: number
  creationTimestamp: string
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

export interface K8sIngress {
  name: string
  namespace: string
  ingressClassName: string
  hosts: string
  address: string
  ports: string
  creationTimestamp: string
  tls: K8sIngressTLS[]
  rules: K8sIngressRule[]
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

export interface K8sPVC {
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

export interface K8sServiceAccount {
  name: string
  namespace: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  secrets: string[]
  imagePullSecrets: string[]
}

export interface K8sSecret {
  name: string
  namespace: string
  type: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  data: Record<string, string>
  keys: string[]
}

export interface K8sRoleRule {
  apiGroups: string[]
  resources: string[]
  verbs: string[]
}

export interface K8sRole {
  name: string
  namespace: string
  rulesCount: number
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  rules: K8sRoleRule[]
}

export interface K8sClusterRole {
  name: string
  rulesCount: number
  creationTimestamp: string
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

export interface K8sAPI {
  listContexts: () => Promise<K8sContext[]>
  getCurrentContext: () => Promise<string>
  listNamespaces: (args?: { contextName?: string }) => Promise<K8sNamespace[]>
  listNodes: (args?: { contextName?: string }) => Promise<K8sNode[]>
  listDeployments: (args?: { contextName?: string }) => Promise<K8sDeployment[]>
  listReplicaSets: (args?: { contextName?: string }) => Promise<K8sReplicaSet[]>
  listStatefulSets: (args?: {
    contextName?: string
  }) => Promise<K8sStatefulSet[]>
  listDaemonSets: (args?: { contextName?: string }) => Promise<K8sDaemonSet[]>
  listConfigMaps: (args?: { contextName?: string }) => Promise<K8sConfigMap[]>
  listSecrets: (args?: { contextName?: string }) => Promise<K8sSecret[]>
  listServiceAccounts: (args?: {
    contextName?: string
  }) => Promise<K8sServiceAccount[]>
  listRoles: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sRole[]>
  listClusterRoles: (args?: {
    contextName?: string
  }) => Promise<K8sClusterRole[]>
  listRoleBindings: (args?: {
    contextName?: string
    namespace?: string
  }) => Promise<K8sRoleBinding[]>
  listClusterRoleBindings: (args?: {
    contextName?: string
  }) => Promise<K8sClusterRoleBinding[]>
  listHPAs: (args?: { contextName?: string }) => Promise<K8sHPA[]>
  listPVs: (args?: { contextName?: string }) => Promise<K8sPV[]>
  listJobs: (args?: { contextName?: string }) => Promise<K8sJob[]>
  listCronJobs: (args?: { contextName?: string }) => Promise<K8sCronJob[]>
  getNodeMetrics: (args?: {
    contextName?: string
  }) => Promise<NodeMetric[] | { unavailable: true }>
  listPVCs: (args?: { contextName?: string }) => Promise<K8sPVC[]>
  listResourceQuotas: (args?: {
    contextName?: string
  }) => Promise<K8sResourceQuota[]>
  listLimitRanges: (args?: { contextName?: string }) => Promise<K8sLimitRange[]>
  listPDBs: (args?: { contextName?: string }) => Promise<K8sPDB[]>
  listPods: (args?: { contextName?: string }) => Promise<K8sPod[]>
  listServices: (args?: { contextName?: string }) => Promise<K8sService[]>
  listIngresses: (args?: { contextName?: string }) => Promise<K8sIngress[]>
  listNetworkPolicies: (args?: {
    contextName?: string
  }) => Promise<K8sNetworkPolicy[]>
  listEndpoints: (args?: { contextName?: string }) => Promise<K8sEndpoint[]>
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
  deleteDeployment: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
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
  deleteStatefulSet: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
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
  deleteDaemonSet: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
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
  deleteService: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
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
  deleteIngress: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
  applyResource: (yaml: string) => Promise<{ name: string; namespace: string }>
  updateConfigMap: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  deleteConfigMap: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
  updateSecret: (
    namespace: string,
    name: string,
    yaml: string,
  ) => Promise<{ name: string; namespace: string }>
  deleteSecret: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
  deletePod: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
  deleteRole: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
  deleteClusterRole: (
    name: string,
  ) => Promise<{ success: boolean; name: string }>
  deleteRoleBinding: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
  deleteClusterRoleBinding: (
    name: string,
  ) => Promise<{ success: boolean; name: string }>
  deleteServiceAccount: (
    namespace: string,
    name: string,
  ) => Promise<{ success: boolean; name: string; namespace: string }>
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
  releaseList: (args?: { namespace?: string }) => Promise<HelmRelease[]>
  releaseInstall: (args: {
    releaseName: string
    chart: string
    namespace: string
    values?: string
  }) => Promise<{ success: boolean; error?: string }>
  releaseUpgrade: (args: {
    releaseName: string
    chart: string
    namespace: string
    values?: string
  }) => Promise<{ success: boolean; error?: string }>
  releaseUninstall: (args: {
    releaseName: string
    namespace: string
  }) => Promise<{ success: boolean; error?: string }>
}

export interface API {
  k8s: K8sAPI
  checkAwsCredentials: () => Promise<AwsCredentialResult>
  startPodLog: (
    namespace: string,
    podName: string,
    containerName?: string,
    tabKey?: string,
  ) => Promise<{ success: boolean }>
  stopPodLog: (
    namespace: string,
    podName: string,
  ) => Promise<{ success: boolean }>
  stopPodLogSession: (sessionId: string) => Promise<{ success: boolean }>
  onPodLogData: (
    callback: (data: { tabKey: string; line: string }) => void,
  ) => () => void
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
  listEvents: (args?: { contextName?: string }) => Promise<K8sEvent[]>
  listEventsForResource: (args: {
    contextName?: string
    namespace: string
    name: string
    kind: string
  }) => Promise<K8sEvent[]>
  startEventsWatch: () => Promise<{ success: boolean }>
  stopEventsWatch: () => Promise<{ success: boolean }>
  onEventsData: (callback: (event: K8sEvent) => void) => () => void
  startPodExec: (
    sessionId: string,
    namespace: string,
    podName: string,
    containerName: string,
  ) => Promise<{ success: boolean }>
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
