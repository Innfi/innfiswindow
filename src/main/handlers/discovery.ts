import http from "node:http"
import https from "node:https"

import {
  KubeConfig,
  V1APIGroupList,
  V1APIResource,
  V1APIResourceList,
  V1APIVersions,
} from "@kubernetes/client-node"

import {
  ApiGroupVersionError,
  ApiResourceCatalog,
  ApiResourceInfo,
} from "./types"

/** The API server's own error body, which says more than the status line. */
function errorMessage(body: string): string {
  try {
    const status = JSON.parse(body) as { message?: string }
    if (typeof status.message === "string" && status.message !== "")
      return status.message
  } catch {
    // Not a Status object — an aggregated API can answer with anything.
  }
  return body.slice(0, 200)
}

/**
 * A plain GET against the API server.
 *
 * Discovery has no typed client: every compiled-in API only answers for its
 * own group, and the interesting groups here are the ones this app has no
 * client for. `applyToHTTPSOptions` supplies the same CA, client certificate
 * and (exec plugin) bearer token the typed clients get, so this is the
 * kubeconfig identity, not an anonymous request.
 */
async function apiGet<T>(kc: KubeConfig, path: string): Promise<T> {
  const cluster = kc.getCurrentCluster()
  if (!cluster) throw new Error("No active k8s cluster")

  const url = new URL(path, cluster.server)
  const options: https.RequestOptions = {
    method: "GET",
    headers: { Accept: "application/json" },
  }
  await kc.applyToHTTPSOptions(options)
  const transport = url.protocol === "http:" ? http : https

  return new Promise<T>((resolve, reject) => {
    const req = transport.request(url, options, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8")
        const status = res.statusCode ?? 0
        if (status < 200 || status >= 300) {
          reject(new Error(`${status}: ${errorMessage(body)}`))
          return
        }
        try {
          resolve(JSON.parse(body) as T)
        } catch {
          reject(new Error(`${path} did not answer with JSON`))
        }
      })
    })
    req.on("error", reject)
    req.end()
  })
}

/** One GET against the API server, as the merge below needs it: a path in,
 *  parsed JSON out. Injectable so the merge rules can be exercised without a
 *  cluster to serve them. */
export type ApiGetter = <T>(path: string) => Promise<T>

/** One group and the versions to ask it about, preferred version first — the
 *  order the merge below takes a kind's metadata from. */
interface GroupPlan {
  group: string
  versions: string[]
}

function orderedVersions(preferred: string, all: string[]): string[] {
  const rest = all.filter((v) => v !== preferred && v !== "")
  return preferred === "" ? rest : [preferred, ...rest]
}

function groupPlans(core: V1APIVersions, groups: V1APIGroupList): GroupPlan[] {
  const coreVersions = core.versions ?? []
  const plans: GroupPlan[] = [
    // The core group is not in /apis — it has an index of its own, and no
    // preferred version to declare, because there has only ever been v1.
    {
      group: "",
      versions: orderedVersions(coreVersions[0] ?? "v1", coreVersions),
    },
  ]
  for (const group of groups.groups ?? []) {
    const versions = (group.versions ?? []).map((v) => v.version ?? "")
    plans.push({
      group: group.name ?? "",
      versions: orderedVersions(
        group.preferredVersion?.version ?? "",
        versions,
      ),
    })
  }
  return plans
}

function qualifiedName(plural: string, group: string): string {
  return group === "" ? plural : `${plural}.${group}`
}

function toInfo(
  resource: V1APIResource,
  group: string,
  version: string,
): ApiResourceInfo {
  return {
    name: qualifiedName(resource.name, group),
    plural: resource.name,
    singular: resource.singularName ?? "",
    group,
    version,
    apiVersion: group === "" ? version : `${group}/${version}`,
    kind: resource.kind,
    namespaced: resource.namespaced,
    verbs: resource.verbs ?? [],
    shortNames: resource.shortNames ?? [],
    categories: resource.categories ?? [],
    servedVersions: [version],
    subresources: [],
  }
}

/**
 * Every kind the cluster serves — this app's `kubectl api-resources`.
 *
 * Discovery is two indexes (`/api` for the core group, `/apis` for the rest)
 * and then one resource list per served groupVersion, which is where the
 * kinds, their verbs and their short names actually live. The per-version
 * reads run together and are collected with `allSettled`: an aggregated API
 * whose backend is down (metrics-server is the usual one) fails only its own
 * groupVersion, and is reported in `errors` rather than costing the catalogue.
 *
 * A kind is listed once per group, at the first version that serves it —
 * preferred first, so the row says what `kubectl` would say — with the other
 * versions carrying it collected into `servedVersions`.
 */
export async function listApiResources(
  kc: KubeConfig,
  get: ApiGetter = (path) => apiGet(kc, path),
): Promise<ApiResourceCatalog> {
  const [core, groups] = await Promise.all([
    get<V1APIVersions>("/api"),
    get<V1APIGroupList>("/apis"),
  ])

  const reads = groupPlans(core, groups).flatMap((plan) =>
    plan.versions.map((version) => ({
      group: plan.group,
      version,
      groupVersion: plan.group === "" ? version : `${plan.group}/${version}`,
    })),
  )
  const results = await Promise.allSettled(
    reads.map((read) =>
      get<V1APIResourceList>(
        read.group === ""
          ? `/api/${read.version}`
          : `/apis/${read.group}/${read.version}`,
      ),
    ),
  )

  const errors: ApiGroupVersionError[] = []
  const byName = new Map<string, ApiResourceInfo>()

  results.forEach((result, i) => {
    const { group, version, groupVersion } = reads[i]
    if (result.status === "rejected") {
      errors.push({
        groupVersion,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      })
      return
    }
    const resources = result.value.resources ?? []
    // Parents first: a subresource is only attached to a kind already listed,
    // and the API server does not promise to list `pods` before `pods/log`.
    for (const resource of resources) {
      if (resource.name.includes("/")) continue
      const key = qualifiedName(resource.name, group)
      const existing = byName.get(key)
      if (existing) existing.servedVersions.push(version)
      else byName.set(key, toInfo(resource, group, version))
    }
    for (const resource of resources) {
      const slash = resource.name.indexOf("/")
      if (slash === -1) continue
      const parent = byName.get(
        qualifiedName(resource.name.slice(0, slash), group),
      )
      // Subresources come from the version the row itself was read at, so the
      // list never mixes what two versions of a kind expose.
      if (!parent || parent.version !== version) continue
      const sub = resource.name.slice(slash + 1)
      if (!parent.subresources.includes(sub)) parent.subresources.push(sub)
    }
  })

  const resources = [...byName.values()]
  resources.sort(
    (a, b) =>
      a.group.localeCompare(b.group) || a.plural.localeCompare(b.plural),
  )
  for (const resource of resources) {
    resource.subresources.sort()
  }
  return { resources, errors }
}
