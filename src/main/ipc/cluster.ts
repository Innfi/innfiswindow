import { IpcMain } from "electron"
import { KubeConfig } from "@kubernetes/client-node"

import {
  checkConnection,
  drainNode,
  getClusterType,
  getCurrentContext,
  getNodeMetrics,
  listContexts,
  listNamespaces,
  listNodes,
  setNodeSchedulable,
} from "../k8s-handlers"
import { GetContextClients, InvalidateContext } from "./context-clients"

export function registerClusterHandlers(
  ipcMain: IpcMain,
  kc: KubeConfig,
  getContextClients: GetContextClients,
  invalidateContext: InvalidateContext,
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
  ipcMain.handle(
    "k8s:node:cordon",
    (_e, args: { contextName?: string; name: string; schedulable: boolean }) =>
      setNodeSchedulable(
        getContextClients(args.contextName).coreV1,
        args.name,
        args.schedulable,
      ),
  )
  ipcMain.handle(
    "k8s:node:drain",
    (_e, args: { contextName?: string; name: string }) =>
      drainNode(getContextClients(args.contextName).coreV1, args.name),
  )
  ipcMain.handle(
    "k8s:connection:check",
    (_e, args?: { contextName?: string }) =>
      checkConnection(getContextClients(args?.contextName).coreV1),
  )
  // Reconnect: drop any cached client so the exec credential plugin re-runs,
  // then probe again.
  ipcMain.handle(
    "k8s:connection:reconnect",
    (_e, args?: { contextName?: string }) => {
      invalidateContext(args?.contextName)
      return checkConnection(getContextClients(args?.contextName).coreV1)
    },
  )
}
