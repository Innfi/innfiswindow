import { IpcMain } from "electron"

import { evaluateAlarmRule } from "../handlers/alarm"
import { GetContextClients } from "./context-clients"

export function registerAlarmHandlers(
  ipcMain: IpcMain,
  getContextClients: GetContextClients,
): void {
  ipcMain.handle(
    "alarm:evaluate",
    (
      _e,
      {
        rule,
      }: {
        rule: {
          id: string
          name: string
          severity: "critical" | "warning" | "info"
          conditionType:
            | "pod-not-running"
            | "deployment-unavailable"
            | "warning-event"
            | "node-not-ready"
          context: string
          namespace?: string
          resourceNameFilter?: string
        }
      },
    ) => {
      const clients = getContextClients(rule.context)
      return evaluateAlarmRule(rule, clients.coreV1, clients.appsV1)
    },
  )
}
