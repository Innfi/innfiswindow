import { IpcMain } from "electron"
import { KubeConfig } from "@kubernetes/client-node"

import {
  getClusterType,
  getCurrentContext,
  getNodeMetrics,
  listContexts,
  listNamespaces,
  listNodes,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerClusterHandlers(
  ipcMain: IpcMain,
  kc: KubeConfig,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle("k8s:contexts:list", () => listContexts(kc))
  ipcMain.handle("k8s:context:current", () => getCurrentContext(kc))
  ipcMain.handle("k8s:cluster:type", () => getClusterType(kc))
  ipcMain.handle("k8s:namespaces:list", (_e, args?: { contextName?: string }) =>
    listNamespaces(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:nodes:list", (_e, args?: { contextName?: string }) =>
    listNodes(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:node:metrics", (_e, args?: { contextName?: string }) =>
    getNodeMetrics(getContextClients(args?.contextName).customObjects),
  )
}
