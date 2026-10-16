import {
  checkPrometheusConnectivity,
  getPodMetrics,
  getPrometheusConfig,
  setPrometheusConfig,
} from "../prometheus-handlers"
import { GetKubeConfig } from "./context-clients"

export function registerPrometheusHandlers(
  ipcMain: TypedIpcMain,
  getKubeConfig: GetKubeConfig,
): void {
  ipcMain.handle("prometheus:connectivity:check", (_e, args) =>
    checkPrometheusConnectivity(
      getKubeConfig(args?.contextName),
      args?.contextName,
    ),
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
        contextName,
        namespace,
        podName,
        step,
        rangeMinutes,
      }: {
        contextName?: string
        namespace: string
        podName: string
        step?: number
        rangeMinutes?: number
      },
    ) =>
      getPodMetrics(
        getKubeConfig(contextName),
        contextName,
        namespace,
        podName,
        step,
        rangeMinutes,
      ),
  )
}
import { TypedIpcMain } from "./typed-ipc"
