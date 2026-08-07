import { IpcMain } from "electron"

import {
  helmReleaseInstall,
  helmReleaseList,
  helmReleaseUninstall,
  helmReleaseUpgrade,
  helmRepoAdd,
  helmRepoList,
} from "../handlers/helm"

export function registerHelmHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("helm:repo:add", (_e, args: { name: string; url: string }) =>
    helmRepoAdd(args.name, args.url),
  )
  ipcMain.handle("helm:repo:list", () => helmRepoList())
  ipcMain.handle(
    "helm:release:list",
    (_e, args?: { namespace?: string; contextName?: string }) =>
      helmReleaseList(args?.namespace, args?.contextName),
  )
  ipcMain.handle(
    "helm:release:install",
    (
      _e,
      args: {
        releaseName: string
        chart: string
        namespace: string
        values?: string
        contextName?: string
      },
    ) =>
      helmReleaseInstall(
        args.releaseName,
        args.chart,
        args.namespace,
        args.values,
        args.contextName,
      ),
  )
  ipcMain.handle(
    "helm:release:upgrade",
    (
      _e,
      args: {
        releaseName: string
        chart: string
        namespace: string
        values?: string
        contextName?: string
      },
    ) =>
      helmReleaseUpgrade(
        args.releaseName,
        args.chart,
        args.namespace,
        args.values,
        args.contextName,
      ),
  )
  ipcMain.handle(
    "helm:release:uninstall",
    (
      _e,
      args: { releaseName: string; namespace: string; contextName?: string },
    ) =>
      helmReleaseUninstall(args.releaseName, args.namespace, args.contextName),
  )
}
