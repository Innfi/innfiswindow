import { ElectronAPI } from "@electron-toolkit/preload"

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

export interface K8sNode {
  name: string
  status: string
  roles: string
  creationTimestamp: string
  version: string
  labels: Record<string, string>
  capacity: Record<string, string>
  allocatable: Record<string, string>
  conditions: K8sNodeCondition[]
}

export interface K8sDeploymentCondition {
  type: string
  status: string
  reason: string
  message: string
}

export interface K8sDeploymentContainer {
  name: string
  image: string
}

export interface K8sDeployment {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  strategy: string
  creationTimestamp: string
  selector: Record<string, string>
  containers: K8sDeploymentContainer[]
  conditions: K8sDeploymentCondition[]
}

export interface K8sPodContainer {
  name: string
  image: string
  restartCount: number
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
  containers: K8sPodContainer[]
  conditions: K8sPodCondition[]
}

export interface K8sOwnerRef {
  kind: string
  name: string
}

export interface K8sReplicaSetContainer {
  name: string
  image: string
}

export interface K8sReplicaSet {
  name: string
  namespace: string
  desiredReplicas: number
  currentReplicas: number
  readyReplicas: number
  creationTimestamp: string
  selector: Record<string, string>
  containers: K8sReplicaSetContainer[]
  ownerReferences: K8sOwnerRef[]
  podTemplateLabels: Record<string, string>
}

export interface K8sStatefulSetContainer {
  name: string
  image: string
}

export interface K8sStatefulSetVolumeClaimTemplate {
  name: string
  storage: string
}

export interface K8sDaemonSetContainer {
  name: string
  image: string
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
  updateStrategy: string
  selector: Record<string, string>
  nodeSelector: Record<string, string>
  containers: K8sDaemonSetContainer[]
  tolerations: K8sDaemonSetToleration[]
}

export interface K8sStatefulSet {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  creationTimestamp: string
  serviceName: string
  updateStrategy: string
  selector: Record<string, string>
  containers: K8sStatefulSetContainer[]
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
  rules: K8sRoleRule[]
}

export interface K8sClusterRole {
  name: string
  rulesCount: number
  creationTimestamp: string
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
}

export interface K8sClusterRoleBinding {
  name: string
  roleRef: K8sRoleRef
  subjects: K8sBindingSubject[]
  subjectsCount: number
  creationTimestamp: string
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
  listPods: (args?: { contextName?: string }) => Promise<K8sPod[]>
  listServices: (args?: { contextName?: string }) => Promise<K8sService[]>
  listIngresses: (args?: { contextName?: string }) => Promise<K8sIngress[]>
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

export interface AwsCredentialResult {
  valid: boolean
  type: "env" | "file" | "metadata" | "none"
  hasSessionToken?: boolean
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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
