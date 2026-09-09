import { describe, expect, test } from "vitest"
import { KubeConfig, V1APIResource } from "@kubernetes/client-node"

import { ApiGetter, listApiResources } from "../handlers/discovery"

// Discovery is one GET per served groupVersion and a merge over the answers.
// The GET is injected here, so what is under test is the merge: which version
// a kind is reported at, which versions it says serve it, which subresources
// hang off it, and what a groupVersion that does not answer costs.

function resource(
  name: string,
  kind: string,
  extra: Partial<V1APIResource> = {},
): V1APIResource {
  return {
    name,
    kind,
    namespaced: true,
    singularName: "",
    verbs: ["get", "list"],
    ...extra,
  }
}

const CLUSTER: Record<string, unknown> = {
  "/api": { versions: ["v1"] },
  "/api/v1": {
    groupVersion: "v1",
    resources: [
      resource("pods", "Pod", {
        singularName: "pod",
        shortNames: ["po"],
        categories: ["all"],
        verbs: ["create", "delete", "get", "list", "patch", "watch"],
      }),
      resource("pods/log", "Pod"),
      resource("pods/status", "Pod"),
      resource("events", "Event"),
      resource("nodes", "Node", { namespaced: false }),
    ],
  },
  "/apis": {
    groups: [
      {
        name: "apps",
        versions: [{ groupVersion: "apps/v1", version: "v1" }],
        preferredVersion: { groupVersion: "apps/v1", version: "v1" },
      },
      {
        name: "example.com",
        versions: [
          { groupVersion: "example.com/v1beta1", version: "v1beta1" },
          { groupVersion: "example.com/v1", version: "v1" },
        ],
        preferredVersion: { groupVersion: "example.com/v1", version: "v1" },
      },
      {
        name: "metrics.k8s.io",
        versions: [
          { groupVersion: "metrics.k8s.io/v1beta1", version: "v1beta1" },
        ],
        preferredVersion: {
          groupVersion: "metrics.k8s.io/v1beta1",
          version: "v1beta1",
        },
      },
    ],
  },
  "/apis/apps/v1": {
    groupVersion: "apps/v1",
    resources: [
      resource("deployments", "Deployment", { shortNames: ["deploy"] }),
      resource("deployments/scale", "Scale"),
    ],
  },
  "/apis/example.com/v1": {
    groupVersion: "example.com/v1",
    resources: [resource("widgets", "Widget", { shortNames: ["wd"] })],
  },
  "/apis/example.com/v1beta1": {
    groupVersion: "example.com/v1beta1",
    resources: [
      resource("widgets", "Widget"),
      resource("widgets/status", "Widget"),
      // Dropped in v1, so v1beta1 is the only version that carries it.
      resource("gadgets", "Gadget", { namespaced: false }),
    ],
  },
}

function getter(): ApiGetter {
  return async <T>(path: string): Promise<T> => {
    if (path === "/apis/metrics.k8s.io/v1beta1") {
      throw new Error(
        "503: the server is currently unable to handle the request",
      )
    }
    const body = CLUSTER[path]
    if (body === undefined) throw new Error(`404: ${path} not found`)
    return body as T
  }
}

const catalog = (): ReturnType<typeof listApiResources> =>
  listApiResources({} as KubeConfig, getter())

describe("listApiResources", () => {
  test("names a kind the way it is addressed, group first for sorting", async () => {
    const { resources } = await catalog()
    expect(resources.map((r) => r.name)).toEqual([
      // Core group first — the empty group name sorts before every other.
      "events",
      "nodes",
      "pods",
      "deployments.apps",
      "gadgets.example.com",
      "widgets.example.com",
    ])
  })

  test("carries the metadata of the version it reports", async () => {
    const { resources } = await catalog()
    const pods = resources.find((r) => r.name === "pods")
    expect(pods).toMatchObject({
      plural: "pods",
      singular: "pod",
      group: "",
      version: "v1",
      apiVersion: "v1",
      kind: "Pod",
      namespaced: true,
      shortNames: ["po"],
      categories: ["all"],
      servedVersions: ["v1"],
    })
    expect(pods?.verbs).toContain("watch")
    const deployments = resources.find((r) => r.name === "deployments.apps")
    expect(deployments?.apiVersion).toBe("apps/v1")
  })

  test("subresources attach to their parent, without the parent prefix", async () => {
    const { resources } = await catalog()
    expect(resources.find((r) => r.name === "pods")?.subresources).toEqual([
      "log",
      "status",
    ])
    expect(
      resources.find((r) => r.name === "deployments.apps")?.subresources,
    ).toEqual(["scale"])
  })

  test("reports a kind at the preferred version and lists the rest", async () => {
    const { resources } = await catalog()
    const widgets = resources.find((r) => r.name === "widgets.example.com")
    expect(widgets?.version).toBe("v1")
    expect(widgets?.servedVersions).toEqual(["v1", "v1beta1"])
    // v1beta1 serves widgets/status and v1 does not: the row is the v1 one, so
    // it must not claim a subresource that version has no idea about.
    expect(widgets?.subresources).toEqual([])
  })

  test("still lists a kind only an older version serves", async () => {
    const { resources } = await catalog()
    const gadgets = resources.find((r) => r.name === "gadgets.example.com")
    expect(gadgets).toMatchObject({
      version: "v1beta1",
      apiVersion: "example.com/v1beta1",
      namespaced: false,
      servedVersions: ["v1beta1"],
    })
  })

  test("a groupVersion that does not answer costs only its own kinds", async () => {
    const { resources, errors } = await catalog()
    expect(errors).toEqual([
      {
        groupVersion: "metrics.k8s.io/v1beta1",
        error: "503: the server is currently unable to handle the request",
      },
    ])
    expect(resources.some((r) => r.group === "metrics.k8s.io")).toBe(false)
    expect(resources.length).toBe(6)
  })
})
