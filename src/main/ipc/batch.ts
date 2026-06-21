import { IpcMain } from "electron"

import { listCronJobs, listJobs } from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerBatchHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle("k8s:jobs:list", (_e, args?: { contextName?: string }) =>
    listJobs(getContextClients(args?.contextName).batchV1),
  )
  ipcMain.handle("k8s:cronjobs:list", (_e, args?: { contextName?: string }) =>
    listCronJobs(getContextClients(args?.contextName).batchV1),
  )
}
