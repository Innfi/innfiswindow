import { Boxes } from "lucide-react"
import { useState } from "react"

import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { CopyResourceButton } from "../../components/ui/CopyResourceButton"
import { DeleteButton } from "../../components/ui/DeleteButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { EditButton } from "../../components/ui/EditButton"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  ageColumn,
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { useAppStore } from "../../store/app.store"
import { K8sCRD, K8sCRDVersion } from "../types/k8s"

/** The version the browser should open on: the stored version is the one the
 *  API server persists, so it is what `kubectl get` reads. */
function defaultVersion(crd: K8sCRD): string {
  return crd.storageVersion || crd.servedVersions[0] || ""
}

function versionLabel(v: K8sCRDVersion): string {
  const tags = [
    v.storage ? "storage" : null,
    v.served ? null : "not served",
    v.deprecated ? "deprecated" : null,
  ].filter((t): t is string => t !== null)
  return tags.length > 0 ? `${v.name} (${tags.join(", ")})` : v.name
}

function EstablishedBadge({ crd }: { crd: K8sCRD }): JSX.Element {
  return crd.established ? (
    <span className="text-green-600 dark:text-green-400 font-semibold">
      Established
    </span>
  ) : (
    <span className="text-amber-600 dark:text-amber-400 font-semibold">
      Pending
    </span>
  )
}

/** Sends the generic browser to this CRD, at the version being viewed. */
function BrowseButton({
  crd,
  version,
}: {
  crd: K8sCRD
  version: string
}): JSX.Element {
  const browseCustomResource = useAppStore((s) => s.browseCustomResource)
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1"
      disabled={!crd.established || version === ""}
      title={
        crd.established
          ? `Browse ${crd.kind} objects`
          : "The API server has not established this CRD yet"
      }
      onClick={() => browseCustomResource({ crdName: crd.name, version })}
    >
      <Boxes className="h-3 w-3" />
      Browse {crd.kind}
    </Button>
  )
}

