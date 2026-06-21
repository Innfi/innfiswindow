import { IpcMain } from "electron"

import {
  checkPrometheusConnectivity,
  getPodMetrics,
  getPrometheusConfig,
  setPrometheusConfig,
} from "../prometheus-handlers"

export function registerPrometheusHandlers(ipcMain: IpcMain): void {
  ipcMain.handle("prometheus:connectivity:check", () =>
    checkPrometheusConnectivity(),
  )
  ipcMain.handle("prometheus:config:get", () => getPrometheusConfig())
  ipcMain.handle(
    "prometheus:config:set",
    (_e, config: { namespace: string; service: string; port: number }) =>
      setPrometheusConfig(config),
  )
  ipcMain.handle(
    "prometheus:pod:metrics",
    (
      _e,
      {
        namespace,
        podName,
        step,
        rangeMinutes,
      }: {
        namespace: string
        podName: string
        step?: number
        rangeMinutes?: number
      },
    ) => getPodMetrics(namespace, podName, step, rangeMinutes),
  )
}
