import { Scaling } from "lucide-react"
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
import { Input } from "./Input"
import { Label } from "./Label"

type ScalableKind = "Deployment" | "StatefulSet" | "ReplicaSet"

const SCALE_API: Record<
  ScalableKind,
  (args: {
    contextName?: string
    namespace: string
    name: string
    replicas: number
  }) => Promise<{ success: boolean }>
> = {
  Deployment: (args) => window.api.k8s.scaleDeployment(args),
  StatefulSet: (args) => window.api.k8s.scaleStatefulSet(args),
  ReplicaSet: (args) => window.api.k8s.scaleReplicaSet(args),
}

interface ScaleButtonProps {
  resourceKind: ScalableKind
  resourceName: string
  namespace: string
  /** Seeds the input, and tells the dialog what it is changing from. */
  currentReplicas: number
  /** Reloads the list once the scale subresource has been patched. */
  onScaled: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange?: (open: boolean) => void
  className?: string
}

/**
 * Patches the workload's `scale` subresource, the same call `kubectl scale`
 * makes. Shared by every scalable kind so the confirm dialog, history record,
 * and error path stay identical.
 */
export function ScaleButton({
  resourceKind,
  resourceName,
  namespace,
  currentReplicas,
  onScaled,
  onDialogChange,
  className,
}: ScaleButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(currentReplicas))
  const [scaling, setScaling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const replicas = Number(value)
  const valid =
    value.trim() !== "" && Number.isInteger(replicas) && replicas >= 0

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange?.(next)
    if (next) {
      // Reopening after a poll changed the count must not show a stale target.
      setValue(String(currentReplicas))
      setError(null)
    }
  }

  async function handleScale(): Promise<void> {
    if (!valid) return
    const target = {
      action: "scale",
      resourceKind,
      resourceName,
      namespace,
    } as const
    setScaling(true)
    setError(null)
    try {
      await SCALE_API[resourceKind]({
        contextName: selectedContext ?? undefined,
        namespace,
        name: resourceName,
        replicas,
      })
      recordHistory(target, { success: true })
      toast.success(`Scaled ${resourceName} to ${replicas} replicas`)
      setOpenNotify(false)
      onScaled()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, `${resourceKind}: scale`)
      setError(msg)
    } finally {
      setScaling(false)
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
        <Scaling className="h-3 w-3" />
        Scale
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scale {resourceKind}</AlertDialogTitle>
            <AlertDialogDescription>
              Set the replica count for{" "}
              <strong>
                {namespace}/{resourceName}
              </strong>
              , currently <strong>{currentReplicas}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="scale-replicas" className="text-xs">
              Replicas
            </Label>
            <Input
              id="scale-replicas"
              type="number"
              min={0}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && valid && !scaling) handleScale()
              }}
              disabled={scaling}
              className="h-8"
              autoFocus
            />
            {!valid && value.trim() !== "" && (
              <p className="text-xs text-red-500">
                Replicas must be a whole number, zero or greater.
              </p>
            )}
          </div>
          {valid && replicas === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Scaling to 0 stops every pod of this workload.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {resourceKind === "ReplicaSet"
              ? "A ReplicaSet owned by a Deployment is scaled straight back by its controller — scale the Deployment instead."
              : "An HPA targeting this workload will scale it back on its next cycle."}
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
              disabled={scaling}
            >
              Cancel
            </Button>
            <Button onClick={handleScale} disabled={scaling || !valid}>
              {scaling ? "Scaling…" : "Scale"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
