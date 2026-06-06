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
import { K8sService, K8sServicePort } from "../types/k8s"
import { CopyResourceButton } from "./CopyResourceButton"
import { EmptyState } from "./EmptyState"
import { RefreshBar } from "./RefreshBar"

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
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function setDeleteOpenNotify(open: boolean): void {
    setDeleteOpen(open)
    onDeleteDialogChange(open)
  }
  const selectorEntries = Object.entries(svc.selector)
  const labelEntries = Object.entries(svc.labels)
  const annotationEntries = Object.entries(svc.annotations)

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
      setDeleteOpenNotify(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="w-96 shrink-0 bg-card text-card-foreground border border-border shadow-md h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-base mb-1">{svc.name}</h2>
          <span className="text-xs text-muted-foreground">{svc.namespace}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-1.5"
            title="Port Forward"
            onClick={onPortForward}
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
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
            onClick={() => setDeleteOpenNotify(true)}
          >
            Delete
          </Button>
          <CopyResourceButton
            name={svc.name}
            namespace={svc.namespace}
            resourceKind="service"
          />
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-1"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
            <Button
              variant="outline"
              onClick={() => setDeleteOpenNotify(false)}
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
      (d) =>
        d.name === selectedItem.name && d.namespace === selectedItem.namespace,
    )
    if (fresh) setSelectedItem(fresh)
  }, [services])

  const visibleServices = filterResources(
    services,
    nameFilter,
    selectedNamespace,
  )

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
