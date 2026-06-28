import { IpcMain } from "electron"

import { listPVCs, listPVs, listStorageClasses, listVolumeSnapshots } from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerStorageHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle("k8s:pvs:list", (_e, args?: { contextName?: string }) =>
    listPVs(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:pvcs:list", (_e, args?: { contextName?: string }) =>
    listPVCs(getContextClients(args?.contextName).coreV1),
  )
  ipcMain.handle("k8s:storageclasses:list", (_e, args?: { contextName?: string }) =>
    listStorageClasses(getContextClients(args?.contextName).storageV1),
  )
  ipcMain.handle("k8s:volumesnapshots:list", (_e, args?: { contextName?: string }) =>
    listVolumeSnapshots(getContextClients(args?.contextName).customObjects),
  )
}
