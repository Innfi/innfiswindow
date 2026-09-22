import { useCallback, useEffect, useState } from "react"

import {
  CollapsibleSection,
  useSectionCollapsed,
} from "../../components/ui/CollapsibleSection"
import { ResourceLink } from "../../components/ui/ResourceLink"
import { normalizeIpcError } from "../../lib/ipc-error"
import {
  type ResourceGvk,
  resourceGvk,
  type ResourceKind,
} from "../../lib/resource-gvk"
import { useAppStore } from "../../store/app.store"
import { K8sRelatedResource, K8sResourceRelations } from "../types/k8s"

const EMPTY: K8sResourceRelations = {
  owners: [],
  dependents: [],
  references: [],
  errors: [],
  truncated: false,
}

/**
 * Where this object sits in the cluster's graph: the controllers above it, the
 * objects it controls, and everything named by a spec field in either
 * direction. Each entry is a link into the view for that kind.
 */
export function RelatedResourcesSection({
  resourceKind,
  gvk,
  name,
  namespace,
  search = "",
  collapsibleId,
}: {
  /** The kind as `resourceGvk` spells it — the group/version and the API's own
   *  kind name both come from there, so a view passes what its write buttons
   *  pass. */
  resourceKind: ResourceKind
  /** Required for a kind outside the built-in GVK table. */
  gvk?: ResourceGvk
  name: string
  /** `""` for a cluster-scoped kind. */
  namespace?: string
  search?: string
  /** Makes the section foldable under this id. Folded, it does not walk the
   *  object graph at all; expanding walks it again. */
  collapsibleId?: string
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const [collapsed] = useSectionCollapsed(collapsibleId ?? "")
  const folded = collapsibleId !== undefined && collapsed
  const [relations, setRelations] = useState<K8sResourceRelations>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const target = resourceGvk(resourceKind, gvk)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    window.api.k8s
      .getResourceRelations({
        contextName: selectedContext ?? undefined,
        apiVersion: target.apiVersion,
        kind: target.kind,
        name,
        namespace: namespace || undefined,
      })
      .then((result) => {
        setRelations(result)
        setLoading(false)
      })
      .catch((err) => {
        setError(normalizeIpcError(err))
        setRelations(EMPTY)
        setLoading(false)
      })
  }, [selectedContext, target.apiVersion, target.kind, name, namespace])

  useEffect(() => {
    if (folded) return
    load()
  }, [load, folded])

  const sl = search.toLowerCase()
  const visible = (items: K8sRelatedResource[]): K8sRelatedResource[] =>
    items.filter(
      (item) =>
        !sl ||
        item.name.toLowerCase().includes(sl) ||
        item.kind.toLowerCase().includes(sl) ||
        item.detail.toLowerCase().includes(sl),
    )

  const groups: { title: string; items: K8sRelatedResource[] }[] = [
    { title: "Owned by", items: visible(relations.owners) },
    { title: "Owns", items: visible(relations.dependents) },
    { title: "References", items: visible(relations.references) },
  ]
  const total = groups.reduce((sum, group) => sum + group.items.length, 0)

  const refresh = (
    <button
      onClick={load}
      className="text-xs text-muted-foreground hover:text-foreground"
    >
      Refresh
    </button>
  )

  const body = (
    <>
      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!loading && !error && total === 0 && (
        <p className="text-xs text-muted-foreground">
          Nothing references this {target.kind}.
        </p>
      )}

      {!loading &&
        !error &&
        groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.title} className="rounded border p-2 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                {group.title}
              </div>
              {group.items.map((item) => (
                <div
                  key={`${item.kind}/${item.namespace}/${item.name}`}
                  className="flex items-baseline gap-2 text-xs"
                >
                  <span className="text-muted-foreground shrink-0">
                    {item.kind}
                  </span>
                  <ResourceLink
                    kind={item.kind}
                    name={item.name}
                    namespace={item.namespace}
                    className="font-mono break-all"
                  >
                    {item.namespace && item.namespace !== namespace
                      ? `${item.namespace}/${item.name}`
                      : item.name}
                  </ResourceLink>
                  <span className="ml-auto text-muted-foreground shrink-0">
                    {item.detail}
                  </span>
                </div>
              ))}
            </div>
          ))}

      {!loading && !error && relations.truncated && (
        <p className="text-xs text-muted-foreground">
          Only the first matches are listed — the cluster holds more.
        </p>
      )}
      {!loading &&
        relations.errors.map((err) => (
          <p key={err} className="text-xs text-yellow-600 dark:text-yellow-400">
            Partial: {err}
          </p>
        ))}
    </>
  )

  if (collapsibleId === undefined) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Related ({total})
          </h3>
          {refresh}
        </div>
        {body}
      </div>
    )
  }

  return (
    <CollapsibleSection
      id={collapsibleId}
      title="Related"
      count={total}
      subtle
      right={refresh}
    >
      {body}
    </CollapsibleSection>
  )
}
