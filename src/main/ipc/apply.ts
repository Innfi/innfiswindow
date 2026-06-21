import { IpcMain } from "electron"
import { KubeConfig } from "@kubernetes/client-node"

import { applyResource } from "../k8s-handlers"

export function registerApplyHandlers(ipcMain: IpcMain, kc: KubeConfig): void {
  ipcMain.handle("k8s:resource:apply", (_e, yaml: string) =>
    applyResource(kc, yaml),
  )
}
