import { IpcMain } from "electron"

import {
  expandPVC,
  listPVCs,
  listPVs,
  listStorageClasses,
  listVolumeSnapshotClasses,
  listVolumeSnapshots,
} from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerStorageHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:pvs:list",
    (_e, args?: { contextName?: string; labelSelector?: string }) =>
      listPVs(getContextClients(args?.contextName).coreV1, args?.labelSelector),
  )
  ipcMain.handle(
    "k8s:pvcs:list",
    (
      _e,
      args?: {
        contextName?: string
        namespace?: string
        labelSelector?: string
      },
    ) => {
      const clients = getContextClients(args?.contextName)
      return listPVCs(
        clients.coreV1,
        args?.namespace,
        clients.storageV1,
        args?.labelSelector,
      )
    },
  )
  ipcMain.handle(
    "k8s:pvc:expand",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        storage: string
      },
    ) => {
      const clients = getContextClients(args.contextName)
      return expandPVC(
        clients.coreV1,
        clients.storageV1,
        args.namespace,
        args.name,
        args.storage,
      )
    },
  )
  ipcMain.handle(
    "k8s:storageclasses:list",
    (_e, args?: { contextName?: string; labelSelector?: string }) =>
      listStorageClasses(
        getContextClients(args?.contextName).storageV1,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:volumesnapshots:list",
    (
      _e,
      args?: {
        contextName?: string
        namespace?: string
        labelSelector?: string
      },
    ) =>
      listVolumeSnapshots(
        getContextClients(args?.contextName).customObjects,
        args?.namespace,
        args?.labelSelector,
      ),
  )
  ipcMain.handle(
    "k8s:volumesnapshotclasses:list",
    (_e, args?: { contextName?: string; labelSelector?: string }) =>
      listVolumeSnapshotClasses(
        getContextClients(args?.contextName).customObjects,
        args?.labelSelector,
      ),
  )
}
