import { IpcMain } from "electron"

import { listApiResources } from "../k8s-handlers"
import { GetKubeConfig } from "./context-clients"

export function registerDiscoveryHandlers(
  ipcMain: IpcMain,
  getKubeConfig: GetKubeConfig,
): void {
  ipcMain.handle(
    "k8s:apiresources:list",
    (_e, args?: { contextName?: string }) =>
      listApiResources(getKubeConfig(args?.contextName)),
  )
}
