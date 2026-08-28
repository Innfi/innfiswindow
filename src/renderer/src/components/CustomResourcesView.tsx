import { useEffect, useMemo, useState } from "react"

import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DeleteButton } from "../../components/ui/DeleteButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { EmptyState } from "../../components/ui/EmptyState"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  ageColumn,
  DetailController,
  ResourceColumn,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { normalizeIpcError } from "../../lib/ipc-error"
import type { ResourceGvk } from "../../lib/resource-gvk"
import { dumpYaml } from "../../lib/yaml"
import { useAppStore } from "../../store/app.store"
import {
  K8sCRD,
  K8sCRDPrinterColumn,
  K8sCRDVersion,
  K8sCustomResource,
  K8sCustomResourceDetail,
  K8sCustomResourceRef,
} from "../types/k8s"
import { ResourceEventsSection } from "./ResourceEventsSection"

/** Columns `kubectl get` prints without `-o wide`. A CRD's own Age column is
 *  dropped because the list already ends with one. */
function tableColumns(columns: K8sCRDPrinterColumn[]): K8sCRDPrinterColumn[] {
  return columns.filter(
    (c) => c.priority === 0 && c.name.toLowerCase() !== "age",
  )
}

function crdVersion(crd: K8sCRD, version: string): K8sCRDVersion | null {
  return crd.versions.find((v) => v.name === version) ?? crd.versions[0] ?? null
}

