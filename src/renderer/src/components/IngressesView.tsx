import { dump as yamlDump } from "js-yaml"
import { X } from "lucide-react"
import { useEffect, useState } from "react"
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
import { cn, filterResources, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sIngress, K8sIngressRule, K8sIngressTLS } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { MetaEntry } from "./MetaEntry"
import { RefreshBar } from "./RefreshBar"
import { ResourceEventsSection } from "./ResourceEventsSection"

function SectionHeader({ title }: { title: string }): JSX.Element {
  return (
    <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
      {title}
    </h3>
  )
}

function DetailPanel({
  item,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  item: K8sIngress
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const labelEntries = Object.entries(item.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(item.annotations)
    .filter(([k]) => !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"))
    .filter(([k, v]) => kv(k, v))

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  function handleEdit(): void {
    const obj = {
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: item.name,
        namespace: item.namespace,
        ...(Object.keys(item.labels).length > 0 ? { labels: item.labels } : {}),
        ...(Object.keys(item.annotations).length > 0 ? { annotations: item.annotations } : {}),
      },
      spec: {
        ...(item.ingressClassName ? { ingressClassName: item.ingressClassName } : {}),
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
          ? { tls: item.tls.map((t) => ({ hosts: t.hosts, secretName: t.secretName })) }
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
      appendHistory({
        action: "delete",
        resourceKind: "Ingress",
        resourceName: item.name,
        namespace: item.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`Ingress ${item.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "Ingress",
        resourceName: item.name,
        namespace: item.namespace,
        context: selectedContext ?? "",
        success: false,
        error: String(e),
      })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Ingress: delete")
      setDeleteOpenNotify(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{item.name}</h2>
          <span className="text-xs text-muted-foreground">{item.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleEdit}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setDeleteOpenNotify(true)}>
            Delete
          </Button>
          <CopyResourceButton name={item.name} namespace={item.namespace} resourceKind="ingress" />
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search…"
        className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
      />

      {/* Info */}
      <div className="space-y-1">
        <SectionHeader title="Info" />
        <MetaEntry
          label="Ingress Class"
          value={item.ingressClassName || "none"}
        />
        {item.address && m(item.address) && (
          <MetaEntry label="Address" value={item.address} mono />
        )}
        <MetaEntry label="Created" value={new Date(item.creationTimestamp).toLocaleString()} />
      </div>

      {/* TLS */}
      {item.tls.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="TLS" />
          {item.tls.map((t: K8sIngressTLS, i: number) => {
            const secret = t.secretName || "none"
            const hosts = t.hosts.length > 0 ? t.hosts.join(", ") : "*"
            if (!m(secret) && !m(hosts)) return null
            return (
              <div key={i} className="rounded border p-2 text-xs space-y-0.5">
                <MetaEntry label="Secret" value={secret} mono />
                <MetaEntry label="Hosts" value={hosts} />
              </div>
            )
          })}
        </div>
      )}

      {/* Rules */}
      <div className="space-y-1">
        <SectionHeader title="Rules" />
        {item.rules.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No rules</p>
        ) : (
          <div className="space-y-2">
            {item.rules
              .filter((rule: K8sIngressRule) => {
                if (!sl) return true
                if (m(rule.host)) return true
                return rule.paths.some((p) => m(p.path) || m(p.serviceName) || m(String(p.servicePort)))
              })
              .map((rule: K8sIngressRule, i: number) => (
                <div key={i} className="rounded border p-2">
                  <p className="font-mono text-sm font-medium mb-2">{rule.host || "*"}</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left pb-1 font-medium">Path</th>
                        <th className="text-left pb-1 font-medium">Type</th>
                        <th className="text-left pb-1 font-medium">Service</th>
                        <th className="text-left pb-1 font-medium">Port</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rule.paths
                        .filter((p) => !sl || m(p.path) || m(p.serviceName) || m(String(p.servicePort)))
                        .map((p, j) => (
                          <tr key={j} className="border-t border-border/40">
                            <td className="font-mono py-0.5 pr-2">{p.path}</td>
                            <td className="py-0.5 pr-2">{p.pathType}</td>
                            <td className="py-0.5 pr-2">{p.serviceName}</td>
                            <td className="py-0.5">{String(p.servicePort)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Labels */}
      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Annotations */}
      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {/* Events */}
      <ResourceEventsSection namespace={item.namespace} name={item.name} kind="Ingress" search={sl} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
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
            <Button variant="outline" onClick={() => setDeleteOpenNotify(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: ingresses,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listIngresses({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || ingresses.length === 0) return
    const item = selectedItem as { name: string; namespace: string }
    const fresh = ingresses.find((i) => i.name === item.name && i.namespace === item.namespace)
    if (fresh) setSelectedItem(fresh as object)
  }, [ingresses])

  const visibleIngresses = filterResources(ingresses, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Ingresses</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleIngresses.length === 0 && (
          <EmptyState message="No Ingresses found" />
        )}
        {!loading && !error && visibleIngresses.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Class</TableHead>
                  <TableHead className="whitespace-nowrap">Hosts</TableHead>
                  <TableHead className="whitespace-nowrap">Address</TableHead>
                  <TableHead className="whitespace-nowrap">Ports</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap font-medium">{ing.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{ing.namespace}</TableCell>
                    <TableCell className="whitespace-nowrap">{ing.ingressClassName || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{ing.hosts}</TableCell>
                    <TableCell className="whitespace-nowrap">{ing.address || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{ing.ports}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatAge(ing.creationTimestamp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.rules !== undefined && (
        <DetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={reload}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
