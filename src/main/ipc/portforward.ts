import { IpcMain } from "electron"
import { createServer, Server } from "net"
import { CoreV1Api, KubeConfig, PortForward } from "@kubernetes/client-node"

export function registerPortForwardHandlers(
  ipcMain: IpcMain,
  kc: KubeConfig,
  coreV1Api: CoreV1Api,
): void {
  const activePortForwardSessions = new Map<string, { server: Server }>()

  ipcMain.handle(
    "portforward:start",
    async (
      _e,
      {
        resourceKind,
        namespace,
        name,
        localPort,
        targetPort,
        sessionId,
      }: {
        resourceKind: "Pod" | "Service"
        namespace: string
        name: string
        localPort: number
        targetPort: number
        sessionId: string
      },
    ) => {
      try {
        // Clean up any existing session
        const existing = activePortForwardSessions.get(sessionId)
        if (existing) {
          existing.server.close()
          activePortForwardSessions.delete(sessionId)
        }

        let podName = name

        // For Service, resolve to a backing pod via endpoints
        if (resourceKind === "Service") {
          const ep = await coreV1Api.readNamespacedEndpoints({
            name,
            namespace,
          })
          const addr = ep.subsets?.[0]?.addresses?.[0]
          if (!addr?.targetRef?.name) {
            return {
              success: false,
              error: "No ready pods found for service",
            }
          }
          podName = addr.targetRef.name
          namespace = addr.targetRef.namespace ?? namespace
        }

        const forward = new PortForward(kc)
        const resolvedPodName = podName
        const resolvedNamespace = namespace
        const server = createServer(async (socket) => {
          try {
            await forward.portForward(
              resolvedNamespace,
              resolvedPodName,
              [targetPort],
              socket,
              null,
              socket,
            )
          } catch (err) {
            socket.destroy()
          }
        })

        await new Promise<void>((resolve, reject) => {
          server.listen(localPort, "127.0.0.1", () => resolve())
          server.on("error", reject)
        })

        activePortForwardSessions.set(sessionId, { server })
        return { success: true }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    },
  )

  ipcMain.handle(
    "portforward:stop",
    (_e, { sessionId }: { sessionId: string }) => {
      const session = activePortForwardSessions.get(sessionId)
      if (session) {
        session.server.close()
        activePortForwardSessions.delete(sessionId)
      }
      return { success: true }
    },
  )
}
