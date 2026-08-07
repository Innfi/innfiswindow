import { IpcMain } from "electron"

import { listEvents, listEventsForResource } from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerEventsHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:events:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listEvents(getContextClients(args?.contextName).coreV1, args?.namespace),
  )

  ipcMain.handle(
    "k8s:events:for-resource",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        kind: string
      },
    ) =>
      listEventsForResource(
        getContextClients(args.contextName).coreV1,
        args.namespace,
        args.name,
        args.kind,
      ),
  )
}
