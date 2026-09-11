import { describe, expect, test } from "vitest"

import { previewReplace, ReplaceDryRunClient } from "../handlers/apply"

// The YAML editor's review step exists to show what a Save (a PUT) would do,
// removals included, so these check the diff against stub clients: on a kind
// cluster a dry run and a real write would both just succeed.
type Call = { method: string; args: unknown[] }

const LIVE = {
  apiVersion: "v1",
  kind: "ConfigMap",
  metadata: {
    name: "app",
    namespace: "web",
    resourceVersion: "41",
    uid: "abc",
    creationTimestamp: "2026-01-01T00:00:00Z",
    managedFields: [{ manager: "kubectl" }],
  },
  data: { keep: "same", drop: "gone", tweak: "old" },
}

function stub(options: {
  rendered?: Record<string, unknown>
  readError?: unknown
}): { calls: Call[]; client: ReplaceDryRunClient } {
  const calls: Call[] = []
  const client = {
    read: (...args: unknown[]) => {
      calls.push({ method: "read", args })
      return options.readError
        ? Promise.reject(options.readError)
        : Promise.resolve(LIVE)
    },
    replace: (...args: unknown[]) => {
      calls.push({ method: "replace", args })
      return Promise.resolve(options.rendered ?? args[0])
    },
  } as unknown as ReplaceDryRunClient
  return { calls, client }
}

const EDITED = {
  apiVersion: "v1",
  kind: "ConfigMap",
  metadata: { name: "app", namespace: "web" },
  data: { keep: "same", tweak: "new" },
}

describe("previewReplace", () => {
  test("dry-runs a replace and reads the same object", async () => {
    const { calls, client } = stub({})
    await previewReplace(client, EDITED)

    const replace = calls.find((c) => c.method === "replace")
    expect(replace?.args[0]).toEqual(EDITED)
    expect(replace?.args[2]).toBe("All")
    expect(calls.find((c) => c.method === "read")?.args[0]).toEqual({
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: { name: "app", namespace: "web" },
    })
  })

  test("shows a field the manifest dropped as a removal", async () => {
    const rendered = {
      ...EDITED,
      metadata: { ...EDITED.metadata, resourceVersion: "42", uid: "abc" },
    }
    const { client } = stub({ rendered })
    const result = await previewReplace(client, EDITED)

    const lines = result.diff.split("\n")
    expect(lines).toContain("-  drop: gone")
    expect(lines).toContain("-  tweak: old")
    expect(lines).toContain("+  tweak: new")
    expect(result.action).toBe("update")
    expect(result).toMatchObject({ kind: "ConfigMap", name: "app" })
  })

  test("ignores server-managed metadata on either side", async () => {
    const rendered = {
      ...LIVE,
      metadata: {
        ...LIVE.metadata,
        resourceVersion: "42",
        managedFields: [{ manager: "innfiswindow" }],
      },
    }
    const { client } = stub({ rendered })
    const result = await previewReplace(client, EDITED)

    expect(result.diff).toBe("")
    expect(result.rendered).not.toContain("resourceVersion")
  })

  test("fails when the object is not live, rather than previewing a create", async () => {
    const notFound = Object.assign(new Error("not found"), { statusCode: 404 })
    const { client } = stub({ readError: notFound })
    await expect(previewReplace(client, EDITED)).rejects.toBe(notFound)
  })

  test("refuses a manifest without an identity", async () => {
    const { calls, client } = stub({})
    await expect(
      previewReplace(client, { apiVersion: "v1", kind: "ConfigMap" }),
    ).rejects.toThrow("metadata.name")
    expect(calls).toEqual([])
  })
})
