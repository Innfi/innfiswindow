import { describe, expect, test } from "vitest"
import { AppsV1Api, BatchV1Api } from "@kubernetes/client-node"

import { setCronJobSuspend, setJobSuspend } from "../handlers/batch"
import {
  scaleDeployment,
  scaleReplicaSet,
  scaleStatefulSet,
  setDeploymentPaused,
} from "../handlers/workload"

// The patch bodies and their content type are what these handlers exist for,
// so they are checked against a stub client rather than a kind cluster: what
// matters is that a merge-patch body never goes out labelled as a JSON Patch.
type Call = { method: string; args: unknown[] }

function stubApi(): { calls: Call[]; api: AppsV1Api & BatchV1Api } {
  const calls: Call[] = []
  const api = new Proxy(
    {},
    {
      get:
        (_t, method: string) =>
        (...args: unknown[]) => {
          calls.push({ method, args })
          return Promise.resolve({})
        },
    },
  ) as AppsV1Api & BatchV1Api
  return { calls, api }
}

/** Replays the options' middleware against a stub request to recover the
 *  Content-Type header it sets — the whole point of passing them. */
function contentType(call: Call): string | undefined {
  const opts = call.args[1] as {
    middleware?: { pre: (req: unknown) => unknown }[]
  }
  const headers: Record<string, string> = {}
  const request = {
    setHeaderParam: (k: string, v: string) => {
      headers[k] = v
    },
  }
  for (const mw of opts?.middleware ?? []) mw.pre(request)
  return headers["Content-Type"]
}

describe("scale handlers", () => {
  const cases = [
    ["deployment", scaleDeployment, "patchNamespacedDeploymentScale"],
    ["statefulset", scaleStatefulSet, "patchNamespacedStatefulSetScale"],
    ["replicaset", scaleReplicaSet, "patchNamespacedReplicaSetScale"],
  ] as const

  for (const [label, fn, method] of cases) {
    test(`${label} patches the scale subresource`, async () => {
      const { calls, api } = stubApi()
      const res = await fn(api, "ns", "web", 3)
      expect(res).toEqual({ success: true, name: "web", namespace: "ns" })
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe(method)
      expect(calls[0].args[0]).toEqual({
        name: "web",
        namespace: "ns",
        body: { spec: { replicas: 3 } },
      })
      expect(contentType(calls[0])).toContain("strategic-merge-patch")
    })
  }

  test("scaling to zero is allowed", async () => {
    const { calls, api } = stubApi()
    await scaleDeployment(api, "ns", "web", 0)
    expect(calls[0].args[0]).toMatchObject({ body: { spec: { replicas: 0 } } })
  })

  test("rejects negative and fractional replica counts before calling the API", async () => {
    const { calls, api } = stubApi()
    await expect(scaleDeployment(api, "ns", "web", -1)).rejects.toThrow(
      /non-negative integer/,
    )
    await expect(scaleStatefulSet(api, "ns", "web", 1.5)).rejects.toThrow(
      /non-negative integer/,
    )
    expect(calls).toHaveLength(0)
  })
})

describe("suspend handlers", () => {
  test("job suspend patches spec.suspend", async () => {
    const { calls, api } = stubApi()
    const res = await setJobSuspend(api, "ns", "batch-1", true)
    expect(res).toEqual({ success: true, name: "batch-1", namespace: "ns" })
    expect(calls[0].method).toBe("patchNamespacedJob")
    expect(calls[0].args[0]).toEqual({
      name: "batch-1",
      namespace: "ns",
      body: { spec: { suspend: true } },
    })
    expect(contentType(calls[0])).toContain("strategic-merge-patch")
  })

  test("cronjob resume patches spec.suspend false", async () => {
    const { calls, api } = stubApi()
    await setCronJobSuspend(api, "ns", "nightly", false)
    expect(calls[0].method).toBe("patchNamespacedCronJob")
    expect(calls[0].args[0]).toEqual({
      name: "nightly",
      namespace: "ns",
      body: { spec: { suspend: false } },
    })
  })
})

describe("rollout pause handler", () => {
  test("pause patches spec.paused", async () => {
    const { calls, api } = stubApi()
    const res = await setDeploymentPaused(api, "ns", "web", true)
    expect(res).toEqual({ success: true, name: "web", namespace: "ns" })
    expect(calls[0].method).toBe("patchNamespacedDeployment")
    expect(calls[0].args[0]).toEqual({
      name: "web",
      namespace: "ns",
      body: { spec: { paused: true } },
    })
    expect(contentType(calls[0])).toContain("strategic-merge-patch")
  })

  test("resume patches spec.paused false", async () => {
    const { calls, api } = stubApi()
    await setDeploymentPaused(api, "ns", "web", false)
    expect(calls[0].args[0]).toEqual({
      name: "web",
      namespace: "ns",
      body: { spec: { paused: false } },
    })
  })
})
