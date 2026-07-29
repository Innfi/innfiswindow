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
    cordonNode: (args: {
      contextName?: string
      name: string
      schedulable: boolean
    }) => ipcRenderer.invoke("k8s:node:cordon", args),
    drainNode: (args: { contextName?: string; name: string }) =>
      ipcRenderer.invoke("k8s:node:drain", args),
    checkConnection: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:connection:check", args),
    reconnect: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:connection:reconnect", args),
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
    listStorageClasses: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:storageclasses:list", args),
    listVolumeSnapshots: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:volumesnapshots:list", args),
    listResourceQuotas: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:resourcequotas:list", args),
    listLimitRanges: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:limitranges:list", args),
    listPDBs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:pdbs:list", args),
    listJobs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:jobs:list", args),
    listCronJobs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:cronjobs:list", args),
    restartJob: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:job:restart", args),
    restartCronJob: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:cronjob:trigger", args),
    getNodeMetrics: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:node:metrics", args),
    listPods: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:pods:list", args),
    listServices: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:services:list", args),
    listIngresses: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:ingresses:list", args),
    listNetworkPolicies: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:networkpolicies:list", args),
    listEndpoints: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:endpoints:list", args),
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
    restartDeployment: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:deployment:restart", args),
    getDeploymentHistory: (args: {
      contextName?: string
      namespace: string
      name: string
      selector: Record<string, string>
    }) => ipcRenderer.invoke("k8s:deployment:history", args),
    rollbackDeployment: (args: {
      contextName?: string
      namespace: string
      name: string
      revision: number
    }) => ipcRenderer.invoke("k8s:deployment:rollback", args),
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
    restartStatefulSet: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:statefulset:restart", args),
    createDaemonSet: (namespace: string, name: string, image: string) =>
      ipcRenderer.invoke("k8s:daemonset:create", namespace, name, image),
    updateDaemonSet: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:daemonset:update", namespace, name, yaml),
    restartDaemonSet: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:daemonset:restart", args),
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
    applyResource: (yaml: string) =>
      ipcRenderer.invoke("k8s:resource:apply", yaml),
    deleteResource: (args: {
      apiVersion: string
      kind: string
      name: string
      namespace?: string
      contextName?: string
      propagationPolicy?: string
    }) => ipcRenderer.invoke("k8s:resource:delete", args),
    replaceResource: (yaml: string) =>
      ipcRenderer.invoke("k8s:resource:replace", yaml),
    readResource: (
      apiVersion: string,
      kind: string,
      name: string,
      namespace?: string,
    ) =>
      ipcRenderer.invoke(
        "k8s:resource:read",
        apiVersion,
        kind,
        name,
        namespace,
      ),
    updateConfigMap: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:configmap:update", namespace, name, yaml),
    updateSecret: (namespace: string, name: string, yaml: string) =>
      ipcRenderer.invoke("k8s:secret:update", namespace, name, yaml),
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
  stopPodLogSession: (sessionId: string) =>
    ipcRenderer.invoke("k8s:pod:log:stop:session", { sessionId }),
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
  listEventsForResource: (args: {
    contextName?: string
    namespace: string
    name: string
    kind: string
  }) => ipcRenderer.invoke("k8s:events:for-resource", args),
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
  startPortForward: (args: {
    resourceKind: "Pod" | "Service"
    namespace: string
    name: string
    localPort: number
    targetPort: number
    sessionId: string
  }) => ipcRenderer.invoke("portforward:start", args),
  stopPortForward: (sessionId: string) =>
    ipcRenderer.invoke("portforward:stop", { sessionId }),
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
  alarm: {
    evaluate: (rule: {
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
    }) => ipcRenderer.invoke("alarm:evaluate", { rule }),
  },
  helm: {
    repoAdd: (name: string, url: string) =>
      ipcRenderer.invoke("helm:repo:add", { name, url }),
    repoList: () => ipcRenderer.invoke("helm:repo:list"),
    releaseList: (args?: { namespace?: string; contextName?: string }) =>
      ipcRenderer.invoke("helm:release:list", args),
    releaseInstall: (args: {
      releaseName: string
      chart: string
      namespace: string
      values?: string
      contextName?: string
    }) => ipcRenderer.invoke("helm:release:install", args),
    releaseUpgrade: (args: {
      releaseName: string
      chart: string
      namespace: string
      values?: string
      contextName?: string
    }) => ipcRenderer.invoke("helm:release:upgrade", args),
    releaseUninstall: (args: {
      releaseName: string
      namespace: string
      contextName?: string
    }) => ipcRenderer.invoke("helm:release:uninstall", args),
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
