import { describe, expect, test } from "vitest"

import { normalizeDeleteOptions } from "../handlers/apply"

// The delete dialog can send a half-typed grace period ("-", "1.5") straight
// from its number input, and the API server answers those with a 422 rather
// than ignoring them. Checked here because a kind cluster test would only see
// the delete succeed either way.
describe("normalizeDeleteOptions", () => {
  test("sends nothing when no options are given", () => {
    expect(normalizeDeleteOptions(undefined)).toEqual({})
  })

  test("passes a valid policy and grace period through", () => {
    expect(
      normalizeDeleteOptions({
        propagationPolicy: "Foreground",
        gracePeriodSeconds: 30,
      }),
    ).toEqual({ propagationPolicy: "Foreground", gracePeriodSeconds: 30 })
  })

  test("keeps gracePeriodSeconds: 0, which is a force delete not an unset", () => {
    expect(normalizeDeleteOptions({ gracePeriodSeconds: 0 })).toEqual({
      gracePeriodSeconds: 0,
    })
  })

  test("drops a negative or fractional grace period", () => {
    expect(normalizeDeleteOptions({ gracePeriodSeconds: -1 })).toEqual({})
    expect(normalizeDeleteOptions({ gracePeriodSeconds: 1.5 })).toEqual({})
    expect(normalizeDeleteOptions({ gracePeriodSeconds: NaN })).toEqual({})
  })

  test("drops a policy the API server does not know", () => {
    expect(
      normalizeDeleteOptions({
        propagationPolicy: "background" as never,
        gracePeriodSeconds: 5,
      }),
    ).toEqual({ gracePeriodSeconds: 5 })
  })
})
