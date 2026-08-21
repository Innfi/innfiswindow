import { IpcMain } from "electron"

import { DeleteResourceOptions } from "../handlers/types"
import {
  applyResource,
  deleteResource,
  dryRunResource,
  readResource,
  replaceResource,
} from "../k8s-handlers"
import { GetKubeConfig } from "./context-clients"

export function registerApplyHandlers(
  ipcMain: IpcMain,
  getKubeConfig: GetKubeConfig,
): void {
  ipcMain.handle("k8s:resource:apply", (_e, yaml: string) =>
    applyResource(getKubeConfig(), yaml),
  )
  ipcMain.handle("k8s:resource:dryRun", (_e, yaml: string) =>
    dryRunResource(getKubeConfig(), yaml),
  )
  ipcMain.handle("k8s:resource:replace", (_e, yaml: string) =>
    replaceResource(getKubeConfig(), yaml),
  )
  ipcMain.handle(
    "k8s:resource:read",
    (_e, apiVersion: string, kind: string, name: string, namespace?: string) =>
      readResource(getKubeConfig(), apiVersion, kind, name, namespace),
  )
  ipcMain.handle(
    "k8s:resource:delete",
    (
      _e,
      args: {
        apiVersion: string
        kind: string
        name: string
        namespace?: string
        contextName?: string
        options?: DeleteResourceOptions
      },
    ) =>
      deleteResource(
        getKubeConfig(args.contextName),
        args.apiVersion,
        args.kind,
        args.name,
        args.namespace,
        args.options,
      ),
  )
}
