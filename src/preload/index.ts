import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

// Custom APIs for renderer
const api = {
  k8s: {
    listContexts: () => ipcRenderer.invoke("k8s:contexts:list"),
    getCurrentContext: () => ipcRenderer.invoke("k8s:context:current"),
    listNamespaces: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:namespaces:list", args),
    listNodes: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:nodes:list", args),
    listDeployments: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:deployments:list", args),
    listReplicaSets: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:replicasets:list", args),
    listStatefulSets: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:statefulsets:list", args),
    listDaemonSets: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:daemonsets:list", args),
    listConfigMaps: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:configmaps:list", args),
    listSecrets: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:secrets:list", args),
    listServiceAccounts: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:serviceaccounts:list", args),
    listRoles: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:roles:list", args),
    listClusterRoles: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:clusterroles:list", args),
    listRoleBindings: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:rolebindings:list", args),
    listClusterRoleBindings: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:clusterrolebindings:list", args),
    updateRole: (
      namespace: string,
      name: string,
      rules: Array<{
        apiGroups: string[]
        resources: string[]
        verbs: string[]
      }>,
    ) => ipcRenderer.invoke("k8s:role:update", namespace, name, rules),
    updateClusterRole: (
      name: string,
      rules: Array<{
        apiGroups: string[]
        resources: string[]
        verbs: string[]
      }>,
    ) => ipcRenderer.invoke("k8s:clusterrole:update", name, rules),
    updateRoleBinding: (
      namespace: string,
      name: string,
      subjects: Array<{ kind: string; name: string; namespace?: string }>,
    ) =>
      ipcRenderer.invoke("k8s:rolebinding:update", namespace, name, subjects),
    updateClusterRoleBinding: (
      name: string,
      subjects: Array<{ kind: string; name: string; namespace?: string }>,
    ) => ipcRenderer.invoke("k8s:clusterrolebinding:update", name, subjects),
    updateServiceAccount: (
      namespace: string,
      name: string,
      metadata: {
        labels?: Record<string, string>
        annotations?: Record<string, string>
      },
    ) =>
      ipcRenderer.invoke(
        "k8s:serviceaccount:update",
        namespace,
        name,
        metadata,
      ),
    listHPAs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:hpas:list", args),
    listPVs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:pvs:list", args),
    listPVCs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:pvcs:list", args),
    listJobs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:jobs:list", args),
    listCronJobs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:cronjobs:list", args),
    listPods: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:pods:list", args),
    listServices: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:services:list", args),
    listIngresses: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:ingresses:list", args),
    getClusterType: () => ipcRenderer.invoke("k8s:cluster:type"),
    createDeployment: (
      namespace: string,
      name: string,
      image: string,
      replicas: number,
    ) =>
      ipcRenderer.invoke(
        "k8s:deployment:create",
        namespace,
        name,
        image,
        replicas,
      ),
    updateDeployment: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:deployment:update", namespace, name, yaml),
    deleteDeployment: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:deployment:delete", namespace, name),
    createStatefulSet: (
      namespace: string,
      name: string,
      image: string,
      replicas: number,
      serviceName: string,
    ) =>
      ipcRenderer.invoke(
        "k8s:statefulset:create",
        namespace,
        name,
        image,
        replicas,
        serviceName,
      ),
    updateStatefulSet: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:statefulset:update", namespace, name, yaml),
    deleteStatefulSet: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:statefulset:delete", namespace, name),
    createDaemonSet: (namespace: string, name: string, image: string) =>
      ipcRenderer.invoke("k8s:daemonset:create", namespace, name, image),
    updateDaemonSet: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:daemonset:update", namespace, name, yaml),
    deleteDaemonSet: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:daemonset:delete", namespace, name),
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
    ) =>
      ipcRenderer.invoke(
        "k8s:service:create",
        namespace,
        name,
        type,
        ports,
        selector,
      ),
    updateService: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:service:update", namespace, name, yaml),
    deleteService: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:service:delete", namespace, name),
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
    ) =>
      ipcRenderer.invoke(
        "k8s:ingress:create",
        namespace,
        name,
        ingressClassName,
        rules,
        tls,
      ),
    updateIngress: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:ingress:update", namespace, name, yaml),
    deleteIngress: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:ingress:delete", namespace, name),
    applyResource: (yaml: string) =>
      ipcRenderer.invoke("k8s:resource:apply", yaml),
    updateConfigMap: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:configmap:update", namespace, name, yaml),
    deleteConfigMap: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:configmap:delete", namespace, name),
    updateSecret: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:secret:update", namespace, name, yaml),
    deleteSecret: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:secret:delete", namespace, name),
    deletePod: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:pod:delete", namespace, name),
    deleteRole: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:role:delete", namespace, name),
    deleteClusterRole: (name: string) =>
      ipcRenderer.invoke("k8s:clusterrole:delete", name),
    deleteRoleBinding: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:rolebinding:delete", namespace, name),
    deleteClusterRoleBinding: (name: string) =>
      ipcRenderer.invoke("k8s:clusterrolebinding:delete", name),
    deleteServiceAccount: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:serviceaccount:delete", namespace, name),
  },
  startPodLog: (
    namespace: string,
    podName: string,
    containerName?: string,
    tabKey?: string,
  ) =>
    ipcRenderer.invoke("k8s:pod:log:start", {
      namespace,
      podName,
      containerName,
      tabKey,
    }),
  stopPodLog: (namespace: string, podName: string) =>
    ipcRenderer.invoke("k8s:pod:log:stop", { namespace, podName }),
  onPodLogData: (
    callback: (data: { tabKey: string; line: string }) => void,
  ) => {
    const handler = (
      _e: IpcRendererEvent,
      data: { tabKey: string; line: string },
    ) => callback(data)
    ipcRenderer.on("k8s:pod:log:data", handler)
    return () => ipcRenderer.removeListener("k8s:pod:log:data", handler)
  },
  getPrometheusConfig: () => ipcRenderer.invoke("prometheus:config:get"),
  setPrometheusConfig: (config: {
    namespace: string
    service: string
    port: number
  }) => ipcRenderer.invoke("prometheus:config:set", config),
  getPrometheusPodMetrics: (args: {
    namespace: string
    podName: string
    step?: number
    rangeMinutes?: number
  }) => ipcRenderer.invoke("prometheus:pod:metrics", args),
  checkAwsCredentials: () => ipcRenderer.invoke("aws:credentials:check"),
  listEvents: (args?: { contextName?: string }) =>
    ipcRenderer.invoke("k8s:events:list", args),
  startEventsWatch: () => ipcRenderer.invoke("k8s:events:watch:start"),
  stopEventsWatch: () => ipcRenderer.invoke("k8s:events:watch:stop"),
  onEventsData: (callback: (event: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, event: unknown) => callback(event)
    ipcRenderer.on("k8s:events:data", handler)
    return () => ipcRenderer.removeListener("k8s:events:data", handler)
  },
  startPodExec: (
    sessionId: string,
    namespace: string,
    podName: string,
    containerName: string,
  ) =>
    ipcRenderer.invoke("k8s:pod:exec", {
      sessionId,
      namespace,
      podName,
      containerName,
    }),
  sendPodExecInput: (sessionId: string, data: string) =>
    ipcRenderer.send("k8s:pod:exec:input", { sessionId, data }),
  closePodExec: (sessionId: string) =>
    ipcRenderer.send("k8s:pod:exec:close", { sessionId }),
  onPodExecOutput: (
    callback: (data: { sessionId: string; data: string }) => void,
  ) => {
    const handler = (
      _e: IpcRendererEvent,
      data: { sessionId: string; data: string },
    ) => callback(data)
    ipcRenderer.on("k8s:pod:exec:output", handler)
    return () => ipcRenderer.removeListener("k8s:pod:exec:output", handler)
  },
  startSocketStream: (socketPath: string, sessionId: string) =>
    ipcRenderer.invoke("stream:socket:start", { socketPath, sessionId }),
  stopSocketStream: (sessionId: string) =>
    ipcRenderer.invoke("stream:socket:stop", { sessionId }),
  onSocketData: (
    callback: (data: { sessionId: string; line: string }) => void,
  ) => {
    const handler = (
      _e: IpcRendererEvent,
      data: { sessionId: string; line: string },
    ) => callback(data)
    ipcRenderer.on("stream:socket:data", handler)
    return () => ipcRenderer.removeListener("stream:socket:data", handler)
  },
  onSocketEnd: (
    callback: (data: { sessionId: string; reason: string }) => void,
  ) => {
    const handler = (
      _e: IpcRendererEvent,
      data: { sessionId: string; reason: string },
    ) => callback(data)
    ipcRenderer.on("stream:socket:end", handler)
    return () => ipcRenderer.removeListener("stream:socket:end", handler)
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI)
    contextBridge.exposeInMainWorld("api", api)
  } catch (error) {
    console.error(error)
  }
} else {
  Object.assign(window, { electron: electronAPI, api })
}
