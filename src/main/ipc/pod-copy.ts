import type { BrowserWindow, IpcMain } from "electron"
import { statSync } from "fs"
import { basename, dirname } from "path"
import { PassThrough, Readable, Writable } from "stream"
import * as tar from "tar-fs"
import { Exec, KubeConfig, V1Status } from "@kubernetes/client-node"

import { PodCopyRequest, PodCopyResult } from "../handlers/types"
import { GetKubeConfig } from "./context-clients"

/** How often a running copy reports its byte count to the renderer. */
const PROGRESS_INTERVAL_MS = 250

interface ExecTarget {
  namespace: string
  podName: string
  containerName: string
}

/** Splits a container path the way `tar -C <dir> <base>` needs it. Container
 *  paths are POSIX whatever this machine runs, so `path.posix` rules apply
 *  rather than the host's: a backslash is a legal character in a Linux file
 *  name, not a separator. A path with no slash is relative to the container's
 *  working directory, which `tar` resolves on its own. */
export function splitRemotePath(remotePath: string): {
  dir: string
  base: string
} {
  const trimmed = remotePath.trim().replace(/\/+$/, "")
  if (trimmed === "" || trimmed === "/") {
    throw new Error(
      "Give a path to a file or directory inside the container, not the root.",
    )
  }
  const cut = trimmed.lastIndexOf("/")
  if (cut === -1) return { dir: ".", base: trimmed }
  return {
    dir: cut === 0 ? "/" : trimmed.slice(0, cut),
    base: trimmed.slice(cut + 1),
  }
}

/** `kubectl cp` out of a pod: tar the path up inside the container and read the
 *  archive off stdout. `-C` keeps the archive rooted at the entry itself, so
 *  extracting it locally recreates `<localDir>/<base>` rather than the whole
 *  path from `/`. */
export function copyFromPodCommand(remotePath: string): string[] {
  const { dir, base } = splitRemotePath(remotePath)
  return ["tar", "cf", "-", "-C", dir, base]
}

/** …and into a pod: extract the archive this side writes to stdin. `-m` drops
 *  the archived mtimes, which a container clock skewed from this machine's
 *  otherwise turns into "file is in the future" warnings. */
export function copyToPodCommand(remoteDir: string): string[] {
  const dir = remoteDir.trim().replace(/(?!^)\/+$/, "")
  if (dir === "") {
    throw new Error("Give a destination directory inside the container.")
  }
  return ["tar", "xmf", "-", "-C", dir]
}

/** Counts what passes through, so a copy can report progress. */
function countingStream(onBytes: (total: number) => void): PassThrough {
  const stream = new PassThrough()
  let total = 0
  stream.on("data", (chunk: Buffer) => {
    total += chunk.length
    onBytes(total)
  })
  return stream
}

function describeTarFailure(
  status: V1Status | undefined,
  stderr: string,
  command: string[],
): string {
  const detail = stderr.trim() || status?.message || "no output"
  if (
    /not found|no such file or directory.*exec|executable file not found/i.test(
      detail,
    )
  ) {
    return `\`${command[0]}\` is not available in this container, so the file cannot be copied. ${detail}`
  }
  return detail
}

/**
 * Runs one `tar` inside a container and settles when the API server reports the
 * command's exit status. The exec channel carries stdout, stderr and the status
 * separately, so a tar stream on stdout stays intact while errors arrive out of
 * band.
 */
async function execTar(
  kc: KubeConfig,
  target: ExecTarget,
  command: string[],
  stdout: Writable | null,
  stdin: Readable | null,
): Promise<void> {
  const exec = new Exec(kc)
  const stderrStream = new PassThrough()
  let stderrText = ""
  stderrStream.on("data", (chunk: Buffer) => {
    // Bounded: a tar that fails per file can produce a lot of these.
    if (stderrText.length < 8192) stderrText += chunk.toString()
  })

  let settle!: (err?: Error) => void
  const finished = new Promise<void>((resolve, reject) => {
    settle = (err?: Error) => (err ? reject(err) : resolve())
  })

  let sawStatus = false
  const conn = await exec.exec(
    target.namespace,
    target.podName,
    target.containerName,
    command,
    stdout,
    stderrStream,
    stdin,
    false,
    (status) => {
      sawStatus = true
      if (status?.status === "Failure") {
        settle(new Error(describeTarFailure(status, stderrText, command)))
      } else {
        settle()
      }
    },
  )

  // The status frame is the only success signal; a socket that drops before it
  // arrives would otherwise leave the copy pending forever.
  const socket = conn as unknown as {
    protocol?: string
    on?: (event: string, cb: (arg?: unknown) => void) => void
  }
  socket.on?.("close", () => {
    if (sawStatus) return
    // Only the v5 channel protocol can half-close stdin: on anything older the
    // client closes the whole socket when the upload's stdin ends, and the
    // server never gets to send its status frame. That close is the end of a
    // successful upload as often as not, so it is not reported as a failure.
    if (stdin && socket.protocol !== "v5.channel.k8s.io") {
      settle()
      return
    }
    settle(
      new Error(
        `The exec connection to ${target.namespace}/${target.podName} closed before the copy finished. ${stderrText.trim()}`.trim(),
      ),
    )
  })
  socket.on?.("error", (err?: unknown) => {
    settle(err instanceof Error ? err : new Error(String(err)))
  })

  await finished
}

