// Shared K8s type definitions for renderer-side view components

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

export interface K8sReplicaSetContainer {
  name: string
  image: string
}

export interface K8sOwnerRef {
  kind: string
  name: string
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

export interface K8sServiceAccount {
  name: string
  namespace: string
  creationTimestamp: string
  labels: Record<string, string>
  annotations: Record<string, string>
  secrets: string[]
  imagePullSecrets: string[]
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

export interface BindingSubject {
  kind: string
  name: string
  namespace: string
}

export interface RoleRef {
  kind: string
  name: string
}

export interface K8sRoleBinding {
  name: string
  namespace: string
  roleRef: RoleRef
  subjects: BindingSubject[]
  subjectsCount: number
  creationTimestamp: string
}

export interface K8sClusterRoleBinding {
  name: string
  roleRef: RoleRef
  subjects: BindingSubject[]
  subjectsCount: number
  creationTimestamp: string
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
}

export interface K8sPVC {
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
