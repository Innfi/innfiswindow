import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "../../components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { handleIpcError } from "../../lib/ipc-error"
import { cn, formatAge } from "../../lib/utils"
import { useAppStore } from "../../store/app.store"
import { K8sEvent } from "../types/k8s"
import { EmptyState } from "./EmptyState"

const MAX_EVENTS = 500

export function EventsView(): JSX.Element {
  const [events, setEvents] = useState<K8sEvent[]>([])
  const [isTailing, setIsTailing] = useState(false)
  const [loading, setLoading] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)
  const selectedContext = useAppStore((s) => s.selectedContext)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.api.listEvents({
        contextName: selectedContext ?? undefined,
      })
      setEvents(data)
    } catch (err) {
      handleIpcError(err, "events")
    } finally {
      setLoading(false)
    }
  }, [selectedContext])

  useEffect(() => {
    fetchEvents()
    return () => {
      window.api.stopEventsWatch().catch(() => {})
      unsubRef.current?.()
    }
  }, [fetchEvents])

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
        <Button
          variant="outline"
          size="sm"
          onClick={fetchEvents}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {!loading && events.length === 0 && (
          <EmptyState message="No Events found" />
        )}
        {events.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-36">Reason</TableHead>
                <TableHead>Object</TableHead>
                <TableHead className="w-32">Namespace</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-16 text-center">Count</TableHead>
                <TableHead className="w-28">Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev, i) => (
                <TableRow
                  key={`${ev.name}-${i}`}
                  className={cn(
                    ev.type === "Warning" && "bg-amber-50 dark:bg-amber-950/20",
                  )}
                >
                  <TableCell>
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
                  <TableCell className="font-mono text-xs">
                    {ev.reason}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {ev.involvedObjectKind}/{ev.involvedObjectName}
                  </TableCell>
                  <TableCell className="text-xs">{ev.namespace}</TableCell>
                  <TableCell
                    className="text-xs max-w-xs truncate"
                    title={ev.message}
                  >
                    {ev.message}
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    {ev.count}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatAge(ev.lastTimestamp || ev.creationTimestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
