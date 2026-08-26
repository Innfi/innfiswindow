import { Gauge, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  metricIdentity,
  RESOURCE_METRIC_KINDS,
  RESOURCE_METRIC_TARGET_TYPES,
  validateResourceMetric,
} from "../../../shared/hpa"
import { useRecordHistory } from "../../src/hooks/useRecordHistory"
import { K8sHPAResourceMetricSpec } from "../../src/types/k8s"
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

interface MetricRow extends K8sHPAResourceMetricSpec {
  id: number
  /** The utilization input as typed, so a half-deleted number stays editable
   *  instead of snapping back through `Number()`. */
  utilizationText: string
}

interface HPAMetricsButtonProps {
  hpaName: string
  namespace: string
  /** The Resource/ContainerResource entries of spec.metrics as last read. */
  metrics: K8sHPAResourceMetricSpec[]
  /** Pods/Object/External metrics this dialog leaves untouched. */
  otherMetricCount: number
  /** Reloads the list once the patch lands. */
  onUpdated: () => void
  /** Pauses list polling while the dialog is open. */
  onDialogChange: (open: boolean) => void
  className?: string
}

function toRows(metrics: K8sHPAResourceMetricSpec[]): MetricRow[] {
  return metrics.map((m, i) => ({
    id: i,
    kind: m.kind,
    name: m.name,
    container: m.container,
    targetType: m.targetType,
    averageUtilization: m.averageUtilization,
    value: m.value,
    utilizationText:
      m.averageUtilization === null ? "" : String(m.averageUtilization),
  }))
}

function toSpec(row: MetricRow): K8sHPAResourceMetricSpec {
  const utilization = Number(row.utilizationText)
  return {
    kind: row.kind,
    name: row.name.trim(),
    container: row.kind === "ContainerResource" ? row.container.trim() : "",
    targetType: row.targetType,
    averageUtilization:
      row.targetType === "Utilization" && row.utilizationText.trim() !== ""
        ? utilization
        : null,
    value: row.targetType === "AverageValue" ? row.value.trim() : "",
  }
}

/** `cpu 70%` / `memory 500Mi` — the form the summary line and the dirty check
 *  compare, order included: the patch replaces the whole list, so a reorder is
 *  a real (if harmless) write. */
function format(metric: K8sHPAResourceMetricSpec): string {
  const source =
    metric.kind === "ContainerResource"
      ? `${metric.name}/${metric.container}`
      : metric.name
  const target =
    metric.targetType === "Utilization"
      ? `${metric.averageUtilization ?? "?"}%`
      : metric.value
  return `${source} ${target}`
}

/** Per-row message, or null when the row is fine. */
function rowError(rows: MetricRow[], index: number): string | null {
  const metric = toSpec(rows[index])
  if (metric.name === "" && metric.value === "" && metric.container === "") {
    return "Resource name is required."
  }
  const problem = validateResourceMetric(metric)
  if (problem) return problem
  const id = metricIdentity(metric)
  const duplicate = rows.some(
    (r, i) => i < index && metricIdentity(toSpec(r)) === id,
  )
  if (duplicate) return `${metric.name} is already read by an earlier metric.`
  return null
}

/**
 * Edits the Resource and ContainerResource entries of `spec.metrics` — the
 * targets an HPA scales against, and the only ones expressible without a
 * metric selector. `spec.metrics` has no merge key, so add and remove are the
 * same write: the HPA ends with exactly the list shown here, plus whatever
 * Pods/Object/External metrics it already carried.
 */
