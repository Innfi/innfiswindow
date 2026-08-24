import { Plus, Tags, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  isReservedKey,
  validateLabelKey,
  validateLabelValue,
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

interface LabelRow {
  id: number
  key: string
  value: string
}

/** The write `kubectl label` describes: keys to set, keys to drop. */
interface LabelUpdate {
  set: Record<string, string>
  remove: string[]
}

interface NodeLabelsButtonProps {
  nodeName: string
  /** metadata.labels as last read; seeds the editor each time it opens. */
  labels: Record<string, string>
  /** Reloads the list once the patch lands. */
  onUpdated: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange: (open: boolean) => void
  className?: string
}

function toRows(labels: Record<string, string>): LabelRow[] {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value], i) => ({ id: i, key, value }))
}

/** What the edited rows add up to: keys whose value is new or changed go in
 *  `set`, keys that no longer appear go in `remove`. A renamed key falls out of
 *  this as both. */
function diffLabels(
  original: Record<string, string>,
  rows: LabelRow[],
): LabelUpdate {
  const set: Record<string, string> = {}
  for (const row of rows) {
    const key = row.key.trim()
    if (key === "") continue
    const value = row.value.trim()
    if (!(key in original) || original[key] !== value) set[key] = value
  }
  const kept = new Set(rows.map((r) => r.key.trim()))
  const remove = Object.keys(original).filter((k) => !kept.has(k))
  return { set, remove }
}

/** Per-row message, or null when the row is fine. A duplicate key is reported
 *  on the later row so the first occurrence stays clean. */
function rowError(rows: LabelRow[], index: number): string | null {
  const row = rows[index]
  const key = row.key.trim()
  if (key === "" && row.value.trim() === "") return null
  const keyProblem = validateLabelKey(key)
  if (keyProblem) return keyProblem
  if (rows.some((r, i) => i < index && r.key.trim() === key))
    return `Duplicate key "${key}".`
  return validateLabelValue(row.value.trim())
}

/**
 * Edits `metadata.labels` on a node — the same write as `kubectl label node`,
 * removals included, which cross the wire as a null for the key. Node labels
 * drive scheduling (`nodeSelector`, affinity) and role display, so the dialog
 * spells out what the save will set and drop before it runs.
 */
export function NodeLabelsButton({
  nodeName,
  labels,
  onUpdated,
  onDialogChange,
  className,
}: NodeLabelsButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<LabelRow[]>(() => toRows(labels))
  const [nextId, setNextId] = useState(() => Object.keys(labels).length)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errors = rows.map((_, i) => rowError(rows, i))
  const update = diffLabels(
    labels,
    rows.filter((r) => r.key.trim() !== ""),
  )
  const changedKeys = [...Object.keys(update.set), ...update.remove]
  const dirty = changedKeys.length > 0
  const valid = errors.every((e) => e === null)
  const reserved = changedKeys.filter(isReservedKey)

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange(next)
    if (next) {
      // A poll may have refreshed the node since the last open; start from what
      // the cluster has now, not from an abandoned edit.
      setRows(toRows(labels))
      setNextId(Object.keys(labels).length)
      setError(null)
    }
  }

  function updateRow(id: number, patch: Partial<LabelRow>): void {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow(): void {
    setRows((rs) => [...rs, { id: nextId, key: "", value: "" }])
    setNextId((n) => n + 1)
  }

  async function handleSave(): Promise<void> {
    if (!dirty || !valid) return
    const target = {
      action: "label",
      resourceKind: "Node",
      resourceName: nodeName,
      namespace: "",
    } as const
    setSaving(true)
    setError(null)
    try {
      await window.api.k8s.updateNodeLabels({
        contextName: selectedContext ?? undefined,
        name: nodeName,
        update,
      })
      recordHistory(target, { success: true })
      toast.success(
        `Labelled ${nodeName}: ${Object.keys(update.set).length} set, ${update.remove.length} removed`,
      )
      setOpenNotify(false)
      onUpdated()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, "Node: label")
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
        title="Edit labels"
      >
        <Tags className="h-3 w-3" />
        Labels
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Labels</AlertDialogTitle>
            <AlertDialogDescription>
              Add, change, or remove labels on <strong>{nodeName}</strong>.
              Labels drive nodeSelector and node affinity, so a removal can
              leave pods unschedulable.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground">
                This node has no labels.
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
                    placeholder="value"
                    disabled={saving}
                    className="h-8 flex-1 font-mono text-xs"
                  />
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
            Add label
          </Button>

          <p className="text-xs text-muted-foreground">
            {dirty
              ? `${Object.keys(update.set).length} to set, ${update.remove.length} to remove${
                  update.remove.length > 0
                    ? ` (${update.remove.join(", ")})`
                    : ""
                }.`
              : "No changes yet."}
          </p>
          {reserved.length > 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              {reserved.join(", ")} {reserved.length === 1 ? "is" : "are"}{" "}
              reserved by Kubernetes — the NodeRestriction admission plugin may
              reject the change, and the kubelet may write it back.
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
