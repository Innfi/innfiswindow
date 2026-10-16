import { app } from "electron"
import * as fs from "fs"
import { createServer, Server } from "net"
import { join } from "path"
import { PrometheusDriver, RangeVector, SampleValue } from "prometheus-query"
import { CoreV1Api, KubeConfig, PortForward } from "@kubernetes/client-node"

import type {
  DataPoint,
  PodMetricsError,
  PodMetricsResult,
  PrometheusConfig,
  PrometheusDiscoveryResult,
} from "../shared/ipc"

export type {
  DataPoint,
  PodMetricsError,
  PodMetricsResult,
  PrometheusConfig,
  PrometheusDiscoveryResult,
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
  // A new service address voids every context's tunnel and every fallback
  // decision made against the old one.
  for (const route of routes.values()) route.tunnel?.server.close()
  routes.clear()
  return { success: true }
}

type ProxyMode = "apiserver" | "portforward"

interface PortForwardTunnel {
  key: string
  server: Server
  localPort: number
}

/**
 * How one kubeconfig context reaches its Prometheus. Some clusters deny the
 * API server's services/proxy subresource via RBAC; a context falls back to a
 * pod-level port-forward tunnel (needs only pods/portforward) once that is
 * detected, and sticks with it. Kept per context: a tunnel is into one
 * cluster's pod, and one cluster's RBAC says nothing about another's.
 */
interface PrometheusRoute {
  proxyMode: ProxyMode
  tunnel: PortForwardTunnel | null
}

/** Keyed by context name, `""` for the kubeconfig's current context. */
const routes = new Map<string, PrometheusRoute>()

function routeFor(contextKey: string): PrometheusRoute {
  let route = routes.get(contextKey)
  if (!route) {
    route = { proxyMode: "apiserver", tunnel: null }
    routes.set(contextKey, route)
  }
  return route
}

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
  route: PrometheusRoute,
  config: PrometheusConfig,
): Promise<string> {
  const { namespace, service, port } = config
  const key = `${namespace}/${service}/${port}`

  if (route.tunnel && route.tunnel.key === key) {
    return `http://127.0.0.1:${route.tunnel.localPort}`
  }
  if (route.tunnel) {
    route.tunnel.server.close()
    route.tunnel = null
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

  route.tunnel = { key, server, localPort }
  return `http://127.0.0.1:${localPort}`
}

async function buildDriver(
  kc: KubeConfig,
  route: PrometheusRoute,
  config: PrometheusConfig,
): Promise<PrometheusDriver> {
  if (route.proxyMode === "portforward") {
    const endpoint = await getPortForwardEndpoint(kc, route, config)
    return new PrometheusDriver({ endpoint })
  }

  const cluster = kc.getCurrentCluster()
  if (!cluster) throw new Error("No active k8s cluster")

  const fetchOpts = await kc.applyToFetchOptions({})
  // `RequestInit` here is node-fetch's, whose `headers` widens to a union with
  // an index signature; at runtime kubeconfig always sets a real Headers.
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
  route: PrometheusRoute,
  config: PrometheusConfig,
  fn: (driver: PrometheusDriver) => Promise<T>,
): Promise<T> {
  const driver = await buildDriver(kc, route, config)
  try {
    return await fn(driver)
  } catch (e) {
    if (route.proxyMode !== "apiserver" || !isForbidden(e)) throw e
    route.proxyMode = "portforward"
    const fallbackDriver = await buildDriver(kc, route, config)
    return fn(fallbackDriver)
  }
}

function currentEndpointLabel(
  kc: KubeConfig,
  route: PrometheusRoute,
  config: PrometheusConfig,
): string {
  const { namespace, service, port } = config
  if (route.proxyMode === "portforward") {
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

/** `kc` must be the KubeConfig of `contextName`; the name keys the context's
 *  proxy-or-tunnel state. */
export async function checkPrometheusConnectivity(
  kc: KubeConfig,
  contextName?: string | null,
): Promise<PrometheusDiscoveryResult> {
  const config = loadConfig()
  const route = routeFor(contextName ?? "")

  try {
    await withProxyFallback(kc, route, config, (driver) =>
      driver.instantQuery("1"),
    )
    return { ok: true, endpoint: currentEndpointLabel(kc, route, config) }
  } catch (e) {
    const error =
      e instanceof Error ? e.message : (JSON.stringify(e) ?? String(e))
    return {
      ok: false,
      endpoint: currentEndpointLabel(kc, route, config),
      error,
    }
  }
}

/**
 * A PromQL string literal holding `value` exactly. Kubernetes names cannot
 * carry a quote or a backslash today, but this is the one place a name is
 * spliced into a query language, so it does not rely on that.
 */
export function promStringLiteral(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")}"`
}

/** The six range queries behind the pod metrics charts. Both labels are
 *  exact matches: a namespace is a name, not a pattern. */
export function podMetricQueries(
  namespace: string,
  podName: string,
): Record<keyof PodMetricsResult, string> {
  const pod = `namespace=${promStringLiteral(namespace)},pod=${promStringLiteral(podName)}`
  return {
    cpu: `sum by (pod) (rate(container_cpu_usage_seconds_total{${pod},container!=""}[5m]))`,
    memory: `sum by (pod) (container_memory_working_set_bytes{${pod},container!=""})`,
    networkRx: `sum by (pod) (rate(container_network_receive_bytes_total{${pod}}[5m]))`,
    networkTx: `sum by (pod) (rate(container_network_transmit_bytes_total{${pod}}[5m]))`,
    diskRead: `sum by (pod) (rate(container_fs_reads_bytes_total{${pod}}[5m]))`,
    diskWrite: `sum by (pod) (rate(container_fs_writes_bytes_total{${pod}}[5m]))`,
  }
}

/** `kc` must be the KubeConfig of `contextName`, as for the connectivity
 *  check: the pod is in that cluster, so its metrics are in that cluster's
 *  Prometheus. */
export async function getPodMetrics(
  kc: KubeConfig,
  contextName: string | null | undefined,
  namespace: string,
  podName: string,
  step = 60,
  rangeMinutes = 30,
): Promise<PodMetricsResult | PodMetricsError> {
  const config = loadConfig()
  const route = routeFor(contextName ?? "")

  const end = Math.floor(Date.now() / 1000)
  const start = end - rangeMinutes * 60
  const q = podMetricQueries(namespace, podName)

  try {
    const [cpu, memory, networkRx, networkTx, diskRead, diskWrite] =
      await withProxyFallback(kc, route, config, (driver) =>
        Promise.all([
          queryPrometheus(driver, q.cpu, start, end, step),
          queryPrometheus(driver, q.memory, start, end, step),
          queryPrometheus(driver, q.networkRx, start, end, step),
          queryPrometheus(driver, q.networkTx, start, end, step),
          queryPrometheus(driver, q.diskRead, start, end, step),
          queryPrometheus(driver, q.diskWrite, start, end, step),
        ]),
      )

    return { cpu, memory, networkRx, networkTx, diskRead, diskWrite }
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : (JSON.stringify(e) ?? String(e)),
    }
  }
}