export function HPAMetricsButton({
  hpaName,
  namespace,
  metrics,
  otherMetricCount,
  onUpdated,
  onDialogChange,
  className,
}: HPAMetricsButtonProps): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const recordHistory = useRecordHistory()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<MetricRow[]>(() => toRows(metrics))
  const [nextId, setNextId] = useState(metrics.length)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const errors = rows.map((_, i) => rowError(rows, i))
  const valid = errors.every((e) => e === null)
  const edited = rows.map(toSpec)
  const originals = metrics.map(format)
  const dirty =
    edited.length !== metrics.length ||
    edited.some((m, i) => format(m) !== originals[i])

  function setOpenNotify(next: boolean): void {
    setOpen(next)
    onDialogChange(next)
    if (next) {
      // A poll may have refreshed the HPA since the last open; start from what
      // the cluster has now, not from an abandoned edit.
      setRows(toRows(metrics))
      setNextId(metrics.length)
      setError(null)
    }
  }

  function updateRow(id: number, patch: Partial<MetricRow>): void {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow(): void {
    setRows((rs) => [
      ...rs,
      {
        id: nextId,
        kind: "Resource",
        name: "cpu",
        container: "",
        targetType: "Utilization",
        averageUtilization: 80,
        value: "",
        utilizationText: "80",
      },
    ])
    setNextId((n) => n + 1)
  }

  async function handleSave(): Promise<void> {
    if (!dirty || !valid) return
    const target = {
      action: "update",
      resourceKind: "HPA",
      resourceName: hpaName,
      namespace,
    } as const
    setSaving(true)
    setError(null)
    try {
      await window.api.k8s.updateHPAMetrics({
        contextName: selectedContext ?? undefined,
        namespace,
        name: hpaName,
        metrics: edited,
      })
      recordHistory(target, { success: true })
      toast.success(
        edited.length === 0
          ? `Cleared the resource metrics of ${hpaName}`
          : `Set ${hpaName} to ${edited.map(format).join(", ")}`,
      )
      setOpenNotify(false)
      onUpdated()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      recordHistory(target, { success: false, error: msg })
      toast.error(msg)
      useAppStore.getState().addGlobalError(msg, "HPA: metrics")
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
        title="Edit metric targets"
      >
        <Gauge className="h-3 w-3" />
        Metrics
      </Button>
      <AlertDialog open={open} onOpenChange={setOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Metric Targets</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>
                {namespace}/{hpaName}
              </strong>{" "}
              ends up reading exactly the resource metrics listed here. It
              scales on whichever of them asks for the most replicas.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground">
                This HPA reads no resource metrics.
              </p>
            )}
            {rows.map((row, i) => (
              <div key={row.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <select
                    value={row.kind}
                    onChange={(e) =>
                      updateRow(row.id, {
                        kind: e.target.value as MetricRow["kind"],
                      })
                    }
                    disabled={saving}
                    className="h-8 rounded border px-2 text-xs bg-background text-foreground"
                    title="Metric source"
                  >
                    {RESOURCE_METRIC_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind === "Resource" ? "Pod" : "Container"}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      updateRow(row.id, { name: e.target.value })
                    }
                    placeholder="cpu"
                    disabled={saving}
                    className="h-8 w-24 font-mono text-xs"
                  />
                  {row.kind === "ContainerResource" && (
                    <Input
                      value={row.container}
                      onChange={(e) =>
                        updateRow(row.id, { container: e.target.value })
                      }
                      placeholder="container"
                      disabled={saving}
                      className="h-8 w-28 font-mono text-xs"
                    />
                  )}
                  <select
                    value={row.targetType}
                    onChange={(e) =>
                      updateRow(row.id, {
                        targetType: e.target.value as MetricRow["targetType"],
                      })
                    }
                    disabled={saving}
                    className="h-8 rounded border px-2 text-xs bg-background text-foreground"
                    title="Target type"
                  >
                    {RESOURCE_METRIC_TARGET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "Utilization" ? "% of request" : "avg value"}
                      </option>
                    ))}
                  </select>
                  {row.targetType === "Utilization" ? (
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={row.utilizationText}
                      onChange={(e) =>
                        updateRow(row.id, { utilizationText: e.target.value })
                      }
                      placeholder="80"
                      disabled={saving}
                      className="h-8 w-20 text-xs"
                    />
                  ) : (
                    <Input
                      value={row.value}
                      onChange={(e) =>
                        updateRow(row.id, { value: e.target.value })
                      }
                      placeholder="100m"
                      disabled={saving}
                      className="h-8 w-20 font-mono text-xs"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    disabled={saving}
                    onClick={() =>
                      setRows((rs) => rs.filter((r) => r.id !== row.id))
                    }
                    title={`Remove ${row.name || "row"}`}
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
            Add metric
          </Button>

          <p className="text-xs text-muted-foreground">
            {dirty
              ? `Will read ${edited.length === 0 ? "no resource metrics" : edited.map(format).join(", ")}.`
              : "No changes yet."}
          </p>
          {rows.some((r) => r.targetType === "Utilization") && (
            <p className="text-xs text-muted-foreground">
              A utilization target is a percentage of the pod&apos;s resource
              <em> request</em>, so every container needs one — the HPA reports
              an unknown metric otherwise.
            </p>
          )}
          {edited.length === 0 && otherMetricCount === 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              With no metrics left the HPA has nothing to scale on, and holds
              the workload at its current replica count.
            </p>
          )}
          {otherMetricCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {otherMetricCount} Pods/Object/External metric
              {otherMetricCount === 1 ? "" : "s"} on this HPA{" "}
              {otherMetricCount === 1 ? "is" : "are"} not shown here and{" "}
              {otherMetricCount === 1 ? "stays" : "stay"} as{" "}
              {otherMetricCount === 1 ? "it is" : "they are"} — edit those in
              YAML.
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
