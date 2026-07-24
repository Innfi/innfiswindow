import { app, BrowserWindow, ipcMain, shell } from "electron"
import { join } from "path"
import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import {
  AppsV1Api,
  AutoscalingV2Api,
  BatchV1Api,
  CoreV1Api,
  CustomObjectsApi,
  KubeConfig,
  NetworkingV1Api,
  PolicyV1Api,
  RbacAuthorizationV1Api,
  StorageV1Api,
} from "@kubernetes/client-node"

import { registerAlarmHandlers } from "./ipc/alarm"
import { registerApplyHandlers } from "./ipc/apply"
import { registerAutoscalingHandlers } from "./ipc/autoscaling"
import { registerAwsHandlers } from "./ipc/aws"
import { registerBatchHandlers } from "./ipc/batch"
import { registerClusterHandlers } from "./ipc/cluster"
import { registerConfigHandlers } from "./ipc/config"
import { createContextClientsCache } from "./ipc/context-clients"
import { registerEventsHandlers } from "./ipc/events"
import { registerGovernanceHandlers } from "./ipc/governance"
import { registerHelmHandlers } from "./ipc/helm"
import { registerNetworkingHandlers } from "./ipc/networking"
import { registerPodStreamHandlers } from "./ipc/pod-streams"
import { registerPortForwardHandlers } from "./ipc/portforward"
import { registerPrometheusHandlers } from "./ipc/prometheus"
import { registerRbacHandlers } from "./ipc/rbac"
import { registerSocketStreamHandlers } from "./ipc/socket-stream"
import { registerStorageHandlers } from "./ipc/storage"
import { registerWorkloadHandlers } from "./ipc/workload"
import { checkPrometheusConnectivity } from "./prometheus-handlers"

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
const storageV1Api = kc.makeApiClient(StorageV1Api)

const { getContextClients, invalidateContext } = createContextClientsCache({
  coreV1: coreV1Api,
  appsV1: appsV1Api,
  networkingV1: networkingV1Api,
  rbacV1: rbacV1Api,
  autoscalingV2: autoscalingV2Api,
  batchV1: batchV1Api,
  customObjects: customObjectsApi,
  policyV1: policyV1Api,
  storageV1: storageV1Api,
})

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

  registerClusterHandlers(ipcMain, kc, getContextClients, invalidateContext)
  registerWorkloadHandlers(ipcMain, appsV1Api, coreV1Api, getContextClients)
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
  registerApplyHandlers(ipcMain, kc)
  registerAwsHandlers(ipcMain)
  registerAlarmHandlers(ipcMain, getContextClients)
  registerHelmHandlers(ipcMain)
  registerPrometheusHandlers(ipcMain)
  registerEventsHandlers(ipcMain, kc, getContextClients, getMainWindow)
  registerPodStreamHandlers(ipcMain, kc, getMainWindow)
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
