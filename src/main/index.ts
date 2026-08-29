import { app, BrowserWindow, ipcMain, session, shell } from "electron"
import { join } from "path"
import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import {
  ApiextensionsV1Api,
  AppsV1Api,
  AutoscalingV2Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  DiscoveryV1Api,
  KubeConfig,
  NetworkingV1Api,
  PolicyV1Api,
  RbacAuthorizationV1Api,
  StorageV1Api,
} from "@kubernetes/client-node"

import { stopAllWatches } from "./informers"
import { registerAlarmHandlers } from "./ipc/alarm"
import { registerApplyHandlers } from "./ipc/apply"
import { registerAutoscalingHandlers } from "./ipc/autoscaling"
import { registerAwsHandlers } from "./ipc/aws"
import { registerBatchHandlers } from "./ipc/batch"
import { registerClusterHandlers } from "./ipc/cluster"
import { registerConfigHandlers } from "./ipc/config"
import {
  createContextClientsCache,
  createKubeConfigCache,
} from "./ipc/context-clients"
import { registerCustomResourceHandlers } from "./ipc/customresources"
import { registerDialogHandlers } from "./ipc/dialog"
import { registerEventsHandlers } from "./ipc/events"
import { registerGovernanceHandlers } from "./ipc/governance"
import { registerHelmHandlers } from "./ipc/helm"
import { registerNetworkingHandlers } from "./ipc/networking"
import { registerPodCopyHandlers } from "./ipc/pod-copy"
import { registerPodStreamHandlers } from "./ipc/pod-streams"
import { registerPortForwardHandlers } from "./ipc/portforward"
import { registerPrometheusHandlers } from "./ipc/prometheus"
import { registerRbacHandlers } from "./ipc/rbac"
import { registerSocketStreamHandlers } from "./ipc/socket-stream"
import { registerStorageHandlers } from "./ipc/storage"
import { registerWatchHandlers } from "./ipc/watch"
import { registerWorkloadHandlers } from "./ipc/workload"
import { checkPrometheusConnectivity } from "./prometheus-handlers"

const kc = new KubeConfig()
kc.loadFromDefault()

const coreV1Api = kc.makeApiClient(CoreV1Api)
const apiextensionsV1Api = kc.makeApiClient(ApiextensionsV1Api)
const appsV1Api = kc.makeApiClient(AppsV1Api)
const discoveryV1Api = kc.makeApiClient(DiscoveryV1Api)
const networkingV1Api = kc.makeApiClient(NetworkingV1Api)
const rbacV1Api = kc.makeApiClient(RbacAuthorizationV1Api)
const autoscalingV2Api = kc.makeApiClient(AutoscalingV2Api)
const batchV1Api = kc.makeApiClient(BatchV1Api)
const customObjectsApi = kc.makeApiClient(CustomObjectsApi)
const policyV1Api = kc.makeApiClient(PolicyV1Api)
const storageV1Api = kc.makeApiClient(StorageV1Api)

const { getContextClients, invalidateContext } = createContextClientsCache({
  coreV1: coreV1Api,
  apiextensionsV1: apiextensionsV1Api,
  appsV1: appsV1Api,
  discoveryV1: discoveryV1Api,
  networkingV1: networkingV1Api,
  rbacV1: rbacV1Api,
  autoscalingV2: autoscalingV2Api,
  batchV1: batchV1Api,
  customObjects: customObjectsApi,
  policyV1: policyV1Api,
  storageV1: storageV1Api,
})

const getKubeConfig = createKubeConfigCache(kc)

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
const getMainWindow = (): BrowserWindow | null => mainWindow

function isSafeExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}

/** Content-Security-Policy applied to every renderer response. In dev, Vite's
 *  HMR client and React Fast Refresh need inline/eval scripts plus a websocket
 *  back to the dev server, so the policy is loosened. Production is tight:
 *  scripts only from the bundle, no eval, and no remote connections (all k8s /
 *  Prometheus traffic goes through the main process over IPC, not the renderer).
 *  `worker-src blob:` is required by Monaco's bundled editor worker, and
 *  `style-src 'unsafe-inline'` by Tailwind v4's injected <style>. */
function contentSecurityPolicy(): string {
  const devServer = process.env["ELECTRON_RENDERER_URL"] ?? ""
  if (is.dev && devServer) {
    return [
      `default-src 'self' ${devServer}`,
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${devServer}`,
      `style-src 'self' 'unsafe-inline' ${devServer}`,
      "img-src 'self' data:",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      `connect-src 'self' ${devServer} ws: wss:`,
    ].join("; ")
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-src 'none'",
  ].join("; ")
}

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
    // The preload only ever touches contextBridge/ipcRenderer, both of which
    // are available inside the sandbox, so the renderer gets no Node access at
    // all — defence in depth on top of contextIsolation. Keeping this true
    // requires the preload bundle to stay dependency-free at runtime; see the
    // externalizeDepsPlugin exclusion in electron.vite.config.ts.
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
    },
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow!.show()
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  // Only ever hand http(s) URLs to the OS browser. A compromised renderer
  // could otherwise pass file://, smb://, or a custom-scheme URL to launch
  // local programs or leak files via shell.openExternal.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) shell.openExternal(details.url)
    return { action: "deny" }
  })

  // The app is a single-page renderer; it never legitimately navigates the
  // top-level frame elsewhere. Block any attempt (e.g. an injected link or
  // redirect) from replacing the app with remote content.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const devUrl = process.env["ELECTRON_RENDERER_URL"]
    if (is.dev && devUrl && url.startsWith(devUrl)) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) shell.openExternal(url)
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

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [contentSecurityPolicy()],
      },
    })
  })

  ipcMain.on("ping", () => console.log("pong"))

  registerClusterHandlers(ipcMain, kc, getContextClients, invalidateContext)
  registerWorkloadHandlers(ipcMain, appsV1Api, getContextClients)
  registerConfigHandlers(ipcMain, coreV1Api, getContextClients)
  registerRbacHandlers(ipcMain, rbacV1Api, getContextClients)
  registerNetworkingHandlers(
    ipcMain,
    coreV1Api,
    networkingV1Api,
    getContextClients,
  )
  registerGovernanceHandlers(ipcMain, getContextClients)
  registerBatchHandlers(ipcMain, getContextClients)
  registerAutoscalingHandlers(ipcMain, getContextClients)
  registerStorageHandlers(ipcMain, getContextClients)
  registerCustomResourceHandlers(ipcMain, getContextClients)
  registerApplyHandlers(ipcMain, getKubeConfig)
  registerAwsHandlers(ipcMain)
  registerAlarmHandlers(ipcMain, getContextClients)
  registerHelmHandlers(ipcMain)
  registerPrometheusHandlers(ipcMain)
  registerEventsHandlers(ipcMain, getContextClients)
  registerWatchHandlers(ipcMain, { getKubeConfig, getContextClients })
  registerPodStreamHandlers(ipcMain, getKubeConfig, getMainWindow)
  registerPodCopyHandlers(ipcMain, getKubeConfig, getMainWindow)
  registerDialogHandlers(ipcMain, getMainWindow)
  registerSocketStreamHandlers(ipcMain, getMainWindow)
  registerPortForwardHandlers(ipcMain, kc, coreV1Api)

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

// Informers hold open watch streams; leaving them running keeps the process
// alive after the last window is gone.
app.on("before-quit", () => {
  stopAllWatches()
})
