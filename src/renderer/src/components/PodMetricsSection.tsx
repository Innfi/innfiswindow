import { useCallback, useEffect, useRef, useState } from "react"
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  formatCores,
  formatMemory,
  formatMillicores,
} from "../../../shared/quantity"
import { Button } from "../../components/ui/Button"
import { useAppStore } from "../../store/app.store"
import { K8sPodMetric } from "../types/k8s"

interface DataPoint {
  timestamp: number
  value: number
}

interface PodMetrics {
  cpu: DataPoint[]
  memory: DataPoint[]
  networkRx: DataPoint[]
  networkTx: DataPoint[]
  diskRead: DataPoint[]
  diskWrite: DataPoint[]
}

interface MetricsResult extends PodMetrics {
  error?: string
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GiB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KiB`
  return `${bytes.toFixed(0)} B`
}

function formatBytesPerSec(val: number): string {
  return formatBytes(val) + "/s"
}

function cpuTick(val: number): string {
  return val.toFixed(3)
}

function memTick(val: number): string {
  return formatBytes(val)
}

function networkTick(val: number): string {
  return formatBytesPerSec(val)
}

function MetricChart({
  title,
  data,
  lines,
  yTickFormatter,
  tooltipFormatter,
}: {
  title: string
  data: Record<string, number | undefined>[]
  lines: { key: string; color: string; label: string }[]
  yTickFormatter: (v: number) => string
  tooltipFormatter: (v: number) => string
}): JSX.Element {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => formatTime(v as number)}
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={yTickFormatter}
            tick={{ fontSize: 10 }}
            width={60}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              tooltipFormatter(value),
              name,
            ]}
            labelFormatter={(label) => formatTime(label as number)}
            contentStyle={{ fontSize: 11 }}
          />
          {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              dot={false}
              isAnimationActive={false}
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function buildSingleSeries(
  points: DataPoint[],
  key: string,
): Record<string, number | undefined>[] {
  return points.map((p) => ({ ts: p.timestamp, [key]: p.value }))
}

function buildDualSeries(
  a: DataPoint[],
  keyA: string,
  b: DataPoint[],
  keyB: string,
): Record<string, number | undefined>[] {
  const map = new Map<number, Record<string, number | undefined>>()
  for (const p of a) {
    map.set(p.timestamp, { ts: p.timestamp, [keyA]: p.value })
  }
  for (const p of b) {
    const existing = map.get(p.timestamp) ?? { ts: p.timestamp }
    existing[keyB] = p.value
    map.set(p.timestamp, existing)
  }
  return Array.from(map.values()).sort(
    (x, y) => (x.ts as number) - (y.ts as number),
  )
}

/**
 * Point-in-time usage straight from metrics-server, for clusters with no
 * Prometheus behind them. There is no history in this API — it answers "what
 * is this pod using now", which is what `kubectl top pod` prints — so it
 * renders as a table rather than as the charts above.
 */
function MetricsServerUsage({
  namespace,
  podName,
}: {
  namespace: string
  podName: string
}): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const refreshInterval = useAppStore((s) => s.refreshInterval)
  const [metric, setMetric] = useState<K8sPodMetric | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)

  const contextRef = useRef(selectedContext)
  contextRef.current = selectedContext

  const fetchMetric = useCallback(async () => {
    try {
      const result = await window.api.k8s.getPodMetric({
        contextName: contextRef.current ?? undefined,
        namespace,
        name: podName,
      })
      if ("unavailable" in result) {
        setUnavailable(true)
        setMetric(null)
      } else {
        setUnavailable(false)
        setMetric(result)
      }
    } catch {
      setUnavailable(true)
      setMetric(null)
    } finally {
      setLoading(false)
    }
  }, [namespace, podName])

  useEffect(() => {
    setLoading(true)
    fetchMetric()
  }, [fetchMetric])

  useEffect(() => {
    if (refreshInterval === "off" || unavailable) return
    const id = setInterval(fetchMetric, (refreshInterval as number) * 1000)
    return () => clearInterval(id)
  }, [refreshInterval, unavailable, fetchMetric])

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground">Loading current usage…</p>
    )
  }

  if (unavailable || !metric) {
    return (
      <p className="text-xs text-muted-foreground">
        metrics-server has no reading for this pod
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">Current usage</span>
        <span className="text-muted-foreground">
          {metric.window ? `over ${metric.window}` : "metrics-server"}
        </span>
      </div>
      <div className="rounded border divide-y text-xs">
        <div className="grid grid-cols-3 gap-2 px-2 py-1 font-medium">
          <span>Container</span>
          <span className="text-right">CPU</span>
          <span className="text-right">Memory</span>
        </div>
        {metric.containers.map((c) => (
          <div key={c.name} className="grid grid-cols-3 gap-2 px-2 py-1">
            <span className="truncate" title={c.name}>
              {c.name}
            </span>
            <span className="text-right tabular-nums">
              {formatMillicores(c.cpuNanocores)}
            </span>
            <span className="text-right tabular-nums">
              {formatMemory(c.memoryBytes)}
            </span>
          </div>
        ))}
        <div className="grid grid-cols-3 gap-2 px-2 py-1 font-medium">
          <span>Pod total</span>
          <span className="text-right tabular-nums">
            {formatMillicores(metric.cpuNanocores)} (
            {formatCores(metric.cpuNanocores)} cores)
          </span>
          <span className="text-right tabular-nums">
            {formatMemory(metric.memoryBytes)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function PodMetricsSection({
  namespace,
  podName,
}: {
  namespace: string
  podName: string
}): JSX.Element {
  const [metrics, setMetrics] = useState<PodMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notConfigured, setNotConfigured] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTimer(): void {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  async function fetchMetrics(): Promise<void> {
    setLoading(true)
    setError(null)
    setNotConfigured(false)
    try {
      const result = (await window.api.getPrometheusPodMetrics({
        namespace,
        podName,
      })) as MetricsResult
      if ("error" in result && result.error) {
        if (result.error === "Prometheus not configured") {
          setNotConfigured(true)
        } else {
          setError(result.error)
        }
        setMetrics(null)
      } else {
        setMetrics(result)
      }
    } catch (e) {
      setError(String(e))
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    intervalRef.current = setInterval(() => {
      fetchMetrics()
    }, 60000)
    return () => {
      clearTimer()
    }
  }, [namespace, podName])

  if (loading) {
    return (
      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Metrics
        </h3>
        <div className="flex items-center gap-2 py-4">
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
          <span className="text-xs text-muted-foreground">
            Loading metrics…
          </span>
        </div>
      </div>
    )
  }

  // Without Prometheus there is no history to chart, but metrics-server still
  // answers for the current moment — show that rather than nothing.
  if (notConfigured || error) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Metrics
        </h3>
        {notConfigured ? (
          <p className="text-xs text-muted-foreground">
            Prometheus not configured — add URL in Settings for history
          </p>
        ) : (
          <>
            <p className="text-xs text-red-500">{error}</p>
            <Button size="sm" variant="outline" onClick={fetchMetrics}>
              Retry
            </Button>
          </>
        )}
        <MetricsServerUsage namespace={namespace} podName={podName} />
      </div>
    )
  }

  if (!metrics) return <></>

  const cpuData = buildSingleSeries(metrics.cpu, "cpu")
  const memData = buildSingleSeries(metrics.memory, "mem")
  const netData = buildDualSeries(
    metrics.networkRx,
    "rx",
    metrics.networkTx,
    "tx",
  )
  const diskData = buildDualSeries(
    metrics.diskRead,
    "read",
    metrics.diskWrite,
    "write",
  )

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
        Metrics
      </h3>
      <MetricChart
        title="CPU Usage (cores)"
        data={cpuData}
        lines={[{ key: "cpu", color: "#3b82f6", label: "CPU" }]}
        yTickFormatter={cpuTick}
        tooltipFormatter={(v) => `${v.toFixed(4)} cores`}
      />
      <MetricChart
        title="Memory Usage"
        data={memData}
        lines={[{ key: "mem", color: "#10b981", label: "Memory" }]}
        yTickFormatter={memTick}
        tooltipFormatter={formatBytes}
      />
      <MetricChart
        title="Network I/O"
        data={netData}
        lines={[
          { key: "rx", color: "#6366f1", label: "Rx" },
          { key: "tx", color: "#f59e0b", label: "Tx" },
        ]}
        yTickFormatter={networkTick}
        tooltipFormatter={formatBytesPerSec}
      />
      <MetricChart
        title="Disk I/O"
        data={diskData}
        lines={[
          { key: "read", color: "#ec4899", label: "Read" },
          { key: "write", color: "#14b8a6", label: "Write" },
        ]}
        yTickFormatter={networkTick}
        tooltipFormatter={formatBytesPerSec}
      />
    </div>
  )
}
