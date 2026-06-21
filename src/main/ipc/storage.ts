import { IpcMain } from "electron"

import { listPVCs, listPVs } from "../k8s-handlers"
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
}