function DetailPanel({
  crd,
  onClose,
  onDeleted,
  onDeleteDialogChange,
}: {
  crd: K8sCRD
  onClose: () => void
  onDeleted: () => void
  onDeleteDialogChange: (open: boolean) => void
}): JSX.Element {
  const [search, setSearch] = useState("")
  const [version, setVersion] = useState(defaultVersion(crd))
  const sl = search.toLowerCase()

  const m = (s: string): boolean => !sl || s.toLowerCase().includes(sl)
  const kv = (k: string, v: string): boolean => m(k) || m(v)

  const shown =
    crd.versions.find((v) => v.name === version) ?? crd.versions[0] ?? null

  const labelEntries = Object.entries(crd.labels).filter(([k, v]) => kv(k, v))
  const annotationEntries = Object.entries(crd.annotations)
    .filter(
      ([k]) =>
        !k.startsWith("kubectl.kubernetes.io/last-applied-configuration"),
    )
    .filter(([k, v]) => kv(k, v))

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{crd.name}</h2>
              <span className="text-xs text-muted-foreground">
                {crd.group || "core"} · {crd.scope}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CopyResourceButton name={crd.name} resourceKind="crd" />
              <EditButton
                resourceKind="CustomResourceDefinition"
                resourceName={crd.name}
                buildYaml={() => ({
                  apiVersion: "apiextensions.k8s.io/v1",
                  kind: "CustomResourceDefinition",
                  metadata: { name: crd.name },
                })}
              />
              <DeleteButton
                resourceKind="CustomResourceDefinition"
                resourceName={crd.name}
                onDeleted={onDeleted}
                onDeleteDialogChange={onDeleteDialogChange}
                onClose={onClose}
                warning={`Deleting this CustomResourceDefinition deletes every ${crd.kind} object in the cluster along with it.`}
              />
              <ClosePanelButton onClose={onClose} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BrowseButton crd={crd} version={version} />
            {crd.versions.length > 1 && (
              <select
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                title="Version"
                className="rounded border px-2 py-1 text-xs bg-background text-foreground"
              >
                {crd.versions.map((v) => (
                  <option key={v.name} value={v.name}>
                    {versionLabel(v)}
                  </option>
                ))}
              </select>
            )}
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
        <SectionHeader title="Names" />
        <MetaEntry label="Kind" value={crd.kind} />
        <MetaEntry label="List kind" value={crd.listKind || "—"} />
        <MetaEntry label="Singular" value={crd.singular || "—"} mono />
        <MetaEntry label="Plural" value={crd.plural} mono />
        <MetaEntry
          label="Short names"
          value={crd.shortNames.length > 0 ? crd.shortNames.join(", ") : "—"}
          mono
        />
        <MetaEntry
          label="Categories"
          value={crd.categories.length > 0 ? crd.categories.join(", ") : "—"}
          mono
        />
        <MetaEntry label="Scope" value={crd.scope} />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground text-xs w-28 shrink-0">
            Status
          </span>
          <EstablishedBadge crd={crd} />
        </div>
        <MetaEntry
          label="Created"
          value={new Date(crd.creationTimestamp).toLocaleString()}
        />
      </div>

      <div className="space-y-1">
        <SectionHeader title="Versions" />
        {crd.versions.map((v) => (
          <div key={v.name} className="text-sm">
            <MetaEntry
              label={v.name}
              value={[
                v.served ? "served" : "not served",
                v.storage ? "storage" : null,
                v.hasStatus ? "status" : null,
                v.hasScale ? "scale" : null,
                v.deprecated ? "deprecated" : null,
              ]
                .filter((t): t is string => t !== null)
                .join(", ")}
            />
            {v.deprecated && v.deprecationWarning && (
              <p className="pl-2 text-xs text-amber-600 dark:text-amber-400">
                {v.deprecationWarning}
              </p>
            )}
          </div>
        ))}
      </div>

      {shown && (
        <div className="space-y-1">
          <SectionHeader title={`Printer columns (${shown.name})`} />
          {shown.printerColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None — the browser shows name and age only.
            </p>
          ) : (
            shown.printerColumns
              .filter((c) => m(c.name) || m(c.jsonPath))
              .map((c) => (
                <MetaEntry
                  key={c.name}
                  label={c.name}
                  value={c.jsonPath}
                  mono
                />
              ))
          )}
        </div>
      )}

      {crd.conditions.length > 0 && (
        <div className="space-y-1">
          <SectionHeader title="Conditions" />
          {crd.conditions
            .filter((c) => m(c.type) || m(c.reason) || m(c.message))
            .map((c) => (
              <MetaEntry
                key={c.type}
                label={c.type}
                value={`${c.status}${c.reason ? ` — ${c.reason}` : ""}`}
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
    </DetailPanelLayout>
  )
}

export function CRDsView(): JSX.Element {
  return (
    <ResourceListView<K8sCRD>
      title="Custom Resource Definitions"
      emptyMessage="No CustomResourceDefinitions found"
      namespaced={false}
      list={(ctx) => window.api.k8s.listCRDs({ contextName: ctx })}
      detailGuard={(item) => (item as K8sCRD).plural !== undefined}
      sortOptions={[
        { label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
        {
          label: "Group",
          compare: (a, b) =>
            a.group.localeCompare(b.group) || a.kind.localeCompare(b.kind),
        },
        {
          label: "Newest",
          compare: (a, b) =>
            b.creationTimestamp.localeCompare(a.creationTimestamp),
        },
      ]}
      columns={[
        { head: "Name", cell: (crd) => crd.name, className: "font-medium" },
        { head: "Group", cell: (crd) => crd.group || "core" },
        { head: "Kind", cell: (crd) => crd.kind },
        { head: "Scope", cell: (crd) => crd.scope },
        {
          head: "Versions",
          cell: (crd) =>
            crd.versions.map((v) => versionLabel(v)).join(", ") || "—",
          className: "font-mono text-xs",
        },
        { head: "Established", cell: (crd) => <EstablishedBadge crd={crd} /> },
        ageColumn<K8sCRD>(),
      ]}
      renderDetail={(crd, ctl: DetailController) => (
        <DetailPanel
          crd={crd}
          onClose={ctl.onClose}
          onDeleted={ctl.onDeleted}
          onDeleteDialogChange={ctl.onDeleteDialogChange}
        />
      )}
    />
  )
}
