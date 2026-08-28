import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron"
import { electronAPI } from "@electron-toolkit/preload"

/** Mirrors PodLogOptions in src/main/ipc/pod-streams.ts. */
interface PodLogOptions {
  follow?: boolean
  previous?: boolean
  timestamps?: boolean
  tailLines?: number | null
  sinceSeconds?: number | null
}

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
    drainNode: (args: {
      contextName?: string
      name: string
      options?: {
        force?: boolean
        gracePeriodSeconds?: number
        ignoreDaemonSets?: boolean
        deleteEmptyDirData?: boolean
        timeoutSeconds?: number
      }
    }) => ipcRenderer.invoke("k8s:node:drain", args),
    updateNodeLabels: (args: {
      contextName?: string
      name: string
      update: { set: Record<string, string>; remove: string[] }
    }) => ipcRenderer.invoke("k8s:node:labels:update", args),
    updateNodeTaints: (args: {
      contextName?: string
      name: string
      taints: { key: string; value: string; effect: string }[]
    }) => ipcRenderer.invoke("k8s:node:taints:update", args),
    evictPod: (args: {
      contextName?: string
      namespace: string
      name: string
      options?: { gracePeriodSeconds?: number; dryRun?: boolean }
    }) => ipcRenderer.invoke("k8s:pod:evict", args),
    debugPod: (args: {
      contextName?: string
      namespace: string
      name: string
      request: {
        image: string
        name?: string
        targetContainer?: string
        command?: string[]
      }
    }) => ipcRenderer.invoke("k8s:pod:debug", args),
    copyToPod: (args: {
      contextName?: string
      namespace: string
      podName: string
      containerName: string
      localPath: string
      remotePath: string
      transferId: string
    }) => ipcRenderer.invoke("k8s:pod:copy:to", args),
    copyFromPod: (args: {
      contextName?: string
      namespace: string
      podName: string
      containerName: string
      localPath: string
      remotePath: string
      transferId: string
    }) => ipcRenderer.invoke("k8s:pod:copy:from", args),
    checkConnection: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:connection:check", args),
    reconnect: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:connection:reconnect", args),
    listDeployments: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:deployments:list", args),
    getDeployment: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:deployment:get", args),
    listReplicaSets: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:replicasets:list", args),
    getReplicaSet: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:replicaset:get", args),
    listStatefulSets: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:statefulsets:list", args),
    getStatefulSet: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:statefulset:get", args),
    listDaemonSets: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:daemonsets:list", args),
    getDaemonSet: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:daemonset:get", args),
    listConfigMaps: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:configmaps:list", args),
    getConfigMap: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:configmap:get", args),
    listSecrets: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:secrets:list", args),
    getSecret: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:secret:get", args),
    listServiceAccounts: (args?: {
      contextName?: string
      namespace?: string
    }) => ipcRenderer.invoke("k8s:serviceaccounts:list", args),
    listRoles: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:roles:list", args),
    getRole: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:role:get", args),
    listClusterRoles: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:clusterroles:list", args),
    getClusterRole: (args: { contextName?: string; name: string }) =>
      ipcRenderer.invoke("k8s:clusterrole:get", args),
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
    listHPAs: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:hpas:list", args),
    getHPA: (args: { contextName?: string; namespace: string; name: string }) =>
      ipcRenderer.invoke("k8s:hpa:get", args),
    updateHPAReplicas: (args: {
      contextName?: string
      namespace: string
      name: string
      minReplicas: number
      maxReplicas: number
    }) => ipcRenderer.invoke("k8s:hpa:replicas:update", args),
    updateHPAMetrics: (args: {
      contextName?: string
      namespace: string
      name: string
      metrics: {
        kind: "Resource" | "ContainerResource"
        name: string
        container: string
        targetType: "Utilization" | "AverageValue" | "Value"
        averageUtilization: number | null
        value: string
      }[]
    }) => ipcRenderer.invoke("k8s:hpa:metrics:update", args),
    listPVs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:pvs:list", args),
    listPVCs: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:pvcs:list", args),
    expandPVC: (args: {
      contextName?: string
      namespace: string
      name: string
      storage: string
    }) => ipcRenderer.invoke("k8s:pvc:expand", args),
    listStorageClasses: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:storageclasses:list", args),
    listVolumeSnapshots: (args?: {
      contextName?: string
      namespace?: string
    }) => ipcRenderer.invoke("k8s:volumesnapshots:list", args),
    listCRDs: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:crds:list", args),
    listCustomResources: (args: {
      contextName?: string
      namespace?: string
      ref: {
        group: string
        version: string
        plural: string
        kind: string
        scope: "Namespaced" | "Cluster"
      }
      printerColumns?: string[]
    }) => ipcRenderer.invoke("k8s:customresources:list", args),
    getCustomResource: (args: {
      contextName?: string
      namespace?: string
      name: string
      ref: {
        group: string
        version: string
        plural: string
        kind: string
        scope: "Namespaced" | "Cluster"
      }
      printerColumns?: string[]
    }) => ipcRenderer.invoke("k8s:customresource:get", args),
    listResourceQuotas: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:resourcequotas:list", args),
    listLimitRanges: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:limitranges:list", args),
    listPDBs: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:pdbs:list", args),
    listJobs: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:jobs:list", args),
    listCronJobs: (args?: { contextName?: string; namespace?: string }) =>
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
    setJobSuspend: (args: {
      contextName?: string
      namespace: string
      name: string
      suspend: boolean
    }) => ipcRenderer.invoke("k8s:job:suspend", args),
    setCronJobSuspend: (args: {
      contextName?: string
      namespace: string
      name: string
      suspend: boolean
    }) => ipcRenderer.invoke("k8s:cronjob:suspend", args),
    getNodeMetrics: (args?: { contextName?: string }) =>
      ipcRenderer.invoke("k8s:node:metrics", args),
    getPodMetrics: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:pods:metrics", args),
    getPodMetric: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:pod:metrics", args),
    listPods: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:pods:list", args),
    getPod: (args: { contextName?: string; namespace: string; name: string }) =>
      ipcRenderer.invoke("k8s:pod:get", args),
    listServices: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:services:list", args),
    listIngresses: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:ingresses:list", args),
    getIngress: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:ingress:get", args),
    listNetworkPolicies: (args?: {
      contextName?: string
      namespace?: string
    }) => ipcRenderer.invoke("k8s:networkpolicies:list", args),
    getNetworkPolicy: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:networkpolicy:get", args),
    listEndpoints: (args?: { contextName?: string; namespace?: string }) =>
      ipcRenderer.invoke("k8s:endpoints:list", args),
    getEndpoint: (args: {
      contextName?: string
      namespace: string
      name: string
    }) => ipcRenderer.invoke("k8s:endpoint:get", args),
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
    scaleDeployment: (args: {
      contextName?: string
      namespace: string
      name: string
      replicas: number
    }) => ipcRenderer.invoke("k8s:deployment:scale", args),
    scaleStatefulSet: (args: {
      contextName?: string
      namespace: string
      name: string
      replicas: number
    }) => ipcRenderer.invoke("k8s:statefulset:scale", args),
    scaleReplicaSet: (args: {
      contextName?: string
      namespace: string
      name: string
      replicas: number
    }) => ipcRenderer.invoke("k8s:replicaset:scale", args),
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
    dryRunResource: (yaml: string) =>
      ipcRenderer.invoke("k8s:resource:dryRun", yaml),
    deleteResource: (args: {
      apiVersion: string
      kind: string
      name: string
      namespace?: string
      contextName?: string
      options?: {
        propagationPolicy?: "Background" | "Foreground" | "Orphan"
        gracePeriodSeconds?: number
      }
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
    options?: PodLogOptions,
  ) =>
    ipcRenderer.invoke("k8s:pod:log:start", {
      namespace,
      podName,
      containerName,
      tabKey,
      options,
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
  onPodLogEnd: (callback: (data: { tabKey: string }) => void) => {
    const handler = (_e: IpcRendererEvent, data: { tabKey: string }) =>
      callback(data)
    ipcRenderer.on("k8s:pod:log:end", handler)
    return () => ipcRenderer.removeListener("k8s:pod:log:end", handler)
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
  listEvents: (args?: { contextName?: string; namespace?: string }) =>
    ipcRenderer.invoke("k8s:events:list", args),
  listEventsForResource: (args: {
    contextName?: string
    namespace: string
    name: string
    kind: string
  }) => ipcRenderer.invoke("k8s:events:for-resource", args),
  // Watch-backed lists: `startWatch` returns the informer's synced cache plus a
  // subscription id, and every later change arrives on the shared event
  // channel tagged with that id.
  startWatch: (args: {
    resource: "pods" | "events"
    contextName?: string
    namespace?: string
  }) => ipcRenderer.invoke("k8s:watch:start", args),
  stopWatch: (args: { subId: string }) =>
    ipcRenderer.invoke("k8s:watch:stop", args),
  onWatchEvent: (callback: (message: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, message: unknown) =>
      callback(message)
    ipcRenderer.on("k8s:watch:event", handler)
    return () => ipcRenderer.removeListener("k8s:watch:event", handler)
  },
  onWatchClosed: (callback: (message: unknown) => void) => {
    const handler = (_e: IpcRendererEvent, message: unknown) =>
      callback(message)
    ipcRenderer.on("k8s:watch:closed", handler)
    return () => ipcRenderer.removeListener("k8s:watch:closed", handler)
  },
  startPodExec: (
    sessionId: string,
    namespace: string,
    podName: string,
    containerName: string,
    contextName?: string,
  ) =>
    ipcRenderer.invoke("k8s:pod:exec", {
      sessionId,
      namespace,
      podName,
      containerName,
      contextName,
    }),
  sendPodExecInput: (sessionId: string, data: string) =>
    ipcRenderer.send("k8s:pod:exec:input", { sessionId, data }),
  closePodExec: (sessionId: string) =>
    ipcRenderer.send("k8s:pod:exec:close", { sessionId }),
  selectLocalPath: (args: { mode: "file" | "directory"; title?: string }) =>
    ipcRenderer.invoke("dialog:path:select", args),
  onPodCopyProgress: (
    callback: (data: { transferId: string; bytes: number }) => void,
  ) => {
    const handler = (
      _e: IpcRendererEvent,
      data: { transferId: string; bytes: number },
    ) => callback(data)
    ipcRenderer.on("k8s:pod:copy:progress", handler)
    return () => ipcRenderer.removeListener("k8s:pod:copy:progress", handler)
  },
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
