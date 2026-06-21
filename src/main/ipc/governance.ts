import { IpcMain } from "electron"

import { listLimitRanges, listPDBs, listResourceQuotas } from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerGovernanceHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
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
}
