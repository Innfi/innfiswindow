import { dump as yamlDump } from "js-yaml"
import { ArrowLeftRight, X } from "lucide-react"
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
import { K8sEndpoint, K8sService, K8sServicePort } from "../types/k8s"
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

function formatPorts(ports: K8sServicePort[]): string {
  if (ports.length === 0) return "-"
  return ports.map((p) => `${p.port}/${p.protocol}`).join(", ")
}

function DetailPanel({
  svc,
  onClose,
  onDeleted,
  onPortForward,
  onDeleteDialogChange,
}: {
  svc: K8sService
  onClose: () => void
  onDeleted: () => void
  onPortForward: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const appendHistory = useAppStore((s) => s.appendHistory)
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [endpoints, setEndpoints] = useState<K8sEndpoint | null>(null)

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  useEffect(() => {
    window.api.k8s
      .listEndpoints({ contextName: selectedContext ?? undefined })
      .then((all) => {
        const ep = all.find((e) => e.name === svc.name && e.namespace === svc.namespace)
        setEndpoints(ep ?? null)
      })
      .catch(() => setEndpoints(null))
  }, [svc.name, svc.namespace, selectedContext])

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }

  const selectorEntries = Object.entries(svc.selector).filter(([k, v]) => kv(k, v))
  const labelEntries = Object.entries(svc.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(svc.annotations)
    .filter(([k]) => !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"))
    .filter(([k, v]) => kv(k, v))

  function handleEdit(): void {
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
        ...(Object.keys(svc.selector).length > 0 ? { selector: svc.selector } : {}),
        ports: svc.ports.map((p) => ({
          name: p.name || undefined,
          protocol: p.protocol,
          port: p.port,
          targetPort: isNaN(Number(p.targetPort)) ? p.targetPort : Number(p.targetPort),
          ...(p.nodePort ? { nodePort: p.nodePort } : {}),
        })),
      },
    }
    openDrawerTab({
      tabKey: `yaml-edit:Service:${svc.namespace}/${svc.name}`,
      type: "yaml-edit",
      resourceKind: "Service",
      resourceName: svc.name,
      namespace: svc.namespace,
      initialYaml: yamlDump(obj),
    })
  }

  async function handleDelete(): Promise<void> {
    setDeleting(true)
    try {
      await window.api.k8s.deleteService(svc.namespace, svc.name)
      appendHistory({
        action: "delete",
        resourceKind: "Service",
        resourceName: svc.name,
        namespace: svc.namespace,
        context: selectedContext ?? "",
        success: true,
      })
      toast.success(`Service ${svc.name} deleted`)
      setDeleteOpenNotify(false)
      onDeleted()
      onClose()
    } catch (e) {
      appendHistory({
        action: "delete",
        resourceKind: "Service",
        resourceName: svc.name,
        namespace: svc.namespace,
        context: selectedContext ?? "",
        success: false,
        error: String(e),
      })
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Service: delete")
      setDeleteOpenNotify(false)
    } finally {
      setDeleting(false)
    }
  }

  const allEndpointIPs = endpoints
    ? endpoints.subsets.flatMap((s) =>
        s.readyAddresses.map((a) => ({ ip: a.ip, pod: a.targetPodName, ready: true })).concat(
          s.notReadyAddresses.map((a) => ({ ip: a.ip, pod: a.targetPodName, ready: false })),
        ),
      )
    : []

  return (
    <div className="w-1/2 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{svc.name}</h2>
          <span className="text-xs text-muted-foreground">{svc.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-1.5" title="Port Forward" onClick={onPortForward}>
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleEdit}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => setDeleteOpenNotify(true)}>
            Delete
          </Button>
          <CopyResourceButton name={svc.name} namespace={svc.namespace} resourceKind="service" />
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

      {/* Network */}
      <div className="space-y-1">
        <SectionHeader title="Network" />
        <MetaEntry label="Type" value={svc.type} />
        <MetaEntry label="ClusterIP" value={svc.clusterIP || "None"} mono />
        {svc.externalIP && m(svc.externalIP) && (
          <MetaEntry label="External IP" value={svc.externalIP} mono />
        )}
        {svc.sessionAffinity && m(svc.sessionAffinity) && (
          <MetaEntry label="Session Affinity" value={svc.sessionAffinity} />
        )}
        {svc.externalTrafficPolicy && m(svc.externalTrafficPolicy) && (
          <MetaEntry label="External Traffic Policy" value={svc.externalTrafficPolicy} />
        )}
        <MetaEntry label="Created" value={new Date(svc.creationTimestamp).toLocaleString()} />
      </div>

      {/* Ports */}
      {svc.ports.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Ports" />
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium pb-1">Name</th>
                <th className="text-left font-medium pb-1">Protocol</th>
                <th className="text-left font-medium pb-1">Port</th>
                <th className="text-left font-medium pb-1">Target</th>
                <th className="text-left font-medium pb-1">NodePort</th>
              </tr>
            </thead>
            <tbody>
              {svc.ports
                .filter((p) => !sl || m(p.name) || m(String(p.port)) || m(p.protocol))
                .map((p, i) => (
                  <tr key={i} className="border-t border-border/40">
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

      {/* Endpoints */}
      {endpoints && allEndpointIPs.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Endpoints" />
          <div className="flex flex-wrap gap-1">
            {allEndpointIPs
              .filter((e) => !sl || m(e.ip) || (e.pod && m(e.pod)))
              .map((e, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono border",
                    e.ready ? "bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" : "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
                  )}
                  title={e.pod ?? undefined}
                >
                  {e.ip}
                </span>
              ))}
          </div>
          {endpoints.subsets.some((s) => s.notReadyAddresses.length > 0) && (
            <p className="text-xs text-muted-foreground">Yellow = not ready</p>
          )}
        </div>
      )}
      {endpoints && allEndpointIPs.length === 0 && (
        <div className="space-y-1">
          <SectionHeader title="Endpoints" />
          <p className="text-xs text-muted-foreground italic">No endpoints</p>
        </div>
      )}

      {/* Selector */}
      {selectorEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Selector" />
          {selectorEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

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
      <ResourceEventsSection namespace={svc.namespace} name={svc.name} kind="Service" search={sl} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpenNotify}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>
                {svc.namespace}/{svc.name}
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

export function ServicesView(): JSX.Element {
  const selectedItem = useAppStore((s) => s.selectedItem) as K8sService | null
  const setSelectedItem = useAppStore((s) => s.setSelectedItem)
  const openDrawerTab = useAppStore((s) => s.openDrawerTab)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const nameFilter = useAppStore((s) => s.nameFilter)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const {
    data: services,
    loading,
    error,
    reload,
    lastRefreshedAt,
  } = useK8sResource(
    (ctx) => window.api.k8s.listServices({ contextName: ctx }),
    selectedContext,
    { paused: deleteDialogOpen },
  )

  useEffect(() => {
    if (!selectedItem || services.length === 0) return
    const fresh = services.find(
      (d) => d.name === selectedItem.name && d.namespace === selectedItem.namespace,
    )
    if (fresh) setSelectedItem(fresh)
  }, [services])

  const visibleServices = filterResources(services, nameFilter, selectedNamespace)

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold">Services</h1>
          <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {!loading && !error && visibleServices.length === 0 && (
          <EmptyState message="No Services found" />
        )}
        {!loading && !error && visibleServices.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">ClusterIP</TableHead>
                  <TableHead className="whitespace-nowrap">External IP</TableHead>
                  <TableHead className="whitespace-nowrap">Ports</TableHead>
                  <TableHead className="whitespace-nowrap">Age</TableHead>
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
                    <TableCell className="whitespace-nowrap">{svc.name}</TableCell>
                    <TableCell className="whitespace-nowrap">{svc.namespace}</TableCell>
                    <TableCell className="whitespace-nowrap">{svc.type}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{svc.clusterIP || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{svc.externalIP || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatPorts(svc.ports)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatAge(svc.creationTimestamp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.type !== undefined && (
        <DetailPanel
          svc={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDeleted={reload}
          onPortForward={() => {
            const firstPort = selectedItem.ports[0]?.port ?? 80
            openDrawerTab({
              tabKey: `port-forward:Service:${selectedItem.namespace}/${selectedItem.name}`,
              type: "port-forward",
              resourceKind: "Service",
              resourceName: selectedItem.name,
              namespace: selectedItem.namespace,
              localPort: firstPort,
              targetPort: firstPort,
            })
          }}
          onDeleteDialogChange={setDeleteDialogOpen}
        />
      )}
    </div>
  )
}
