import { LucideIcon, Trash2, X } from "lucide-react"
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
import {
  HistoryTarget,
  useRecordHistory,
} from "../../src/hooks/useRecordHistory"
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
import { Label } from "./Label"

interface Named {
  name: string
  namespace?: string | null
}

/**
 * One verb offered over a multi-row selection. `run` is called once per
 * selected row; rejecting counts that row as failed and leaves it selected.
 */
export interface BatchAction<T> {
  label: string
  /** Verb recorded in the History view, once per row. */
  action: HistoryTarget["action"]
  icon?: LucideIcon
  /** Present-tense label while the batch runs, e.g. `Restarting`. */
  runningLabel?: string
  destructive?: boolean
  /** Extra warning shown in the confirm dialog. */
  warning?: ReactNode
  run: (item: T, contextName?: string) => Promise<unknown>
}

/** Opts a `ResourceListView` into multi-select. Delete is always offered. */
export interface BatchConfig<T> {
  /** GVK of the rows, for the built-in delete and for history records. */
  resourceKind: ResourceKind
  /** Required for a custom resource, whose group/version only its CRD knows. */
  gvk?: ResourceGvk
  /** Verbs offered alongside Delete. */
  actions?: BatchAction<T>[]
  /** Seeds the cascade choice of the built-in delete. */
  propagationPolicy?: PropagationPolicy
}

const PROPAGATION_CHOICES: { value: PropagationPolicy; label: string }[] = [
  { value: "Background", label: "Background" },
  { value: "Foreground", label: "Foreground" },
  { value: "Orphan", label: "Orphan" },
]

function displayName(item: Named): string {
  return item.namespace ? `${item.namespace}/${item.name}` : item.name
}

interface BatchActionBarProps<T extends Named> {
  config: BatchConfig<T>
  selected: T[]
  /** Drops every row from the selection (after a batch, or on Clear). */
  onClear: () => void
  /** Drops only the rows a batch finished with, keeping the failures. */
  onDone: (succeeded: T[]) => void
  /** Reloads the list once the batch is over. */
  onReload: () => void
  /** Pauses list polling while a confirm dialog is open. */
  onDialogChange: (open: boolean) => void
}

/**
 * Runs one verb over every selected row, sequentially: a batch is N ordinary
 * writes, not a new IPC surface, so each row goes through the same handler,
 * history record and error path a detail-panel button would use. Rows that
 * fail stay selected and are listed in the dialog, so a partial batch can be
 * retried without re-picking the rows that worked.
 */
