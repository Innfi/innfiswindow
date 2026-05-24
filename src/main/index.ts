import { app, BrowserWindow, ipcMain, shell } from "electron"
import { createConnection, createServer, Server, Socket } from "net"
import { join } from "path"
import { PassThrough } from "stream"
import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import {
  AppsV1Api,
  AutoscalingV2Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  Exec,
  KubeConfig,
  Log,
  NetworkingV1Api,
  PolicyV1Api,
  PortForward,
  RbacAuthorizationV1Api,
  Watch,
} from "@kubernetes/client-node"

import { checkAwsCredentials } from "./aws-handlers"
import {
  applyResource,
  createDaemonSet,
  createDeployment,
  createIngress,
  createService,
  createStatefulSet,
  deleteClusterRole,
  deleteClusterRoleBinding,
  deleteConfigMap,
  deleteDaemonSet,
  deleteDeployment,
  deleteIngress,
  deletePod,
  deleteRole,
  deleteRoleBinding,
  deleteSecret,
  deleteService,
  deleteServiceAccount,
  deleteStatefulSet,
  getClusterType,
  getCurrentContext,
  getNodeMetrics,
  listClusterRoleBindings,
  listClusterRoles,
  listConfigMaps,
  listContexts,
  listCronJobs,
  listDaemonSets,
  listDeploymentHistory,
  listDeployments,
  listEndpoints,
  listEvents,
  listHPAs,
  listIngresses,
  listJobs,
  listLimitRanges,
  listNamespaces,
  listNetworkPolicies,
  listNodes,
  listPDBs,
  listPods,
  listPVCs,
  listPVs,
  listReplicaSets,
  listResourceQuotas,
  listRoleBindings,
  listRoles,
  listSecrets,
  listServiceAccounts,
  listServices,
  listStatefulSets,
  replaceConfigMapFromYaml,
  replaceDaemonSetFromYaml,
  replaceDeploymentFromYaml,
  replaceIngressFromYaml,
  replaceSecretFromYaml,
  replaceServiceFromYaml,
  replaceStatefulSetFromYaml,
  rollbackDeployment,
  updateClusterRole,
  updateClusterRoleBinding,
  updateRole,
  updateRoleBinding,
  updateServiceAccount,
} from "./k8s-handlers"
import {
  checkPrometheusConnectivity,
  getPodMetrics,
  getPrometheusConfig,
  setPrometheusConfig,
} from "./prometheus-handlers"

const kc = new KubeConfig()
kc.loadFromDefault()

const coreV1Api = kc.makeApiClient(CoreV1Api)
const appsV1Api = kc.makeApiClient(AppsV1Api)
const networkingV1Api = kc.makeApiClient(NetworkingV1Api)
const rbacV1Api = kc.makeApiClient(RbacAuthorizationV1Api)
const autoscalingV2Api = kc.makeApiClient(AutoscalingV2Api)
const batchV1Api = kc.makeApiClient(BatchV1Api)
const customObjectsApi = kc.makeApiClient(CustomObjectsApi)
const policyV1Api = kc.makeApiClient(PolicyV1Api)

// Per-context API client cache
const clientCache = new Map<
  string,
  {
    coreV1: CoreV1Api
    appsV1: AppsV1Api
    networkingV1: NetworkingV1Api
    rbacV1: RbacAuthorizationV1Api
    autoscalingV2: AutoscalingV2Api
    batchV1: BatchV1Api
    customObjects: CustomObjectsApi
    policyV1: PolicyV1Api
  }
>()

function getContextClients(contextName?: string | null) {
  if (!contextName) {
    return {
      coreV1: coreV1Api,
      appsV1: appsV1Api,
      networkingV1: networkingV1Api,
      rbacV1: rbacV1Api,
      autoscalingV2: autoscalingV2Api,
      batchV1: batchV1Api,
      customObjects: customObjectsApi,
      policyV1: policyV1Api,
    }
  }
  if (clientCache.has(contextName)) return clientCache.get(contextName)!
  const ctxKc = new KubeConfig()
  ctxKc.loadFromDefault()
  ctxKc.setCurrentContext(contextName)
  const clients = {
    coreV1: ctxKc.makeApiClient(CoreV1Api),
    appsV1: ctxKc.makeApiClient(AppsV1Api),
    networkingV1: ctxKc.makeApiClient(NetworkingV1Api),
    rbacV1: ctxKc.makeApiClient(RbacAuthorizationV1Api),
    autoscalingV2: ctxKc.makeApiClient(AutoscalingV2Api),
    batchV1: ctxKc.makeApiClient(BatchV1Api),
    customObjects: ctxKc.makeApiClient(CustomObjectsApi),
    policyV1: ctxKc.makeApiClient(PolicyV1Api),
  }
  clientCache.set(contextName, clients)
  return clients
}

