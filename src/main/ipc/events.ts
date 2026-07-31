import { BrowserWindow, IpcMain } from "electron"
import { KubeConfig, Watch } from "@kubernetes/client-node"

import { listEvents, listEventsForResource } from "../k8s-handlers"
import { GetContextClients } from "./context-clients"

export function registerEventsHandlers(
  ipcMain: IpcMain,
  kc: KubeConfig,
  getContextClients: GetContextClients,
  getMainWindow: () => BrowserWindow | null,
): void {
  let activeEventsWatch: { abort: () => void } | null = null

  ipcMain.handle(
    "k8s:events:list",
    (_e, args?: { contextName?: string; namespace?: string }) =>
      listEvents(getContextClients(args?.contextName).coreV1, args?.namespace),
  )

  ipcMain.handle(
    "k8s:events:for-resource",
    (
      _e,
      args: {
        contextName?: string
        namespace: string
        name: string
        kind: string
      },
    ) =>
      listEventsForResource(
        getContextClients(args.contextName).coreV1,
        args.namespace,
        args.name,
        args.kind,
      ),
  )

  ipcMain.handle("k8s:events:watch:start", async () => {
    if (activeEventsWatch) {
      activeEventsWatch.abort()
      activeEventsWatch = null
    }
    const watch = new Watch(kc)
    const req = await watch.watch(
      "/api/v1/events",
      {},
      (_type: string, apiObj: unknown) => {
        if (!apiObj) return
        const ev = apiObj as Record<string, unknown>
        const meta = (ev.metadata ?? {}) as Record<string, unknown>
        const involvedObject = (ev.involvedObject ?? {}) as Record<
          string,
          unknown
        >
        const event = {
          name: (meta.name as string) ?? "",
          namespace: (meta.namespace as string) ?? "",
          type: (ev.type as string) ?? "Normal",
          reason: (ev.reason as string) ?? "",
          involvedObjectKind: (involvedObject.kind as string) ?? "",
          involvedObjectName: (involvedObject.name as string) ?? "",
          message: (ev.message as string) ?? "",
          count: (ev.count as number) ?? 1,
          firstTimestamp: (ev.firstTimestamp as string) ?? "",
          lastTimestamp:
            (ev.lastTimestamp as string) ?? (ev.eventTime as string) ?? "",
          creationTimestamp: (meta.creationTimestamp as string) ?? "",
        }
        getMainWindow()?.webContents.send("k8s:events:data", event)
      },
      (err) => {
        if (err) console.error("Events watch ended:", err)
      },
    )
    activeEventsWatch = { abort: () => req.abort() }
    return { success: true }
  })

  ipcMain.handle("k8s:events:watch:stop", () => {
    if (activeEventsWatch) {
      activeEventsWatch.abort()
      activeEventsWatch = null
    }
    return { success: true }
  })
}
