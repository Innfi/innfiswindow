import { useMemo } from "react"

import { EmptyState } from "../../components/ui/EmptyState"
import { RefreshBar } from "../../components/ui/RefreshBar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { useK8sResource } from "../hooks/useK8sResource"
import { K8sEvent } from "../types/k8s"

/** The API server keeps an hour of events for a busy cluster; the table only
 *  needs the newest of them. */
const MAX_EVENTS = 500

const lastSeen = (ev: K8sEvent): string =>
  ev.lastTimestamp || ev.creationTimestamp

export function EventsView(): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)

  // Watch-backed: an event's `count` climbs as it repeats, so the watch reports
  // it as an update to the same row rather than as another row.
  const { data, loading, error, reload, lastRefreshedAt } =
    useK8sResource<K8sEvent>(
      (ctx, ns) => window.api.listEvents({ contextName: ctx, namespace: ns }),
      selectedContext,
      { namespace: selectedNamespace, watch: "events" },
    )

  // Watch updates land in place, so the order has to come from the rows
  // themselves rather than from the order the API server sent them in.
  const events = useMemo(
    () =>
      [...data]
        .sort((a, b) => lastSeen(b).localeCompare(lastSeen(a)))
        .slice(0, MAX_EVENTS),
    [data],
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
        <h2 className="font-semibold flex-1">Events</h2>
        <RefreshBar lastRefreshedAt={lastRefreshedAt} onRefresh={reload} />
      </div>
      <div className="flex-1 overflow-auto">
        {error && <p className="p-4 text-sm text-red-500">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <EmptyState message="No Events found" />
        )}
        {events.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap w-24">Type</TableHead>
                  <TableHead className="whitespace-nowrap w-36">
                    Reason
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Object</TableHead>
                  <TableHead className="whitespace-nowrap w-32">
                    Namespace
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Message</TableHead>
                  <TableHead className="whitespace-nowrap w-16 text-center">
                    Count
                  </TableHead>
                  <TableHead className="whitespace-nowrap w-28">
                    Last Seen
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev, i) => (
                  <TableRow
                    key={`${ev.name}-${i}`}
                    className={cn(
                      ev.type === "Warning" &&
                        "bg-amber-50 dark:bg-amber-950/20",
                    )}
                  >
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                          ev.type === "Warning"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {ev.type}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {ev.reason}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      {ev.involvedObjectKind}/{ev.involvedObjectName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {ev.namespace}
                    </TableCell>
                    <TableCell
                      className="whitespace-nowrap text-xs max-w-xs truncate"
                      title={ev.message}
                    >
                      {ev.message}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-center text-xs">
                      {ev.count}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatAge(ev.lastTimestamp || ev.creationTimestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