function DetailPanel({
  detail,
  crd,
  gvk,
  printerColumns,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  detail: K8sCustomResourceDetail
  crd: K8sCRD
  gvk: ResourceGvk
  printerColumns: K8sCRDPrinterColumn[]
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const info = detail.info
  const labelEntries = Object.entries(info.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(info.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  // Nothing here knows the kind's schema, so the manifest itself is the detail
  // view — the same thing `kubectl get -o yaml` would print.
  const manifest = useMemo(() => dumpYaml(detail.object), [detail.object])

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{info.name}</h2>
              <span className="text-xs text-muted-foreground">
                {info.namespace ? `${info.namespace} · ` : ""}
                {info.apiVersion}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CopyResourceButton
                name={info.name}
                namespace={info.namespace || undefined}
                resourceKind={crd.plural}
              />
              <EditButton
                resourceKind={crd.kind}
                gvk={gvk}
                resourceName={info.name}
                namespace={info.namespace}
                buildYaml={() => detail.object}
              />
              <DeleteButton
                resourceKind={crd.kind}
                gvk={gvk}
                resourceName={info.name}
                namespace={info.namespace || undefined}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
              />
              <ClosePanelButton onClose={onClose} />
            </div>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground"
          />
        </>
      }
    >
      <div className="space-y-1">
        <SectionHeader title="Overview" />
        <MetaEntry label="Kind" value={info.kind} />
        <MetaEntry label="API version" value={info.apiVersion} mono />
        {info.namespace && (
          <MetaEntry label="Namespace" value={info.namespace} />
        )}
        <MetaEntry
          label="Created"
          value={
            info.creationTimestamp
              ? new Date(info.creationTimestamp).toLocaleString()
              : "—"
          }
        />
      </div>

      {printerColumns.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Status" />
          {printerColumns.map((col, i) => (
            <MetaEntry
              key={col.name}
              label={col.name}
              value={info.columns[i] ?? "—"}
            />
          ))}
        </div>
      )}

      {labelEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Labels" />
          {labelEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {annotationEntries.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Annotations" />
          {annotationEntries.map(([k, v]) => (
            <MetaEntry key={k} label={k} value={v} />
          ))}
        </div>
      )}

      {info.namespace && (
        <ResourceEventsSection
          namespace={info.namespace}
          name={info.name}
          kind={info.kind}
          search={search}
        />
      )}

      <div className="space-y-1">
        <SectionHeader title="Manifest" />
        <pre className="max-h-96 overflow-auto rounded border bg-muted p-2 font-mono text-xs whitespace-pre">
          {manifest}
        </pre>
      </div>
    </DetailPanelLayout>
  )
}

/** The list for one CRD version. Remounted (via `key`) whenever the kind or
 *  version changes: every piece of list state — the sort, the checked rows,
 *  the poll — belongs to the kind that is on screen. */
function CustomResourceList({
  crd,
  version,
}: {
  crd: K8sCRD
  version: string
}): JSX.Element {
  const shown = crdVersion(crd, version)
  const printerColumns = useMemo(
    () => tableColumns(shown?.printerColumns ?? []),
    [shown],
  )
  const ref: K8sCustomResourceRef = useMemo(
    () => ({
      group: crd.group,
      version: shown?.name ?? version,
      plural: crd.plural,
      kind: crd.kind,
      scope: crd.scope,
    }),
    [crd, shown, version],
  )
  const gvk: ResourceGvk = useMemo(
    () => ({
      apiVersion: ref.group ? `${ref.group}/${ref.version}` : ref.version,
      kind: ref.kind,
    }),
    [ref],
  )
  const paths = useMemo(
    () => printerColumns.map((c) => c.jsonPath),
    [printerColumns],
  )

  const columns: ResourceColumn<K8sCustomResource>[] = [
    { head: "Name", cell: (cr) => cr.name, className: "font-medium" },
    ...(crd.scope === "Namespaced"
      ? [
          {
            head: "Namespace",
            cell: (cr: K8sCustomResource) => cr.namespace,
          },
        ]
      : []),
    ...printerColumns.map((col, i) => ({
      head: col.name,
      cell: (cr: K8sCustomResource) => cr.columns[i] ?? "—",
    })),
    ageColumn<K8sCustomResource>(),
  ]

  return (
    <ResourceListView<K8sCustomResource, K8sCustomResourceDetail>
      title={crd.kind}
      emptyMessage={`No ${crd.kind} objects found`}
      namespaced={crd.scope === "Namespaced"}
      batch={{ resourceKind: crd.kind, gvk }}
      list={(ctx, ns) =>
        window.api.k8s.listCustomResources({
          contextName: ctx,
          namespace: ns,
          ref,
          printerColumns: paths,
        })
      }
      getDetail={(ctx, namespace, name) =>
        window.api.k8s.getCustomResource({
          contextName: ctx,
          namespace: namespace || undefined,
          name,
          ref,
          printerColumns: paths,
        })
      }
      detailGuard={(item) => Array.isArray((item as K8sCustomResource).columns)}
      columns={columns}
      sortOptions={[
        { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
        {
          label: "Newest",
          compare: (a, b) =>
            b.creationTimestamp.localeCompare(a.creationTimestamp),
        },
      ]}
      renderDetail={(detail, ctl: DetailController) => (
        <DetailPanel
          detail={detail}
          crd={crd}
          gvk={gvk}
          printerColumns={printerColumns}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}

/**
 * Lists the objects of any CRD in the cluster — the kinds this app has no
 * compiled-in view for, which on a real cluster is most of the interesting
 * ones. The CRD supplies everything: the group/version/plural to address the
 * objects by, whether they are namespaced, and the printer columns the table
 * shows.
 */
export function CustomResourcesView(): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const target = useAppStore((s) => s.customResourceTarget)
  const setTarget = useAppStore((s) => s.setCustomResourceTarget)

  const [crds, setCrds] = useState<K8sCRD[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    window.api.k8s
      .listCRDs({ contextName: selectedContext ?? undefined })
      .then((data) => {
        if (cancelled) return
        setCrds(data.filter((crd) => crd.established))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(normalizeIpcError(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedContext])

  const crd = crds.find((c) => c.name === target?.crdName) ?? null
  // A target left over from another cluster, or from before the operator was
  // uninstalled, points at a CRD that is no longer there.
  const missing = target !== null && crd === null && !loading && !error
  const version =
    crd === null
      ? ""
      : (crd.servedVersions.includes(target?.version ?? "")
          ? target?.version
          : "") ||
        crd.storageVersion ||
        crd.servedVersions[0] ||
        ""

  const grouped = useMemo(() => {
    const sorted = [...crds].sort(
      (a, b) => a.group.localeCompare(b.group) || a.kind.localeCompare(b.kind),
    )
    const out = new Map<string, K8sCRD[]>()
    for (const item of sorted) {
      const key = item.group || "core"
      const list = out.get(key)
      if (list) list.push(item)
      else out.set(key, [item])
    }
    return [...out.entries()]
  }, [crds])

  function pickCrd(name: string): void {
    const next = crds.find((c) => c.name === name)
    if (!next) return
    setTarget({
      crdName: next.name,
      version: next.storageVersion || next.servedVersions[0] || "",
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">Kind</span>
        <select
          value={crd?.name ?? ""}
          disabled={loading || crds.length === 0}
          onChange={(e) => pickCrd(e.target.value)}
          title="Custom resource kind"
          className="rounded border px-2 py-1 text-xs bg-background text-foreground max-w-96"
        >
          <option value="" disabled>
            {loading ? "Loading CRDs…" : "Select a kind…"}
          </option>
          {grouped.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.kind} ({item.scope === "Cluster" ? "cluster" : "ns"})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {crd && crd.servedVersions.length > 1 && (
          <>
            <span className="text-xs font-medium text-muted-foreground">
              Version
            </span>
            <select
              value={version}
              onChange={(e) =>
                setTarget({ crdName: crd.name, version: e.target.value })
              }
              title="Version"
              className="rounded border px-2 py-1 text-xs bg-background text-foreground"
            >
              {crd.servedVersions.map((v) => (
                <option key={v} value={v}>
                  {v}
                  {v === crd.storageVersion ? " (storage)" : ""}
                </option>
              ))}
            </select>
          </>
        )}
        {crd && (
          <span className="text-xs text-muted-foreground font-mono">
            {crd.plural}
            {crd.group ? `.${crd.group}` : ""}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {error !== null && <p className="p-4 text-sm text-red-500">{error}</p>}
        {error === null && loading && (
          <p className="p-4 text-sm text-muted-foreground">Loading...</p>
        )}
        {error === null && !loading && crds.length === 0 && (
          <EmptyState message="This cluster has no established CustomResourceDefinitions" />
        )}
        {error === null && !loading && crds.length > 0 && crd === null && (
          <EmptyState
            message={
              missing
                ? "That CustomResourceDefinition is not in this cluster — pick another kind"
                : "Pick a kind to list its objects"
            }
          />
        )}
        {crd !== null && version !== "" && (
          <CustomResourceList
            key={`${crd.name}/${version}`}
            crd={crd}
            version={version}
          />
        )}
      </div>
    </div>
  )
}
