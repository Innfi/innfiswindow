import { useEffect, useState } from "react"
import { dump as yamlDump } from "js-yaml"
import { YamlEditorPanel } from "./YamlEditorPanel"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { useAppStore } from "../../store/app.store"
import { cn } from "../../lib/utils"
import { Pencil, Trash2, Plus, X, FileCode } from "lucide-react"

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

interface FlatRule {
  host: string
  path: string
  pathType: string
  serviceName: string
  servicePort: string
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

function flattenRules(rules: K8sIngressRule[]): FlatRule[] {
  const flat: FlatRule[] = []
  for (const rule of rules) {
    for (const p of rule.paths) {
      flat.push({
        host: rule.host || "",
        path: p.path,
        pathType: p.pathType,
        serviceName: p.serviceName,
        servicePort: String(p.servicePort),
      })
    }
  }
  if (flat.length === 0) {
    flat.push({ host: "", path: "/", pathType: "Prefix", serviceName: "", servicePort: "80" })
  }
  return flat
}

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

function RulesEditor({
  rules,
  onChange,
}: {
  rules: FlatRule[]
  onChange: (rules: FlatRule[]) => void
}): JSX.Element {
  function addRule(): void {
    onChange([
      ...rules,
      { host: "", path: "/", pathType: "Prefix", serviceName: "", servicePort: "80" },
    ])
  }

  function removeRule(i: number): void {
    onChange(rules.filter((_, idx) => idx !== i))
  }

  function updateRule(i: number, field: keyof FlatRule, value: string): void {
    onChange(rules.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Rules</Label>
        <Button type="button" variant="ghost" size="sm" onClick={addRule}>
          <Plus className="h-3 w-3 mr-1" />
          Add Rule
        </Button>
      </div>
      {rules.map((r, i) => (
        <div key={i} className="rounded border p-2 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Host</Label>
              <Input
                value={r.host}
                onChange={(e) => updateRule(i, "host", e.target.value)}
                placeholder="example.com"
                className="h-7 text-xs"
              />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs">Path Type</Label>
              <select
                value={r.pathType}
                onChange={(e) => updateRule(i, "pathType", e.target.value)}
                className={cn(SELECT_CLASS, "h-7 text-xs")}
              >
                <option>Prefix</option>
                <option>Exact</option>
                <option>ImplementationSpecific</option>
              </select>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 mt-5"
              onClick={() => removeRule(i)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex gap-2">
            <div className="w-24 space-y-1">
              <Label className="text-xs">Path</Label>
              <Input
                value={r.path}
                onChange={(e) => updateRule(i, "path", e.target.value)}
                placeholder="/"
                className="h-7 text-xs"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Service Name</Label>
              <Input
                value={r.serviceName}
                onChange={(e) => updateRule(i, "serviceName", e.target.value)}
                placeholder="my-service"
                className="h-7 text-xs"
              />
            </div>
            <div className="w-20 space-y-1">
              <Label className="text-xs">Port</Label>
              <Input
                value={r.servicePort}
                onChange={(e) => updateRule(i, "servicePort", e.target.value)}
                placeholder="80"
                className="h-7 text-xs"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DetailPanel({ item, onClose }: { item: K8sIngress; onClose: () => void }): JSX.Element {
  return (
    <div className="w-96 shrink-0 border-l overflow-y-auto p-4 space-y-4">
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
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Ingress Class</p>
        <p className="text-sm">
          {item.ingressClassName || (
            <span className="text-muted-foreground italic">none</span>
          )}
        </p>
      </div>

      {item.tls.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">TLS</p>
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
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Rules</p>
        {item.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No rules</p>
        ) : (
          <div className="space-y-3">
            {item.rules.map((rule: K8sIngressRule, i: number) => (
              <div key={i} className="rounded border p-2">
                <p className="font-mono text-sm font-medium mb-2">{rule.host}</p>
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
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Labels</p>
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
  const [ingressClassName, setIngressClassName] = useState("")
  const [rules, setRules] = useState<FlatRule[]>([
    { host: "", path: "/", pathType: "Prefix", serviceName: "", servicePort: "80" },
  ])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setNamespace(namespaces[0] ?? "default")
      setIngressClassName("")
      setRules([{ host: "", path: "/", pathType: "Prefix", serviceName: "", servicePort: "80" }])
      setError(null)
    }
  }, [open, namespaces])

  async function handleSubmit(): Promise<void> {
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (rules.length === 0) {
      setError("At least one rule is required.")
      return
    }
    const invalidRule = rules.find((r) => !r.serviceName.trim() || !r.servicePort.trim())
    if (invalidRule) {
      setError("All rules must have a service name and port.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.createIngress(
        namespace,
        name.trim(),
        ingressClassName.trim(),
        rules.map((r) => ({
          host: r.host.trim(),
          path: r.path.trim() || "/",
          pathType: r.pathType,
          serviceName: r.serviceName.trim(),
          servicePort: parseInt(r.servicePort, 10) || r.servicePort,
        })),
        [],
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
          <DialogTitle>New Ingress</DialogTitle>
          <DialogDescription>Create a new Kubernetes Ingress.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label htmlFor="create-ing-name">Name</Label>
            <Input
              id="create-ing-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-ingress"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-ing-namespace">Namespace</Label>
            <select
              id="create-ing-namespace"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              className={SELECT_CLASS}
            >
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="create-ing-class">Ingress Class Name</Label>
            <Input
              id="create-ing-class"
              value={ingressClassName}
              onChange={(e) => setIngressClassName(e.target.value)}
              placeholder="nginx"
            />
          </div>
          <RulesEditor rules={rules} onChange={setRules} />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
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
  ingress: K8sIngress | null
  onUpdated: () => void
}

function EditDialog({
  open,
  onOpenChange,
  ingress,
  onUpdated,
}: EditDialogProps): JSX.Element {
  const [ingressClassName, setIngressClassName] = useState("")
  const [rules, setRules] = useState<FlatRule[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && ingress) {
      setIngressClassName(ingress.ingressClassName || "")
      setRules(flattenRules(ingress.rules))
      setError(null)
    }
  }, [open, ingress])

  async function handleSubmit(): Promise<void> {
    if (!ingress) return
    if (rules.length === 0) {
      setError("At least one rule is required.")
      return
    }
    const invalidRule = rules.find((r) => !r.serviceName.trim() || !r.servicePort.trim())
    if (invalidRule) {
      setError("All rules must have a service name and port.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await window.api.k8s.updateIngress(
        ingress.namespace,
        ingress.name,
        ingressClassName.trim(),
        rules.map((r) => ({
          host: r.host.trim(),
          path: r.path.trim() || "/",
          pathType: r.pathType,
          serviceName: r.serviceName.trim(),
          servicePort: parseInt(r.servicePort, 10) || r.servicePort,
        })),
        ingress.tls,
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
          <DialogTitle>Edit Ingress</DialogTitle>
          <DialogDescription>
            {ingress ? `${ingress.namespace}/${ingress.name}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
          <div className="space-y-1">
            <Label htmlFor="edit-ing-class">Ingress Class Name</Label>
            <Input
              id="edit-ing-class"
              value={ingressClassName}
              onChange={(e) => setIngressClassName(e.target.value)}
              placeholder="nginx"
            />
          </div>
          <RulesEditor rules={rules} onChange={setRules} />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
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
            <strong>{ingress ? `${ingress.namespace}/${ingress.name}` : ""}</strong>? This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
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
  const [namespaces, setNamespaces] = useState<string[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<K8sIngress | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<K8sIngress | null>(null)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [yamlInitial, setYamlInitial] = useState("")
  const [yamlTitle, setYamlTitle] = useState("")

  const selectedItem = useAppStore((s) => s.selectedItem) as K8sIngress | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)

  function openNewYaml(): void {
    const template = yamlDump({
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: { name: "my-ingress", namespace: "default" },
      spec: {
        rules: [
          {
            host: "example.com",
            http: {
              paths: [
                {
                  path: "/",
                  pathType: "Prefix",
                  backend: { service: { name: "my-service", port: { number: 80 } } },
                },
              ],
            },
          },
        ],
      },
    })
    setYamlInitial(template)
    setYamlTitle("New Ingress (YAML)")
    setYamlOpen(true)
  }

  function openEditYaml(ing: K8sIngress): void {
    const obj = {
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: ing.name,
        namespace: ing.namespace,
        ...(Object.keys(ing.labels).length > 0 ? { labels: ing.labels } : {}),
        ...(Object.keys(ing.annotations).length > 0 ? { annotations: ing.annotations } : {}),
      },
      spec: {
        ...(ing.ingressClassName ? { ingressClassName: ing.ingressClassName } : {}),
        rules: ing.rules.map((r) => ({
          host: r.host,
          http: {
            paths: r.paths.map((p) => ({
              path: p.path,
              pathType: p.pathType,
              backend: {
                service: {
                  name: p.serviceName,
                  port: { number: typeof p.servicePort === "number" ? p.servicePort : parseInt(String(p.servicePort), 10) || 80 },
                },
              },
            })),
          },
        })),
        ...(ing.tls.length > 0
          ? { tls: ing.tls.map((t) => ({ hosts: t.hosts, secretName: t.secretName })) }
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
      .listIngresses()
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
    window.api.k8s
      .listNamespaces()
      .then((data) => setNamespaces(data.map((ns) => ns.name)))
      .catch(() => setNamespaces(["default"]))
  }, [])

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Ingresses</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openNewYaml}>
              <FileCode className="h-4 w-4" />
              New Resource (YAML)
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New Ingress
            </Button>
          </div>
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
              {ingresses.map((ing) => (
                <TableRow
                  key={`${ing.namespace}/${ing.name}`}
                  className={cn(
                    "cursor-pointer",
                    selectedItem?.name === ing.name &&
                      selectedItem?.namespace === ing.namespace &&
                      "bg-muted",
                  )}
                  onClick={() => setSelectedItem(selectedItem?.name === ing.name && selectedItem?.namespace === ing.namespace ? null : ing)}
                >
                  <TableCell className="font-medium">{ing.name}</TableCell>
                  <TableCell>{ing.namespace}</TableCell>
                  <TableCell>{ing.ingressClassName || "-"}</TableCell>
                  <TableCell>{ing.hosts}</TableCell>
                  <TableCell>{ing.address || "-"}</TableCell>
                  <TableCell>{ing.ports}</TableCell>
                  <TableCell>{formatAge(ing.creationTimestamp)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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
                        title="Edit"
                        onClick={() => setEditTarget(ing)}
                      >
                        <Pencil className="h-4 w-4" />
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
              {ingresses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No ingresses found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedItem && selectedItem.rules !== undefined && (
        <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        namespaces={namespaces.length > 0 ? namespaces : ["default"]}
        onCreated={() => {
          fetchIngresses()
          setSelectedItem(null)
        }}
      />

      <EditDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        ingress={editTarget}
        onUpdated={() => {
          fetchIngresses()
          setSelectedItem(null)
        }}
      />

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
