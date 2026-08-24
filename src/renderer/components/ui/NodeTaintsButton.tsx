import { Ban, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  isReservedKey,
  TAINT_EFFECTS,
  validateTaint,
} from "../../../shared/labels"
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

interface Taint {
  key: string
  value: string
  effect: string
}

interface TaintRow extends Taint {
  id: number
}

interface NodeTaintsButtonProps {
  nodeName: string
  /** spec.taints as last read; seeds the editor each time it opens. */
  taints: Taint[]
  /** Reloads the list once the patch lands. */
  onUpdated: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange: (open: boolean) => void
  className?: string
}

function toRows(taints: Taint[]): TaintRow[] {
  return taints.map((t, i) => ({
    id: i,
    key: t.key,
    value: t.value ?? "",
    effect: t.effect,
  }))
}

function trim(row: Taint): Taint {
  return {
    key: row.key.trim(),
    value: row.value.trim(),
    effect: row.effect,
  }
}

/** `key=value:Effect`, the form kubectl takes and prints. Used to compare the
 *  edited list against the node's, order included — the patch replaces the
 *  whole list, so a reorder is a real (if harmless) write. */
function format(taint: Taint): string {
  return `${taint.key}${taint.value ? `=${taint.value}` : ""}:${taint.effect}`
}

/** Per-row message, or null when the row is fine. The API server rejects two
 *  taints sharing a key and effect, so the later one is flagged. */
function rowError(rows: TaintRow[], index: number): string | null {
  const row = trim(rows[index])
  if (row.key === "" && row.value === "") return "Key is required."
  const problem = validateTaint(row)
  if (problem) return problem
  const duplicate = rows.some((r, i) => {
    const other = trim(r)
    return i < index && other.key === row.key && other.effect === row.effect
  })
  if (duplicate) return `Duplicate ${row.key}:${row.effect}.`
  return null
}

/**
 * Edits `spec.taints` — what `kubectl taint node` writes. Taints have no merge
 * key, so add and remove are the same operation: the node ends with exactly the
 * list shown here. A NoExecute taint evicts running pods that do not tolerate
 * it, so the dialog calls that out before saving.
 */
export function NodeTaintsButton({
  nodeName,
  taints,
  onUpdated,
  onDialogChange,
  className,
}: NodeTaintsButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<TaintRow[]>(() => toRows(taints))
  const [nextId, setNextId] = useState(taints.length)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errors = rows.map((_, i) => rowError(rows, i))
  const valid = errors.every((e) => e === null)
  const edited = rows.map(trim)
  const originals = taints.map((t) => format(trim(t)))
  const dirty =
    edited.length !== taints.length ||
    edited.some((t, i) => format(t) !== originals[i])

  const added = edited.filter((t) => !originals.includes(format(t)))
  const removedTaints = taints
    .map((t) => format(trim(t)))
    .filter((t) => !edited.map(format).includes(t))
  const newNoExecute = added.filter((t) => t.effect === "NoExecute")
  const reserved = added.filter((t) => isReservedKey(t.key)).map((t) => t.key)

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange(next)
    if (next) {
      // A poll may have refreshed the node since the last open; start from what
      // the cluster has now, not from an abandoned edit.
      setRows(toRows(taints))
      setNextId(taints.length)
      setError(null)
    }
  }

  function updateRow(id: number, patch: Partial<TaintRow>): void {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow(): void {
    setRows((rs) => [
      ...rs,
      { id: nextId, key: "", value: "", effect: TAINT_EFFECTS[0] },
    ])
    setNextId((n) => n + 1)
  }

  async function handleSave(): Promise<void> {
    if (!dirty || !valid) return
    const target = {
      action: "taint",
      resourceKind: "Node",
      resourceName: nodeName,
      namespace: "",
    } as const
    setSaving(true)
    setError(null)
    try {
      await window.api.k8s.updateNodeTaints({
        contextName: selectedContext ?? undefined,
        name: nodeName,
        taints: edited,
      })
      recordHistory(target, { success: true })
      toast.success(
        `Tainted ${nodeName}: ${added.length} added, ${removedTaints.length} removed`,
      )
      setOpenNotify(false)
      onUpdated()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, "Node: taint")
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
        title="Edit taints"
      >
        <Ban className="h-3 w-3" />
        Taints
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Taints</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{nodeName}</strong> ends up with exactly the taints listed
              here. Only pods with a matching toleration will schedule onto it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground">
                This node has no taints.
              </p>
            )}
            {rows.map((row, i) => (
              <div key={row.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={row.key}
                    onChange={(e) => updateRow(row.id, { key: e.target.value })}
                    placeholder="key"
                    disabled={saving}
                    className="h-8 flex-1 font-mono text-xs"
                  />
                  <Input
                    value={row.value}
                    onChange={(e) =>
                      updateRow(row.id, { value: e.target.value })
                    }
                    placeholder="value (optional)"
                    disabled={saving}
                    className="h-8 flex-1 font-mono text-xs"
                  />
                  <select
                    value={row.effect}
                    onChange={(e) =>
                      updateRow(row.id, { effect: e.target.value })
                    }
                    disabled={saving}
                    className="h-8 rounded border px-2 text-xs bg-background text-foreground"
                    title="Effect"
                  >
                    {TAINT_EFFECTS.map((effect) => (
                      <option key={effect} value={effect}>
                        {effect}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    disabled={saving}
                    onClick={() =>
                      setRows((rs) => rs.filter((r) => r.id !== row.id))
                    }
                    title={`Remove ${row.key || "row"}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {errors[i] && (
                  <p className="text-xs text-red-500">{errors[i]}</p>
                )}
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 w-fit gap-1 text-xs"
            onClick={addRow}
            disabled={saving}
          >
            <Plus className="h-3 w-3" />
            Add taint
          </Button>

          <p className="text-xs text-muted-foreground">
            {dirty
              ? `${added.length} to add, ${removedTaints.length} to remove${
                  removedTaints.length > 0
                    ? ` (${removedTaints.join(", ")})`
                    : ""
                }.`
              : "No changes yet."}
          </p>
          {newNoExecute.length > 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              {newNoExecute.map(format).join(", ")} takes effect immediately:
              running pods without a matching toleration are evicted.
            </p>
          )}
          {reserved.length > 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              {reserved.join(", ")} is reserved by Kubernetes — the node
              controller manages taints under that prefix and may overwrite this
              one.
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
            <Button onClick={handleSave} disabled={saving || !dirty || !valid}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
