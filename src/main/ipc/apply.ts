import { IpcMain } from "electron"

import { DeleteResourceOptions } from "../handlers/types"
import {
  applyResource,
  deleteResource,
  dryRunReplaceResource,
  dryRunResource,
  readResource,
  replaceResource,
} from "../k8s-handlers"
import { GetKubeConfig } from "./context-clients"

export function registerApplyHandlers(
  ipcMain: IpcMain,
  getKubeConfig: GetKubeConfig,
): void {
  ipcMain.handle(
    "k8s:resource:apply",
    (_e, args: { yaml: string; contextName?: string }) =>
      applyResource(getKubeConfig(args.contextName), args.yaml),
  )
  ipcMain.handle(
    "k8s:resource:dryRun",
    (_e, args: { yaml: string; contextName?: string }) =>
      dryRunResource(getKubeConfig(args.contextName), args.yaml),
  )
  ipcMain.handle(
    "k8s:resource:replace",
    (
      _e,
      args: { yaml: string; resourceVersion?: string; contextName?: string },
    ) =>
      replaceResource(
        getKubeConfig(args.contextName),
        args.yaml,
        args.resourceVersion,
      ),
  )
  ipcMain.handle(
    "k8s:resource:replace:dryRun",
    (
      _e,
      args: { yaml: string; resourceVersion?: string; contextName?: string },
    ) =>
      dryRunReplaceResource(
        getKubeConfig(args.contextName),
        args.yaml,
        args.resourceVersion,
      ),
  )
  ipcMain.handle(
    "k8s:resource:read",
    (
      _e,
      args: {
        apiVersion: string
        kind: string
        name: string
        namespace?: string
        contextName?: string
      },
    ) =>
      readResource(
        getKubeConfig(args.contextName),
        args.apiVersion,
        args.kind,
        args.name,
        args.namespace,
      ),
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
