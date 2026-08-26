import { useCallback, useEffect, useRef, useState } from "react"
import {
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { metricIdentity } from "../../../shared/hpa"
import { SectionHeader } from "../../components/ui/SectionHeader"
import { useAppStore } from "../../store/app.store"
import { K8sHPA, K8sHPAResourceMetric } from "../types/k8s"

/** Session-local history: the HPA API answers "what is it reading now", with
 *  no past to ask for, so the window is however long this panel has been open.
 *  Long enough to see a scaling decision play out, short enough to stay cheap. */
const MAX_SAMPLES = 240

const SERIES_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
]

interface Sample {
  ts: number
  /** Current utilization per metric key, plus `replicas` and `desired`. */
  values: Record<string, number>
}

/** A recharts dataKey: the metric identity with everything but word
 *  characters folded away, since `.` and `/` read as a path there. */
function seriesKey(metric: K8sHPAResourceMetric): string {
  return `m_${metricIdentity(metric).replace(/[^a-zA-Z0-9]/g, "_")}`
}

function metricLabel(metric: K8sHPAResourceMetric): string {
  return metric.kind === "ContainerResource"
    ? `${metric.name}/${metric.container}`
    : metric.name
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** What the metric is reading now, in the units its target is stated in. */
function currentText(metric: K8sHPAResourceMetric): string {
  if (metric.targetType === "Utilization") {
    return metric.currentUtilization === null
      ? "—"
      : `${metric.currentUtilization}%`
  }
  return metric.currentValue || "—"
}

function targetText(metric: K8sHPAResourceMetric): string {
  return metric.targetType === "Utilization"
    ? `${metric.averageUtilization ?? "?"}%`
    : metric.value
}

/**
 * Current-versus-target for every resource metric, sampled on its own timer
 * rather than off the list poll — a chart that only moves when some other
 * field of the HPA changes would draw a misleading line. History is only as
 * long as the panel has been open; nothing is persisted.
 */
export function HPAUtilizationSection({ hpa }: { hpa: K8sHPA }): JSX.Element {
  const selectedContext = useAppStore((s) => s.selectedContext)
  const refreshInterval = useAppStore((s) => s.refreshInterval)
  const [samples, setSamples] = useState<Sample[]>([])
  const [live, setLive] = useState<K8sHPA>(hpa)
  const [error, setError] = useState<string | null>(null)

  const contextRef = useRef(selectedContext)
  contextRef.current = selectedContext

  const { name, namespace } = hpa

  const sample = useCallback(async () => {
    try {
      const fresh = await window.api.k8s.getHPA({
        contextName: contextRef.current ?? undefined,
        namespace,
        name,
      })
      setError(null)
      setLive(fresh)
      const values: Record<string, number> = {
        replicas: fresh.currentReplicas,
        desired: fresh.desiredReplicas,
      }
      for (const metric of fresh.resourceMetrics) {
        if (metric.currentUtilization !== null) {
          values[seriesKey(metric)] = metric.currentUtilization
        }
      }
      setSamples((prev) =>
        [...prev, { ts: Date.now(), values }].slice(-MAX_SAMPLES),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [namespace, name])

  // A different HPA is a different history; drop what the last one collected.
  useEffect(() => {
    setSamples([])
    sample()
  }, [sample])

  useEffect(() => {
    if (refreshInterval === "off") return
    const id = setInterval(sample, (refreshInterval as number) * 1000)
    return () => clearInterval(id)
  }, [refreshInterval, sample])

  const utilizationMetrics = live.resourceMetrics.filter(
    (m) => m.targetType === "Utilization",
  )
  const chartData = samples.map((s) => ({ ts: s.ts, ...s.values }))
  const charted = utilizationMetrics.filter((m) =>
    samples.some((s) => seriesKey(m) in s.values),
  )

  return (
    <div className="space-y-2">
      <SectionHeader title="Utilisation" />

      {live.resourceMetrics.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          This HPA reads no resource metrics.
        </p>
      ) : (
        <div className="rounded border divide-y text-xs">
          <div className="grid grid-cols-3 gap-2 px-2 py-1 font-medium">
            <span>Metric</span>
            <span className="text-right">Current</span>
            <span className="text-right">Target</span>
          </div>
          {live.resourceMetrics.map((metric) => (
            <div
              key={metricIdentity(metric)}
              className="grid grid-cols-3 gap-2 px-2 py-1"
            >
              <span className="truncate font-mono" title={metricLabel(metric)}>
                {metricLabel(metric)}
              </span>
              <span className="text-right tabular-nums">
                {currentText(metric)}
              </span>
              <span className="text-right tabular-nums text-muted-foreground">
                {targetText(metric)}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {charted.length > 0 && samples.length > 1 && (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart
            data={chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="ts"
              tickFormatter={(v) => formatTime(v as number)}
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10 }}
              width={40}
            />
            <Tooltip
              formatter={(value: number, seriesName: string) => [
                `${value}%`,
                seriesName,
              ]}
              labelFormatter={(label) => formatTime(label as number)}
              contentStyle={{ fontSize: 11 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {charted.map((metric, i) => (
              <Line
                key={seriesKey(metric)}
                type="monotone"
                dataKey={seriesKey(metric)}
                name={metricLabel(metric)}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                dot={false}
                isAnimationActive={false}
                strokeWidth={1.5}
                connectNulls
              />
            ))}
            {/* The line the controller is steering each metric towards. */}
            {charted.map((metric, i) => (
              <ReferenceLine
                key={`target-${seriesKey(metric)}`}
                y={metric.averageUtilization ?? undefined}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {charted.length > 0 && samples.length <= 1 && (
        <p className="text-xs text-muted-foreground">
          {refreshInterval === "off"
            ? "Auto-refresh is off, so no history is being collected."
            : `Collecting history — a point every ${refreshInterval}s while this panel stays open.`}
        </p>
      )}

      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          Replicas {live.currentReplicas} of {live.minReplicas}–
          {live.maxReplicas}
        </span>
        <span>Desired {live.desiredReplicas}</span>
      </div>
    </div>
  )
}
