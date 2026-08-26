import { IpcMain } from "electron"

import { HPAResourceMetricSpec } from "../handlers/types"
import {
  getHPA,
  listHPAs,
  updateHPAMetrics,
  updateHPAReplicas,
} from "../k8s-handlers"
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
  ipcMain.handle(
    "k8s:hpa:get",
    (_e, args: { contextName?: string; namespace: string; name: string }) =>
      getHPA(
        getContextClients(args.contextName).autoscalingV2,
        args.namespace,
        args.name,
      ),
  )
  ipcMain.handle(
    "k8s:hpa:replicas:update",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        minReplicas: number
        maxReplicas: number
      },
    ) =>
      updateHPAReplicas(
        getContextClients(args.contextName).autoscalingV2,
        args.namespace,
        args.name,
        { minReplicas: args.minReplicas, maxReplicas: args.maxReplicas },
      ),
  )
  ipcMain.handle(
    "k8s:hpa:metrics:update",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        metrics: HPAResourceMetricSpec[]
      },
    ) =>
      updateHPAMetrics(
        getContextClients(args.contextName).autoscalingV2,
        args.namespace,
        args.name,
        args.metrics,
      ),
  )
}
