import { ArrowUpDown } from "lucide-react"
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

interface HPAReplicasButtonProps {
  hpaName: string
  namespace: string
  minReplicas: number
  maxReplicas: number
  /** status.currentReplicas — tells the dialog whether new bounds bite now. */
  currentReplicas: number
  /** What the HPA scales, named in the dialog. */
  targetRef: { kind: string; name: string }
  /** Reloads the list once the patch lands. */
  onUpdated: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange: (open: boolean) => void
  className?: string
}

/**
 * Edits `spec.minReplicas`/`spec.maxReplicas`, the bounds `kubectl autoscale`
 * sets. Scaling the target workload directly is pointless while an HPA owns
 * it — the controller scales it back on its next cycle — so these bounds are
 * the way to move that workload's replica count for real.
 */
export function HPAReplicasButton({
  hpaName,
  namespace,
  minReplicas,
  maxReplicas,
  currentReplicas,
  targetRef,
  onUpdated,
  onDialogChange,
  className,
}: HPAReplicasButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [minValue, setMinValue] = useState(String(minReplicas))
  const [maxValue, setMaxValue] = useState(String(maxReplicas))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const min = Number(minValue)
  const max = Number(maxValue)
  const minWellFormed =
    minValue.trim() !== "" && Number.isInteger(min) && min >= 0
  const maxWellFormed =
    maxValue.trim() !== "" && Number.isInteger(max) && max >= 1
  const ordered = !minWellFormed || !maxWellFormed || max >= min
  const valid = minWellFormed && maxWellFormed && ordered
  const dirty = valid && (min !== minReplicas || max !== maxReplicas)

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange(next)
    if (next) {
      // A poll may have picked up new bounds since the last open; start from
      // what the cluster has now, not from an abandoned edit.
      setMinValue(String(minReplicas))
      setMaxValue(String(maxReplicas))
      setError(null)
    }
  }

  async function handleSave(): Promise<void> {
    if (!dirty) return
    const target = {
      action: "scale",
      resourceKind: "HPA",
      resourceName: hpaName,
      namespace,
    } as const
    setSaving(true)
    setError(null)
    try {
      await window.api.k8s.updateHPAReplicas({
        contextName: selectedContext ?? undefined,
        namespace,
        name: hpaName,
        minReplicas: min,
        maxReplicas: max,
      })
      recordHistory(target, { success: true })
      toast.success(`Set ${hpaName} to ${min}–${max} replicas`)
      setOpenNotify(false)
      onUpdated()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, "HPA: replicas")
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`h-7 text-xs gap-1${className ? ` ${className}` : ""}`}
        onClick={() => setOpenNotify(true)}
        title="Edit replica bounds"
      >
        <ArrowUpDown className="h-3 w-3" />
        Replicas
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Replica Bounds</AlertDialogTitle>
            <AlertDialogDescription>
              The range{" "}
              <strong>
                {namespace}/{hpaName}
              </strong>{" "}
              may scale {targetRef.kind}/{targetRef.name} within, currently{" "}
              <strong>
                {minReplicas}–{maxReplicas}
              </strong>{" "}
              with {currentReplicas} running.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="hpa-min" className="text-xs">
                Min replicas
              </Label>
              <Input
                id="hpa-min"
                type="number"
                min={0}
                step={1}
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dirty && !saving) handleSave()
                }}
                disabled={saving}
                className="h-8"
                autoFocus
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="hpa-max" className="text-xs">
                Max replicas
              </Label>
              <Input
                id="hpa-max"
                type="number"
                min={1}
                step={1}
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && dirty && !saving) handleSave()
                }}
                disabled={saving}
                className="h-8"
              />
            </div>
          </div>
          {!minWellFormed && minValue.trim() !== "" && (
            <p className="text-xs text-red-500">
              Min must be a whole number, zero or greater.
            </p>
          )}
          {!maxWellFormed && maxValue.trim() !== "" && (
            <p className="text-xs text-red-500">
              Max must be a whole number of 1 or more.
            </p>
          )}
          {!ordered && (
            <p className="text-xs text-red-500">
              Max cannot be below min — the API server rejects the pair.
            </p>
          )}
          {valid && min === 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              A min of 0 lets the HPA stop the workload entirely, and only
              clusters with the HPAScaleToZero feature gate accept it — the API
              server rejects it otherwise.
            </p>
          )}
          {valid && max < currentReplicas && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              {currentReplicas} pods are running now; the HPA will scale down to{" "}
              {max} on its next cycle.
            </p>
          )}
          {valid && min > currentReplicas && (
            <p className="text-xs text-muted-foreground">
              {currentReplicas} pods are running now; the HPA will scale up to{" "}
              {min} on its next cycle.
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
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
