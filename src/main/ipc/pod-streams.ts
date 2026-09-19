import { type BrowserWindow, dialog, type IpcMain } from "electron"
import { once } from "events"
import { createWriteStream } from "fs"
import { rm } from "fs/promises"
import { PassThrough, Writable } from "stream"
import { Exec, Log } from "@kubernetes/client-node"

import { GetKubeConfig } from "./context-clients"

type ExecWebSocket = { terminate(): void }

/**
 * The subset of the pod log API the panel drives. `null` for `tailLines`,
 * `sinceSeconds` or `sinceTime` means "no limit": the query parameter is left
 * off, which is how the API server spells "all of it".
 */
export interface PodLogOptions {
  follow?: boolean
  previous?: boolean
  timestamps?: boolean
  tailLines?: number | null
  sinceSeconds?: number | null
  /** An absolute cutoff, as anything `Date.parse` reads. Wins over
   *  `sinceSeconds`: the API server takes one or the other, never both. */
  sinceTime?: string | null
}

/** The API server parses `sinceTime` as RFC 3339; this normalises anything
 *  `Date.parse` reads to UTC at whole seconds, and refuses what it can't read
 *  here rather than letting it come back as a 400 on every restart. */
export function toRfc3339Seconds(value: string): string {
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) throw new Error(`Invalid log start time: ${value}`)
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")
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
  sinceTime?: string
} {
  const opts = options ?? {}
  const sinceTime =
    opts.sinceTime != null ? toRfc3339Seconds(opts.sinceTime) : undefined
  return {
    // A terminated container's log is a finished blob: the server writes it and
    // closes, so following it only holds a dead request open.
    follow: opts.previous ? false : (opts.follow ?? true),
    previous: opts.previous ?? false,
    timestamps: opts.timestamps ?? false,
    ...(opts.tailLines != null ? { tailLines: opts.tailLines } : {}),
    ...(sinceTime !== undefined
      ? { sinceTime }
      : opts.sinceSeconds != null
        ? { sinceSeconds: opts.sinceSeconds }
        : {}),
  }
}

/**
 * Writes each container's log to `out` in turn and ends it, resolving to the
 * bytes written. With more than one container each gets a `==> name <==`
 * header, the way `tail` labels several files — a bulk read has no arrival
 * order worth interleaving by. `read` starts one container's read into the
 * sink it is handed and resolves once the response is streaming (rejecting on
 * an error status); the sink ending is what marks that container done.
 */
export async function writeContainerLogs(
  containers: string[],
  read: (container: string, sink: Writable) => Promise<unknown>,
  out: Writable,
): Promise<number> {
  // A write error (disk full, permissions) is emitted rather than thrown, and
  // an unhandled one would take the main process down with it.
  let failure: unknown = null
  out.on("error", (err) => {
    failure = err
  })
  let bytes = 0
  const put = async (chunk: Buffer): Promise<void> => {
    if (failure) throw failure
    bytes += chunk.length
    if (!out.write(chunk)) await once(out, "drain")
  }
  for (const [i, container] of containers.entries()) {
    if (containers.length > 1) {
      await put(Buffer.from(`${i > 0 ? "\n" : ""}==> ${container} <==\n`))
    }
    const sink = new PassThrough()
    await read(container, sink)
    for await (const chunk of sink) await put(chunk as Buffer)
  }
  if (failure) throw failure
  out.end()
  await once(out, "finish")
  return bytes
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
  getKubeConfig: GetKubeConfig,
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
        contextName,
        namespace,
        podName,
        containerName,
        tabKey,
        options,
      }: {
        contextName?: string
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

      // The tab carries the context it was opened against, so a log started
      // before a context switch keeps reading the cluster it was opened on.
      const log = new Log(getKubeConfig(contextName))
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

  // A one-off read of the whole log (not the panel's capped buffer) straight to
  // a file: the dialog runs here, so the only path written to is one the user
  // picked, and the lines never cross IPC.
  ipcMain.handle(
    "k8s:pod:log:save",
    async (
      _e,
      {
        contextName,
        namespace,
        podName,
        containers,
        options,
      }: {
        contextName?: string
        namespace: string
        podName: string
        containers: string[]
        options?: PodLogOptions
      },
    ): Promise<{ path: string | null; bytes?: number }> => {
      if (containers.length === 0) {
        throw new Error("No container to save the log of")
      }
      const query = toLogQueryOptions({ ...options, follow: false })
      const suffix = containers.length === 1 ? `-${containers[0]}` : ""
      const dialogOptions: Electron.SaveDialogOptions = {
        title: "Save log",
        defaultPath: `${podName}${suffix}${options?.previous ? "-previous" : ""}.log`,
        filters: [
          { name: "Log files", extensions: ["log", "txt"] },
          { name: "All files", extensions: ["*"] },
        ],
      }
      const parent = getMainWindow()
      const picked = parent
        ? await dialog.showSaveDialog(parent, dialogOptions)
        : await dialog.showSaveDialog(dialogOptions)
      if (picked.canceled || !picked.filePath) return { path: null }

      const log = new Log(getKubeConfig(contextName))
      const out = createWriteStream(picked.filePath)
      try {
        const bytes = await writeContainerLogs(
          containers,
          (container, sink) =>
            log.log(namespace, podName, container, sink, query),
          out,
        )
        return { path: picked.filePath, bytes }
      } catch (err) {
        // Half a log reads as the whole of it, so none is left behind.
        out.destroy()
        await rm(picked.filePath, { force: true }).catch(() => {})
        throw err
      }
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
        contextName,
        sessionId,
        namespace,
        podName,
        containerName,
      }: {
        contextName?: string
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

      const exec = new Exec(getKubeConfig(contextName))
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
