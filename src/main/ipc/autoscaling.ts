import { IpcMain } from "electron"

import { listHPAs } from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerAutoscalingHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "k8s:hpas:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listHPAs(
        getContextClients(args?.contextName).autoscalingV2,
        args?.namespace,
      ),
  )
}
