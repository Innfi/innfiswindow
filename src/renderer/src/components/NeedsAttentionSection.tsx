import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

import type { ClusterAlert } from "../../../shared/triage"
import { countBySeverity } from "../../../shared/triage"
import { ResourceLink } from "../../components/ui/ResourceLink"
import { cn, formatAge } from "../../lib/utils"

/** Past this the list stops being a to-do and starts being a wall; the rest is
 *  a count, and the kind's own view lists them in full. */
const MAX_ROWS = 25

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

/**
 * The top of the Overview: everything the cluster is currently unhappy about,
 * worst first, each row a click into the object it is about. The rules are in
 * `src/shared/triage.ts`; this only renders what they found.
 */
export function NeedsAttentionSection({
  alerts,
}: {
  alerts: ClusterAlert[]
}): JSX.Element {
  const { critical, warning } = countBySeverity(alerts)
  const shown = alerts.slice(0, MAX_ROWS)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">Needs attention</h3>
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
            Nothing needs attention — no broken pods, unready nodes, empty
            workloads, failed jobs or unbound claims.
          </span>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {shown.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm",
                alert.severity === "critical" &&
                  "bg-red-50/60 dark:bg-red-950/10",
              )}
            >
              <SeverityBadge severity={alert.severity} />
              <span className="font-medium whitespace-nowrap">
                {alert.title}
              </span>
              <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                {alert.kind}/
                <ResourceLink
                  kind={alert.kind}
                  name={alert.name}
                  namespace={alert.namespace}
                >
                  {alert.namespace
                    ? `${alert.namespace}/${alert.name}`
                    : alert.name}
                </ResourceLink>
              </span>
              <span
                className="flex-1 min-w-48 text-xs text-muted-foreground truncate"
                title={alert.detail}
              >
                {alert.detail}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatAge(alert.since)}
              </span>
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
    </div>
  )
}
