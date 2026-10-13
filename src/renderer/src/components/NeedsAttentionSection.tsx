import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  EyeOff,
  XCircle,
} from "lucide-react"
import { useState } from "react"

import type { AlertMutes, ClusterAlert } from "../../../shared/triage"
import { countBySeverity } from "../../../shared/triage"
import { Button } from "../../components/ui/Button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/Popover"
import { ResourceLink } from "../../components/ui/ResourceLink"
import { cn, formatAge } from "../../lib/utils"

/** Past this the list stops being a to-do and starts being a wall; the rest is
 *  a count, and the kind's own view lists them in full. */
const MAX_ROWS = 25

const HOUR_MS = 60 * 60 * 1000

/** `null` is a dismissal: hidden for as long as the problem lasts. */
const MUTE_CHOICES: { label: string; durationMs: number | null }[] = [
  { label: "Snooze 1 hour", durationMs: HOUR_MS },
  { label: "Snooze 8 hours", durationMs: 8 * HOUR_MS },
  { label: "Snooze 24 hours", durationMs: 24 * HOUR_MS },
  { label: "Dismiss until resolved", durationMs: null },
]

function SeverityBadge({
  severity,
}: {
  severity: ClusterAlert["severity"]
}): JSX.Element {
  const critical = severity === "critical"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        critical
          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
      )}
    >
      {critical ? (
        <XCircle className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {critical ? "Critical" : "Warning"}
    </span>
  )
}

function AlertTarget({ alert }: { alert: ClusterAlert }): JSX.Element {
  return (
    <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
      {alert.kind}/
      <ResourceLink
        kind={alert.kind}
        name={alert.name}
        namespace={alert.namespace}
      >
        {alert.namespace ? `${alert.namespace}/${alert.name}` : alert.name}
      </ResourceLink>
    </span>
  )
}

function MuteMenu({
  alert,
  onMute,
}: {
  alert: ClusterAlert
  onMute: (alert: ClusterAlert, until: number | null) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Snooze or dismiss"
          aria-label={`Snooze or dismiss ${alert.title} on ${alert.name}`}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end">
        {MUTE_CHOICES.map((choice) => (
          <button
            key={choice.label}
            type="button"
            className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
            onClick={() => {
              setOpen(false)
              onMute(
                alert,
                choice.durationMs === null
                  ? null
                  : Date.now() + choice.durationMs,
              )
            }}
          >
            {choice.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/** When a muted row comes back, in the reader's terms. */
function describeMute(until: number | null | undefined): string {
  if (until === null || until === undefined) return "until resolved"
  const at = new Date(until)
  const sameDay = at.toDateString() === new Date().toDateString()
  return `until ${
    sameDay
      ? at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : at.toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
  }`
}

/**
 * The top of the Overview: everything the cluster is currently unhappy about,
 * worst first, each row a click into the object it is about. The rules are in
 * `src/shared/triage.ts`; this only renders what they found, split by the
 * caller into the rows to show and the ones the reader snoozed or dismissed.
 */
export function NeedsAttentionSection({
  alerts,
  muted,
  mutes,
  namespace,
  onMute,
  onRestore,
}: {
  alerts: ClusterAlert[]
  muted: ClusterAlert[]
  mutes: AlertMutes
  /** The app bar's namespace scope; null is every namespace. */
  namespace: string | null
  onMute: (alert: ClusterAlert, until: number | null) => void
  onRestore: (alerts: ClusterAlert[]) => void
}): JSX.Element {
  const [showMuted, setShowMuted] = useState(false)
  const { critical, warning } = countBySeverity(alerts)
  const shown = alerts.slice(0, MAX_ROWS)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Needs attention</h3>
        {namespace && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {namespace}
          </span>
        )}
        {alerts.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {critical > 0 && `${critical} critical`}
            {critical > 0 && warning > 0 && " · "}
            {warning > 0 && `${warning} warning`}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border-2 border-green-400 bg-green-50 p-3 text-sm dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" />
          <span>
            {muted.length > 0
              ? "Nothing else needs attention — everything raised is snoozed or dismissed."
              : `Nothing needs attention${namespace ? ` in ${namespace}` : ""} — no broken pods, unready nodes, empty workloads, failed jobs or unbound claims.`}
          </span>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {shown.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm",
                alert.severity === "critical" &&
                  "bg-red-50/60 dark:bg-red-950/10",
              )}
            >
              <SeverityBadge severity={alert.severity} />
              <span className="font-medium whitespace-nowrap">
                {alert.title}
              </span>
              <AlertTarget alert={alert} />
              <span
                className="flex-1 min-w-48 text-xs text-muted-foreground truncate"
                title={alert.detail}
              >
                {alert.detail}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatAge(alert.since)}
              </span>
              <MuteMenu alert={alert} onMute={onMute} />
            </div>
          ))}
          {alerts.length > shown.length && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {alerts.length - shown.length} more — open the kind's own view to
              see the rest.
            </div>
          )}
        </div>
      )}

      {muted.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 hover:text-foreground"
              aria-expanded={showMuted}
              onClick={() => setShowMuted(!showMuted)}
            >
              {showMuted ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {muted.length} hidden (snoozed or dismissed)
            </button>
            {showMuted && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => onRestore(muted)}
              >
                Restore all
              </Button>
            )}
          </div>
          {showMuted && (
            <div className="mt-2 divide-y rounded-lg border">
              {muted.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5"
                >
                  <SeverityBadge severity={alert.severity} />
                  <span className="whitespace-nowrap">{alert.title}</span>
                  <AlertTarget alert={alert} />
                  <span className="flex-1 whitespace-nowrap">
                    {describeMute(mutes[alert.id]?.until)}
                  </span>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground"
                    onClick={() => onRestore([alert])}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
