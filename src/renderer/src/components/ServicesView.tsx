import { useEffect, useState } from "react"
import { useAppStore } from "../../store/app.store"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { cn } from "../../lib/utils"
import { Pencil, Trash2, Plus, X } from "lucide-react"

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

interface PortEntry {
  protocol: string
  port: string
  targetPort: string
}

interface SelectorEntry {
  key: string
  value: string
}

function formatAge(isoTimestamp: string): string {
  if (!isoTimestamp) return "-"
  const diffMs = Date.now() - new Date(isoTimestamp).getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return `${diffSecs}s`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

function formatPorts(ports: K8sServicePort[]): string {
  if (ports.length === 0) return "-"
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ")
}

function DetailPanel({ svc }: { svc: K8sService }): JSX.Element {
  const selectorEntries = Object.entries(svc.selector)
  const labelEntries = Object.entries(svc.labels)
  const annotationEntries = Object.entries(svc.annotations)

  return (
    <div className="w-96 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{svc.name}</h2>
        <span className="text-xs text-muted-foreground">{svc.namespace}</span>
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

function PortsEditor({
  ports,
  onChange,
}: {
  ports: PortEntry[]
  onChange: (ports: PortEntry[]) => void
}): JSX.Element {
  function updatePort(idx: number, field: keyof PortEntry, value: string): void {
    const updated = ports.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    onChange(updated)
  }

  function addPort(): void {
    onChange([...ports, { protocol: "TCP", port: "", targetPort: "" }])
  }

  function removePort(idx: number): void {
    onChange(ports.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Ports</Label>
        <Button type="button" variant="outline" size="sm" onClick={addPort}>
          <Plus className="h-3 w-3 mr-1" />
          Add Port
        </Button>
      </div>
      {ports.map((p, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select
            value={p.protocol}
            onChange={(e) => updatePort(i, "protocol", e.target.value)}
            className="flex h-8 w-20 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option>TCP</option>
            <option>UDP</option>
            <option>SCTP</option>
          </select>
          <Input
            className="h-8 w-20"
            placeholder="Port"
            value={p.port}
            onChange={(e) => updatePort(i, "port", e.target.value)}
          />
          <Input
            className="h-8 w-24"
            placeholder="TargetPort"
            value={p.targetPort}
            onChange={(e) => updatePort(i, "targetPort", e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removePort(i)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {ports.length === 0 && (
        <p className="text-xs text-muted-foreground">No ports configured.</p>
      )}
    </div>
  )
}

function SelectorEditor({
  entries,
  onChange,
}: {
  entries: SelectorEntry[]
  onChange: (entries: SelectorEntry[]) => void
}): JSX.Element {
  function updateEntry(idx: number, field: keyof SelectorEntry, value: string): void {
    const updated = entries.map((e, i) => (i === idx ? { ...e, [field]: value } : e))
    onChange(updated)
  }

  function addEntry(): void {
    onChange([...entries, { key: "", value: "" }])
  }

  function removeEntry(idx: number): void {
    onChange(entries.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Selector</Label>
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>
      {entries.map((e, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            className="h-8"
            placeholder="key"
            value={e.key}
            onChange={(ev) => updateEntry(i, "key", ev.target.value)}
          />
          <span className="text-muted-foreground text-sm">=</span>
          <Input
            className="h-8"
            placeholder="value"
            value={e.value}
            onChange={(ev) => updateEntry(i, "value", ev.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removeEntry(i)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No selector labels.</p>
      )}
    </div>
  )
}

interface CreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  namespaces: string[]
  onCreated: () => void
}

function CreateDialog({
  open,
  onOpenChange,
  namespaces,
  onCreated,
}: CreateDialogProps): JSX.Element {
  const [name, setName] = useState("")
  const [namespace, setNamespace] = useState(namespaces[0] ?? "default")
  const [type, setType] = useState("ClusterIP")
  const [ports, setPorts] = useState<PortEntry[]>([
    { protocol: "TCP", port: "", targetPort: "" },
  ])
  const [selector, setSelector] = useState<SelectorEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setNamespace(namespaces[0] ?? "default")
      setType("ClusterIP")
      setPorts([{ protocol: "TCP", port: "", targetPort: "" }])
      setSelector([])
      setError(null)
    }
  }, [open, namespaces])

  async function handleSubmit(): Promise<void> {
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (ports.length === 0) {
      setError("At least one port is required.")
      return
    }
    const invalidPort = ports.find((p) => !p.port.trim() || !p.targetPort.trim())
    if (invalidPort) {
      setError("All port and targetPort fields are required.")
      return
    }
    const parsedPorts = ports.map((p) => ({
      protocol: p.protocol,
      port: parseInt(p.port, 10),
      targetPort: isNaN(parseInt(p.targetPort, 10))
        ? p.targetPort
        : parseInt(p.targetPort, 10),
    }))
    const selectorMap: Record<string, string> = {}
    for (const entry of selector) {
      if (entry.key.trim()) selectorMap[entry.key.trim()] = entry.value.trim()
    }

    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.createService(
        namespace,
        name.trim(),
        type,
        parsedPorts,
        selectorMap,
      )
      onCreated()
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
          <DialogTitle>New Service</DialogTitle>
          <DialogDescription>Create a new Kubernetes Service.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label htmlFor="create-svc-name">Name</Label>
            <Input
              id="create-svc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-service"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-svc-namespace">Namespace</Label>
            <select
              id="create-svc-namespace"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-svc-type">Type</Label>
            <select
              id="create-svc-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option>ClusterIP</option>
              <option>NodePort</option>
              <option>LoadBalancer</option>
            </select>
          </div>
          <PortsEditor ports={ports} onChange={setPorts} />
          <SelectorEditor entries={selector} onChange={setSelector} />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface EditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: K8sService | null
  onUpdated: () => void
}

function EditDialog({
  open,
  onOpenChange,
  service,
  onUpdated,
}: EditDialogProps): JSX.Element {
  const [type, setType] = useState("ClusterIP")
  const [ports, setPorts] = useState<PortEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && service) {
      setType(service.type)
      setPorts(
        service.ports.map((p) => ({
          protocol: p.protocol,
          port: String(p.port),
          targetPort: String(p.targetPort),
        })),
      )
      setError(null)
    }
  }, [open, service])

  async function handleSubmit(): Promise<void> {
    if (!service) return
    if (ports.length === 0) {
      setError("At least one port is required.")
      return
    }
    const invalidPort = ports.find((p) => !p.port.trim() || !p.targetPort.trim())
    if (invalidPort) {
      setError("All port and targetPort fields are required.")
      return
    }
    const parsedPorts = ports.map((p) => ({
      protocol: p.protocol,
      port: parseInt(p.port, 10),
      targetPort: isNaN(parseInt(p.targetPort, 10))
        ? p.targetPort
        : parseInt(p.targetPort, 10),
    }))

    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.updateService(
        service.namespace,
        service.name,
        type,
        parsedPorts,
      )
      onUpdated()
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
          <DialogTitle>Edit Service</DialogTitle>
          <DialogDescription>
            {service ? `${service.namespace}/${service.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label htmlFor="edit-svc-type">Type</Label>
            <select
              id="edit-svc-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option>ClusterIP</option>
              <option>NodePort</option>
              <option>LoadBalancer</option>
            </select>
          </div>
          <PortsEditor ports={ports} onChange={setPorts} />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [namespaces, setNamespaces] = useState<string[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<K8sService | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<K8sService | null>(null)

  const selectedItem = useAppStore((s) => s.selectedItem) as K8sService | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

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
        setError(String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchServices()
    window.api.k8s
      .listNamespaces()
      .then((data) => setNamespaces(data.map((ns) => ns.name)))
      .catch(() => setNamespaces(["default"]))
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Services</h1>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New Service
          </Button>
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
              {services.map((svc) => (
                <TableRow
                  key={`${svc.namespace}/${svc.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === svc.name &&
                      selectedItem?.namespace === svc.namespace &&
                      "bg-muted",
                  )}
                  onClick={() => setSelectedItem(svc)}
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
                        title="Edit"
                        onClick={() => setEditTarget(svc)}
                      >
                        <Pencil className="h-4 w-4" />
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
        <DetailPanel svc={selectedItem} />
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        namespaces={namespaces.length > 0 ? namespaces : ["default"]}
        onCreated={() => {
          fetchServices()
          setSelectedItem(null)
        }}
      />

      <EditDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        service={editTarget}
        onUpdated={() => {
          fetchServices()
          setSelectedItem(null)
        }}
      />

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
    </div>
  )
}