/** Copies a file or directory out of a container into `localDir`, keeping its
 *  name. Returns the size of the tar stream, not of the payload. */
export async function copyFromPod(
  kc: KubeConfig,
  request: PodCopyRequest,
  onProgress: (bytes: number) => void,
): Promise<PodCopyResult> {
  const localDir = request.localPath
  const stat = statSync(localDir, { throwIfNoEntry: false })
  if (!stat?.isDirectory()) {
    throw new Error(`${localDir} is not a directory on this machine.`)
  }

  const command = copyFromPodCommand(request.remotePath)
  let bytes = 0
  const counter = countingStream((total) => {
    bytes = total
    onProgress(total)
  })
  const extract = tar.extract(localDir)
  const extracted = new Promise<void>((resolve, reject) => {
    extract.on("finish", resolve)
    extract.on("error", reject)
  })
  // A tar that fails inside the container throws out of `execTar` below before
  // this is awaited; the no-op keeps that rejection from surfacing as an
  // unhandled one, without swallowing it for the await further down.
  extracted.catch(() => {})
  counter.pipe(extract)

  await execTar(
    kc,
    {
      namespace: request.namespace,
      podName: request.podName,
      containerName: request.containerName,
    },
    command,
    counter,
    null,
  )
  await extracted

  if (bytes === 0) {
    throw new Error(
      `Nothing was copied — ${request.remotePath} is empty or does not exist in the container.`,
    )
  }
  return { success: true, bytes }
}

/** Copies a local file or directory into `remotePath`, which is a directory
 *  inside the container: the entry keeps its local name, the way
 *  `kubectl cp ./x pod:/dir/` behaves. */
export async function copyToPod(
  kc: KubeConfig,
  request: PodCopyRequest,
  onProgress: (bytes: number) => void,
): Promise<PodCopyResult> {
  const stat = statSync(request.localPath, { throwIfNoEntry: false })
  if (!stat) {
    throw new Error(`${request.localPath} does not exist on this machine.`)
  }

  const command = copyToPodCommand(request.remotePath)
  // Packing the parent with a single entry keeps the entry's own name at the
  // root of the archive, so a directory lands as `<remoteDir>/<name>` instead
  // of having its contents strewn across the destination.
  const pack = tar.pack(dirname(request.localPath), {
    entries: [basename(request.localPath)],
  })
  let bytes = 0
  const counter = countingStream((total) => {
    bytes = total
    onProgress(total)
  })
  pack.pipe(counter)

  await execTar(
    kc,
    {
      namespace: request.namespace,
      podName: request.podName,
      containerName: request.containerName,
    },
    command,
    null,
    counter,
  )
  return { success: true, bytes }
}

export function registerPodCopyHandlers(
  ipcMain: IpcMain,
  getKubeConfig: GetKubeConfig,
  getMainWindow: () => BrowserWindow | null,
): void {
  const progressReporter = (transferId: string): ((bytes: number) => void) => {
    let lastSent = 0
    return (bytes: number) => {
      const now = Date.now()
      if (now - lastSent < PROGRESS_INTERVAL_MS) return
      lastSent = now
      getMainWindow()?.webContents.send("k8s:pod:copy:progress", {
        transferId,
        bytes,
      })
    }
  }

  ipcMain.handle(
    "k8s:pod:copy:from",
    (_e, args: PodCopyRequest & { contextName?: string; transferId: string }) =>
      copyFromPod(
        getKubeConfig(args.contextName),
        args,
        progressReporter(args.transferId),
      ),
  )

  ipcMain.handle(
    "k8s:pod:copy:to",
    (_e, args: PodCopyRequest & { contextName?: string; transferId: string }) =>
      copyToPod(
        getKubeConfig(args.contextName),
        args,
        progressReporter(args.transferId),
      ),
  )
}
