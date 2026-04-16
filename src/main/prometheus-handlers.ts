import { app } from "electron"
import * as fs from "fs"
import { join } from "path"

export interface PrometheusConfig {
  prometheusUrl: string
  prometheusToken: string
}

export interface DataPoint {
  timestamp: number
  value: number
}

export interface PodMetricsResult {
  cpu: DataPoint[]
  memory: DataPoint[]
  networkRx: DataPoint[]
  networkTx: DataPoint[]
  diskRead: DataPoint[]
  diskWrite: DataPoint[]
}

export interface PodMetricsError {
  error: string
}

function getConfigPath(): string {
  return join(app.getPath("userData"), "prometheus-config.json")
}

function loadConfig(): PrometheusConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8")
    return JSON.parse(raw) as PrometheusConfig
  } catch {
    return { prometheusUrl: "", prometheusToken: "" }
  }
}

function saveConfig(config: PrometheusConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8")
}

export function getPrometheusConfig(): PrometheusConfig {
  return loadConfig()
}

export function setPrometheusConfig(config: PrometheusConfig): { success: boolean } {
  saveConfig(config)
  return { success: true }
}

async function queryPrometheus(
  baseUrl: string,
  token: string,
  query: string,
  start: number,
  end: number,
  step: number,
): Promise<DataPoint[]> {
  const url = new URL("/api/v1/query_range", baseUrl)
  url.searchParams.set("query", query)
  url.searchParams.set("start", String(start))
  url.searchParams.set("end", String(end))
  url.searchParams.set("step", String(step))

  const headers: Record<string, string> = {}
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(url.toString(), { headers })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = (await response.json()) as {
    status: string
    data: {
      resultType: string
      result: Array<{
        metric: Record<string, string>
        values: Array<[number, string]>
      }>
    }
  }

  if (data.status !== "success") {
    throw new Error("Prometheus query returned non-success status")
  }

  if (!data.data.result.length) return []

  return data.data.result[0].values.map(([ts, val]) => ({
    timestamp: ts,
    value: parseFloat(val),
  }))
}

export async function getPodMetrics(
  namespace: string,
  podName: string,
  step = 60,
  rangeMinutes = 30,
): Promise<PodMetricsResult | PodMetricsError> {
  const config = loadConfig()
  if (!config.prometheusUrl) {
    return { error: "Prometheus not configured" }
  }

  const end = Math.floor(Date.now() / 1000)
  const start = end - rangeMinutes * 60

  const ns = namespace
  const pod = podName

  const cpuQuery = `sum by (pod) (rate(container_cpu_usage_seconds_total{namespace=~"${ns}",pod="${pod}",container!=""}[5m]))`
  const memQuery = `sum by (pod) (container_memory_working_set_bytes{namespace=~"${ns}",pod="${pod}",container!=""})`
  const netRxQuery = `sum by (pod) (rate(container_network_receive_bytes_total{namespace=~"${ns}",pod="${pod}"}[5m]))`
  const netTxQuery = `sum by (pod) (rate(container_network_transmit_bytes_total{namespace=~"${ns}",pod="${pod}"}[5m]))`
  const diskReadQuery = `sum by (pod) (rate(container_fs_reads_bytes_total{namespace=~"${ns}",pod="${pod}"}[5m]))`
  const diskWriteQuery = `sum by (pod) (rate(container_fs_writes_bytes_total{namespace=~"${ns}",pod="${pod}"}[5m]))`

  try {
    const [cpu, memory, networkRx, networkTx, diskRead, diskWrite] =
      await Promise.all([
        queryPrometheus(
          config.prometheusUrl,
          config.prometheusToken,
          cpuQuery,
          start,
          end,
          step,
        ),
        queryPrometheus(
          config.prometheusUrl,
          config.prometheusToken,
          memQuery,
          start,
          end,
          step,
        ),
        queryPrometheus(
          config.prometheusUrl,
          config.prometheusToken,
          netRxQuery,
          start,
          end,
          step,
        ),
        queryPrometheus(
          config.prometheusUrl,
          config.prometheusToken,
          netTxQuery,
          start,
          end,
          step,
        ),
        queryPrometheus(
          config.prometheusUrl,
          config.prometheusToken,
          diskReadQuery,
          start,
          end,
          step,
        ),
        queryPrometheus(
          config.prometheusUrl,
          config.prometheusToken,
          diskWriteQuery,
          start,
          end,
          step,
        ),
      ])

    return { cpu, memory, networkRx, networkTx, diskRead, diskWrite }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
