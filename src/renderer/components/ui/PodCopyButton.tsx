import { FolderInput } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { normalizeIpcError } from "../../lib/ipc-error"
import { useRecordHistory } from "../../src/hooks/useRecordHistory"
import { useAppStore } from "../../store/app.store"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./AlertDialog"
import { Button } from "./Button"
import { Input } from "./Input"
import { Label } from "./Label"

type Direction = "to" | "from"

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${bytes} B`
}

interface PodCopyButtonProps {
  podName: string
  namespace: string
  /** Every container a copy can run in, debug containers included. */
  containers: { name: string }[]
  /** Which one the panel is currently pointed at. */
  defaultContainer: string
  /** Pauses list polling while the dialog is open. */
  onDialogChange: (open: boolean) => void
  className?: string
}

/**
 * `kubectl cp` in both directions. Both run `tar` inside the container over the
 * exec channel — the only transport the API server offers — so the container
 * image must have `tar` on its PATH, and the copied entry always keeps its own
 * name: the other side of a copy is a directory, never a new file name.
 */
export function PodCopyButton({
  podName,
  namespace,
  containers,
  defaultContainer,
  onDialogChange,
  className,
}: PodCopyButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<Direction>("from")
  const [container, setContainer] = useState(defaultContainer)
  const [localPath, setLocalPath] = useState("")
  const [remotePath, setRemotePath] = useState("")
  const [copying, setCopying] = useState(false)
  const [bytes, setBytes] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // The copy in flight. Progress for any other one belongs to another dialog.
  const transferId = useRef<string | null>(null)

  useEffect(() => {
    return window.api.onPodCopyProgress((data) => {
      if (data.transferId === transferId.current) setBytes(data.bytes)
    })
  }, [])

  const valid = localPath.trim() !== "" && remotePath.trim() !== ""

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange(next)
    if (next) {
      setContainer(defaultContainer)
      setLocalPath("")
      setRemotePath("")
      setBytes(0)
      setError(null)
      setDone(null)
    }
  }

  function switchDirection(next: Direction): void {
    setDirection(next)
    // The two directions read the local path differently — a file or directory
    // to upload, versus the directory a download lands in — so a path picked
    // for one is not a path for the other.
    setLocalPath("")
    setError(null)
    setDone(null)
  }

  async function browse(): Promise<void> {
    // A download always lands in a directory; an upload can send either.
    const mode = direction === "from" ? "directory" : "file"
    const result = await window.api.selectLocalPath({
      mode,
      title: mode === "directory" ? "Copy into folder" : "File to copy",
    })
    if (result.path) setLocalPath(result.path)
  }

  async function handleCopy(): Promise<void> {
    if (!valid) return
    const historyTarget = {
      action: "copy",
      resourceKind: "Pod",
      resourceName: podName,
      namespace,
    } as const
    const id = crypto.randomUUID()
    transferId.current = id
    setCopying(true)
    setBytes(0)
    setError(null)
    setDone(null)
    const args = {
      contextName: selectedContext ?? undefined,
      namespace,
      podName,
      containerName: container,
      localPath: localPath.trim(),
      remotePath: remotePath.trim(),
      transferId: id,
    }
    try {
      const result =
        direction === "to"
          ? await window.api.k8s.copyToPod(args)
          : await window.api.k8s.copyFromPod(args)
      setBytes(result.bytes)
      recordHistory(historyTarget, { success: true })
      const summary =
        direction === "to"
          ? `Copied ${localPath.trim()} into ${podName}:${remotePath.trim()}`
          : `Copied ${podName}:${remotePath.trim()} into ${localPath.trim()}`
      toast.success(`${summary} (${formatBytes(result.bytes)})`)
      setDone(summary)
    } catch (e) {
      const msg = normalizeIpcError(e)
      recordHistory(historyTarget, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, "Pod: copy")
      setError(msg)
    } finally {
      transferId.current = null
      setCopying(false)
    }
  }

  const localLabel =
    direction === "to" ? "Local file or folder" : "Local destination folder"
  const remoteLabel =
    direction === "to" ? "Destination folder in container" : "Path in container"

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Copy files"
        className={className}
        onClick={() => setOpenNotify(true)}
      >
        <FolderInput className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Copy Files</AlertDialogTitle>
            <AlertDialogDescription>
              Copy between this machine and{" "}
              <strong>
                {namespace}/{podName}
              </strong>
              . The entry keeps its name on the far side.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-1">
            <Button
              variant={direction === "from" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs flex-1"
              disabled={copying}
              onClick={() => switchDirection("from")}
            >
              From pod
            </Button>
            <Button
              variant={direction === "to" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs flex-1"
              disabled={copying}
              onClick={() => switchDirection("to")}
            >
              To pod
            </Button>
          </div>
          {containers.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="copy-container" className="text-xs">
                Container
              </Label>
              <select
                id="copy-container"
                value={container}
                onChange={(e) => setContainer(e.target.value)}
                disabled={copying}
                className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground h-8"
              >
                {containers.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="copy-remote" className="text-xs">
              {remoteLabel}
            </Label>
            <Input
              id="copy-remote"
              value={remotePath}
              onChange={(e) => setRemotePath(e.target.value)}
              disabled={copying}
              placeholder={direction === "to" ? "/tmp" : "/var/log/app.log"}
              className="h-8"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="copy-local" className="text-xs">
              {localLabel}
            </Label>
            <div className="flex gap-1">
              <Input
                id="copy-local"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && valid && !copying) handleCopy()
                }}
                disabled={copying}
                placeholder="Browse…"
                className="h-8"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={copying}
                onClick={browse}
              >
                Browse
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Both directions run <code>tar</code> inside the container, so an
            image without it cannot be copied to or from. Symlinks are followed
            and file ownership is not preserved.
          </p>
          {copying && (
            <p className="text-sm text-muted-foreground">
              Copying… {formatBytes(bytes)}
            </p>
          )}
          {done && !copying && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {done} ({formatBytes(bytes)})
            </p>
          )}
          {error && (
            <p className="text-sm text-red-500 font-mono whitespace-pre-wrap">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenNotify(false)}
              disabled={copying}
            >
              Close
            </Button>
            <Button onClick={handleCopy} disabled={copying || !valid}>
              {copying ? "Copying…" : "Copy"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
