import { IpcMain } from "electron"

import {
  deleteCronJob,
  deleteJob,
  listCronJobs,
  listJobs,
  restartJob,
  triggerCronJob,
} from "../k8s-handlers"
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
  ipcMain.handle(
    "k8s:job:restart",
    (_e, args: { contextName?: string; namespace: string; name: string }) =>
      restartJob(
        getContextClients(args.contextName).batchV1,
        args.namespace,
        args.name,
      ),
  )
  ipcMain.handle(
    "k8s:cronjob:trigger",
    (_e, args: { contextName?: string; namespace: string; name: string }) =>
      triggerCronJob(
        getContextClients(args.contextName).batchV1,
        args.namespace,
        args.name,
      ),
  )
  ipcMain.handle(
    "k8s:job:delete",
    (_e, args: { contextName?: string; namespace: string; name: string }) =>
      deleteJob(
        getContextClients(args.contextName).batchV1,
        args.namespace,
        args.name,
      ),
  )
  ipcMain.handle(
    "k8s:cronjob:delete",
    (_e, args: { contextName?: string; namespace: string; name: string }) =>
      deleteCronJob(
        getContextClients(args.contextName).batchV1,
        args.namespace,
        args.name,
      ),
  )
}
