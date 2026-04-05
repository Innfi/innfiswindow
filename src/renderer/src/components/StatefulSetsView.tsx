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
import { Pencil, Trash2, Plus } from "lucide-react"

interface K8sStatefulSetContainer {
  name: string
  image: string
}

interface K8sStatefulSetVolumeClaimTemplate {
  name: string
  storage: string
}

interface K8sStatefulSet {
  name: string
  namespace: string
  replicas: number
  readyReplicas: number
  creationTimestamp: string
  serviceName: string
  updateStrategy: string
  selector: Record<string, string>
  containers: K8sStatefulSetContainer[]
  volumeClaimTemplates: K8sStatefulSetVolumeClaimTemplate[]
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

function MetaEntry({
  label,
  value,
}: {
  label: string
  value: string
}): JSX.Element {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground w-32">
        {label}
      </span>
      <span className="break-all">{value}</span>
    </div>
  )
}

function DetailPanel({ ss }: { ss: K8sStatefulSet }): JSX.Element {
  const selectorEntries = Object.entries(ss.selector)

  return (
    <div className="w-80 shrink-0 border-l h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-base mb-1">{ss.name}</h2>
        <span className="text-xs text-muted-foreground">{ss.namespace}</span>
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Replicas
        </h3>
        <MetaEntry label="Desired" value={String(ss.replicas)} />
        <MetaEntry label="Ready" value={String(ss.readyReplicas)} />
        <MetaEntry
          label="Created"
          value={new Date(ss.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Configuration
        </h3>
        <MetaEntry label="Service Name" value={ss.serviceName} />
        <MetaEntry label="Update Strategy" value={ss.updateStrategy} />
      </div>

      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Selector Labels
          </h3>
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {ss.containers.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Containers
          </h3>
          {ss.containers.map((c) => (
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

      {ss.volumeClaimTemplates.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Volume Claim Templates
          </h3>
          {ss.volumeClaimTemplates.map((vct) => (
            <div
              key={vct.name}
              className="text-sm border rounded p-2 space-y-0.5"
            >
              <div className="font-medium">{vct.name}</div>
              <div className="text-xs text-muted-foreground">{vct.storage}</div>
            </div>
          ))}
        </div>
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
  const [image, setImage] = useState("")
  const [replicas, setReplicas] = useState(1)
  const [serviceName, setServiceName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setNamespace(namespaces[0] ?? "default")
      setImage("")
      setReplicas(1)
      setServiceName("")
      setError(null)
    }
  }, [open, namespaces])

  async function handleSubmit(): Promise<void> {
    if (!name.trim() || !image.trim() || !serviceName.trim()) {
      setError("Name, image, and service name are required.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.createStatefulSet(
        namespace,
        name.trim(),
        image.trim(),
        replicas,
        serviceName.trim(),
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
          <DialogTitle>New StatefulSet</DialogTitle>
          <DialogDescription>
            Create a new Kubernetes StatefulSet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="create-ss-name">Name</Label>
            <Input
              id="create-ss-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-statefulset"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-ss-namespace">Namespace</Label>
            <select
              id="create-ss-namespace"
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
            <Label htmlFor="create-ss-image">Image</Label>
            <Input
              id="create-ss-image"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="nginx:latest"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-ss-replicas">Replicas</Label>
            <Input
              id="create-ss-replicas"
              type="number"
              min={0}
              value={replicas}
              onChange={(e) => setReplicas(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-ss-servicename">Service Name</Label>
            <Input
              id="create-ss-servicename"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="my-service"
            />
          </div>
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
  statefulSet: K8sStatefulSet | null
  onUpdated: () => void
}

function EditDialog({
  open,
  onOpenChange,
  statefulSet,
  onUpdated,
}: EditDialogProps): JSX.Element {
  const [image, setImage] = useState("")
  const [replicas, setReplicas] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && statefulSet) {
      setImage(statefulSet.containers[0]?.image ?? "")
      setReplicas(statefulSet.replicas)
      setError(null)
    }
  }, [open, statefulSet])

  async function handleSubmit(): Promise<void> {
    if (!statefulSet) return
    if (!image.trim()) {
      setError("Image is required.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.updateStatefulSet(
        statefulSet.namespace,
        statefulSet.name,
        image.trim(),
        replicas,
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
          <DialogTitle>Edit StatefulSet</DialogTitle>
          <DialogDescription>
            {statefulSet ? `${statefulSet.namespace}/${statefulSet.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edit-ss-image">Image</Label>
            <Input
              id="edit-ss-image"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="nginx:latest"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-ss-replicas">Replicas</Label>
            <Input
              id="edit-ss-replicas"
              type="number"
              min={0}
              value={replicas}
              onChange={(e) => setReplicas(Number(e.target.value))}
            />
          </div>
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
  statefulSet: K8sStatefulSet | null
  onDeleted: () => void
}

function DeleteDialog({
  open,
  onOpenChange,
  statefulSet,
  onDeleted,
}: DeleteDialogProps): JSX.Element {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  async function handleDelete(): Promise<void> {
    if (!statefulSet) return
    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.deleteStatefulSet(
        statefulSet.namespace,
        statefulSet.name,
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
          <DialogTitle>Delete StatefulSet</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <strong>
              {statefulSet
                ? `${statefulSet.namespace}/${statefulSet.name}`
                : ""}
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

export function StatefulSetsView(): JSX.Element {
  const [statefulSets, setStatefulSets] = useState<K8sStatefulSet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [namespaces, setNamespaces] = useState<string[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<K8sStatefulSet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<K8sStatefulSet | null>(null)

  const selectedItem = useAppStore(
    (s) => s.selectedItem,
  ) as K8sStatefulSet | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  function fetchStatefulSets(): void {
    setLoading(true)
    setError(null)
    window.api.k8s
      .listStatefulSets()
      .then((data) => {
        setStatefulSets(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchStatefulSets()
    window.api.k8s
      .listNamespaces()
      .then((data) => setNamespaces(data.map((ns) => ns.name)))
      .catch(() => setNamespaces(["default"]))
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">StatefulSets</h1>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New StatefulSet
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
                <TableHead>Ready</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Service</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statefulSets.map((ss) => (
                <TableRow
                  key={`${ss.namespace}/${ss.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === ss.name &&
                      selectedItem?.namespace === ss.namespace &&
                      "bg-muted",
                  )}
                  onClick={() => setSelectedItem(ss)}
                >
                  <TableCell>{ss.name}</TableCell>
                  <TableCell>{ss.namespace}</TableCell>
                  <TableCell>
                    {ss.readyReplicas}/{ss.replicas}
                  </TableCell>
                  <TableCell>{formatAge(ss.creationTimestamp)}</TableCell>
                  <TableCell>{ss.serviceName}</TableCell>
                  <TableCell>
                    <div
                      className="flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => setEditTarget(ss)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleteTarget(ss)}
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

      {selectedItem && selectedItem.serviceName !== undefined && (
        <DetailPanel ss={selectedItem} />
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        namespaces={namespaces.length > 0 ? namespaces : ["default"]}
        onCreated={() => {
          fetchStatefulSets()
          setSelectedItem(null)
        }}
      />

      <EditDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        statefulSet={editTarget}
        onUpdated={() => {
          fetchStatefulSets()
          setSelectedItem(null)
        }}
      />

      <DeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        statefulSet={deleteTarget}
        onDeleted={() => {
          fetchStatefulSets()
          setSelectedItem(null)
        }}
      />
    </div>
  )
}
