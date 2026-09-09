import { Boxes } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../components/ui/Button"
import { ClosePanelButton } from "../../components/ui/ClosePanelButton"
import { DetailPanelLayout } from "../../components/ui/DetailPanelLayout"
import { MetaEntry } from "../../components/ui/MetaEntry"
import {
  DetailController,
  ResourceListView,
} from "../../components/ui/ResourceListView"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { useAppStore } from "../../store/app.store"
import { K8sApiGroupVersionError, K8sApiResource } from "../types/k8s"
import { ResourceType, resourceTypeForKind } from "../types/resource"

/** Where a kind can be listed, if anywhere. */
type OpenTarget =
  | { where: "view"; type: ResourceType }
  | { where: "crd"; crdName: string; version: string }
  | null

/**
 * Discovery says what the cluster serves, not what this app can show. A kind
 * with a compiled-in view opens there; anything else opens in the generic
 * custom-resource browser, which needs a CRD to describe it — so an aggregated
 * API (metrics.k8s.io) and the built-in kinds without a view of their own have
 * nowhere to go.
 */
function openTarget(
  resource: K8sApiResource,
  crdNames: Set<string> | null,
): OpenTarget {
  const type = resourceTypeForKind(resource.kind)
  if (type !== null) return { where: "view", type }
  if (resource.group === "") return null
  const crdName = `${resource.plural}.${resource.group}`
  // `null` means the CRD list could not be read at all — an identity without
  // access to apiextensions. Let the browser try rather than refuse on a
  // guess; it says for itself when the CRD is not there.
  if (crdNames !== null && !crdNames.has(crdName)) return null
  return { where: "crd", crdName, version: resource.version }
}

function targetLabel(target: OpenTarget): string {
  if (target === null) return "—"
  return target.where === "view" ? target.type : "Custom resources"
}

function OpenButton({
  resource,
  target,
}: {
  resource: K8sApiResource
  target: OpenTarget
}): JSX.Element {
  const setSelectedResourceType = useAppStore((s) => s.setSelectedResourceType)
  const browseCustomResource = useAppStore((s) => s.browseCustomResource)
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 text-xs gap-1"
      disabled={target === null}
      title={
        target === null
          ? "No view for this kind, and no CRD describing it"
          : `List ${resource.kind} objects`
      }
      onClick={() => {
        if (target === null) return
        if (target.where === "view") setSelectedResourceType(target.type)
        else
          browseCustomResource({
            crdName: target.crdName,
            version: target.version,
          })
      }}
    >
      <Boxes className="h-3 w-3" />
      Open {resource.kind}
    </Button>
  )
}

