import { ElectronAPI } from '@electron-toolkit/preload'

export interface K8sContext {
  name: string
  cluster: string
  user: string
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

export interface K8sAPI {
  listContexts: () => Promise<K8sContext[]>
  getCurrentContext: () => Promise<string>
  listNamespaces: () => Promise<K8sNamespace[]>
  listNodes: () => Promise<K8sNode[]>
  listDeployments: () => Promise<K8sDeployment[]>
  listReplicaSets: () => Promise<K8sReplicaSet[]>
  listStatefulSets: () => Promise<K8sStatefulSet[]>
  listDaemonSets: () => Promise<K8sDaemonSet[]>
  listPods: () => Promise<K8sPod[]>
  getClusterType: () => Promise<'EKS' | 'AKS' | 'Local'>
}

export interface API {
  k8s: K8sAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
