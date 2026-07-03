import { app } from "electron"
import * as fs from "fs"
import { createServer, Server } from "net"
import { join } from "path"
import { PrometheusDriver, RangeVector, SampleValue } from "prometheus-query"
import { CoreV1Api, KubeConfig, PortForward } from "@kubernetes/client-node"

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
  if (pfTunnel) {
    pfTunnel.server.close()
    pfTunnel = null
  }
  proxyMode = "apiserver"
  return { success: true }
}

type ProxyMode = "apiserver" | "portforward"

// Some clusters deny the API server's services/proxy subresource via RBAC.
// Fall back to a pod-level port-forward tunnel (needs only pods/portforward)
// once that's detected, and stick with it for subsequent calls.
let proxyMode: ProxyMode = "apiserver"

interface PortForwardTunnel {
  key: string
  server: Server
  localPort: number
}

let pfTunnel: PortForwardTunnel | null = null

function isForbidden(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /forbidden|403/i.test(msg)
}

async function resolveEndpointPod(
  coreV1Api: CoreV1Api,
  namespace: string,
  service: string,
): Promise<{ podName: string; podNamespace: string; targetPort: number }> {
  const ep = await coreV1Api.readNamespacedEndpoints({
    name: service,
    namespace,
  })
  const subset = ep.subsets?.[0]
  const addr = subset?.addresses?.[0]
  if (!addr?.targetRef?.name) {
    throw new Error("No ready pods found for prometheus service")
  }
  const targetPort = subset?.ports?.[0]?.port
  if (!targetPort) {
    throw new Error("Could not resolve target port for prometheus service")
  }
  return {
    podName: addr.targetRef.name,
    podNamespace: addr.targetRef.namespace ?? namespace,
    targetPort,
  }
}

async function getPortForwardEndpoint(
  kc: KubeConfig,
  config: PrometheusConfig,
): Promise<string> {
  const { namespace, service, port } = config
  const key = `${namespace}/${service}/${port}`

  if (pfTunnel && pfTunnel.key === key) {
    return `http://127.0.0.1:${pfTunnel.localPort}`
  }
  if (pfTunnel) {
    pfTunnel.server.close()
    pfTunnel = null
  }

  const coreV1Api = kc.makeApiClient(CoreV1Api)
  const { podName, podNamespace, targetPort } = await resolveEndpointPod(
    coreV1Api,
    namespace,
    service,
  )

  const forward = new PortForward(kc)
  const server = createServer((socket) => {
    forward
      .portForward(podNamespace, podName, [targetPort], socket, null, socket)
      .catch(() => socket.destroy())
  })

  const localPort = await new Promise<number>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address()
      if (addr && typeof addr === "object") resolve(addr.port)
      else reject(new Error("Failed to allocate local port"))
    })
    server.on("error", reject)
  })

  pfTunnel = { key, server, localPort }
  return `http://127.0.0.1:${localPort}`
}

async function buildDriver(
  kc: KubeConfig,
  config: PrometheusConfig,
): Promise<PrometheusDriver> {
  if (proxyMode === "portforward") {
    const endpoint = await getPortForwardEndpoint(kc, config)
    return new PrometheusDriver({ endpoint })
  }

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

async function withProxyFallback<T>(
  kc: KubeConfig,
  config: PrometheusConfig,
  fn: (driver: PrometheusDriver) => Promise<T>,
): Promise<T> {
  const driver = await buildDriver(kc, config)
  try {
    return await fn(driver)
  } catch (e) {
    if (proxyMode !== "apiserver" || !isForbidden(e)) throw e
    proxyMode = "portforward"
    const fallbackDriver = await buildDriver(kc, config)
    return fn(fallbackDriver)
  }
}

function currentEndpointLabel(
  kc: KubeConfig,
  config: PrometheusConfig,
): string {
  const { namespace, service, port } = config
  if (proxyMode === "portforward") {
    return `portforward://${namespace}/${service}:${port}`
  }
  const cluster = kc.getCurrentCluster()
  return `${cluster?.server ?? ""}/api/v1/namespaces/${namespace}/services/http:${service}:${port}/proxy`
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

  try {
    await withProxyFallback(kc, config, (driver) => driver.instantQuery("1"))
    return { ok: true, endpoint: currentEndpointLabel(kc, config) }
  } catch (e) {
    const error =
      e instanceof Error ? e.message : (JSON.stringify(e) ?? String(e))
    return { ok: false, endpoint: currentEndpointLabel(kc, config), error }
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
      await withProxyFallback(kc, config, (driver) =>
        Promise.all([
          queryPrometheus(driver, cpuQuery, start, end, step),
          queryPrometheus(driver, memQuery, start, end, step),
          queryPrometheus(driver, netRxQuery, start, end, step),
          queryPrometheus(driver, netTxQuery, start, end, step),
          queryPrometheus(driver, diskReadQuery, start, end, step),
          queryPrometheus(driver, diskWriteQuery, start, end, step),
        ]),
      )

    return { cpu, memory, networkRx, networkTx, diskRead, diskWrite }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : (JSON.stringify(e) ?? String(e)),
    }
  }
}
