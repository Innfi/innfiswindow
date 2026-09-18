import { describe, expect, test } from "vitest"

import { isEditConflictMessage } from "../../shared/edit-conflict"
import {
  previewReplace,
  putReplace,
  ReplaceClient,
  ReplaceDryRunClient,
} from "../handlers/apply"

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
  replaceError?: unknown
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
      return options.replaceError
        ? Promise.reject(options.replaceError)
        : Promise.resolve(options.rendered ?? args[0])
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

// The editor sends the resourceVersion it loaded with both the review and the
// save, so the API server refuses either once someone else has written the
// object — the stale-write case a plain PUT would silently overwrite.
const conflict = (): Error =>
  Object.assign(new Error("the object has been modified"), { statusCode: 409 })

describe("previewReplace with a resourceVersion", () => {
  test("dry-runs the replace at that version", async () => {
    const { calls, client } = stub({})
    await previewReplace(client, EDITED, "41")

    const replace = calls.find((c) => c.method === "replace")
    expect(replace?.args[0]).toEqual({
      ...EDITED,
      metadata: { ...EDITED.metadata, resourceVersion: "41" },
    })
    expect(replace?.args[2]).toBe("All")
    // The caller's manifest is not mutated into carrying it.
    expect(EDITED.metadata).not.toHaveProperty("resourceVersion")
  })

  test("reports a 409 as an edit conflict", async () => {
    const { client } = stub({ replaceError: conflict() })
    const err = await previewReplace(client, EDITED, "41").catch((e) => e)
    expect(isEditConflictMessage((err as Error).message)).toBe(true)
    expect((err as Error).message).toContain("ConfigMap/app")
  })

  test("passes a 409 through untouched when no version was sent", async () => {
    const original = conflict()
    const { client } = stub({ replaceError: original })
    await expect(previewReplace(client, EDITED)).rejects.toBe(original)
  })
})

describe("putReplace", () => {
  function replaceStub(replaceError?: unknown): {
    calls: unknown[][]
    client: ReplaceClient
  } {
    const calls: unknown[][] = []
    const client = {
      replace: (...args: unknown[]) => {
        calls.push(args)
        return replaceError
          ? Promise.reject(replaceError)
          : Promise.resolve(args[0])
      },
    } as unknown as ReplaceClient
    return { calls, client }
  }

  test("sends the manifest as-is without a version", async () => {
    const { calls, client } = replaceStub()
    const result = await putReplace(client, EDITED)
    expect(calls[0][0]).toEqual(EDITED)
    expect(result).toEqual({ name: "app", namespace: "web" })
  })

  test("makes the write conditional on the version it is given", async () => {
    const { calls, client } = replaceStub()
    await putReplace(client, EDITED, "41")
    expect(
      (calls[0][0] as { metadata: Record<string, unknown> }).metadata,
    ).toMatchObject({ resourceVersion: "41" })
  })

  test("a version the manifest already carries is overridden", async () => {
    const { calls, client } = replaceStub()
    const stale = {
      ...EDITED,
      metadata: { ...EDITED.metadata, resourceVersion: "7" },
    }
    await putReplace(client, stale, "41")
    expect(
      (calls[0][0] as { metadata: Record<string, unknown> }).metadata
        .resourceVersion,
    ).toBe("41")
  })

  test("reports a 409 as an edit conflict", async () => {
    const { client } = replaceStub(conflict())
    const err = await putReplace(client, EDITED, "41").catch((e) => e)
    expect(isEditConflictMessage((err as Error).message)).toBe(true)
  })

  test("passes any other failure through", async () => {
    const invalid = Object.assign(new Error("invalid"), { statusCode: 422 })
    const { client } = replaceStub(invalid)
    await expect(putReplace(client, EDITED, "41")).rejects.toBe(invalid)
  })
})
