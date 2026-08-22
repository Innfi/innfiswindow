import { LogOut } from "lucide-react"
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

interface EvictButtonProps {
  podName: string
  namespace: string
  /** Reloads the list once the eviction is accepted. */
  onEvicted: () => void
  /** Pauses list polling while the confirm dialog is open. */
  onDialogChange: (open: boolean) => void
  /** Closes the detail panel — the pod it describes is on its way out. */
  onClose: () => void
  className?: string
}

/**
 * Evicts a pod through the `policy/v1` Eviction subresource. Unlike a delete,
 * the API server refuses the call when a PodDisruptionBudget would drop below
 * its minimum, which is what makes eviction the safe way to move a pod off a
 * node one at a time. The dry run asks for that verdict without acting.
 */
export function EvictButton({
  podName,
  namespace,
  onEvicted,
  onDialogChange,
  onClose,
  className,
}: EvictButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [evicting, setEvicting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  // Blank grace period means "use the pod's own terminationGracePeriod".
  const [grace, setGrace] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<string | null>(null)

  const graceSeconds = Number(grace)
  const graceValid =
    grace.trim() === "" || (Number.isInteger(graceSeconds) && graceSeconds >= 0)
  const busy = evicting || checking

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange(next)
    if (next) {
      // Options are per-eviction: a previous run's grace period must not carry
      // over into the next pod the panel shows.
      setShowOptions(false)
      setGrace("")
      setError(null)
      setCheckResult(null)
    }
  }

  function evictArgs(dryRun: boolean): {
    contextName?: string
    namespace: string
    name: string
    options: { gracePeriodSeconds?: number; dryRun?: boolean }
  } {
    return {
      contextName: selectedContext ?? undefined,
      namespace,
      name: podName,
      options: {
        ...(grace.trim() === "" ? {} : { gracePeriodSeconds: graceSeconds }),
        ...(dryRun ? { dryRun: true } : {}),
      },
    }
  }

  async function handleDryRun(): Promise<void> {
    if (!graceValid) return
    setChecking(true)
    setError(null)
    setCheckResult(null)
    try {
      await window.api.k8s.evictPod(evictArgs(true))
      setCheckResult(
        "No PodDisruptionBudget blocks this eviction right now — nothing was evicted.",
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setChecking(false)
    }
  }

  async function handleEvict(): Promise<void> {
    if (!graceValid) return
    const target = {
      action: "evict",
      resourceKind: "Pod",
      resourceName: podName,
      namespace,
    } as const
    setEvicting(true)
    setError(null)
    setCheckResult(null)
    try {
      await window.api.k8s.evictPod(evictArgs(false))
      recordHistory(target, { success: true })
      toast.success(`Evicted ${podName}`)
      setOpenNotify(false)
      onEvicted()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, "Pod: evict")
      setError(msg)
    } finally {
      setEvicting(false)
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
        <LogOut className="h-3 w-3" />
        Evict
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Evict Pod</AlertDialogTitle>
            <AlertDialogDescription>
              Evict{" "}
              <strong>
                {namespace}/{podName}
              </strong>
              ? The pod is deleted gracefully, and its controller replaces it —
              unlike a delete, the request is refused if a PodDisruptionBudget
              would be violated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <button
            type="button"
            className="w-fit text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowOptions((v) => !v)}
          >
            {showOptions ? "▾" : "▸"} Eviction options
            {!showOptions && grace.trim() !== "" ? ` — ${grace.trim()}s` : ""}
          </button>
          {showOptions && (
            <div className="space-y-1 text-sm">
              <Label htmlFor="evict-grace-period" className="text-xs">
                Grace period (s)
              </Label>
              <Input
                id="evict-grace-period"
                type="number"
                min={0}
                step={1}
                placeholder="pod default"
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
                disabled={busy}
                className="h-8"
              />
              {!graceValid && (
                <p className="text-xs text-red-500">
                  Grace period must be a whole number of seconds, zero or
                  greater.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A pod no controller owns is not recreated after eviction.
          </p>
          {checkResult && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {checkResult}
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
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleDryRun}
              disabled={busy || !graceValid}
            >
              {checking ? "Checking…" : "Dry run"}
            </Button>
            <Button onClick={handleEvict} disabled={busy || !graceValid}>
              {evicting ? "Evicting…" : "Evict"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
