import { describe, expect, test } from "vitest"

import {
  isPermanentWatchError,
  WATCH_RETRY_BASE_MS,
  WATCH_RETRY_MAX_MS,
  watchRetryDelay,
} from "../../shared/watch"

describe("watchRetryDelay", () => {
  test("doubles from the base", () => {
    expect(watchRetryDelay(0)).toBe(WATCH_RETRY_BASE_MS)
    expect(watchRetryDelay(1)).toBe(2 * WATCH_RETRY_BASE_MS)
    expect(watchRetryDelay(2)).toBe(4 * WATCH_RETRY_BASE_MS)
  })

  test("is capped", () => {
    expect(watchRetryDelay(50)).toBe(WATCH_RETRY_MAX_MS)
  })
})

describe("isPermanentWatchError", () => {
  test("a 403 is the cluster saying no", () => {
    expect(
      isPermanentWatchError(
        'HTTP-Code: 403 Message: pods is forbidden: User "dev" cannot watch resource "pods"',
      ),
    ).toBe(true)
  })

  test("a network failure is worth retrying", () => {
    expect(isPermanentWatchError("connect ECONNREFUSED 127.0.0.1:6443")).toBe(
      false,
    )
    expect(isPermanentWatchError("socket hang up")).toBe(false)
  })
})