function DetailPanel({
  resource,
  crdNames,
  onClose,
}: {
  resource: K8sApiResource
  crdNames: Set<string> | null
  onClose: () => void
}): JSX.Element {
  const target = openTarget(resource, crdNames)
  const otherVersions = resource.servedVersions.filter(
    (v) => v !== resource.version,
  )

  return (
    <DetailPanelLayout
      header={
        <>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-base mb-1">{resource.name}</h2>
              <span className="text-xs text-muted-foreground">
                {resource.apiVersion} ·{" "}
                {resource.namespaced ? "namespaced" : "cluster-scoped"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ClosePanelButton onClose={onClose} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OpenButton resource={resource} target={target} />
          </div>
        </>
      }
    >
      <div className="space-y-1">
        <SectionHeader title="Names" />
        <MetaEntry label="Kind" value={resource.kind} />
        <MetaEntry label="Plural" value={resource.plural} mono />
        <MetaEntry label="Singular" value={resource.singular || "—"} mono />
        <MetaEntry
          label="Short names"
          value={
            resource.shortNames.length > 0
              ? resource.shortNames.join(", ")
              : "—"
          }
          mono
        />
        <MetaEntry
          label="Categories"
          value={
            resource.categories.length > 0
              ? resource.categories.join(", ")
              : "—"
          }
          mono
        />
      </div>

      <div className="space-y-1">
        <SectionHeader title="API" />
        <MetaEntry label="Group" value={resource.group || "core"} mono />
        <MetaEntry label="Version" value={resource.version} mono />
        <MetaEntry label="API version" value={resource.apiVersion} mono />
        <MetaEntry
          label="Other served versions"
          value={otherVersions.length > 0 ? otherVersions.join(", ") : "—"}
          mono
        />
        <MetaEntry
          label="Scope"
          value={resource.namespaced ? "Namespaced" : "Cluster"}
        />
        <MetaEntry
          label="Opens in"
          value={
            target === null
              ? "No view — a YAML apply still reaches this kind"
              : targetLabel(target)
          }
        />
      </div>

      <div className="space-y-1">
        <SectionHeader title="Verbs" />
        {resource.verbs.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          <p className="font-mono text-xs break-all">
            {resource.verbs.join(", ")}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <SectionHeader title="Subresources" />
        {resource.subresources.length === 0 ? (
          <p className="text-sm text-muted-foreground">None</p>
        ) : (
          <p className="font-mono text-xs break-all">
            {resource.subresources
              .map((sub) => `${resource.plural}/${sub}`)
              .join(", ")}
          </p>
        )}
      </div>
    </DetailPanelLayout>
  )
}

/** The groupVersions discovery could not read. Everything else on screen is
 *  still true, so this is a banner rather than an error state — the same call
 *  `kubectl` makes when it prints "unable to retrieve the complete list of
 *  server APIs" and carries on. */
function DiscoveryErrors({
  errors,
}: {
  errors: K8sApiGroupVersionError[]
}): JSX.Element {
  return (
    <div className="shrink-0 border-b border-border bg-amber-50 px-4 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      <p className="font-semibold">
        Incomplete list of server APIs — {errors.length} groupVersion
        {errors.length === 1 ? "" : "s"} did not answer:
      </p>
      <ul className="mt-1 space-y-0.5">
        {errors.map((e) => (
          <li key={e.groupVersion} className="font-mono break-all">
            {e.groupVersion}: {e.error}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * `kubectl api-resources`: every kind the API server serves, whether or not
 * this app has a view for it. One row per (group, resource) at the version
 * discovery answers with, so a kind carried by two versions of its group is
 * listed once, with the other versions in the detail panel.
 */
export function ApiResourcesView(): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const [errors, setErrors] = useState<K8sApiGroupVersionError[]>([])
  // Which kinds a CRD describes, and so which the generic browser can open.
  // `null` while that is unknown — before the first answer, and when the CRD
  // list is not readable at all.
  const [crdNames, setCrdNames] = useState<Set<string> | null>(null)

  useEffect(() => {
    let cancelled = false
    setCrdNames(null)
    window.api.k8s
      .listCRDs({ contextName: selectedContext ?? undefined })
      .then((crds) => {
        if (cancelled) return
        setCrdNames(
          new Set(crds.filter((crd) => crd.established).map((crd) => crd.name)),
        )
      })
      .catch(() => {
        // Not worth an error state: it only costs the Open button its
        // certainty, and `openTarget` then lets the browser try anyway.
      })
    return () => {
      cancelled = true
    }
  }, [selectedContext])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {errors.length > 0 && <DiscoveryErrors errors={errors} />}
      <div className="flex-1 overflow-hidden">
        <ResourceListView<K8sApiResource>
          title="API Resources"
          emptyMessage="No API resources found"
          namespaced={false}
          list={async (ctx) => {
            const catalog = await window.api.k8s.listApiResources({
              contextName: ctx,
            })
            setErrors((prev) =>
              // A poll tick that found the same failures must not re-render the
              // banner, and the table under it, for nothing.
              prev.length === catalog.errors.length &&
              prev.every(
                (e, i) => e.groupVersion === catalog.errors[i].groupVersion,
              )
                ? prev
                : catalog.errors,
            )
            return catalog.resources
          }}
          detailGuard={(item) => Array.isArray((item as K8sApiResource).verbs)}
          sortOptions={[
            {
              label: "Group",
              compare: (a, b) =>
                a.group.localeCompare(b.group) ||
                a.plural.localeCompare(b.plural),
            },
            {
              label: "Name",
              compare: (a, b) => a.plural.localeCompare(b.plural),
            },
            { label: "Kind", compare: (a, b) => a.kind.localeCompare(b.kind) },
          ]}
          columns={[
            { head: "Name", cell: (r) => r.plural, className: "font-medium" },
            {
              head: "Short names",
              cell: (r) => r.shortNames.join(", ") || "—",
              className: "font-mono text-xs",
            },
            {
              head: "API version",
              cell: (r) => r.apiVersion,
              className: "font-mono text-xs",
            },
            { head: "Namespaced", cell: (r) => (r.namespaced ? "Yes" : "No") },
            { head: "Kind", cell: (r) => r.kind },
            {
              head: "Verbs",
              cell: (r) => r.verbs.join(", ") || "—",
              className: "font-mono text-xs",
            },
            {
              head: "Opens in",
              cell: (r) => targetLabel(openTarget(r, crdNames)),
              className: "text-muted-foreground",
            },
          ]}
          renderDetail={(resource, ctl: DetailController) => (
            <DetailPanel
              resource={resource}
              crdNames={crdNames}
              onClose={ctl.onClose}
            />
          )}
        />
      </div>
    </div>
  )
}
