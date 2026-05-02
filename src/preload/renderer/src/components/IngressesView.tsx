import { dump as yamlDump } from "js-yaml"
import { X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog"
import { Button } from "../../components/ui/button"
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
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sIngress, K8sIngressRule, K8sIngressTLS } from "../types/k8s"
import { EmptyState } from "./EmptyState"

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
  onDeleted,
}: {
  item: K8sIngress
  onClose: () => void
  onDeleted: () => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleEdit(): void {
    const obj = {
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: item.name,
        namespace: item.namespace,
        ...(Object.keys(item.labels).length > 0 ? { labels: item.labels } : {}),
        ...(Object.keys(item.annotations).length > 0
          ? { annotations: item.annotations }
          : {}),
      },
      spec: {
        ...(item.ingressClassName
          ? { ingressClassName: item.ingressClassName }
          : {}),
        rules: item.rules.map((r) => ({
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
        ...(item.tls.length > 0
          ? {
              tls: item.tls.map((t) => ({
                hosts: t.hosts,
                secretName: t.secretName,
              })),
            }
          : {}),
      },
    }
    openDrawerTab({
      tabKey: `yaml-edit:Ingress:${item.namespace}/${item.name}`,
      type: "yaml-edit",
      resourceKind: "Ingress",
      resourceName: item.name,
      namespace: item.namespace,
      initialYaml: yamlDump(obj),
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.k8s.deleteIngress(item.namespace, item.name)
      toast.success(`Ingress ${item.name} deleted`)
      setDeleteOpen(false)
      onDeleted()
      onClose()
    } catch (e) {
      toast.error(String(e))
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg mb-1">{item.name}</h2>
          <p className="text-xs text-muted-foreground">{item.namespace}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={handleEdit}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </Button>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ingress</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {item.namespace}/{item.name}
              </strong>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
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
    </div>
  )
}

export function IngressesView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sIngress | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const {
    data: ingresses,
    loading,
    error,
    reload,
  } = useK8sResource(
    (ctx) => window.api.k8s.listIngresses({ contextName: ctx }),
    selectedContext,
  )

  const visibleIngresses = filterResources(
    ingresses,
    nameFilter,
    selectedNamespace,
  )

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Ingresses</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleIngresses.length === 0 && (
          <EmptyState message="No Ingresses found" />
        )}
        {!loading && !error && visibleIngresses.length > 0 && (
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.rules !== undefined && (
        <DetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={reload}
        />
      )}
    </div>
  )
}
