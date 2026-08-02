import { beforeAll, describe, expect, test } from "vitest"
import { AppsV1Api, CoreV1Api, KubeConfig } from "@kubernetes/client-node"

import {
  getConfigMap,
  getCurrentContext,
  getDaemonSet,
  getDeployment,
  getPod,
  getReplicaSet,
  getSecret,
  getStatefulSet,
  listConfigMaps,
  listContexts,
  listDaemonSets,
  listDeployments,
  listNamespaces,
  listNodes,
  listPods,
  listReplicaSets,
  listSecrets,
  listStatefulSets,
} from "../k8s-handlers"

const KIND_CONTEXT = "kind-innfiswindow-test"

// Check whether the kind context is available before running any tests
function hasKindContext(): boolean {
  try {
    const kc = new KubeConfig()
    kc.loadFromDefault()
    const contexts = kc.getContexts()
    return contexts.some((ctx) => ctx.name === KIND_CONTEXT)
  } catch {
    return false
  }
}

const kindAvailable = hasKindContext()

let kc: KubeConfig
let coreApi: CoreV1Api
let appsApi: AppsV1Api

beforeAll(() => {
  if (!kindAvailable) return
  kc = new KubeConfig()
  kc.loadFromDefault()
  kc.setCurrentContext(KIND_CONTEXT)
  coreApi = kc.makeApiClient(CoreV1Api)
  appsApi = kc.makeApiClient(AppsV1Api)
})

