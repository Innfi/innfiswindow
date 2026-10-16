import { describe, expect, test } from "vitest"

import { podMetricQueries, promStringLiteral } from "../prometheus-handlers"

describe("promStringLiteral", () => {
  test("a plain name is just quoted", () => {
    expect(promStringLiteral("web-1")).toBe('"web-1"')
  })

  test("quotes, backslashes and newlines cannot end the literal early", () => {
    expect(promStringLiteral('a"} or vector(1) #')).toBe(
      '"a\\"} or vector(1) #"',
    )
    expect(promStringLiteral("a\\b")).toBe('"a\\\\b"')
    expect(promStringLiteral("a\nb")).toBe('"a\\nb"')
  })
})

describe("podMetricQueries", () => {
  test("matches namespace and pod exactly, never as a pattern", () => {
    const queries = podMetricQueries("team.a", "web-1")
    for (const query of Object.values(queries)) {
      expect(query).toContain('namespace="team.a",pod="web-1"')
      expect(query).not.toContain("=~")
    }
  })
})
