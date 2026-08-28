import { Trash2 } from "lucide-react"
import { ReactNode, useState } from "react"
import { toast } from "sonner"

import type {
  DeleteResourceOptions,
  PropagationPolicy,
} from "../../../shared/k8s"
import {
  type ResourceGvk,
  resourceGvk,
  type ResourceKind,
} from "../../lib/resource-gvk"
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

const PROPAGATION_CHOICES: {
  value: PropagationPolicy
  label: string
  hint: string
}[] = [
  {
    value: "Background",
    label: "Background",
    hint: "Returns straight away; the garbage collector deletes the dependents afterwards.",
  },
  {
    value: "Foreground",
    label: "Foreground",
    hint: "Deletes the dependents first — the object stays, marked for deletion, until they are gone.",
  },
  {
    value: "Orphan",
    label: "Orphan",
    hint: "Leaves the dependents running with no owner. A Deployment's ReplicaSets and Pods keep going.",
  },
]

interface DeleteButtonProps {
  resourceKind: ResourceKind
  /** Required for a custom resource, whose group/version only its CRD knows. */
  gvk?: ResourceGvk
  resourceName: string
  /** Omit for cluster-scoped resources. */
  namespace?: string
  /** Reloads the list once the object is gone. */
  onDeleted: () => void
  /** Pauses list polling while the confirm dialog is open. */
  onDeleteDialogChange: (open: boolean) => void
  /** Closes the detail panel after a successful delete. */
  onClose: () => void
  /** Extra warning shown in the confirm dialog (cascading deletes, etc.). */
  warning?: ReactNode
  /** Seeds the cascade choice; the dialog can still change it. */
  propagationPolicy?: PropagationPolicy
  className?: string
}

/**
 * Deletes by GVK through the generic `k8s:resource:delete` handler, so every
 * detail panel gets the same confirm dialog, delete options, history record,
 * and error path without a per-kind IPC method.
 */
export function DeleteButton({
  resourceKind,
  gvk,
  resourceName,
  namespace,
  onDeleted,
  onDeleteDialogChange,
  onClose,
  warning,
  propagationPolicy = "Background",
  className,
}: DeleteButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [policy, setPolicy] = useState<PropagationPolicy>(propagationPolicy)
  // Blank grace period means "use the object's own terminationGracePeriod".
  const [grace, setGrace] = useState("")
  const [force, setForce] = useState(false)
  const { apiVersion, kind } = resourceGvk(resourceKind, gvk)

  const graceSeconds = Number(grace)
  const graceValid =
    grace.trim() === "" || (Number.isInteger(graceSeconds) && graceSeconds >= 0)

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDeleteDialogChange(next)
    if (next) {
      // Options are per-delete: a previous run's force flag must not carry
      // over into the next object the panel shows.
      setError(null)
      setShowOptions(false)
      setPolicy(propagationPolicy)
      setGrace("")
      setForce(false)
    }
  }

  function deleteOptions(): DeleteResourceOptions {
    return {
      propagationPolicy: policy,
      // Force is exactly `--grace-period=0`, so it wins over the input, which
      // is disabled while it is checked.
      ...(force
        ? { gracePeriodSeconds: 0 }
        : grace.trim() === ""
          ? {}
          : { gracePeriodSeconds: graceSeconds }),
    }
  }

  async function handleDelete(): Promise<void> {
    if (!graceValid) return
    const target = {
      action: "delete",
      resourceKind: kind,
      resourceName,
      namespace: namespace ?? null,
    } as const
    setDeleting(true)
    setError(null)
    try {
      await window.api.k8s.deleteResource({
        apiVersion,
        kind,
        name: resourceName,
        namespace: namespace || undefined,
        contextName: selectedContext ?? undefined,
        options: deleteOptions(),
      })
      recordHistory(target, { success: true })
      toast.success(`${kind} ${resourceName} deleted`)
      setOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, `${kind}: delete`)
      setError(msg)
    } finally {
      setDeleting(false)
    }
  }

  const policyHint = PROPAGATION_CHOICES.find((c) => c.value === policy)?.hint
  const optionSummary = force
    ? `${policy}, force`
    : grace.trim() !== ""
      ? `${policy}, ${grace.trim()}s`
      : policy !== propagationPolicy
        ? policy
        : null

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`h-7 text-xs gap-1 text-destructive hover:text-destructive${
          className ? ` ${className}` : ""
        }`}
        onClick={() => setOpenNotify(true)}
      >
        <Trash2 className="h-3 w-3" />
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {kind}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {namespace ? `${namespace}/${resourceName}` : resourceName}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {warning && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {warning}
            </p>
          )}
          <button
            type="button"
            className="w-fit text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowOptions((v) => !v)}
          >
            {showOptions ? "▾" : "▸"} Delete options
            {!showOptions && optionSummary ? ` — ${optionSummary}` : ""}
          </button>
          {showOptions && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <Label htmlFor="delete-propagation" className="text-xs">
                  Cascade
                </Label>
                <select
                  id="delete-propagation"
                  value={policy}
                  onChange={(e) =>
                    setPolicy(e.target.value as PropagationPolicy)
                  }
                  disabled={deleting}
                  className="w-full rounded border px-2 py-1 text-sm bg-background text-foreground"
                >
                  {PROPAGATION_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{policyHint}</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="delete-grace-period" className="text-xs">
                  Grace period (s)
                </Label>
                <Input
                  id="delete-grace-period"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="object default"
                  value={force ? "0" : grace}
                  onChange={(e) => setGrace(e.target.value)}
                  disabled={deleting || force}
                  className="h-8"
                />
                {!graceValid && (
                  <p className="text-xs text-red-500">
                    Grace period must be a whole number of seconds, zero or
                    greater.
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  disabled={deleting}
                />
                <span>
                  Force (grace period 0)
                  <span className="block text-xs text-muted-foreground">
                    Drops the object from the API server without waiting for it
                    to shut down.
                  </span>
                </span>
              </label>
            </div>
          )}
          {force && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              A force delete does not confirm the workload stopped — a Pod
              removed this way can still be running on its node, so its
              StatefulSet replacement may run twice.
            </p>
          )}
          {policy === "Orphan" && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Dependents are left behind with no owner and must be cleaned up by
              hand.
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
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || !graceValid}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
