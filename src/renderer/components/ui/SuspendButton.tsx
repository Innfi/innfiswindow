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

type SuspendableKind = "Job" | "CronJob"

const SUSPEND_API: Record<
  SuspendableKind,
  (args: {
    contextName?: string
    namespace: string
    name: string
    suspend: boolean
  }) => Promise<{ success: boolean }>
> = {
  Job: (args) => window.api.k8s.setJobSuspend(args),
  CronJob: (args) => window.api.k8s.setCronJobSuspend(args),
}

const EFFECT: Record<SuspendableKind, string> = {
  Job: "Its running pods are deleted and their work is lost; resuming starts the Job over from a fresh set of pods.",
  CronJob:
    "No new runs are scheduled while suspended, and missed schedules are not backfilled on resume. Jobs already running are left alone.",
}

interface SuspendButtonProps {
  resourceKind: SuspendableKind
  resourceName: string
  namespace: string
  /** Current `spec.suspend`; decides whether this suspends or resumes. */
  suspended: boolean
  /** Reloads the list once the flag has flipped. */
  onChanged: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange?: (open: boolean) => void
  className?: string
}

/**
 * Flips `spec.suspend`, as `kubectl patch` does — one button that suspends or
 * resumes depending on the object's current state.
 */
export function SuspendButton({
  resourceKind,
  resourceName,
  namespace,
  suspended,
  onChanged,
  onDialogChange,
  className,
}: SuspendButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verb = suspended ? "Resume" : "Suspend"
  const progressLabel = suspended ? "Resuming…" : "Suspending…"

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange?.(next)
    if (next) setError(null)
  }

  async function handleToggle(): Promise<void> {
    const target = {
      action: suspended ? "resume" : "suspend",
      resourceKind,
      resourceName,
      namespace,
    } as const
    setWorking(true)
    setError(null)
    try {
      await SUSPEND_API[resourceKind]({
        contextName: selectedContext ?? undefined,
        namespace,
        name: resourceName,
        suspend: !suspended,
      })
      recordHistory(target, { success: true })
      toast.success(`${suspended ? "Resumed" : "Suspended"} ${resourceName}`)
      setOpenNotify(false)
      onChanged()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore
        .getState()
        .addGlobalError(msg, `${resourceKind}: ${verb.toLowerCase()}`)
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
        {suspended ? (
          <Play className="h-3 w-3" />
        ) : (
          <Pause className="h-3 w-3" />
        )}
        {verb}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {verb} {resourceKind}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {verb}{" "}
              <strong>
                {namespace}/{resourceName}
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!suspended && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {EFFECT[resourceKind]}
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
