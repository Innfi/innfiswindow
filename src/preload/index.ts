import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

// Custom APIs for renderer
const api = {
  k8s: {
    listContexts: () => ipcRenderer.invoke("k8s:contexts:list"),
    getCurrentContext: () => ipcRenderer.invoke("k8s:context:current"),
    listNamespaces: () => ipcRenderer.invoke("k8s:namespaces:list"),
    listNodes: () => ipcRenderer.invoke("k8s:nodes:list"),
    listDeployments: () => ipcRenderer.invoke("k8s:deployments:list"),
    listReplicaSets: () => ipcRenderer.invoke("k8s:replicasets:list"),
    listStatefulSets: () => ipcRenderer.invoke("k8s:statefulsets:list"),
    listDaemonSets: () => ipcRenderer.invoke("k8s:daemonsets:list"),
    listConfigMaps: () => ipcRenderer.invoke("k8s:configmaps:list"),
    listSecrets: () => ipcRenderer.invoke("k8s:secrets:list"),
    listPods: () => ipcRenderer.invoke("k8s:pods:list"),
    listServices: () => ipcRenderer.invoke("k8s:services:list"),
    listIngresses: () => ipcRenderer.invoke("k8s:ingresses:list"),
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
    updateDeployment: (
      namespace: string,
      name: string,
      image: string,
      replicas: number,
    ) =>
      ipcRenderer.invoke(
        "k8s:deployment:update",
        namespace,
        name,
        image,
        replicas,
      ),
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
    updateStatefulSet: (
      namespace: string,
      name: string,
      image: string,
      replicas: number,
    ) =>
      ipcRenderer.invoke(
        "k8s:statefulset:update",
        namespace,
        name,
        image,
        replicas,
      ),
    deleteStatefulSet: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:statefulset:delete", namespace, name),
    createDaemonSet: (namespace: string, name: string, image: string) =>
      ipcRenderer.invoke("k8s:daemonset:create", namespace, name, image),
    updateDaemonSet: (namespace: string, name: string, image: string) =>
      ipcRenderer.invoke("k8s:daemonset:update", namespace, name, image),
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
    updateService: (
      namespace: string,
      name: string,
      type: string,
      ports: Array<{
        protocol: string
        port: number
        targetPort: number | string
      }>,
    ) => ipcRenderer.invoke("k8s:service:update", namespace, name, type, ports),
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
    updateIngress: (
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
        "k8s:ingress:update",
        namespace,
        name,
        ingressClassName,
        rules,
        tls,
      ),
    deleteIngress: (namespace: string, name: string) =>
      ipcRenderer.invoke("k8s:ingress:delete", namespace, name),
    applyResource: (yaml: string) =>
      ipcRenderer.invoke("k8s:resource:apply", yaml),
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
    prometheusUrl: string
    prometheusToken: string
  }) => ipcRenderer.invoke("prometheus:config:set", config),
  getPrometheusPodMetrics: (args: {
    namespace: string
    podName: string
    step?: number
    rangeMinutes?: number
  }) => ipcRenderer.invoke("prometheus:pod:metrics", args),
  listEvents: () => ipcRenderer.invoke("k8s:events:list"),
  startEventsWatch: () => ipcRenderer.invoke("k8s:events:watch:start"),
  stopEventsWatch: () => ipcRenderer.invoke("k8s:events:watch:stop"),
  onEventsData: (callback: (event: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, event: unknown) => callback(event)
    ipcRenderer.on("k8s:events:data", handler)
    return () => ipcRenderer.removeListener("k8s:events:data", handler)
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
