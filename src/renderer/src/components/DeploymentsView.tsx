import { dump as yamlDump } from "js-yaml"
import { FileCode, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { handleIpcError } from "../../lib/ipc-error"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { MetaEntry } from "./MetaEntry"
import { YamlEditorPanel } from "./YamlEditorPanel"

interface K8sDeploymentCondition {
  type: string
  status: string
  reason: string
  message: string
}

interface K8sDeploymentContainer {
  name: string
  image: string
}

interface K8sDeployment {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  updatedReplicas: number
  availableReplicas: number
  strategy: string
  creationTimestamp: string
  selector: Record<string, string>
  containers: K8sDeploymentContainer[]
  conditions: K8sDeploymentCondition[]
}

function DetailPanel({
  deployment,
  onClose,
}: {
  deployment: K8sDeployment
  onClose: () => void
}): JSX.Element {
  const selectorEntries = Object.entries(deployment.selector)

  return (
    <div className="w-80 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{deployment.name}</h2>
          <span className="text-xs text-muted-foreground">
            {deployment.namespace}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Desired" value={String(deployment.replicas)} />
        <MetaEntry label="Ready" value={String(deployment.readyReplicas)} />
        <MetaEntry
          label="Up-to-date"
          value={String(deployment.updatedReplicas)}
        />
        <MetaEntry
          label="Available"
          value={String(deployment.availableReplicas)}
        />
        <MetaEntry label="Strategy" value={deployment.strategy} />
        <MetaEntry
          label="Created"
          value={new Date(deployment.creationTimestamp).toLocaleString()}
        />
      </div>

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {deployment.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {deployment.containers.map((c) => (
            <div
              key={c.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground break-all">
                {c.image}
              </div>
            </div>
          ))}
        </div>
      )}

      {deployment.conditions.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Conditions
          </h3>
          {deployment.conditions.map((c) => (
            <div
              key={c.type}
              className="text-sm space-y-0.5 border rounded p-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.type}</span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs",
                    c.status === "True"
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800",
                  )}
                >
                  {c.status}
                </span>
              </div>
              {c.reason && (
                <div className="text-xs text-muted-foreground">{c.reason}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deployment: K8sDeployment | null
  onDeleted: () => void
}

function DeleteDialog({
  open,
  onOpenChange,
  deployment,
  onDeleted,
}: DeleteDialogProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  async function handleDelete(): Promise<void> {
    if (!deployment) return
    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.deleteDeployment(
        deployment.namespace,
        deployment.name,
      )
      onDeleted()
      onOpenChange(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Delete Deployment</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {deployment ? `${deployment.namespace}/${deployment.name}` : ""}
            </strong>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeploymentsView(): JSX.Element {
  const [deployments, setDeployments] = useState<K8sDeployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<K8sDeployment | null>(null)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlInitial, setYamlInitial] = useState("")
  const [yamlTitle, setYamlTitle] = useState("")

  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sDeployment | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  function fetchDeployments(): void {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listDeployments()
      .then((data) => {
        setDeployments(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "Deployments")
        setError(String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchDeployments()
  }, [])

  function openEditYaml(d: K8sDeployment): void {
    const obj = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: { name: d.name, namespace: d.namespace },
      spec: {
        replicas: d.replicas,
        selector: { matchLabels: d.selector },
        template: {
          metadata: { labels: d.selector },
          spec: {
            containers: d.containers.map((c) => ({
              name: c.name,
              image: c.image,
            })),
          },
        },
      },
    }
    setYamlInitial(yamlDump(obj))
    setYamlTitle(`Edit Deployment: ${d.namespace}/${d.name}`)
    setYamlOpen(true)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Deployments</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Up-to-date</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Age</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.map((d) => (
                <TableRow
                  key={`${d.namespace}/${d.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === d.name &&
                      selectedItem?.namespace === d.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === d.name &&
                        selectedItem?.namespace === d.namespace
                        ? null
                        : d,
                    )
                  }
                >
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.namespace}</TableCell>
                  <TableCell>{`${d.readyReplicas}/${d.replicas}`}</TableCell>
                  <TableCell>{d.updatedReplicas}</TableCell>
                  <TableCell>{d.availableReplicas}</TableCell>
                  <TableCell>{formatAge(d.creationTimestamp)}</TableCell>
                  <TableCell>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit YAML"
                        onClick={() => openEditYaml(d)}
                      >
                        <FileCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(d)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.namespace !== undefined && (
        <DetailPanel
          deployment={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <DeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        deployment={deleteTarget}
        onDeleted={() => {
          fetchDeployments()
          setSelectedItem(null)
        }}
      />

      <YamlEditorPanel
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        initialYaml={yamlInitial}
        title={yamlTitle}
        onApplied={() => {
          fetchDeployments()
          setSelectedItem(null)
        }}
      />
    </div>
  )
}
