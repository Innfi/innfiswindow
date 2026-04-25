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
import { cn, filterResources } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { YamlEditorPanel } from "./YamlEditorPanel"

interface K8sIngressTLS {
  secretName: string
  hosts: string[]
}

interface K8sIngressPath {
  path: string
  pathType: string
  serviceName: string
  servicePort: string | number
}

interface K8sIngressRule {
  host: string
  paths: K8sIngressPath[]
}

interface K8sIngress {
  name: string
  namespace: string
  ingressClassName: string
  hosts: string
  address: string
  ports: string
  creationTimestamp: string
  tls: K8sIngressTLS[]
  rules: K8sIngressRule[]
  labels: Record<string, string>
  annotations: Record<string, string>
}

function formatAge(timestamp: string): string {
  if (!timestamp) return ""
  const diff = Date.now() - new Date(timestamp).getTime()
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d`
  const hours = Math.floor(diff / 3600000)
  if (hours > 0) return `${hours}h`
  const mins = Math.floor(diff / 60000)
  return `${mins}m`
}

function DetailPanel({
  item,
  onClose,
}: {
  item: K8sIngress
  onClose: () => void
}): JSX.Element {
  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg mb-1">{item.name}</h2>
          <p className="text-xs text-muted-foreground">{item.namespace}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
          Ingress Class
        </p>
        <p className="text-sm">
          {item.ingressClassName || (
            <span className="text-muted-foreground italic">none</span>
          )}
        </p>
      </div>

      {item.tls.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
            TLS
          </p>
          <div className="space-y-2">
            {item.tls.map((t: K8sIngressTLS, i: number) => (
              <div key={i} className="rounded border p-2 text-sm space-y-1">
                <div>
                  <span className="text-muted-foreground">Secret: </span>
                  <span className="font-mono">
                    {t.secretName || (
                      <span className="italic text-muted-foreground">none</span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Hosts: </span>
                  <span>{t.hosts.length > 0 ? t.hosts.join(", ") : "*"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
          Rules
        </p>
        {item.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No rules</p>
        ) : (
          <div className="space-y-3">
            {item.rules.map((rule: K8sIngressRule, i: number) => (
              <div key={i} className="rounded border p-2">
                <p className="font-mono text-sm font-medium mb-2">
                  {rule.host}
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left pb-1">Path</th>
                      <th className="text-left pb-1">Type</th>
                      <th className="text-left pb-1">Service</th>
                      <th className="text-left pb-1">Port</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rule.paths.map((p, j) => (
                      <tr key={j}>
                        <td className="font-mono pr-2">{p.path}</td>
                        <td className="pr-2">{p.pathType}</td>
                        <td className="pr-2">{p.serviceName}</td>
                        <td>{String(p.servicePort)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {Object.keys(item.labels).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Labels
          </p>
          <div className="space-y-0.5">
            {Object.entries(item.labels).map(([k, v]) => (
              <div key={k} className="text-xs font-mono">
                <span className="text-muted-foreground">{k}=</span>
                {v}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(item.annotations).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Annotations
          </p>
          <div className="space-y-0.5">
            {Object.entries(item.annotations).map(([k, v]) => (
              <div key={k} className="text-xs font-mono break-all">
                <span className="text-muted-foreground">{k}=</span>
                {v}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingress: K8sIngress | null
  onDeleted: () => void
}

function DeleteDialog({
  open,
  onOpenChange,
  ingress,
  onDeleted,
}: DeleteDialogProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  async function handleDelete(): Promise<void> {
    if (!ingress) return
    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.deleteIngress(ingress.namespace, ingress.name)
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
          <DialogTitle>Delete Ingress</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {ingress ? `${ingress.namespace}/${ingress.name}` : ""}
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

export function IngressesView(): JSX.Element {
  const [ingresses, setIngresses] = useState<K8sIngress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<K8sIngress | null>(null)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlInitial, setYamlInitial] = useState("")
  const [yamlTitle, setYamlTitle] = useState("")

  const selectedItem = useAppStore((s) => s.selectedItem) as K8sIngress | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const visibleIngresses = filterResources(
    ingresses,
    nameFilter,
    selectedNamespace,
  )

  function openEditYaml(ing: K8sIngress): void {
    const obj = {
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: ing.name,
        namespace: ing.namespace,
        ...(Object.keys(ing.labels).length > 0 ? { labels: ing.labels } : {}),
        ...(Object.keys(ing.annotations).length > 0
          ? { annotations: ing.annotations }
          : {}),
      },
      spec: {
        ...(ing.ingressClassName
          ? { ingressClassName: ing.ingressClassName }
          : {}),
        rules: ing.rules.map((r) => ({
          host: r.host,
          http: {
            paths: r.paths.map((p) => ({
              path: p.path,
              pathType: p.pathType,
              backend: {
                service: {
                  name: p.serviceName,
                  port: {
                    number:
                      typeof p.servicePort === "number"
                        ? p.servicePort
                        : parseInt(String(p.servicePort), 10) || 80,
                  },
                },
              },
            })),
          },
        })),
        ...(ing.tls.length > 0
          ? {
              tls: ing.tls.map((t) => ({
                hosts: t.hosts,
                secretName: t.secretName,
              })),
            }
          : {}),
      },
    }
    setYamlInitial(yamlDump(obj))
    setYamlTitle(`Edit Ingress: ${ing.namespace}/${ing.name}`)
    setYamlOpen(true)
  }

  function fetchIngresses(): void {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listIngresses({ contextName: selectedContext ?? undefined })
      .then((data) => {
        setIngresses(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchIngresses()
  }, [selectedContext])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Ingresses</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Hosts</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead>Age</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleIngresses.map((ing) => (
                <TableRow
                  key={`${ing.namespace}/${ing.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === ing.name &&
                      selectedItem?.namespace === ing.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === ing.name &&
                        selectedItem?.namespace === ing.namespace
                        ? null
                        : ing,
                    )
                  }
                >
                  <TableCell className="font-medium">{ing.name}</TableCell>
                  <TableCell>{ing.namespace}</TableCell>
                  <TableCell>{ing.ingressClassName || "-"}</TableCell>
                  <TableCell>{ing.hosts}</TableCell>
                  <TableCell>{ing.address || "-"}</TableCell>
                  <TableCell>{ing.ports}</TableCell>
                  <TableCell>{formatAge(ing.creationTimestamp)}</TableCell>
                  <TableCell>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit YAML"
                        onClick={() => openEditYaml(ing)}
                      >
                        <FileCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(ing)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {visibleIngresses.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground"
                  >
                    No ingresses found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.rules !== undefined && (
        <DetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <DeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        ingress={deleteTarget}
        onDeleted={() => {
          fetchIngresses()
          setSelectedItem(null)
        }}
      />

      <YamlEditorPanel
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        initialYaml={yamlInitial}
        title={yamlTitle}
        onApplied={() => {
          fetchIngresses()
          setSelectedItem(null)
        }}
      />
    </div>
  )
}
