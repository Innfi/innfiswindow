import { IpcMain } from "electron"

import { RelationTarget } from "../handlers/references"
import { getResourceRelations } from "../k8s-handlers"
import { GetContextClients, GetKubeConfig } from "./context-clients"

export function registerReferenceHandlers(
  ipcMain: IpcMain,
  getKubeConfig: GetKubeConfig,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:references:get",
    (_e, args: { contextName?: string } & RelationTarget) =>
      getResourceRelations(
        getKubeConfig(args.contextName),
        getContextClients(args.contextName),
        {
          apiVersion: args.apiVersion,
          kind: args.kind,
          name: args.name,
          namespace: args.namespace,
        },
      ),
  )
}
