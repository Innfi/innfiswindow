import { Bug } from "lucide-react"
import { useState } from "react"
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

/** Images that carry the tools a slim workload image is missing. Offered as
 *  suggestions, not a closed list — the field takes any image. */
const SUGGESTED_IMAGES = [
  "busybox:1.36",
  "alpine:3.20",
  "nicolaka/netshoot:latest",
]

interface DebugContainerButtonProps {
  podName: string
  namespace: string
  /** spec.containers — the ones a debug container can target. */
  containers: { name: string }[]
  /** Opens a shell against the container that was just added. */
  onAttach: (containerName: string) => void
  /** Reloads the detail so the new container shows up in its own section. */
  onAdded: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange: (open: boolean) => void
  className?: string
}

/**
 * Adds an ephemeral container to a running pod, which is what `kubectl debug`
 * does: a second image, sharing the pod's network and volumes, brought up
 * alongside a workload image too slim to debug from the inside. Targeting a
 * container additionally shares its process namespace, so its processes and
 * its filesystem (under `/proc/1/root`) are reachable.
 *
 * An ephemeral container cannot be removed or restarted — it lives until the
 * pod does — so the dialog says so before it writes.
 */
export function DebugContainerButton({
  podName,
  namespace,
  containers,
  onAttach,
  onAdded,
  onDialogChange,
  className,
}: DebugContainerButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [image, setImage] = useState(SUGGESTED_IMAGES[0])
  const [name, setName] = useState("")
  const [target, setTarget] = useState("")
  const [command, setCommand] = useState("")
  const [error, setError] = useState<string | null>(null)

  const valid = image.trim() !== ""

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange(next)
    if (next) {
      // Each debug session starts from the defaults: a name from the last run
      // would collide, since ephemeral containers are never removed.
      setImage(SUGGESTED_IMAGES[0])
      setName("")
      setTarget("")
      setCommand("")
      setError(null)
    }
  }

  async function handleStart(): Promise<void> {
    if (!valid) return
    const historyTarget = {
      action: "debug",
      resourceKind: "Pod",
      resourceName: podName,
      namespace,
    } as const
    setStarting(true)
    setError(null)
    try {
      const result = await window.api.k8s.debugPod({
        contextName: selectedContext ?? undefined,
        namespace,
        name: podName,
        request: {
          image: image.trim(),
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(target ? { targetContainer: target } : {}),
          ...(command.trim() ? { command: command.trim().split(/\s+/) } : {}),
        },
      })
      recordHistory(historyTarget, { success: true })
      setOpenNotify(false)
      onAdded()
      if (result.running) {
        toast.success(`Debug container ${result.containerName} is running`)
        onAttach(result.containerName)
      } else {
        // The container exists either way; only the shell is pointless now.
        toast.warning(
          `${result.containerName} was added but is not running yet (${result.state}). Attach a shell from the pod's Ephemeral Containers section once it starts.`,
        )
      }
    } catch (e) {
      const msg = normalizeIpcError(e)
      recordHistory(historyTarget, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, "Pod: debug")
      setError(msg)
    } finally {
      setStarting(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title="Debug container"
        className={className}
        onClick={() => setOpenNotify(true)}
      >
        <Bug className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Debug Pod</AlertDialogTitle>
            <AlertDialogDescription>
              Add an ephemeral container to{" "}
              <strong>
                {namespace}/{podName}
              </strong>
              . It shares the pod&apos;s network and volumes, so it can reach
              what the workload reaches with tools the workload image lacks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="debug-image" className="text-xs">
              Image
            </Label>
            <Input
              id="debug-image"
              list="debug-image-suggestions"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              disabled={starting}
              placeholder="busybox:1.36"
              className="h-8"
              autoFocus
            />
            <datalist id="debug-image-suggestions">
              {SUGGESTED_IMAGES.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor="debug-target" className="text-xs">
              Target container
            </Label>
            <select
              id="debug-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={starting}
              className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground h-8"
            >
              <option value="">None — share the pod only</option>
              {containers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              A target shares that container&apos;s process namespace, so its
              processes are visible and its filesystem sits under /proc/1/root.
              Clusters that disable process-namespace targeting reject it.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="debug-name" className="text-xs">
              Container name (optional)
            </Label>
            <Input
              id="debug-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={starting}
              placeholder="debugger-xxxxx"
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="debug-command" className="text-xs">
              Command (optional)
            </Label>
            <Input
              id="debug-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid && !starting) handleStart()
              }}
              disabled={starting}
              placeholder="the image's own entrypoint"
              className="h-8"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            An ephemeral container cannot be removed or restarted: it stays on
            the pod, and its image is pulled onto the node, until the pod is
            replaced. A shell opens on it once the kubelet reports it running.
          </p>
          {error && (
            <p className="text-sm text-red-500 font-mono whitespace-pre-wrap">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenNotify(false)}
              disabled={starting}
            >
              Cancel
            </Button>
            <Button onClick={handleStart} disabled={starting || !valid}>
              {starting ? "Starting…" : "Start debug container"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
