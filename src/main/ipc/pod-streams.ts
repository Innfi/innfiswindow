import { BrowserWindow, IpcMain } from "electron"
import { PassThrough } from "stream"
import { Exec, KubeConfig, Log } from "@kubernetes/client-node"

type ExecWebSocket = { terminate(): void }

export function registerPodStreamHandlers(
  ipcMain: IpcMain,
  kc: KubeConfig,
  getMainWindow: () => BrowserWindow | null,
): void {
  const activeLogRequests = new Map<string, { abort: () => void }>()
  const activeExecSessions = new Map<
    string,
    { ws: ExecWebSocket; stdinStream: PassThrough }
  >()

  ipcMain.handle(
    "k8s:pod:log:start",
    async (
      _e,
      {
        namespace,
        podName,
        containerName,
        tabKey,
      }: {
        namespace: string
        podName: string
        containerName?: string
        tabKey?: string
      },
    ) => {
      const defaultKey = `${namespace}/${podName}`
      const storageKey = tabKey ?? defaultKey
      if (activeLogRequests.has(storageKey)) {
        activeLogRequests.get(storageKey)!.abort()
        activeLogRequests.delete(storageKey)
      }

      const log = new Log(kc)
      const logStream = new PassThrough()
      const emitKey = storageKey

      logStream.on("data", (chunk: Buffer) => {
        const text = chunk.toString()
        const lines = text.split("\n")
        for (const line of lines) {
          if (line) {
            getMainWindow()?.webContents.send("k8s:pod:log:data", {
              tabKey: emitKey,
              line,
            })
          }
        }
      })

      const req = await log.log(
        namespace,
        podName,
        containerName ?? "",
        logStream,
        (err) => {
          if (err) console.error("Log stream ended:", err)
        },
        { follow: true, tailLines: 200 },
      )

      activeLogRequests.set(storageKey, { abort: () => req.abort() })
      return { success: true }
    },
  )

  ipcMain.handle(
    "k8s:pod:log:stop",
    (_e, { namespace, podName }: { namespace: string; podName: string }) => {
      const key = `${namespace}/${podName}`
      if (activeLogRequests.has(key)) {
        activeLogRequests.get(key)!.abort()
        activeLogRequests.delete(key)
      }
      return { success: true }
    },
  )

  ipcMain.handle(
    "k8s:pod:log:stop:session",
    (_e, { sessionId }: { sessionId: string }) => {
      if (activeLogRequests.has(sessionId)) {
        activeLogRequests.get(sessionId)!.abort()
        activeLogRequests.delete(sessionId)
      }
      return { success: true }
    },
  )

  ipcMain.handle(
    "k8s:pod:exec",
    async (
      _e,
      {
        sessionId,
        namespace,
        podName,
        containerName,
      }: {
        sessionId: string
        namespace: string
        podName: string
        containerName: string
      },
    ) => {
      const stdinStream = new PassThrough()
      const stdoutStream = new PassThrough()
      const stderrStream = new PassThrough()

      stdoutStream.on("data", (chunk: Buffer) => {
        getMainWindow()?.webContents.send("k8s:pod:exec:output", {
          sessionId,
          data: chunk.toString("binary"),
        })
      })
      stderrStream.on("data", (chunk: Buffer) => {
        getMainWindow()?.webContents.send("k8s:pod:exec:output", {
          sessionId,
          data: chunk.toString("binary"),
        })
      })

      const exec = new Exec(kc)
      const ws = await exec.exec(
        namespace,
        podName,
        containerName,
        ["/bin/sh"],
        stdoutStream,
        stderrStream,
        stdinStream,
        true,
        (status) => {
          if (status?.status === "Failure") {
            console.error("Exec failed:", status.message)
          }
        },
      )

      activeExecSessions.set(sessionId, {
        ws: ws as ExecWebSocket,
        stdinStream,
      })
      return { success: true }
    },
  )

  ipcMain.on(
    "k8s:pod:exec:input",
    (_e, { sessionId, data }: { sessionId: string; data: string }) => {
      const session = activeExecSessions.get(sessionId)
      if (session) {
        session.stdinStream.write(data)
      }
    },
  )

  ipcMain.on(
    "k8s:pod:exec:close",
    (_e, { sessionId }: { sessionId: string }) => {
      const session = activeExecSessions.get(sessionId)
      if (session) {
        try {
          session.ws.terminate()
        } catch (_err) {
          // ignore
        }
        session.stdinStream.end()
        activeExecSessions.delete(sessionId)
      }
    },
  )
}
