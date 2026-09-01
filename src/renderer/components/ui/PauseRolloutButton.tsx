import { Pause, Play } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

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

type PausableKind = "Deployment"

const PAUSE_API: Record<
  PausableKind,
  (args: {
    contextName?: string
    namespace: string
    name: string
    paused: boolean
  }) => Promise<{ success: boolean }>
> = {
  Deployment: (args) => window.api.k8s.setDeploymentPaused(args),
}

interface PauseRolloutButtonProps {
  resourceKind: PausableKind
  resourceName: string
  namespace: string
  /** Current `spec.paused`; decides whether this pauses or resumes. */
  paused: boolean
  /** Reloads the list once the flag has flipped. */
  onChanged: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange?: (open: boolean) => void
  className?: string
}

/**
 * Flips `spec.paused`, as `kubectl rollout pause/resume` does — one button
 * that pauses or resumes depending on the object's current state. Unlike
 * `SuspendButton`, pausing touches no pods: the existing ReplicaSet keeps
 * serving and only the reconciliation of template changes stops.
 */
export function PauseRolloutButton({
  resourceKind,
  resourceName,
  namespace,
  paused,
  onChanged,
  onDialogChange,
  className,
}: PauseRolloutButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verb = paused ? "Resume" : "Pause"
  const progressLabel = paused ? "Resuming…" : "Pausing…"

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange?.(next)
    if (next) setError(null)
  }

  async function handleToggle(): Promise<void> {
    const target = {
      action: paused ? "resume" : "pause",
      resourceKind,
      resourceName,
      namespace,
    } as const
    setWorking(true)
    setError(null)
    try {
      await PAUSE_API[resourceKind]({
        contextName: selectedContext ?? undefined,
        namespace,
        name: resourceName,
        paused: !paused,
      })
      recordHistory(target, { success: true })
      toast.success(`${paused ? "Resumed" : "Paused"} ${resourceName}`)
      setOpenNotify(false)
      onChanged()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore
        .getState()
        .addGlobalError(msg, `${resourceKind}: ${verb.toLowerCase()} rollout`)
      setError(msg)
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`h-7 text-xs gap-1${className ? ` ${className}` : ""}`}
        onClick={() => setOpenNotify(true)}
      >
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        {verb}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{verb} rollout</AlertDialogTitle>
            <AlertDialogDescription>
              {verb} the rollout of{" "}
              <strong>
                {namespace}/{resourceName}
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            {paused
              ? "Every template change made while paused rolls out now, as a single revision."
              : "Running pods are left alone, but template changes — including an edit or a rollback — are not rolled out until this is resumed."}
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
              disabled={working}
            >
              Cancel
            </Button>
            <Button onClick={handleToggle} disabled={working}>
              {working ? progressLabel : verb}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
