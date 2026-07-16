import { IpcMain } from "electron"
import { KubeConfig } from "@kubernetes/client-node"

import { applyResource, readResource, replaceResource } from "../k8s-handlers"

export function registerApplyHandlers(ipcMain: IpcMain, kc: KubeConfig): void {
  ipcMain.handle("k8s:resource:apply", (_e, yaml: string) =>
    applyResource(kc, yaml),
  )
  ipcMain.handle("k8s:resource:replace", (_e, yaml: string) =>
    replaceResource(kc, yaml),
  )
  ipcMain.handle(
    "k8s:resource:read",
    (_e, apiVersion: string, kind: string, name: string, namespace?: string) =>
      readResource(kc, apiVersion, kind, name, namespace),
  )
}
