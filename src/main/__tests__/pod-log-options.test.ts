import { describe, expect, test } from "vitest"

import { createLineSplitter, toLogQueryOptions } from "../ipc/pod-streams"

// Both helpers decide what the panel actually shows, and neither is reachable
// from a kind cluster test: the query mapping is checked before it becomes a
// URL, and the splitter is checked against chunk boundaries a real stream only
// hits by luck.
describe("toLogQueryOptions", () => {
  test("follows with no limits by default", () => {
    expect(toLogQueryOptions(undefined)).toEqual({
      follow: true,
      previous: false,
      timestamps: false,
    })
  })

  test("omits tailLines and sinceSeconds when they are null", () => {
    const opts = toLogQueryOptions({ tailLines: null, sinceSeconds: null })
    expect(opts).not.toHaveProperty("tailLines")
    expect(opts).not.toHaveProperty("sinceSeconds")
  })

  test("passes limits through when set", () => {
    expect(
      toLogQueryOptions({ tailLines: 50, sinceSeconds: 300 }),
    ).toMatchObject({ tailLines: 50, sinceSeconds: 300 })
  })

  test("keeps tailLines: 0, which means no lines rather than no limit", () => {
    expect(toLogQueryOptions({ tailLines: 0 })).toMatchObject({ tailLines: 0 })
  })

  test("turns follow off for a previous-instance read", () => {
    expect(toLogQueryOptions({ previous: true, follow: true })).toMatchObject({
      previous: true,
      follow: false,
    })
  })

  test("honours an explicit follow: false", () => {
    expect(toLogQueryOptions({ follow: false })).toMatchObject({
      follow: false,
    })
  })
})

describe("createLineSplitter", () => {
  test("emits whole lines and holds the partial tail back", () => {
    const lines: string[] = []
    const splitter = createLineSplitter((l) => lines.push(l))

    splitter.push("alpha\nbra")
    expect(lines).toEqual(["alpha"])

    splitter.push("vo\ncharlie")
    expect(lines).toEqual(["alpha", "bravo"])

    splitter.flush()
    expect(lines).toEqual(["alpha", "bravo", "charlie"])
  })

  test("drops blank lines and flushes nothing when the tail is empty", () => {
    const lines: string[] = []
    const splitter = createLineSplitter((l) => lines.push(l))

    splitter.push("one\n\ntwo\n")
    splitter.flush()

    expect(lines).toEqual(["one", "two"])
  })
})
