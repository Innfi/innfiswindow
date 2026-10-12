import { ipcRenderer, IpcRendererEvent } from "electron"

import type {
  AlarmRule,
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeArgs,
  IpcInvokeChannel,
  IpcInvokeResult,
  IpcSendChannel,
  IpcSendMap,
  PodLogOptions,
} from "../shared/ipc"

// Everything below is typed by the channel it names: the arguments and the
// result come from `src/shared/ipc.ts`, which main's handlers are held to as
// well. `Api` — what `window.api` is declared as — is this object's own type,
// so there is no second list of methods to keep in step.

function invoke<C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeArgs<C>
): Promise<IpcInvokeResult<C>> {
  return ipcRenderer.invoke(channel, ...args)
}

/** A method that passes its arguments to the channel as they are. */
function call<C extends IpcInvokeChannel>(
  channel: C,
): (...args: IpcInvokeArgs<C>) => Promise<IpcInvokeResult<C>> {
  return (...args) => invoke(channel, ...args)
}

function send<C extends IpcSendChannel>(
  channel: C,
  payload: IpcSendMap[C],
): void {
  ipcRenderer.send(channel, payload)
}

/** A subscription to a main → renderer channel; the returned function ends it. */
function listen<C extends IpcEventChannel>(
  channel: C,
): (callback: (payload: IpcEventMap[C]) => void) => () => void {
  return (callback) => {
    const handler = (_e: IpcRendererEvent, payload: IpcEventMap[C]): void =>
      callback(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

export const api = {
  k8s: {
    listContexts: call("k8s:contexts:list"),
    getCurrentContext: call("k8s:context:current"),
    getClusterType: call("k8s:cluster:type"),
    checkConnection: call("k8s:connection:check"),
    reconnect: call("k8s:connection:reconnect"),
    listNamespaces: call("k8s:namespaces:list"),
    listNodes: call("k8s:nodes:list"),
    cordonNode: call("k8s:node:cordon"),
    drainNode: call("k8s:node:drain"),
    updateNodeLabels: call("k8s:node:labels:update"),
    updateNodeTaints: call("k8s:node:taints:update"),
    getNodeMetrics: call("k8s:node:metrics"),
    listApiResources: call("k8s:apiresources:list"),

    listDeployments: call("k8s:deployments:list"),
    getDeployment: call("k8s:deployment:get"),
    createDeployment: call("k8s:deployment:create"),
    updateDeployment: call("k8s:deployment:update"),
    restartDeployment: call("k8s:deployment:restart"),
    setDeploymentPaused: call("k8s:deployment:pause"),
    scaleDeployment: call("k8s:deployment:scale"),
    getDeploymentHistory: call("k8s:deployment:history"),
    rollbackDeployment: call("k8s:deployment:rollback"),
    listReplicaSets: call("k8s:replicasets:list"),
    getReplicaSet: call("k8s:replicaset:get"),
    scaleReplicaSet: call("k8s:replicaset:scale"),
    listStatefulSets: call("k8s:statefulsets:list"),
    getStatefulSet: call("k8s:statefulset:get"),
    createStatefulSet: call("k8s:statefulset:create"),
    updateStatefulSet: call("k8s:statefulset:update"),
    restartStatefulSet: call("k8s:statefulset:restart"),
    scaleStatefulSet: call("k8s:statefulset:scale"),
    listDaemonSets: call("k8s:daemonsets:list"),
    getDaemonSet: call("k8s:daemonset:get"),
    createDaemonSet: call("k8s:daemonset:create"),
    updateDaemonSet: call("k8s:daemonset:update"),
    restartDaemonSet: call("k8s:daemonset:restart"),
    listPods: call("k8s:pods:list"),
    getPod: call("k8s:pod:get"),
    getPodMetrics: call("k8s:pods:metrics"),
    getPodMetric: call("k8s:pod:metrics"),
    evictPod: call("k8s:pod:evict"),
    debugPod: call("k8s:pod:debug"),
    copyToPod: call("k8s:pod:copy:to"),
    copyFromPod: call("k8s:pod:copy:from"),

    listJobs: call("k8s:jobs:list"),
    restartJob: call("k8s:job:restart"),
    setJobSuspend: call("k8s:job:suspend"),
    listCronJobs: call("k8s:cronjobs:list"),
    restartCronJob: call("k8s:cronjob:trigger"),
    setCronJobSuspend: call("k8s:cronjob:suspend"),

    listConfigMaps: call("k8s:configmaps:list"),
    getConfigMap: call("k8s:configmap:get"),
    updateConfigMap: call("k8s:configmap:update"),
    listSecrets: call("k8s:secrets:list"),
    getSecret: call("k8s:secret:get"),
    updateSecret: call("k8s:secret:update"),

    listServices: call("k8s:services:list"),
    createService: call("k8s:service:create"),
    updateService: call("k8s:service:update"),
    listIngresses: call("k8s:ingresses:list"),
    getIngress: call("k8s:ingress:get"),
    createIngress: call("k8s:ingress:create"),
    updateIngress: call("k8s:ingress:update"),
    listIngressClasses: call("k8s:ingressclasses:list"),
    listNetworkPolicies: call("k8s:networkpolicies:list"),
    getNetworkPolicy: call("k8s:networkpolicy:get"),
    listEndpoints: call("k8s:endpoints:list"),
    getEndpoint: call("k8s:endpoint:get"),
    listEndpointSlices: call("k8s:endpointslices:list"),
    getEndpointSlice: call("k8s:endpointslice:get"),

    listServiceAccounts: call("k8s:serviceaccounts:list"),
    updateServiceAccount: call("k8s:serviceaccount:update"),
    listRoles: call("k8s:roles:list"),
    getRole: call("k8s:role:get"),
    updateRole: call("k8s:role:update"),
    listClusterRoles: call("k8s:clusterroles:list"),
    getClusterRole: call("k8s:clusterrole:get"),
    updateClusterRole: call("k8s:clusterrole:update"),
    listRoleBindings: call("k8s:rolebindings:list"),
    updateRoleBinding: call("k8s:rolebinding:update"),
    listClusterRoleBindings: call("k8s:clusterrolebindings:list"),
    updateClusterRoleBinding: call("k8s:clusterrolebinding:update"),
    checkAccess: call("k8s:access:review"),
    listSelfRules: call("k8s:access:selfrules"),
    getSubjectPermissions: call("k8s:access:subject"),
    getRoleSubjects: call("k8s:access:rolesubjects"),
    getResourceRelations: call("k8s:references:get"),

    listHPAs: call("k8s:hpas:list"),
    getHPA: call("k8s:hpa:get"),
    updateHPAReplicas: call("k8s:hpa:replicas:update"),
    updateHPAMetrics: call("k8s:hpa:metrics:update"),

    listPVs: call("k8s:pvs:list"),
    listPVCs: call("k8s:pvcs:list"),
    expandPVC: call("k8s:pvc:expand"),
    listStorageClasses: call("k8s:storageclasses:list"),
    listVolumeSnapshots: call("k8s:volumesnapshots:list"),
    listVolumeSnapshotClasses: call("k8s:volumesnapshotclasses:list"),

    listCRDs: call("k8s:crds:list"),
    listCustomResources: call("k8s:customresources:list"),
    getCustomResource: call("k8s:customresource:get"),

    listResourceQuotas: call("k8s:resourcequotas:list"),
    listLimitRanges: call("k8s:limitranges:list"),
    listPDBs: call("k8s:pdbs:list"),
    listPriorityClasses: call("k8s:priorityclasses:list"),
    listValidatingWebhookConfigurations: call(
      "k8s:validatingwebhookconfigurations:list",
    ),
    getValidatingWebhookConfiguration: call(
      "k8s:validatingwebhookconfiguration:get",
    ),
    listMutatingWebhookConfigurations: call(
      "k8s:mutatingwebhookconfigurations:list",
    ),
    getMutatingWebhookConfiguration: call(
      "k8s:mutatingwebhookconfiguration:get",
    ),

    applyResource: call("k8s:resource:apply"),
    dryRunResource: call("k8s:resource:dryRun"),
    replaceResource: call("k8s:resource:replace"),
    dryRunReplaceResource: call("k8s:resource:replace:dryRun"),
    readResource: call("k8s:resource:read"),
    deleteResource: call("k8s:resource:delete"),
  },

  listEvents: call("k8s:events:list"),
  listEventsForResource: call("k8s:events:for-resource"),

  // Watch-backed lists: `startWatch` returns the informer's synced cache plus a
  // subscription id, and every later change arrives on the shared event
  // channel tagged with that id.
  startWatch: call("k8s:watch:start"),
  stopWatch: call("k8s:watch:stop"),
  onWatchEvent: listen("k8s:watch:event"),
  onWatchClosed: listen("k8s:watch:closed"),

  startPodLog: (
    namespace: string,
    podName: string,
    containerName?: string,
    tabKey?: string,
    options?: PodLogOptions,
    contextName?: string,
  ) =>
    invoke("k8s:pod:log:start", {
      namespace,
      podName,
      containerName,
      tabKey,
      options,
      contextName,
    }),
  savePodLog: call("k8s:pod:log:save"),
  stopPodLog: (namespace: string, podName: string) =>
    invoke("k8s:pod:log:stop", { namespace, podName }),
  stopPodLogSession: (sessionId: string) =>
    invoke("k8s:pod:log:stop:session", { sessionId }),
  onPodLogData: listen("k8s:pod:log:data"),
  onPodLogEnd: listen("k8s:pod:log:end"),

  startPodExec: (
    sessionId: string,
    namespace: string,
    podName: string,
    containerName: string,
    contextName?: string,
  ) =>
    invoke("k8s:pod:exec", {
      sessionId,
      namespace,
      podName,
      containerName,
      contextName,
    }),
  sendPodExecInput: (sessionId: string, data: string) =>
    send("k8s:pod:exec:input", { sessionId, data }),
  closePodExec: (sessionId: string) =>
    send("k8s:pod:exec:close", { sessionId }),
  onPodExecOutput: listen("k8s:pod:exec:output"),
  onPodCopyProgress: listen("k8s:pod:copy:progress"),

  startSocketStream: (socketPath: string, sessionId: string) =>
    invoke("stream:socket:start", { socketPath, sessionId }),
  stopSocketStream: (sessionId: string) =>
    invoke("stream:socket:stop", { sessionId }),
  onSocketData: listen("stream:socket:data"),
  onSocketEnd: listen("stream:socket:end"),
  startPortForward: call("portforward:start"),
  stopPortForward: (sessionId: string) =>
    invoke("portforward:stop", { sessionId }),
  selectLocalPath: call("dialog:path:select"),

  getPrometheusConfig: call("prometheus:config:get"),
  setPrometheusConfig: call("prometheus:config:set"),
  getPrometheusPodMetrics: call("prometheus:pod:metrics"),
  checkAwsCredentials: call("aws:credentials:check"),

  alarm: {
    evaluate: (rule: AlarmRule) => invoke("alarm:evaluate", { rule }),
  },
  helm: {
    repoAdd: (name: string, url: string) =>
      invoke("helm:repo:add", { name, url }),
    repoList: call("helm:repo:list"),
    releaseList: call("helm:release:list"),
    releaseInstall: call("helm:release:install"),
    releaseUpgrade: call("helm:release:upgrade"),
    releaseUninstall: call("helm:release:uninstall"),
  },
}

export type Api = typeof api
