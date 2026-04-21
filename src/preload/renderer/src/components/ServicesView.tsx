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
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { YamlEditorPanel } from "./YamlEditorPanel"

interface K8sServicePort {
  name: string
  protocol: string
  port: number
  targetPort: string
  nodePort: number | null
}

interface K8sService {
  name: string
  namespace: string
  type: string
  clusterIP: string
  externalIP: string
  ports: K8sServicePort[]
  creationTimestamp: string
  selector: Record<string, string>
  labels: Record<string, string>
  annotations: Record<string, string>
}

function formatPorts(ports: K8sServicePort[]): string {
  if (ports.length === 0) return "-"
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ")
}

function DetailPanel({
  svc,
  onClose,
}: {
  svc: K8sService
  onClose: () => void
}): JSX.Element {
  const selectorEntries = Object.entries(svc.selector)
  const labelEntries = Object.entries(svc.labels)
  const annotationEntries = Object.entries(svc.annotations)

  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{svc.name}</h2>
          <span className="text-xs text-muted-foreground">{svc.namespace}</span>
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
          Network
        </h3>
        <div className="flex gap-2 text-sm">
          <span className="shrink-0 font-medium text-muted-foreground">
            Type:
          </span>
          <span>{svc.type}</span>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="shrink-0 font-medium text-muted-foreground">
            ClusterIP:
          </span>
          <span className="font-mono">{svc.clusterIP || "-"}</span>
        </div>
        {svc.externalIP && (
          <div className="flex gap-2 text-sm">
            <span className="shrink-0 font-medium text-muted-foreground">
              External IP:
            </span>
            <span className="font-mono">{svc.externalIP}</span>
          </div>
        )}
      </div>

      {svc.ports.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Ports
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="text-left font-medium pb-1">Name</th>
                <th className="text-left font-medium pb-1">Protocol</th>
                <th className="text-left font-medium pb-1">Port</th>
                <th className="text-left font-medium pb-1">Target</th>
                <th className="text-left font-medium pb-1">NodePort</th>
              </tr>
            </thead>
            <tbody>
              {svc.ports.map((p, i) => (
                <tr key={i} className="font-mono text-xs">
                  <td className="py-0.5">{p.name || "-"}</td>
                  <td className="py-0.5">{p.protocol}</td>
                  <td className="py-0.5">{p.port}</td>
                  <td className="py-0.5">{p.targetPort}</td>
                  <td className="py-0.5">{p.nodePort ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector
          </h3>
          {selectorEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Labels
          </h3>
          {labelEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Annotations
          </h3>
          {annotationEntries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">
                {k}:
              </span>
              <span className="break-all">{v}</span>
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
  service: K8sService | null
  onDeleted: () => void
}

function DeleteDialog({
  open,
  onOpenChange,
  service,
  onDeleted,
}: DeleteDialogProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  async function handleDelete(): Promise<void> {
    if (!service) return
    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.deleteService(service.namespace, service.name)
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
          <DialogTitle>Delete Service</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {service ? `${service.namespace}/${service.name}` : ""}
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

export function ServicesView(): JSX.Element {
  const [services, setServices] = useState<K8sService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<K8sService | null>(null)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlInitial, setYamlInitial] = useState("")
  const [yamlTitle, setYamlTitle] = useState("")

  const selectedItem = useAppStore((s) => s.selectedItem) as K8sService | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const nameFilter = useAppStore((s) => s.nameFilter)

  const visibleServices = filterResources(
    services,
    nameFilter,
    selectedNamespace,
  )

  function openEditYaml(svc: K8sService): void {
    const obj = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: svc.name,
        namespace: svc.namespace,
        ...(Object.keys(svc.labels).length > 0 ? { labels: svc.labels } : {}),
      },
      spec: {
        type: svc.type,
        ...(Object.keys(svc.selector).length > 0
          ? { selector: svc.selector }
          : {}),
        ports: svc.ports.map((p) => ({
          name: p.name || undefined,
          protocol: p.protocol,
          port: p.port,
          targetPort: isNaN(Number(p.targetPort))
            ? p.targetPort
            : Number(p.targetPort),
          ...(p.nodePort ? { nodePort: p.nodePort } : {}),
        })),
      },
    }
    setYamlInitial(yamlDump(obj))
    setYamlTitle(`Edit Service: ${svc.namespace}/${svc.name}`)
    setYamlOpen(true)
  }

  function fetchServices(): void {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listServices()
      .then((data) => {
        setServices(data)
        setLoading(false)
      })
      .catch((err) => {
        handleIpcError(err, "Services")
        setError(String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchServices()
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Services</h1>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>ClusterIP</TableHead>
                <TableHead>External IP</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead>Age</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleServices.map((svc) => (
                <TableRow
                  key={`${svc.namespace}/${svc.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === svc.name &&
                      selectedItem?.namespace === svc.namespace &&
                      "bg-muted",
                  )}
                  onClick={() =>
                    setSelectedItem(
                      selectedItem?.name === svc.name &&
                        selectedItem?.namespace === svc.namespace
                        ? null
                        : svc,
                    )
                  }
                >
                  <TableCell>{svc.name}</TableCell>
                  <TableCell>{svc.namespace}</TableCell>
                  <TableCell>{svc.type}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {svc.clusterIP || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {svc.externalIP || "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatPorts(svc.ports)}
                  </TableCell>
                  <TableCell>{formatAge(svc.creationTimestamp)}</TableCell>
                  <TableCell>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit YAML"
                        onClick={() => openEditYaml(svc)}
                      >
                        <FileCode className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(svc)}
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

      {selectedItem && selectedItem.type !== undefined && (
        <DetailPanel svc={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      <DeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        service={deleteTarget}
        onDeleted={() => {
          fetchServices()
          setSelectedItem(null)
        }}
      />

      <YamlEditorPanel
        open={yamlOpen}
        onOpenChange={setYamlOpen}
        initialYaml={yamlInitial}
        title={yamlTitle}
        onApplied={() => {
          fetchServices()
          setSelectedItem(null)
        }}
      />
    </div>
  )
}