// Export for use in other modules if needed
export {
  appsV1Api,
  autoscalingV2Api,
  batchV1Api,
  coreV1Api,
  kc,
  networkingV1Api,
  rbacV1Api,
}

let mainWindow: BrowserWindow | null = null
const activeLogRequests = new Map<string, { abort: () => void }>()
let activeEventsWatch: { abort: () => void } | null = null

type ExecWebSocket = { terminate(): void }
const activeExecSessions = new Map<
  string,
  { ws: ExecWebSocket; stdinStream: PassThrough }
>()

const activeSocketStreams = new Map<string, Socket>()
const activePortForwardSessions = new Map<string, { server: Server }>()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux"
      ? {
          icon: join(__dirname, "../../build/icon.png"),
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
    },
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show()
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron")

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on("ping", () => console.log("pong"))

  ipcMain.handle("k8s:contexts:list", () => listContexts(kc))
  ipcMain.handle("k8s:context:current", () => getCurrentContext(kc))
  ipcMain.handle("k8s:cluster:type", () => getClusterType(kc))
  ipcMain.handle("k8s:namespaces:list", (_e, args?: { contextName?: string }) =>
    listNamespaces(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle(
    "k8s:deployments:list",
    (_e, args?: { contextName?: string }) =>
      listDeployments(getContextClients(args?.contextName).appsV1),
  )
  ipcMain.handle(
    "k8s:replicasets:list",
    (_e, args?: { contextName?: string }) =>
      listReplicaSets(getContextClients(args?.contextName).appsV1),
  )
  ipcMain.handle("k8s:pods:list", (_e, args?: { contextName?: string }) =>
    listPods(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:daemonsets:list", (_e, args?: { contextName?: string }) =>
    listDaemonSets(getContextClients(args?.contextName).appsV1),
  )
  ipcMain.handle(
    "k8s:statefulsets:list",
    (_e, args?: { contextName?: string }) =>
      listStatefulSets(getContextClients(args?.contextName).appsV1),
  )
  ipcMain.handle("k8s:configmaps:list", (_e, args?: { contextName?: string }) =>
    listConfigMaps(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:secrets:list", (_e, args?: { contextName?: string }) =>
    listSecrets(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle(
    "k8s:serviceaccounts:list",
    (_e, args?: { contextName?: string }) =>
      listServiceAccounts(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle(
    "k8s:roles:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listRoles(getContextClients(args?.contextName).rbacV1, args?.namespace),
  )
  ipcMain.handle(
    "k8s:clusterroles:list",
    (_e, args?: { contextName?: string }) =>
      listClusterRoles(getContextClients(args?.contextName).rbacV1),
  )
  ipcMain.handle(
    "k8s:rolebindings:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listRoleBindings(
        getContextClients(args?.contextName).rbacV1,
        args?.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:clusterrolebindings:list",
    (_e, args?: { contextName?: string }) =>
      listClusterRoleBindings(getContextClients(args?.contextName).rbacV1),
  )
  ipcMain.handle(
    "k8s:role:update",
    (
      _e,
      namespace: string,
      name: string,
      rules: Array<{
        apiGroups: string[]
        resources: string[]
        verbs: string[]
      }>,
    ) => updateRole(rbacV1Api, namespace, name, rules),
  )
  ipcMain.handle(
    "k8s:clusterrole:update",
    (
      _e,
      name: string,
      rules: Array<{
        apiGroups: string[]
        resources: string[]
        verbs: string[]
      }>,
    ) => updateClusterRole(rbacV1Api, name, rules),
  )
  ipcMain.handle(
    "k8s:rolebinding:update",
    (
      _e,
      namespace: string,
      name: string,
      subjects: Array<{ kind: string; name: string; namespace?: string }>,
    ) => updateRoleBinding(rbacV1Api, namespace, name, subjects),
  )
  ipcMain.handle(
    "k8s:clusterrolebinding:update",
    (
      _e,
      name: string,
      subjects: Array<{ kind: string; name: string; namespace?: string }>,
    ) => updateClusterRoleBinding(rbacV1Api, name, subjects),
  )
  ipcMain.handle(
    "k8s:serviceaccount:update",
    (
      _e,
      namespace: string,
      name: string,
      metadata: {
        labels?: Record<string, string>
        annotations?: Record<string, string>
      },
    ) => updateServiceAccount(coreV1Api, namespace, name, metadata),
  )
  ipcMain.handle("k8s:role:delete", (_e, namespace: string, name: string) =>
    deleteRole(rbacV1Api, namespace, name),
  )
  ipcMain.handle("k8s:clusterrole:delete", (_e, name: string) =>
    deleteClusterRole(rbacV1Api, name),
  )
  ipcMain.handle(
    "k8s:rolebinding:delete",
    (_e, namespace: string, name: string) =>
      deleteRoleBinding(rbacV1Api, namespace, name),
  )
  ipcMain.handle("k8s:clusterrolebinding:delete", (_e, name: string) =>
    deleteClusterRoleBinding(rbacV1Api, name),
  )
  ipcMain.handle(
    "k8s:serviceaccount:delete",
    (_e, namespace: string, name: string) =>
      deleteServiceAccount(coreV1Api, namespace, name),
  )
  ipcMain.handle("k8s:services:list", (_e, args?: { contextName?: string }) =>
    listServices(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:ingresses:list", (_e, args?: { contextName?: string }) =>
    listIngresses(getContextClients(args?.contextName).networkingV1),
  )
  ipcMain.handle(
    "k8s:networkpolicies:list",
    (_e, args?: { contextName?: string }) =>
      listNetworkPolicies(getContextClients(args?.contextName).networkingV1),
  )
  ipcMain.handle("k8s:endpoints:list", (_e, args?: { contextName?: string }) =>
    listEndpoints(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:nodes:list", (_e, args?: { contextName?: string }) =>
    listNodes(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:hpas:list", (_e, args?: { contextName?: string }) =>
    listHPAs(getContextClients(args?.contextName).autoscalingV2),
  )
  ipcMain.handle("k8s:pvs:list", (_e, args?: { contextName?: string }) =>
    listPVs(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:pvcs:list", (_e, args?: { contextName?: string }) =>
    listPVCs(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:jobs:list", (_e, args?: { contextName?: string }) =>
    listJobs(getContextClients(args?.contextName).batchV1),
  )
  ipcMain.handle("k8s:cronjobs:list", (_e, args?: { contextName?: string }) =>
    listCronJobs(getContextClients(args?.contextName).batchV1),
  )
  ipcMain.handle("k8s:node:metrics", (_e, args?: { contextName?: string }) =>
    getNodeMetrics(getContextClients(args?.contextName).customObjects),
  )
  ipcMain.handle(
    "k8s:resourcequotas:list",
    (_e, args?: { contextName?: string }) =>
      listResourceQuotas(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle(
    "k8s:limitranges:list",
    (_e, args?: { contextName?: string }) =>
      listLimitRanges(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:pdbs:list", (_e, args?: { contextName?: string }) =>
    listPDBs(getContextClients(args?.contextName).policyV1),
  )
  ipcMain.handle(
    "k8s:deployment:create",
    (_e, namespace: string, name: string, image: string, replicas: number) =>
      createDeployment(appsV1Api, namespace, name, image, replicas),
  )
  ipcMain.handle(
    "k8s:deployment:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceDeploymentFromYaml(appsV1Api, namespace, name, yaml),
  )
  ipcMain.handle(
    "k8s:deployment:delete",
    (_e, namespace: string, name: string) =>
      deleteDeployment(appsV1Api, namespace, name),
  )
  ipcMain.handle(
    "k8s:deployment:history",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        selector: Record<string, string>
      },
    ) =>
      listDeploymentHistory(
        getContextClients(args.contextName).appsV1,
        args.namespace,
        args.name,
        args.selector,
      ),
  )
  ipcMain.handle(
    "k8s:deployment:rollback",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        revision: number
      },
    ) =>
      rollbackDeployment(
        getContextClients(args.contextName).appsV1,
        args.namespace,
        args.name,
        args.revision,
      ),
  )
  ipcMain.handle(
    "k8s:statefulset:create",
    (
      _e,
      namespace: string,
      name: string,
      image: string,
      replicas: number,
      serviceName: string,
    ) =>
      createStatefulSet(
        appsV1Api,
        namespace,
        name,
        image,
        replicas,
        serviceName,
      ),
  )
  ipcMain.handle(
    "k8s:statefulset:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceStatefulSetFromYaml(appsV1Api, namespace, name, yaml),
  )
  ipcMain.handle(
    "k8s:statefulset:delete",
    (_e, namespace: string, name: string) =>
      deleteStatefulSet(appsV1Api, namespace, name),
  )
  ipcMain.handle(
    "k8s:daemonset:create",
    (_e, namespace: string, name: string, image: string) =>
      createDaemonSet(appsV1Api, namespace, name, image),
  )
  ipcMain.handle(
    "k8s:daemonset:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceDaemonSetFromYaml(appsV1Api, namespace, name, yaml),
  )
  ipcMain.handle(
    "k8s:daemonset:delete",
    (_e, namespace: string, name: string) =>
      deleteDaemonSet(appsV1Api, namespace, name),
  )
  ipcMain.handle(
    "k8s:configmap:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceConfigMapFromYaml(coreV1Api, namespace, name, yaml),
  )
  ipcMain.handle(
    "k8s:configmap:delete",
    (_e, namespace: string, name: string) =>
      deleteConfigMap(coreV1Api, namespace, name),
  )
  ipcMain.handle(
    "k8s:secret:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceSecretFromYaml(coreV1Api, namespace, name, yaml),
  )
  ipcMain.handle("k8s:secret:delete", (_e, namespace: string, name: string) =>
    deleteSecret(coreV1Api, namespace, name),
  )
  ipcMain.handle(
    "k8s:service:create",
    (
      _e,
      namespace: string,
      name: string,
      type: string,
      ports: Array<{
        protocol: string
        port: number
        targetPort: number | string
      }>,
      selector: Record<string, string>,
    ) => createService(coreV1Api, namespace, name, type, ports, selector),
  )
  ipcMain.handle(
    "k8s:service:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceServiceFromYaml(coreV1Api, namespace, name, yaml),
  )
  ipcMain.handle("k8s:service:delete", (_e, namespace: string, name: string) =>
    deleteService(coreV1Api, namespace, name),
  )
  ipcMain.handle(
    "k8s:ingress:create",
    (
      _e,
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
      createIngress(
        networkingV1Api,
        namespace,
        name,
        ingressClassName,
        rules,
        tls,
      ),
  )
  ipcMain.handle(
    "k8s:ingress:update",
    (_e, namespace: string, name: string, yaml: string) =>
      replaceIngressFromYaml(networkingV1Api, namespace, name, yaml),
  )
  ipcMain.handle("k8s:ingress:delete", (_e, namespace: string, name: string) =>
    deleteIngress(networkingV1Api, namespace, name),
  )
  ipcMain.handle("k8s:resource:apply", (_e, yaml: string) =>
    applyResource(kc, yaml),
  )

  ipcMain.handle("aws:credentials:check", () => checkAwsCredentials())

  ipcMain.handle("prometheus:connectivity:check", () =>
    checkPrometheusConnectivity(),
  )
  ipcMain.handle("prometheus:config:get", () => getPrometheusConfig())
  ipcMain.handle(
    "prometheus:config:set",
    (_e, config: { namespace: string; service: string; port: number }) =>
      setPrometheusConfig(config),
  )
  ipcMain.handle(
    "prometheus:pod:metrics",
    (
      _e,
      {
        namespace,
        podName,
        step,
        rangeMinutes,
      }: {
        namespace: string
        podName: string
        step?: number
        rangeMinutes?: number
      },
    ) => getPodMetrics(namespace, podName, step, rangeMinutes),
  )

  ipcMain.handle("k8s:events:list", (_e, args?: { contextName?: string }) =>
    listEvents(getContextClients(args?.contextName).coreV1),
  )

  ipcMain.handle("k8s:events:watch:start", async () => {
    if (activeEventsWatch) {
      activeEventsWatch.abort()
      activeEventsWatch = null
    }
    const watch = new Watch(kc)
    const req = await watch.watch(
      "/api/v1/events",
      {},
      (_type: string, apiObj: unknown) => {
        if (!apiObj) return
        const ev = apiObj as Record<string, unknown>
        const meta = (ev.metadata ?? {}) as Record<string, unknown>
        const involvedObject = (ev.involvedObject ?? {}) as Record<
          string,
          unknown
        >
        const event = {
          name: (meta.name as string) ?? "",
          namespace: (meta.namespace as string) ?? "",
          type: (ev.type as string) ?? "Normal",
          reason: (ev.reason as string) ?? "",
          involvedObjectKind: (involvedObject.kind as string) ?? "",
          involvedObjectName: (involvedObject.name as string) ?? "",
          message: (ev.message as string) ?? "",
          count: (ev.count as number) ?? 1,
          firstTimestamp: (ev.firstTimestamp as string) ?? "",
          lastTimestamp:
            (ev.lastTimestamp as string) ?? (ev.eventTime as string) ?? "",
          creationTimestamp: (meta.creationTimestamp as string) ?? "",
        }
        mainWindow?.webContents.send("k8s:events:data", event)
      },
      (err) => {
        if (err) console.error("Events watch ended:", err)
      },
    )
    activeEventsWatch = { abort: () => req.abort() }
    return { success: true }
  })

  ipcMain.handle("k8s:events:watch:stop", () => {
    if (activeEventsWatch) {
      activeEventsWatch.abort()
      activeEventsWatch = null
    }
    return { success: true }
  })

  ipcMain.handle(
    "k8s:pod:log:start",
    async (
      _e,
      {
        namespace,
        podName,
        containerName,
        tabKey,
      }: {
        namespace: string
        podName: string
        containerName?: string
        tabKey?: string
      },
    ) => {
      const key = `${namespace}/${podName}`
      if (activeLogRequests.has(key)) {
        activeLogRequests.get(key)!.abort()
        activeLogRequests.delete(key)
      }

      const log = new Log(kc)
      const logStream = new PassThrough()
      const emitKey = tabKey ?? key

      logStream.on("data", (chunk: Buffer) => {
        const text = chunk.toString()
        const lines = text.split("\n")
        for (const line of lines) {
          if (line) {
            mainWindow?.webContents.send("k8s:pod:log:data", {
              tabKey: emitKey,
              line,
            })
          }
        }
      })

      const req = await log.log(
        namespace,
        podName,
        containerName ?? "",
        logStream,
        (err) => {
          if (err) console.error("Log stream ended:", err)
        },
        { follow: true, tailLines: 200 },
      )

      activeLogRequests.set(key, { abort: () => req.abort() })
      return { success: true }
    },
  )

  ipcMain.handle(
    "k8s:pod:log:stop",
    (_e, { namespace, podName }: { namespace: string; podName: string }) => {
      const key = `${namespace}/${podName}`
      if (activeLogRequests.has(key)) {
        activeLogRequests.get(key)!.abort()
        activeLogRequests.delete(key)
      }
      return { success: true }
    },
  )

  ipcMain.handle(
    "k8s:pod:exec",
    async (
      _e,
      {
        sessionId,
        namespace,
        podName,
        containerName,
      }: {
        sessionId: string
        namespace: string
        podName: string
        containerName: string
      },
    ) => {
      const stdinStream = new PassThrough()
      const stdoutStream = new PassThrough()
      const stderrStream = new PassThrough()

      stdoutStream.on("data", (chunk: Buffer) => {
        mainWindow?.webContents.send("k8s:pod:exec:output", {
          sessionId,
          data: chunk.toString("binary"),
        })
      })
      stderrStream.on("data", (chunk: Buffer) => {
        mainWindow?.webContents.send("k8s:pod:exec:output", {
          sessionId,
          data: chunk.toString("binary"),
        })
      })

      const exec = new Exec(kc)
      const ws = await exec.exec(
        namespace,
        podName,
        containerName,
        ["/bin/sh"],
        stdoutStream,
        stderrStream,
        stdinStream,
        true,
        (status) => {
          if (status?.status === "Failure") {
            console.error("Exec failed:", status.message)
          }
        },
      )

      activeExecSessions.set(sessionId, {
        ws: ws as ExecWebSocket,
        stdinStream,
      })
      return { success: true }
    },
  )

  ipcMain.on(
    "k8s:pod:exec:input",
    (_e, { sessionId, data }: { sessionId: string; data: string }) => {
      const session = activeExecSessions.get(sessionId)
      if (session) {
        session.stdinStream.write(data)
      }
    },
  )

  ipcMain.handle("k8s:pod:delete", (_e, namespace: string, name: string) =>
    deletePod(coreV1Api, namespace, name),
  )

  ipcMain.on(
    "k8s:pod:exec:close",
    (_e, { sessionId }: { sessionId: string }) => {
      const session = activeExecSessions.get(sessionId)
      if (session) {
        try {
          session.ws.terminate()
        } catch (_err) {
          // ignore
        }
        session.stdinStream.end()
        activeExecSessions.delete(sessionId)
      }
    },
  )

  ipcMain.handle(
    "stream:socket:start",
    (
      _e,
      { socketPath, sessionId }: { socketPath: string; sessionId: string },
    ) => {
      // Clean up any existing session with same id
      const existing = activeSocketStreams.get(sessionId)
      if (existing) {
        existing.destroy()
        activeSocketStreams.delete(sessionId)
      }

      const sock = createConnection(socketPath)
      activeSocketStreams.set(sessionId, sock)

      let buffer = ""
      sock.on("data", (chunk: Buffer) => {
        buffer += chunk.toString()
        const parts = buffer.split("\n")
        buffer = parts.pop() ?? ""
        for (const line of parts) {
          mainWindow?.webContents.send("stream:socket:data", {
            sessionId,
            line,
          })
        }
      })

      sock.on("error", (err) => {
        activeSocketStreams.delete(sessionId)
        mainWindow?.webContents.send("stream:socket:end", {
          sessionId,
          reason: err.message,
        })
      })

      sock.on("close", () => {
        activeSocketStreams.delete(sessionId)
        mainWindow?.webContents.send("stream:socket:end", {
          sessionId,
          reason: "",
        })
      })

      return { success: true }
    },
  )

  ipcMain.handle(
    "stream:socket:stop",
    (_e, { sessionId }: { sessionId: string }) => {
      const sock = activeSocketStreams.get(sessionId)
      if (sock) {
        sock.destroy()
        activeSocketStreams.delete(sessionId)
      }
      return { success: true }
    },
  )

  ipcMain.handle(
    "portforward:start",
    async (
      _e,
      {
        resourceKind,
        namespace,
        name,
        localPort,
        targetPort,
        sessionId,
      }: {
        resourceKind: "Pod" | "Service"
        namespace: string
        name: string
        localPort: number
        targetPort: number
        sessionId: string
      },
    ) => {
      try {
        // Clean up any existing session
        const existing = activePortForwardSessions.get(sessionId)
        if (existing) {
          existing.server.close()
          activePortForwardSessions.delete(sessionId)
        }

        let podName = name

        // For Service, resolve to a backing pod via endpoints
        if (resourceKind === "Service") {
          const ep = await coreV1Api.readNamespacedEndpoints({
            name,
            namespace,
          })
          const addr = ep.subsets?.[0]?.addresses?.[0]
          if (!addr?.targetRef?.name) {
            return {
              success: false,
              error: "No ready pods found for service",
            }
          }
          podName = addr.targetRef.name
          namespace = addr.targetRef.namespace ?? namespace
        }

        const forward = new PortForward(kc)
        const resolvedPodName = podName
        const resolvedNamespace = namespace
        const server = createServer(async (socket) => {
          try {
            await forward.portForward(
              resolvedNamespace,
              resolvedPodName,
              [targetPort],
              socket,
              null,
              socket,
            )
          } catch (err) {
            socket.destroy()
          }
        })

        await new Promise<void>((resolve, reject) => {
          server.listen(localPort, "127.0.0.1", () => resolve())
          server.on("error", reject)
        })

        activePortForwardSessions.set(sessionId, { server })
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    "portforward:stop",
    (_e, { sessionId }: { sessionId: string }) => {
      const session = activePortForwardSessions.get(sessionId)
      if (session) {
        session.server.close()
        activePortForwardSessions.delete(sessionId)
      }
      return { success: true }
    },
  )

  createWindow()

  checkPrometheusConnectivity().then((result) => {
    console.log("[prometheus] connectivity check:", JSON.stringify(result))
  })

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
