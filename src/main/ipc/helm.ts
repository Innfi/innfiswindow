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
  ipcMain.handle("helm:release:list", (_e, args?: { namespace?: string }) =>
    helmReleaseList(args?.namespace),
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
      },
    ) =>
      helmReleaseInstall(
        args.releaseName,
        args.chart,
        args.namespace,
        args.values,
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
      },
    ) =>
      helmReleaseUpgrade(
        args.releaseName,
        args.chart,
        args.namespace,
        args.values,
      ),
  )
  ipcMain.handle(
    "helm:release:uninstall",
    (_e, args: { releaseName: string; namespace: string }) =>
      helmReleaseUninstall(args.releaseName, args.namespace),
  )
}
