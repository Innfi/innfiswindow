import { Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "../../components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog"
import { Input } from "../../components/ui/Input"
import { Label } from "../../components/ui/Label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { AlarmEntry, AlarmRule, useAppStore } from "../../store/app.store"
import { K8sContext } from "../types/k8s"

const SEVERITY_CLASS: Record<AlarmRule["severity"], string> = {
  critical:
    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 rounded px-1.5 py-0.5 text-[10px] font-semibold",
  warning:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 rounded px-1.5 py-0.5 text-[10px] font-semibold",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded px-1.5 py-0.5 text-[10px] font-semibold",
}

const CONDITION_LABELS: Record<AlarmRule["conditionType"], string> = {
  "pod-not-running": "Pod not Running",
  "deployment-unavailable": "Deployment unavailable",
  "warning-event": "Warning Event",
  "node-not-ready": "Node not Ready",
}

function SeverityBadge({
  severity,
}: {
  severity: AlarmRule["severity"]
}): JSX.Element {
  return <span className={SEVERITY_CLASS[severity]}>{severity}</span>
}

// ── Rules panel ──────────────────────────────────────────────────────────────

export function AlarmRulesView(): JSX.Element {
  const alarmRules = useAppStore((s) => s.alarmRules)
  const addAlarmRule = useAppStore((s) => s.addAlarmRule)
  const deleteAlarmRule = useAppStore((s) => s.deleteAlarmRule)

  const [addOpen, setAddOpen] = useState(false)
  const [contexts, setContexts] = useState<K8sContext[]>([])

  const [formName, setFormName] = useState("")
  const [formCondition, setFormCondition] =
    useState<AlarmRule["conditionType"]>("pod-not-running")
  const [formSeverity, setFormSeverity] =
    useState<AlarmRule["severity"]>("warning")
  const [formContext, setFormContext] = useState("")
  const [formNamespace, setFormNamespace] = useState("")
  const [formFilter, setFormFilter] = useState("")

  useEffect(() => {
    window.api.k8s
      .listContexts()
      .then((data) => {
        setContexts(data)
        if (data.length > 0 && !formContext) setFormContext(data[0].name)
      })
      .catch(() => {})
  }, [])

  function resetForm(): void {
    setFormName("")
    setFormCondition("pod-not-running")
    setFormSeverity("warning")
    setFormContext(contexts[0]?.name ?? "")
    setFormNamespace("")
    setFormFilter("")
  }

  function handleAdd(): void {
    if (!formName.trim() || !formContext) return
    addAlarmRule({
      name: formName.trim(),
      conditionType: formCondition,
      severity: formSeverity,
      context: formContext,
      namespace: formNamespace.trim() || undefined,
      resourceNameFilter: formFilter.trim() || undefined,
    })
    toast.success(`Alarm rule "${formName.trim()}" added`)
    resetForm()
    setAddOpen(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Alarm Rules</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          Add Rule
        </Button>
      </div>

      {alarmRules.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No alarm rules defined. Add one to start monitoring.
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Name</TableHead>
                <TableHead className="whitespace-nowrap">Condition</TableHead>
                <TableHead className="whitespace-nowrap">Severity</TableHead>
                <TableHead className="whitespace-nowrap">Context</TableHead>
                <TableHead className="whitespace-nowrap">Namespace</TableHead>
                <TableHead className="whitespace-nowrap">Name Filter</TableHead>
                <TableHead className="whitespace-nowrap"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alarmRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {rule.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {CONDITION_LABELS[rule.conditionType]}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <SeverityBadge severity={rule.severity} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {rule.context}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {rule.namespace ?? (
                      <span className="text-muted-foreground">all</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {rule.resourceNameFilter ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <button
                      onClick={() => deleteAlarmRule(rule.id)}
                      className="rounded p-1 hover:bg-destructive/10 text-destructive"
                      aria-label="Delete rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent onClose={() => setAddOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add Alarm Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="alarm-name">Name</Label>
              <Input
                id="alarm-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="My alarm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="alarm-condition">Condition</Label>
              <select
                id="alarm-condition"
                value={formCondition}
                onChange={(e) =>
                  setFormCondition(e.target.value as AlarmRule["conditionType"])
                }
                className="w-full rounded border px-2 py-1 text-sm bg-background text-foreground"
              >
                <option value="pod-not-running">Pod not Running</option>
                <option value="deployment-unavailable">
                  Deployment unavailable
                </option>
                <option value="warning-event">Warning Event</option>
                <option value="node-not-ready">Node not Ready</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="alarm-severity">Severity</Label>
              <select
                id="alarm-severity"
                value={formSeverity}
                onChange={(e) =>
                  setFormSeverity(e.target.value as AlarmRule["severity"])
                }
                className="w-full rounded border px-2 py-1 text-sm bg-background text-foreground"
              >
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="alarm-context">Context</Label>
              <select
                id="alarm-context"
                value={formContext}
                onChange={(e) => setFormContext(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm bg-background text-foreground"
              >
                {contexts.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="alarm-namespace">
                Namespace{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="alarm-namespace"
                value={formNamespace}
                onChange={(e) => setFormNamespace(e.target.value)}
                placeholder="Leave blank for all namespaces"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="alarm-filter">
                Name filter{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Input
                id="alarm-filter"
                value={formFilter}
                onChange={(e) => setFormFilter(e.target.value)}
                placeholder="Substring match on resource name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!formName.trim() || !formContext}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Active alarms panel ──────────────────────────────────────────────────────

export function AlarmActiveView(): JSX.Element {
  const alarmRules = useAppStore((s) => s.alarmRules)
  const alarmEntries = useAppStore((s) => s.alarmEntries)
  const appendAlarmEntries = useAppStore((s) => s.appendAlarmEntries)
  const clearAlarmEntries = useAppStore((s) => s.clearAlarmEntries)
  const contextAliases = useAppStore((s) => s.contextAliases)

  const [evaluating, setEvaluating] = useState(false)

  async function evaluateAll(): Promise<void> {
    if (alarmRules.length === 0) {
      toast.info("No alarm rules defined. Add rules first.")
      return
    }
    setEvaluating(true)
    try {
      const results = await Promise.all(
        alarmRules.map((rule) => window.api.alarm.evaluate(rule)),
      )
      const allEntries: AlarmEntry[] = results.flat()
      appendAlarmEntries(allEntries)
      const count = allEntries.length
      toast.success(
        count === 0
          ? "Evaluation complete — no issues found"
          : `Evaluation complete — ${count} issue(s) found`,
      )
    } catch (e) {
      toast.error(`Evaluation failed: ${String(e)}`)
      useAppStore.getState().addGlobalError(String(e), "Alarms: evaluate")
    } finally {
      setEvaluating(false)
    }
  }

  const sorted = [...alarmEntries].reverse()

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Active Alarms</h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={evaluateAll} disabled={evaluating}>
            {evaluating ? "Evaluating…" : "Evaluate All Rules"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => clearAlarmEntries()}
            disabled={alarmEntries.length === 0}
          >
            Clear All
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No alarm entries. Click "Evaluate All Rules" to check the cluster.
        </div>
      ) : (
        <div className="overflow-x-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Severity</TableHead>
                <TableHead className="whitespace-nowrap">Rule</TableHead>
                <TableHead className="whitespace-nowrap">Cluster</TableHead>
                <TableHead className="whitespace-nowrap">Source</TableHead>
                <TableHead className="whitespace-nowrap">Namespace</TableHead>
                <TableHead className="whitespace-nowrap">Message</TableHead>
                <TableHead className="whitespace-nowrap">Triggered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((entry) => (
                <TableRow key={entry.id + entry.triggeredAt}>
                  <TableCell className="whitespace-nowrap">
                    <SeverityBadge severity={entry.severity} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {entry.ruleName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {contextAliases[entry.context] ?? entry.context}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.sourceKind} / {entry.sourceName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {entry.namespace ?? (
                      <span className="text-muted-foreground">
                        cluster-scoped
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {entry.message}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(entry.triggeredAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
