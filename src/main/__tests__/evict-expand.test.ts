import { describe, expect, test } from "vitest"
import { CoreV1Api, StorageV1Api } from "@kubernetes/client-node"

import { expandPVC } from "../handlers/storage"
import { evictPod } from "../handlers/workload"

// Both handlers exist for the checks they make before (and the message they
// make of a rejection after) a single API call, so they run against stub
// clients: a kind cluster would need a CSI driver that actually resizes to
// tell any of these cases apart.
type Call = { method: string; args: unknown[] }

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

function evictionStub(reject?: unknown): { calls: Call[]; api: CoreV1Api } {
  const calls: Call[] = []
  const api = {
    createNamespacedPodEviction: (...args: unknown[]) => {
      calls.push({ method: "createNamespacedPodEviction", args })
      return reject ? Promise.reject(reject) : Promise.resolve({})
    },
  } as unknown as CoreV1Api
  return { calls, api }
}

function pvcStub(options: { requested?: string; storageClass?: string }): {
  calls: Call[]
  core: CoreV1Api
} {
  const calls: Call[] = []
  const core = {
    readNamespacedPersistentVolumeClaim: () =>
      Promise.resolve({
        spec: {
          storageClassName: options.storageClass ?? "",
          resources: { requests: { storage: options.requested ?? "10Gi" } },
        },
      }),
    patchNamespacedPersistentVolumeClaim: (...args: unknown[]) => {
      calls.push({ method: "patchNamespacedPersistentVolumeClaim", args })
      return Promise.resolve({})
    },
  } as unknown as CoreV1Api
  return { calls, core }
}

function storageStub(classes: Record<string, boolean>): StorageV1Api {
  return {
    listStorageClass: () =>
      Promise.resolve({
        items: Object.entries(classes).map(([name, allow]) => ({
          metadata: { name },
          allowVolumeExpansion: allow,
        })),
      }),
  } as unknown as StorageV1Api
}

describe("evictPod", () => {
  test("posts a policy/v1 Eviction for the pod", async () => {
    const { calls, api } = evictionStub()
    const res = await evictPod(api, "ns", "web-0")
    expect(res).toEqual({ success: true, name: "web-0", namespace: "ns" })
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0]).toEqual({
      name: "web-0",
      namespace: "ns",
      body: {
        apiVersion: "policy/v1",
        kind: "Eviction",
        metadata: { name: "web-0", namespace: "ns" },
      },
    })
  })

  test("passes a grace period and a dry run as delete options", async () => {
    const { calls, api } = evictionStub()
    await evictPod(api, "ns", "web-0", { gracePeriodSeconds: 0, dryRun: true })
    const body = (calls[0].args[0] as { body: { deleteOptions?: unknown } })
      .body
    expect(body.deleteOptions).toEqual({
      gracePeriodSeconds: 0,
      dryRun: ["All"],
    })
  })

  test("explains a 429 as the PodDisruptionBudget it is", async () => {
    const { api } = evictionStub({
      code: 429,
      body: JSON.stringify({
        message: "Cannot evict pod as it would violate the budget.",
      }),
      message: "Too Many Requests",
    })
    await expect(evictPod(api, "ns", "web-0")).rejects.toThrow(
      /PodDisruptionBudget would be violated .*violate the budget/,
    )
  })

  test("passes any other rejection through with its status message", async () => {
    const { api } = evictionStub({
      code: 404,
      body: { message: 'pods "web-0" not found' },
    })
    await expect(evictPod(api, "ns", "web-0")).rejects.toThrow(
      'pods "web-0" not found',
    )
  })
})

describe("expandPVC", () => {
  test("patches the storage request as a merge patch", async () => {
    const { calls, core } = pvcStub({ requested: "10Gi", storageClass: "gp3" })
    const res = await expandPVC(
      core,
      storageStub({ gp3: true }),
      "ns",
      "data",
      "20Gi",
    )
    expect(res).toEqual({ success: true, name: "data", namespace: "ns" })
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0]).toEqual({
      name: "data",
      namespace: "ns",
      body: { spec: { resources: { requests: { storage: "20Gi" } } } },
    })
    expect(contentType(calls[0])).toBe("application/strategic-merge-patch+json")
  })

  test("refuses a size that is not a quantity", async () => {
    const { calls, core } = pvcStub({})
    await expect(
      expandPVC(core, storageStub({}), "ns", "data", "20 gigs"),
    ).rejects.toThrow(/not a valid storage quantity/)
    expect(calls).toHaveLength(0)
  })

  test("refuses a shrink, comparing sizes as bytes not strings", async () => {
    const { calls, core } = pvcStub({ requested: "10Gi", storageClass: "gp3" })
    await expect(
      expandPVC(core, storageStub({ gp3: true }), "ns", "data", "9Gi"),
    ).rejects.toThrow(/Cannot shrink/)
    expect(calls).toHaveLength(0)
  })

  test("refuses a StorageClass that does not allow expansion", async () => {
    const { calls, core } = pvcStub({ requested: "10Gi", storageClass: "gp2" })
    await expect(
      expandPVC(core, storageStub({ gp2: false }), "ns", "data", "20Gi"),
    ).rejects.toThrow(/does not allow volume expansion/)
    expect(calls).toHaveLength(0)
  })

  test("still patches when the StorageClass cannot be read", async () => {
    const { calls, core } = pvcStub({ requested: "10Gi", storageClass: "gp3" })
    const unreadable = {
      listStorageClass: () => Promise.reject(new Error("forbidden")),
    } as unknown as StorageV1Api
    await expandPVC(core, unreadable, "ns", "data", "20Gi")
    expect(calls).toHaveLength(1)
  })
})
