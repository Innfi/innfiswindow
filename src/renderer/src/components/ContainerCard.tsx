import { cn } from "../../lib/utils"

export interface ContainerCardData {
  name: string
  image: string
  restartCount?: number
  ports: { name: string; containerPort: number; protocol: string }[]
  env: { name: string; value: string; valueFrom?: string }[]
  resources: {
    requests: Record<string, string>
    limits: Record<string, string>
  }
  volumeMounts: { name: string; mountPath: string; readOnly: boolean }[]
  livenessProbe: {
    description: string
    initialDelaySeconds: number
    periodSeconds: number
    timeoutSeconds: number
    failureThreshold: number
  } | null
  readinessProbe: {
    description: string
    initialDelaySeconds: number
    periodSeconds: number
    timeoutSeconds: number
    failureThreshold: number
  } | null
  startupProbe: {
    description: string
    initialDelaySeconds: number
    periodSeconds: number
    timeoutSeconds: number
    failureThreshold: number
  } | null
}

function ProbeRow({
  label,
  probe,
}: {
  label: string
  probe: NonNullable<ContainerCardData["livenessProbe"]>
}): JSX.Element {
  return (
    <div>
      <div className="font-medium text-muted-foreground mb-0.5">{label}</div>
      <div className="text-muted-foreground">{probe.description}</div>
      <div className="text-muted-foreground">
        delay={probe.initialDelaySeconds}s period={probe.periodSeconds}s
        timeout={probe.timeoutSeconds}s #fail={probe.failureThreshold}
      </div>
    </div>
  )
}

export function ContainerCard({
  container,
  search = "",
}: {
  container: ContainerCardData
  search?: string
}): JSX.Element {
  const m = (s: string): boolean => !search || s.toLowerCase().includes(search)

  const visiblePorts = container.ports.filter(
    (p) => m(String(p.containerPort)) || m(p.name) || m(p.protocol),
  )
  const visibleEnv = container.env.filter(
    (e) => m(e.name) || m(e.value) || m(e.valueFrom ?? ""),
  )
  const visibleMounts = container.volumeMounts.filter(
    (mv) => m(mv.name) || m(mv.mountPath),
  )

  const hasRequests = Object.keys(container.resources.requests).length > 0
  const hasLimits = Object.keys(container.resources.limits).length > 0

  return (
    <div className={cn("text-xs border rounded p-2 space-y-2")}>
      <div>
        <div className="font-medium text-sm">{container.name}</div>
        <div className="text-muted-foreground break-all">{container.image}</div>
        {container.restartCount !== undefined && (
          <div className="text-muted-foreground">
            Restarts: {container.restartCount}
          </div>
        )}
      </div>

      {visiblePorts.length > 0 && (
        <div>
          <div className="font-medium text-muted-foreground mb-0.5">Ports</div>
          {visiblePorts.map((p, i) => (
            <div key={i} className="text-muted-foreground">
              {p.containerPort}/{p.protocol}
              {p.name ? ` (${p.name})` : ""}
            </div>
          ))}
        </div>
      )}

      {visibleEnv.length > 0 && (
        <div>
          <div className="font-medium text-muted-foreground mb-0.5">
            Environment
          </div>
          {visibleEnv.map((e) => (
            <div key={e.name} className="flex gap-1 flex-wrap">
              <span className="text-foreground">{e.name}:</span>
              <span className="text-muted-foreground break-all">
                {e.valueFrom ? `(${e.valueFrom})` : e.value || "<empty>"}
              </span>
            </div>
          ))}
        </div>
      )}

      {(hasRequests || hasLimits) && (
        <div>
          <div className="font-medium text-muted-foreground mb-0.5">
            Resources
          </div>
          {hasRequests && (
            <div>
              <span className="text-muted-foreground">Requests: </span>
              {Object.entries(container.resources.requests)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}
            </div>
          )}
          {hasLimits && (
            <div>
              <span className="text-muted-foreground">Limits: </span>
              {Object.entries(container.resources.limits)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}
            </div>
          )}
        </div>
      )}

      {visibleMounts.length > 0 && (
        <div>
          <div className="font-medium text-muted-foreground mb-0.5">Mounts</div>
          {visibleMounts.map((mv) => (
            <div key={mv.name} className="text-muted-foreground">
              {mv.mountPath}
              {" ← "}
              {mv.name}
              {mv.readOnly ? " (ro)" : ""}
            </div>
          ))}
        </div>
      )}

      {container.livenessProbe && m(container.livenessProbe.description) && (
        <ProbeRow label="Liveness" probe={container.livenessProbe} />
      )}
      {container.readinessProbe && m(container.readinessProbe.description) && (
        <ProbeRow label="Readiness" probe={container.readinessProbe} />
      )}
      {container.startupProbe && m(container.startupProbe.description) && (
        <ProbeRow label="Startup" probe={container.startupProbe} />
      )}
    </div>
  )
}
