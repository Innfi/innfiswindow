import { type ReactNode, useState } from "react"
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

type RestartableKind =
  | "Deployment"
  | "StatefulSet"
  | "DaemonSet"
  | "Job"
  | "CronJob"

type RestartArgs = { contextName?: string; namespace: string; name: string }

const RESTART_API: Record<
  RestartableKind,
  (args: RestartArgs) => Promise<unknown>
> = {
  Deployment: (args) => window.api.k8s.restartDeployment(args),
  StatefulSet: (args) => window.api.k8s.restartStatefulSet(args),
  DaemonSet: (args) => window.api.k8s.restartDaemonSet(args),
  Job: (args) => window.api.k8s.restartJob(args),
  CronJob: (args) => window.api.k8s.restartCronJob(args),
}

/** What "restart" means differs per kind, and the dialog says so. */
const COPY: Record<
  RestartableKind,
  {
    describe: (ref: ReactNode) => ReactNode
    success: (name: string) => string
    progress: string
  }
> = {
  Deployment: {
    describe: (ref) => (
      <>Trigger a rolling restart of {ref}? All pods will be recreated.</>
    ),
    success: (name) => `Restarting ${name}`,
    progress: "Restarting…",
  },
  StatefulSet: {
    describe: (ref) => (
      <>
        Trigger a rolling restart of {ref}? Pods will be recreated one at a time
        in order.
      </>
    ),
    success: (name) => `Restarting ${name}`,
    progress: "Restarting…",
  },
  DaemonSet: {
    describe: (ref) => (
      <>
        Trigger a rolling restart of {ref}? Pods will be recreated on every
        node.
      </>
    ),
    success: (name) => `Restarting ${name}`,
    progress: "Restarting…",
  },
  Job: {
    describe: (ref) => (
      <>
        Jobs are immutable, so {ref} will be deleted and recreated from its spec
        to run again. This cannot be undone.
      </>
    ),
    success: (name) => `Restarted ${name}`,
    progress: "Restarting…",
  },
  CronJob: {
    describe: (ref) => (
      <>
        CronJobs have no restart, so this manually triggers a new job run for{" "}
        {ref} now, from its job template.
      </>
    ),
    success: (name) => `Triggered a new job run for ${name}`,
    progress: "Triggering…",
  },
}

interface RestartButtonProps {
  resourceKind: RestartableKind
  resourceName: string
  namespace: string
  /** Called once the restart went through, for kinds whose list changes. */
  onRestarted?: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange?: (open: boolean) => void
}

/** The detail panel's Restart button and its confirmation dialog. */
export function RestartButton({
  resourceKind,
  resourceName,
  namespace,
  onRestarted,
  onDialogChange,
}: RestartButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const copy = COPY[resourceKind]

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange?.(next)
  }

  async function handleRestart(): Promise<void> {
    const target = {
      action: "restart",
      resourceKind,
      resourceName,
      namespace,
    } as const
    setWorking(true)
    try {
      await RESTART_API[resourceKind]({
        contextName: selectedContext ?? undefined,
        namespace,
        name: resourceName,
      })
      recordHistory(target, { success: true })
      toast.success(copy.success(resourceName))
      setOpenNotify(false)
      onRestarted?.()
    } catch (e) {
      recordHistory(target, { success: false, error: String(e) })
      toast.error(String(e))
      useAppStore
        .getState()
        .addGlobalError(String(e), `${resourceKind}: restart`)
      setOpenNotify(false)
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => setOpenNotify(true)}
      >
        Restart
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart {resourceKind}</AlertDialogTitle>
            <AlertDialogDescription>
              {copy.describe(
                <strong>
                  {namespace}/{resourceName}
                </strong>,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenNotify(false)}
              disabled={working}
            >
              Cancel
            </Button>
            <Button onClick={handleRestart} disabled={working}>
              {working ? copy.progress : "Restart"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
