import { Trash2 } from "lucide-react"
import { ReactNode, useState } from "react"
import { toast } from "sonner"

import { resourceGvk } from "../../lib/resource-gvk"
import { useRecordHistory } from "../../src/hooks/useRecordHistory"
import { DrawerTabInput, useAppStore } from "../../store/app.store"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./AlertDialog"
import { Button } from "./Button"

type DeletableKind = Extract<
  DrawerTabInput,
  { type: "yaml-edit" }
>["resourceKind"]

interface DeleteButtonProps {
  resourceKind: DeletableKind
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
  /** Passed through as DeleteOptions.propagationPolicy (e.g. "Background"). */
  propagationPolicy?: string
  className?: string
}

/**
 * Deletes by GVK through the generic `k8s:resource:delete` handler, so every
 * detail panel gets the same confirm dialog, history record, and error path
 * without a per-kind IPC method.
 */
export function DeleteButton({
  resourceKind,
  resourceName,
  namespace,
  onDeleted,
  onDeleteDialogChange,
  onClose,
  warning,
  propagationPolicy,
  className,
}: DeleteButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { apiVersion, kind } = resourceGvk(resourceKind)

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDeleteDialogChange(next)
    if (next) setError(null)
  }

  async function handleDelete(): Promise<void> {
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
        propagationPolicy,
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
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
