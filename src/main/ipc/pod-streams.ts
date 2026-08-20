import type { BrowserWindow, IpcMain } from "electron"
import { PassThrough } from "stream"
import { Exec, KubeConfig, Log } from "@kubernetes/client-node"

type ExecWebSocket = { terminate(): void }

/**
 * The subset of the pod log API the panel drives. `null` for `tailLines` or
 * `sinceSeconds` means "no limit": the query parameter is left off, which is
 * how the API server spells "all of it".
 */
export interface PodLogOptions {
  follow?: boolean
  previous?: boolean
  timestamps?: boolean
  tailLines?: number | null
  sinceSeconds?: number | null
}

/** The query options one read sends. Written out rather than inlined at the
 *  call so the mapping — in particular "no limit means omit the parameter" —
 *  can be checked without a cluster. */
export function toLogQueryOptions(options: PodLogOptions | undefined): {
  follow: boolean
  previous: boolean
  timestamps: boolean
  tailLines?: number
  sinceSeconds?: number
} {
  const opts = options ?? {}
  return {
    // A terminated container's log is a finished blob: the server writes it and
    // closes, so following it only holds a dead request open.
    follow: opts.previous ? false : (opts.follow ?? true),
    previous: opts.previous ?? false,
    timestamps: opts.timestamps ?? false,
    ...(opts.tailLines != null ? { tailLines: opts.tailLines } : {}),
    ...(opts.sinceSeconds != null ? { sinceSeconds: opts.sinceSeconds } : {}),
  }
}

/** Chunk boundaries land mid-line, so the trailing fragment is held back until
 *  its newline arrives rather than emitted as if it were a whole line. */
export function createLineSplitter(emit: (line: string) => void): {
  push: (text: string) => void
  flush: () => void
} {
  let carry = ""
  return {
    push: (text: string): void => {
      const parts = (carry + text).split("\n")
      carry = parts.pop() ?? ""
      for (const line of parts) {
        if (line) emit(line)
      }
    },
    flush: (): void => {
      if (carry) {
        emit(carry)
        carry = ""
      }
    },
  }
}

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
        options,
      }: {
        namespace: string
        podName: string
        containerName?: string
        tabKey?: string
        options?: PodLogOptions
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

      const emit = (line: string): void => {
        getMainWindow()?.webContents.send("k8s:pod:log:data", {
          tabKey: emitKey,
          line,
        })
      }

      const splitter = createLineSplitter(emit)
      logStream.on("data", (chunk: Buffer) => splitter.push(chunk.toString()))

      // Reached only when the stream was not aborted, i.e. a non-following read
      // ran out of log. The panel uses it to drop out of its streaming state.
      logStream.on("end", () => {
        splitter.flush()
        activeLogRequests.delete(storageKey)
        getMainWindow()?.webContents.send("k8s:pod:log:end", {
          tabKey: emitKey,
        })
      })

      const req = await log.log(
        namespace,
        podName,
        containerName ?? "",
        logStream,
        (err) => {
          if (err) console.error("Log stream ended:", err)
        },
        toLogQueryOptions(options),
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
