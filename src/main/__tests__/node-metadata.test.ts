import { describe, expect, test } from "vitest"
import { CoreV1Api } from "@kubernetes/client-node"

import { updateNodeLabels, updateNodeTaints } from "../handlers/cluster"

// Both handlers are one patch wrapped in the validation that decides what the
// patch body says, so they run against a stub client: what matters is the body
// and the Content-Type, neither of which a kind cluster would show any better.
type Call = { args: unknown[] }

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

function nodeStub(): { calls: Call[]; api: CoreV1Api } {
  const calls: Call[] = []
  const api = {
    patchNode: (...args: unknown[]) => {
      calls.push({ args })
      return Promise.resolve({})
    },
  } as unknown as CoreV1Api
  return { calls, api }
}

describe("updateNodeLabels", () => {
  test("sets and removes in one merge patch, removals as null", async () => {
    const { calls, api } = nodeStub()
    const res = await updateNodeLabels(api, "worker-1", {
      set: { "topology.kubernetes.io/zone": "eu-west-1a", tier: "gpu" },
      remove: ["retired"],
    })
    expect(res).toEqual({ success: true, name: "worker-1" })
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0]).toEqual({
      name: "worker-1",
      body: {
        metadata: {
          labels: {
            "topology.kubernetes.io/zone": "eu-west-1a",
            tier: "gpu",
            retired: null,
          },
        },
      },
    })
    // A strategic merge patch would not delete the key.
    expect(contentType(calls[0])).toBe("application/merge-patch+json")
  })

  test("accepts an empty value", async () => {
    const { calls, api } = nodeStub()
    await updateNodeLabels(api, "worker-1", { set: { tier: "" }, remove: [] })
    expect(calls[0].args[0]).toMatchObject({
      body: { metadata: { labels: { tier: "" } } },
    })
  })

  test("rejects a malformed key before patching", async () => {
    const { calls, api } = nodeStub()
    await expect(
      updateNodeLabels(api, "worker-1", {
        set: { "bad key": "x" },
        remove: [],
      }),
    ).rejects.toThrow(/Label "bad key"/)
    expect(calls).toHaveLength(0)
  })

  test("rejects a value that is not a label value", async () => {
    const { api } = nodeStub()
    await expect(
      updateNodeLabels(api, "worker-1", { set: { tier: "a b" }, remove: [] }),
    ).rejects.toThrow(/alphanumeric/)
  })

  test("rejects a key that is both set and removed", async () => {
    const { api } = nodeStub()
    await expect(
      updateNodeLabels(api, "worker-1", {
        set: { tier: "gpu" },
        remove: ["tier"],
      }),
    ).rejects.toThrow(/both set and removed/)
  })

  test("rejects an empty update rather than sending a no-op patch", async () => {
    const { calls, api } = nodeStub()
    await expect(
      updateNodeLabels(api, "worker-1", { set: {}, remove: [] }),
    ).rejects.toThrow(/No label changes/)
    expect(calls).toHaveLength(0)
  })
})

describe("updateNodeTaints", () => {
  test("replaces spec.taints with the list given", async () => {
    const { calls, api } = nodeStub()
    const res = await updateNodeTaints(api, "worker-1", [
      { key: "dedicated", value: "gpu", effect: "NoSchedule" },
      { key: "maintenance", value: "", effect: "NoExecute" },
    ])
    expect(res).toEqual({ success: true, name: "worker-1" })
    expect(calls[0].args[0]).toEqual({
      name: "worker-1",
      body: {
        spec: {
          taints: [
            { key: "dedicated", effect: "NoSchedule", value: "gpu" },
            // An empty value is dropped, not sent as "".
            { key: "maintenance", effect: "NoExecute" },
          ],
        },
      },
    })
    expect(contentType(calls[0])).toBe("application/merge-patch+json")
  })

  test("an empty list clears every taint", async () => {
    const { calls, api } = nodeStub()
    await updateNodeTaints(api, "worker-1", [])
    expect(calls[0].args[0]).toEqual({
      name: "worker-1",
      body: { spec: { taints: [] } },
    })
  })

  test("rejects an unknown effect", async () => {
    const { calls, api } = nodeStub()
    await expect(
      updateNodeTaints(api, "worker-1", [
        { key: "dedicated", value: "gpu", effect: "NoScheduling" },
      ]),
    ).rejects.toThrow(/Effect must be one of/)
    expect(calls).toHaveLength(0)
  })

  test("rejects two taints sharing a key and an effect", async () => {
    const { api } = nodeStub()
    await expect(
      updateNodeTaints(api, "worker-1", [
        { key: "dedicated", value: "gpu", effect: "NoSchedule" },
        { key: "dedicated", value: "cpu", effect: "NoSchedule" },
      ]),
    ).rejects.toThrow(/appears twice/)
  })

  test("allows the same key under two effects", async () => {
    const { calls, api } = nodeStub()
    await updateNodeTaints(api, "worker-1", [
      { key: "dedicated", value: "gpu", effect: "NoSchedule" },
      { key: "dedicated", value: "gpu", effect: "NoExecute" },
    ])
    expect(calls).toHaveLength(1)
  })

  test("rejects a taint with no key", async () => {
    const { api } = nodeStub()
    await expect(
      updateNodeTaints(api, "worker-1", [
        { key: "", value: "gpu", effect: "NoSchedule" },
      ]),
    ).rejects.toThrow(/Key is required/)
  })
})
