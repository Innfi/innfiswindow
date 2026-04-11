import { app, BrowserWindow, ipcMain, shell } from "electron"
import { join } from "path"
import { PassThrough } from "stream"
import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import {
  AppsV1Api,
  CoreV1Api,
  KubeConfig,
  Log,
  NetworkingV1Api,
  Watch,
} from "@kubernetes/client-node"

import {
  applyResource,
  createDaemonSet,
  createDeployment,
  createIngress,
  createService,
  createStatefulSet,
  deleteDaemonSet,
  deleteDeployment,
  deleteIngress,
  deleteService,
  deleteStatefulSet,
  getClusterType,
  getCurrentContext,
  listConfigMaps,
  listContexts,
  listDaemonSets,
  listDeployments,
  listEvents,
  listIngresses,
  listNamespaces,
  listNodes,
  listPods,
  listReplicaSets,
  listSecrets,
  listServices,
  listStatefulSets,
  updateDaemonSet,
  updateDeployment,
  updateIngress,
  updateService,
  updateStatefulSet,
} from "./k8s-handlers"

const kc = new KubeConfig()
kc.loadFromDefault()

const coreV1Api = kc.makeApiClient(CoreV1Api)
const appsV1Api = kc.makeApiClient(AppsV1Api)
const networkingV1Api = kc.makeApiClient(NetworkingV1Api)

// Export for use in other modules if needed
export { appsV1Api, coreV1Api, kc, networkingV1Api }

let mainWindow: BrowserWindow | null = null
const activeLogRequests = new Map<string, { abort: () => void }>()
let activeEventsWatch: { abort: () => void } | null = null

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
  ipcMain.handle("k8s:namespaces:list", () => listNamespaces(coreV1Api))
  ipcMain.handle("k8s:deployments:list", () => listDeployments(appsV1Api))
  ipcMain.handle("k8s:replicasets:list", () => listReplicaSets(appsV1Api))
  ipcMain.handle("k8s:pods:list", () => listPods(coreV1Api))
  ipcMain.handle("k8s:daemonsets:list", () => listDaemonSets(appsV1Api))
  ipcMain.handle("k8s:statefulsets:list", () => listStatefulSets(appsV1Api))
  ipcMain.handle("k8s:configmaps:list", () => listConfigMaps(coreV1Api))
  ipcMain.handle("k8s:secrets:list", () => listSecrets(coreV1Api))
  ipcMain.handle("k8s:services:list", () => listServices(coreV1Api))
  ipcMain.handle("k8s:ingresses:list", () => listIngresses(networkingV1Api))
  ipcMain.handle("k8s:nodes:list", () => listNodes(coreV1Api))
  ipcMain.handle(
    "k8s:deployment:create",
    (_e, namespace: string, name: string, image: string, replicas: number) =>
      createDeployment(appsV1Api, namespace, name, image, replicas),
  )
  ipcMain.handle(
    "k8s:deployment:update",
    (_e, namespace: string, name: string, image: string, replicas: number) =>
      updateDeployment(appsV1Api, namespace, name, image, replicas),
  )
  ipcMain.handle(
    "k8s:deployment:delete",
    (_e, namespace: string, name: string) =>
      deleteDeployment(appsV1Api, namespace, name),
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
    (_e, namespace: string, name: string, image: string, replicas: number) =>
      updateStatefulSet(appsV1Api, namespace, name, image, replicas),
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
    (_e, namespace: string, name: string, image: string) =>
      updateDaemonSet(appsV1Api, namespace, name, image),
  )
  ipcMain.handle(
    "k8s:daemonset:delete",
    (_e, namespace: string, name: string) =>
      deleteDaemonSet(appsV1Api, namespace, name),
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
    ) => updateService(coreV1Api, namespace, name, type, ports),
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
      updateIngress(
        networkingV1Api,
        namespace,
        name,
        ingressClassName,
        rules,
        tls,
      ),
  )
  ipcMain.handle("k8s:ingress:delete", (_e, namespace: string, name: string) =>
    deleteIngress(networkingV1Api, namespace, name),
  )
  ipcMain.handle("k8s:resource:apply", (_e, yaml: string) =>
    applyResource(kc, yaml),
  )

  ipcMain.handle("k8s:events:list", () => listEvents(coreV1Api))

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
      }: { namespace: string; podName: string; containerName?: string },
    ) => {
      const key = `${namespace}/${podName}`
      if (activeLogRequests.has(key)) {
        activeLogRequests.get(key)!.abort()
        activeLogRequests.delete(key)
      }

      const log = new Log(kc)
      const logStream = new PassThrough()

      logStream.on("data", (chunk: Buffer) => {
        const text = chunk.toString()
        const lines = text.split("\n")
        for (const line of lines) {
          if (line) {
            mainWindow?.webContents.send("k8s:pod:log:data", line)
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

  createWindow()

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
