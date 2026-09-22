import { useCallback, useEffect, useState } from "react"

import {
  CollapsibleSection,
  useSectionCollapsed,
} from "../../components/ui/CollapsibleSection"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { K8sEvent } from "../types/k8s"

export function ResourceEventsSection({
  namespace,
  name,
  kind,
  search = "",
  collapsibleId,
}: {
  namespace: string
  name: string
  kind: string
  search?: string
  /** Makes the section foldable under this id. Folded, it does not read the
   *  events at all; expanding reads them again. */
  collapsibleId?: string
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const [collapsed] = useSectionCollapsed(collapsibleId ?? "")
  const folded = collapsibleId !== undefined && collapsed
  const [events, setEvents] = useState<K8sEvent[]>([])
  const [loading, setLoading] = useState(false)

  const m = (s: string): boolean =>
    !search || s.toLowerCase().includes(search.toLowerCase())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const evs = await window.api.listEventsForResource({
        contextName: selectedContext ?? undefined,
        namespace,
        name,
        kind,
      })
      setEvents(
        evs.sort((a, b) => (b.lastTimestamp > a.lastTimestamp ? 1 : -1)),
      )
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [namespace, name, kind, selectedContext])

  useEffect(() => {
    if (folded) return
    load()
  }, [load, folded])

  const visible = events.filter(
    (ev) => m(ev.reason) || m(ev.message) || m(ev.type),
  )

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
      {loading && <p className="text-xs text-muted-foreground">Loading...</p>}
      {!loading && visible.length === 0 && (
        <p className="text-xs text-muted-foreground">No events</p>
      )}
      {!loading &&
        visible.map((ev) => (
          <div
            key={ev.name}
            className={cn(
              "text-xs border rounded p-2 space-y-0.5",
              ev.type === "Warning" &&
                "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-medium",
                  ev.type === "Warning"
                    ? "text-yellow-700 dark:text-yellow-400"
                    : "",
                )}
              >
                {ev.reason}
              </span>
              {ev.count > 1 && (
                <span className="text-muted-foreground">×{ev.count}</span>
              )}
              <span className="ml-auto text-muted-foreground">
                {ev.lastTimestamp
                  ? formatAge(ev.lastTimestamp)
                  : formatAge(ev.creationTimestamp)}
              </span>
            </div>
            <div className="text-muted-foreground">{ev.message}</div>
          </div>
        ))}
    </>
  )

  if (collapsibleId === undefined) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Events
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
      title="Events"
      subtle
      right={refresh}
    >
      {body}
    </CollapsibleSection>
  )
}
