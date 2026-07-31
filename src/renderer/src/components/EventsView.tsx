import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "../../components/ui/Button"
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
import { handleIpcError } from "../../lib/ipc-error"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { K8sEvent } from "../types/k8s"

const MAX_EVENTS = 500

export function EventsView(): JSX.Element {
  const [events, setEvents] = useState<K8sEvent[]>([])
  const [isTailing, setIsTailing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const selectedContext = useAppStore((s) => s.selectedContext)
  const selectedNamespace = useAppStore((s) => s.selectedNamespace)
  const refreshInterval = useAppStore((s) => s.refreshInterval)

  const fetchEvents = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const data = await window.api.listEvents({
          contextName: selectedContext ?? undefined,
          namespace: selectedNamespace ?? undefined,
        })
        setEvents(data)
        setLastRefreshedAt(Date.now())
      } catch (err) {
        handleIpcError(err, "events")
      } finally {
        setLoading(false)
      }
    },
    [selectedContext, selectedNamespace],
  )

  useEffect(() => {
    fetchEvents()
    return () => {
      window.api.stopEventsWatch().catch(() => {})
      unsubRef.current?.()
    }
  }, [fetchEvents])

  useEffect(() => {
    if (refreshInterval === "off" || isTailing) return
    const ms = (refreshInterval as number) * 1000
    const id = setInterval(() => fetchEvents(true), ms)
    return () => clearInterval(id)
  }, [refreshInterval, isTailing, fetchEvents])

  const startTail = async () => {
    try {
      unsubRef.current = window.api.onEventsData((event: K8sEvent) => {
        setEvents((prev) => {
          const next = [event, ...prev]
          return next.slice(0, MAX_EVENTS)
        })
      })
      await window.api.startEventsWatch()
      setIsTailing(true)
    } catch (err) {
      handleIpcError(err, "events watch")
    }
  }

  const stopTail = async () => {
    try {
      await window.api.stopEventsWatch()
      unsubRef.current?.()
      unsubRef.current = null
      setIsTailing(false)
    } catch (err) {
      handleIpcError(err, "events watch stop")
    }
  }

  const toggleTail = () => {
    if (isTailing) {
      stopTail()
    } else {
      startTail()
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-2 shrink-0">
        <h2 className="font-semibold flex-1">Events</h2>
        <Button
          variant={isTailing ? "destructive" : "outline"}
          size="sm"
          onClick={toggleTail}
        >
          {isTailing ? "Stop Tail" : "Tail"}
        </Button>
        <RefreshBar
          lastRefreshedAt={lastRefreshedAt}
          onRefresh={() => fetchEvents(false)}
        />
      </div>
      <div className="flex-1 overflow-auto">
        {!loading && events.length === 0 && (
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