describe.skipIf(!kindAvailable)("k8s IPC handlers against kind cluster", () => {
  test("k8s:contexts:list returns array with kind context", () => {
    const contexts = listContexts(kc)
    expect(Array.isArray(contexts)).toBe(true)
    const kindCtx = contexts.find((c) => c.name === KIND_CONTEXT)
    expect(kindCtx).toBeDefined()
    expect(kindCtx?.name).toBe(KIND_CONTEXT)
    expect(typeof kindCtx?.cluster).toBe("string")
    expect(typeof kindCtx?.user).toBe("string")
  })

  test("k8s:context:current returns kind context name", () => {
    const current = getCurrentContext(kc)
    expect(current).toBe(KIND_CONTEXT)
  })

  test("k8s:namespaces:list returns array with test namespaces", async () => {
    const namespaces = await listNamespaces(coreApi)
    expect(Array.isArray(namespaces)).toBe(true)
    const ns1 = namespaces.find((n) => n.name === "test-ns-1")
    expect(ns1).toBeDefined()
    expect(ns1?.name).toBe("test-ns-1")
    expect(typeof ns1?.status).toBe("string")
    expect(typeof ns1?.creationTimestamp).toBe("string")
    expect(ns1?.creationTimestamp).not.toBe("")
    const ns2 = namespaces.find((n) => n.name === "test-ns-2")
    expect(ns2).toBeDefined()
  })

  test("k8s:nodes:list returns array with at least one node", async () => {
    const nodes = await listNodes(coreApi)
    expect(Array.isArray(nodes)).toBe(true)
    expect(nodes.length).toBeGreaterThan(0)
    const node = nodes[0]
    expect(typeof node.name).toBe("string")
    expect(node.name).not.toBe("")
    expect(typeof node.status).toBe("string")
    expect(typeof node.roles).toBe("string")
    expect(typeof node.version).toBe("string")
    expect(typeof node.creationTimestamp).toBe("string")
    expect(Array.isArray(node.conditions)).toBe(true)
  })

  test("k8s:deployments:list returns array with nginx-deploy", async () => {
    const deployments = await listDeployments(appsApi)
    expect(Array.isArray(deployments)).toBe(true)
    const nginx = deployments.find((d) => d.name === "nginx-deploy")
    expect(nginx).toBeDefined()
    expect(nginx?.namespace).toBe("test-ns-1")
    expect(typeof nginx?.replicas).toBe("number")
    expect(typeof nginx?.readyReplicas).toBe("number")
    expect(typeof nginx?.updatedReplicas).toBe("number")
    expect(typeof nginx?.creationTimestamp).toBe("string")
  })

  test("k8s:deployment:get returns the detail the list omits", async () => {
    const nginx = await getDeployment(appsApi, "test-ns-1", "nginx-deploy")
    expect(nginx.name).toBe("nginx-deploy")
    expect(nginx.namespace).toBe("test-ns-1")
    // Summary fields come through on the detail shape too.
    expect(typeof nginx.replicas).toBe("number")
    expect(typeof nginx.strategy).toBe("string")
    expect(Array.isArray(nginx.containers)).toBe(true)
    expect(nginx.containers.length).toBeGreaterThan(0)
    expect(Array.isArray(nginx.conditions)).toBe(true)
  })

  test("k8s:replicasets:list returns array with nginx replicaset", async () => {
    const replicaSets = await listReplicaSets(appsApi)
    expect(Array.isArray(replicaSets)).toBe(true)
    const nginxRs = replicaSets.find(
      (rs) =>
        rs.namespace === "test-ns-1" && rs.name.startsWith("nginx-deploy-"),
    )
    expect(nginxRs).toBeDefined()
    expect(typeof nginxRs?.desiredReplicas).toBe("number")
    expect(typeof nginxRs?.currentReplicas).toBe("number")
    expect(typeof nginxRs?.readyReplicas).toBe("number")
    expect(typeof nginxRs?.creationTimestamp).toBe("string")
  })

  test("k8s:replicaset:get returns the detail the list omits", async () => {
    const replicaSets = await listReplicaSets(appsApi)
    const summary = replicaSets.find(
      (rs) =>
        rs.namespace === "test-ns-1" && rs.name.startsWith("nginx-deploy-"),
    )
    expect(summary).toBeDefined()
    const rs = await getReplicaSet(appsApi, "test-ns-1", summary!.name)
    expect(Array.isArray(rs.containers)).toBe(true)
    expect(Array.isArray(rs.ownerReferences)).toBe(true)
  })

  test("k8s:statefulsets:list returns array with postgres statefulset", async () => {
    const statefulSets = await listStatefulSets(appsApi)
    expect(Array.isArray(statefulSets)).toBe(true)
    const pg = statefulSets.find((ss) => ss.name === "postgres")
    expect(pg).toBeDefined()
    expect(pg?.namespace).toBe("test-ns-1")
    expect(typeof pg?.replicas).toBe("number")
    expect(typeof pg?.serviceName).toBe("string")
    expect(pg?.serviceName).not.toBe("")
    expect(typeof pg?.creationTimestamp).toBe("string")
  })

  test("k8s:statefulset:get returns the detail the list omits", async () => {
    const pg = await getStatefulSet(appsApi, "test-ns-1", "postgres")
    expect(typeof pg.updateStrategy).toBe("string")
    expect(Array.isArray(pg.containers)).toBe(true)
    expect(Array.isArray(pg.volumeClaimTemplates)).toBe(true)
    expect(pg.volumeClaimTemplates.length).toBeGreaterThan(0)
  })

  test("k8s:daemonsets:list returns array with log-collector daemonset", async () => {
    const daemonSets = await listDaemonSets(appsApi)
    expect(Array.isArray(daemonSets)).toBe(true)
    const lc = daemonSets.find((ds) => ds.name === "log-collector")
    expect(lc).toBeDefined()
    expect(lc?.namespace).toBe("test-ns-1")
    expect(typeof lc?.desiredNumberScheduled).toBe("number")
    expect(typeof lc?.currentNumberScheduled).toBe("number")
    expect(typeof lc?.numberReady).toBe("number")
    expect(typeof lc?.creationTimestamp).toBe("string")
  })

  test("k8s:daemonset:get returns the detail the list omits", async () => {
    const lc = await getDaemonSet(appsApi, "test-ns-1", "log-collector")
    expect(typeof lc.updateStrategy).toBe("string")
    expect(Array.isArray(lc.containers)).toBe(true)
    expect(Array.isArray(lc.tolerations)).toBe(true)
    expect(lc.tolerations.length).toBeGreaterThan(0)
  })

  test("k8s:pods:list returns array with pods in test-ns-1", async () => {
    const pods = await listPods(coreApi, undefined, appsApi)
    expect(Array.isArray(pods)).toBe(true)
    const testPods = pods.filter((p) => p.namespace === "test-ns-1")
    expect(testPods.length).toBeGreaterThan(0)
    const pod = testPods[0]
    expect(typeof pod.name).toBe("string")
    expect(pod.name).not.toBe("")
    expect(typeof pod.namespace).toBe("string")
    expect(typeof pod.status).toBe("string")
    expect(typeof pod.restarts).toBe("number")
    expect(typeof pod.creationTimestamp).toBe("string")
    expect(typeof pod.ownerKind).toBe("string")
  })

  test("k8s:pod:get returns the detail the list omits", async () => {
    const pods = await listPods(coreApi, "test-ns-1", appsApi)
    expect(pods.length).toBeGreaterThan(0)
    const pod = await getPod(coreApi, "test-ns-1", pods[0].name, appsApi)
    expect(pod.name).toBe(pods[0].name)
    // The single-object owner lookup must agree with the list's bulk one.
    expect(pod.ownerKind).toBe(pods[0].ownerKind)
    expect(pod.ownerName).toBe(pods[0].ownerName)
    expect(Array.isArray(pod.containers)).toBe(true)
    expect(Array.isArray(pod.conditions)).toBe(true)
  })

  test("k8s:configmaps:list returns array with app-config and db-config", async () => {
    const configMaps = await listConfigMaps(coreApi)
    expect(Array.isArray(configMaps)).toBe(true)
    const appConfig = configMaps.find((cm) => cm.name === "app-config")
    expect(appConfig).toBeDefined()
    expect(appConfig?.namespace).toBe("test-ns-1")
    expect(typeof appConfig?.creationTimestamp).toBe("string")
    expect(Array.isArray(appConfig?.keys)).toBe(true)
    expect(appConfig?.keys.length).toBeGreaterThan(0)
    const dbConfig = configMaps.find((cm) => cm.name === "db-config")
    expect(dbConfig).toBeDefined()
  })

  test("k8s:configmap:get returns data the list omits", async () => {
    const appConfig = await getConfigMap(coreApi, "test-ns-1", "app-config")
    expect(typeof appConfig.data).toBe("object")
    expect(Object.keys(appConfig.data)).toEqual(
      expect.arrayContaining(appConfig.keys.slice(0, 1)),
    )
  })

  test("k8s:secrets:list returns array with app-secret", async () => {
    const secrets = await listSecrets(coreApi)
    expect(Array.isArray(secrets)).toBe(true)
    const appSecret = secrets.find((s) => s.name === "app-secret")
    expect(appSecret).toBeDefined()
    expect(appSecret?.namespace).toBe("test-ns-1")
    expect(typeof appSecret?.type).toBe("string")
    expect(appSecret?.type).toBe("Opaque")
    expect(typeof appSecret?.creationTimestamp).toBe("string")
    expect(Array.isArray(appSecret?.keys)).toBe(true)
    expect(appSecret?.keys).toContain("API_KEY")
    expect(appSecret?.keys).toContain("DB_PASSWORD")
    // The values must not ride along with the list.
    expect(appSecret).not.toHaveProperty("data")
  })

  test("k8s:secret:get returns the values the list omits", async () => {
    const appSecret = await getSecret(coreApi, "test-ns-1", "app-secret")
    expect(typeof appSecret.data).toBe("object")
    expect(typeof appSecret.data["API_KEY"]).toBe("string")
  })
})
