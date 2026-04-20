import { app } from "electron"
import * as fs from "fs"
import { join } from "path"
import { PrometheusDriver, RangeVector, SampleValue } from "prometheus-query"
import { KubeConfig } from "@kubernetes/client-node"

export interface PrometheusConfig {
  namespace: string
  service: string
  port: number
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

const DEFAULT_CONFIG: PrometheusConfig = {
  namespace: "prometheus",
  service: "prometheus-server",
  port: 80,
}

function getConfigPath(): string {
  return join(app.getPath("userData"), "prometheus-config.json")
}

function loadConfig(): PrometheusConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8")
    return {
      ...DEFAULT_CONFIG,
      ...(JSON.parse(raw) as Partial<PrometheusConfig>),
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function saveConfig(config: PrometheusConfig): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8")
}

export function getPrometheusConfig(): PrometheusConfig {
  return loadConfig()
}

export function setPrometheusConfig(config: PrometheusConfig): {
  success: boolean
} {
  saveConfig(config)
  return { success: true }
}

async function buildDriver(
  kc: KubeConfig,
  config: PrometheusConfig,
): Promise<PrometheusDriver> {
  const cluster = kc.getCurrentCluster()
  if (!cluster) throw new Error("No active k8s cluster")

  const fetchOpts = await kc.applyToFetchOptions({})
  const authHeader =
    (fetchOpts.headers as unknown as Headers).get("Authorization") ?? undefined
  const httpsAgent = fetchOpts.agent

  const { namespace, service, port } = config
  const endpoint = `${cluster.server}/api/v1/namespaces/${namespace}/services/http:${service}:${port}/proxy`

  return new PrometheusDriver({
    endpoint,
    headers: authHeader ? { Authorization: authHeader } : {},
    requestInterceptor: {
      onFulfilled: (config) => {
        if (httpsAgent)
          (config as unknown as Record<string, unknown>).httpsAgent = httpsAgent
        return config
      },
    },
  })
}

async function queryPrometheus(
  driver: PrometheusDriver,
  query: string,
  start: number,
  end: number,
  step: number,
): Promise<DataPoint[]> {
  const result = await driver.rangeQuery(query, start * 1000, end * 1000, step)

  if (!result.result.length) return []

  const rangeVector = result.result[0] as RangeVector
  return rangeVector.values.map((sv: SampleValue) => ({
    timestamp: sv.time.getTime() / 1000,
    value: sv.value,
  }))
}

export interface PrometheusDiscoveryResult {
  ok: boolean
  endpoint: string
  error?: string
}

export async function checkPrometheusConnectivity(): Promise<PrometheusDiscoveryResult> {
  const config = loadConfig()
  const kc = new KubeConfig()
  kc.loadFromDefault()

  let driver: PrometheusDriver
  let endpoint: string
  try {
    const cluster = kc.getCurrentCluster()
    if (!cluster) throw new Error("No active k8s cluster")
    const { namespace, service, port } = config
    endpoint = `${cluster.server}/api/v1/namespaces/${namespace}/services/http:${service}:${port}/proxy`
    driver = await buildDriver(kc, config)
  } catch (e) {
    return {
      ok: false,
      endpoint: "",
      error: e instanceof Error ? e.message : String(e),
    }
  }

  try {
    await driver.instantQuery("1")
    return { ok: true, endpoint }
  } catch (e) {
    const error =
      e instanceof Error ? e.message : (JSON.stringify(e) ?? String(e))
    return { ok: false, endpoint, error }
  }
}

export async function getPodMetrics(
  namespace: string,
  podName: string,
  step = 60,
  rangeMinutes = 30,
): Promise<PodMetricsResult | PodMetricsError> {
  const config = loadConfig()

  const kc = new KubeConfig()
  kc.loadFromDefault()

  let driver: PrometheusDriver
  try {
    driver = await buildDriver(kc, config)
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
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
        queryPrometheus(driver, cpuQuery, start, end, step),
        queryPrometheus(driver, memQuery, start, end, step),
        queryPrometheus(driver, netRxQuery, start, end, step),
        queryPrometheus(driver, netTxQuery, start, end, step),
        queryPrometheus(driver, diskReadQuery, start, end, step),
        queryPrometheus(driver, diskWriteQuery, start, end, step),
      ])

    return { cpu, memory, networkRx, networkTx, diskRead, diskWrite }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : (JSON.stringify(e) ?? String(e)),
    }
  }
}
