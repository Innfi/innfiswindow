import { IpcMain } from "electron"

import {
  listLimitRanges,
  listPDBs,
  listPriorityClasses,
  listResourceQuotas,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerGovernanceHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:resourcequotas:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listResourceQuotas(
        getContextClients(args?.contextName).coreV1,
        args?.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:limitranges:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listLimitRanges(
        getContextClients(args?.contextName).coreV1,
        args?.namespace,
      ),
  )
  ipcMain.handle(
    "k8s:pdbs:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listPDBs(getContextClients(args?.contextName).policyV1, args?.namespace),
  )
  ipcMain.handle(
    "k8s:priorityclasses:list",
    (_e, args?: { contextName?: string }) =>
      listPriorityClasses(getContextClients(args?.contextName).schedulingV1),
  )
}