export function BatchActionBar<T extends Named>({
  config,
  selected,
  onClear,
  onDone,
  onReload,
  onDialogChange,
}: BatchActionBarProps<T>): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  // Exactly one of these is set while a dialog is open: `pending` for a
  // caller-supplied verb, `pendingDelete` for the built-in delete, which is
  // the only one with options of its own.
  const [pending, setPending] = useState<BatchAction<T> | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [failures, setFailures] = useState<{ name: string; error: string }[]>(
    [],
  )
  const [policy, setPolicy] = useState<PropagationPolicy>(
    config.propagationPolicy ?? "Background",
  )
  const [force, setForce] = useState(false)
  const { apiVersion, kind } = resourceGvk(config.resourceKind, config.gvk)

  function openDialog(action: BatchAction<T> | null): void {
    setFailures([])
    setProgress(0)
    if (action === null) {
      // Options are per-batch: a previous run's force flag must not carry over.
      setPolicy(config.propagationPolicy ?? "Background")
      setForce(false)
      setPendingDelete(true)
    } else {
      setPending(action)
    }
    onDialogChange(true)
  }

  function closeDialog(): void {
    if (running) return
    setPending(null)
    setPendingDelete(false)
    setFailures([])
    onDialogChange(false)
  }

  function deleteOptions(): DeleteResourceOptions {
    return {
      propagationPolicy: policy,
      ...(force ? { gracePeriodSeconds: 0 } : {}),
    }
  }

  async function runBatch(
    action: HistoryTarget["action"],
    run: (item: T) => Promise<unknown>,
  ): Promise<void> {
    const targets = selected
    setRunning(true)
    setProgress(0)
    const succeeded: T[] = []
    const failed: { name: string; error: string }[] = []
    // Sequential: N restarts fired at once is a thundering herd on the API
    // server, and the progress count is only meaningful in order.
    for (const item of targets) {
      const target = {
        action,
        resourceKind: kind,
        resourceName: item.name,
        namespace: item.namespace ?? null,
      } as const
      try {
        await run(item)
        recordHistory(target, { success: true })
        succeeded.push(item)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        recordHistory(target, { success: false, error: msg })
        failed.push({ name: displayName(item), error: msg })
      }
      setProgress((n) => n + 1)
    }
    setRunning(false)
    setFailures(failed)
    onReload()

    if (failed.length === 0) {
      toast.success(`${succeeded.length} ${kind} ${action} succeeded`)
      onClear()
      setPending(null)
      setPendingDelete(false)
      onDialogChange(false)
      return
    }
    // Partial failure keeps the dialog open: the per-row errors are the only
    // place the reason is shown, and the failed rows stay selected so the
    // footer button can retry just those.
    onDone(succeeded)
    const msg = `${action} failed for ${failed.length} of ${targets.length} ${kind}`
    toast.error(msg)
    useAppStore.getState().addGlobalError(msg, `${kind}: batch ${action}`)
  }

  const count = selected.length
  const dialogOpen = pending !== null || pendingDelete
  const actionLabel = pendingDelete ? "Delete" : (pending?.label ?? "")
  const runningLabel = pendingDelete
    ? "Deleting"
    : (pending?.runningLabel ?? `${actionLabel}ing`)
  const plural = count === 1 ? "" : "s"

  return (
    <>
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2">
        <span className="text-xs font-medium">{count} selected</span>
        {config.actions?.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.label}
              size="sm"
              variant="outline"
              className={`h-7 text-xs gap-1${
                action.destructive
                  ? " text-destructive hover:text-destructive"
                  : ""
              }`}
              onClick={() => openDialog(action)}
            >
              {Icon && <Icon className="h-3 w-3" />}
              {action.label}
            </Button>
          )
        })}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
          onClick={() => openDialog(null)}
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 text-xs gap-1"
          onClick={onClear}
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      </div>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionLabel} {count} {kind}
              {plural}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionLabel} the {count} selected {kind}
              {plural}?{pendingDelete ? " This action cannot be undone." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="max-h-32 overflow-auto text-xs font-mono text-muted-foreground">
            {selected.map((item) => (
              <li key={displayName(item)}>{displayName(item)}</li>
            ))}
          </ul>
          {!pendingDelete && pending?.warning && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {pending.warning}
            </p>
          )}
          {pendingDelete && (
            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <Label htmlFor="batch-delete-propagation" className="text-xs">
                  Cascade
                </Label>
                <select
                  id="batch-delete-propagation"
                  value={policy}
                  onChange={(e) =>
                    setPolicy(e.target.value as PropagationPolicy)
                  }
                  disabled={running}
                  className="w-full rounded border px-2 py-1 text-sm bg-background text-foreground"
                >
                  {PROPAGATION_CHOICES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={force}
                  onChange={(e) => setForce(e.target.checked)}
                  disabled={running}
                />
                <span>
                  Force (grace period 0)
                  <span className="block text-xs text-muted-foreground">
                    Drops every selected object from the API server without
                    waiting for it to shut down.
                  </span>
                </span>
              </label>
            </div>
          )}
          {running && (
            <p className="text-sm text-muted-foreground">
              {runningLabel} {progress}/{count}…
            </p>
          )}
          {failures.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-auto">
              {failures.map((f) => (
                <p
                  key={f.name}
                  className="text-xs text-red-500 font-mono whitespace-pre-wrap"
                >
                  {f.name}: {f.error}
                </p>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={running}>
              {failures.length > 0 ? "Close" : "Cancel"}
            </Button>
            <Button
              variant={
                pendingDelete || pending?.destructive
                  ? "destructive"
                  : "default"
              }
              disabled={running || count === 0}
              onClick={() => {
                if (pendingDelete) {
                  void runBatch("delete", (item) =>
                    window.api.k8s.deleteResource({
                      apiVersion,
                      kind,
                      name: item.name,
                      namespace: item.namespace || undefined,
                      contextName: selectedContext ?? undefined,
                      options: deleteOptions(),
                    }),
                  )
                  return
                }
                const action = pending
                if (!action) return
                void runBatch(action.action, (item) =>
                  action.run(item, selectedContext ?? undefined),
                )
              }}
            >
              {running
                ? `${runningLabel}…`
                : failures.length > 0
                  ? `Retry ${count}`
                  : actionLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
