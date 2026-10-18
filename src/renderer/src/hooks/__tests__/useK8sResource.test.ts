import { beforeEach, describe, expect, test, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"

import type {
  WatchClosedMessage,
  WatchEventMessage,
  WatchSnapshot,
} from "../../../../shared/watch"
import {
  WATCH_HEALTHY_MS,
  WATCH_RETRY_BASE_MS,
  WATCH_RETRY_MAX_MS,
} from "../../../../shared/watch"
import { installApi, ipcError } from "../../test/mock-api"
import { useK8sResource } from "../useK8sResource"

interface Row {
  name: string
  namespace: string
  v: number
}

const row = (name: string, v = 1): Row => ({ name, namespace: "default", v })

/** Lets the promise callbacks queued by a resolved IPC call run. */
const flush = (): Promise<void> => advance(0)

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** A fake main process for the watch channel: hands out snapshots, records
 *  subscriptions, and lets a test push events or close the stream. */
function fakeWatch() {
  let eventListener: ((m: WatchEventMessage) => void) | null = null
  let closedListener: ((m: WatchClosedMessage) => void) | null = null
  let nextSub = 0
  const outcomes: (Row[] | Error)[] = []

  const startWatch = vi.fn((): Promise<WatchSnapshot<unknown>> => {
    const outcome = outcomes.shift() ?? []
    if (outcome instanceof Error) return Promise.reject(outcome)
    return Promise.resolve({ subId: `sub-${++nextSub}`, items: outcome })
  })
  const api = installApi({
    startWatch,
    stopWatch: vi.fn(() => Promise.resolve({ success: true })),
    onWatchEvent: (cb) => {
      eventListener = cb
      return () => {
        if (eventListener === cb) eventListener = null
      }
    },
    onWatchClosed: (cb) => {
      closedListener = cb
      return () => {
        if (closedListener === cb) closedListener = null
      }
    },
  })

  return {
    api,
    startWatch,
    /** What the next `startWatch` answers: a snapshot, or a rejection. */
    next: (...o: (Row[] | Error)[]) => outcomes.push(...o),
    subId: () => `sub-${nextSub}`,
    emit: (message: WatchEventMessage) => act(() => eventListener?.(message)),
    close: (error = "stream closed") =>
      act(() => closedListener?.({ subId: `sub-${nextSub}`, error })),
  }
}

describe("useK8sResource", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  test("without a watch, lists on mount and again every refresh interval", async () => {
    installApi()
    const fetcher = vi.fn(() => Promise.resolve([row("a")]))
    const { result } = renderHook(() => useK8sResource(fetcher, "ctx"))
    await flush()

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith("ctx", undefined, undefined, undefined)
    expect(result.current.data).toEqual([row("a")])
    expect(result.current.loading).toBe(false)

    await advance(30_000)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test("a watch serves the snapshot and applies events in place", async () => {
    const w = fakeWatch()
    w.next([row("a"), row("b")])
    const fetcher = vi.fn(() => Promise.resolve([] as Row[]))
    const { result } = renderHook(() =>
      useK8sResource(fetcher, "ctx", { watch: "pods" }),
    )
    await flush()

    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.data.map((r) => r.name)).toEqual(["a", "b"])

    await w.emit({ subId: w.subId(), type: "update", item: row("a", 2) })
    expect(result.current.data).toEqual([row("a", 2), row("b")])

    await w.emit({ subId: w.subId(), type: "delete", item: row("b") })
    await w.emit({ subId: w.subId(), type: "add", item: row("c") })
    expect(result.current.data.map((r) => r.name)).toEqual(["a", "c"])

    // Watching replaces the poll.
    await advance(60_000)
    expect(fetcher).not.toHaveBeenCalled()
  })

  test("an unreachable watch polls, then is tried again after the backoff", async () => {
    const w = fakeWatch()
    w.next(ipcError("k8s:watch:start", "connect ECONNREFUSED"), [row("w")])
    const fetcher = vi.fn(() => Promise.resolve([row("polled")]))
    const { result } = renderHook(() =>
      useK8sResource(fetcher, "ctx", { watch: "pods" }),
    )
    await flush()

    expect(w.startWatch).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual([row("polled")])

    await advance(WATCH_RETRY_BASE_MS)
    expect(w.startWatch).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual([row("w")])
  })

  test("the backoff doubles while the watch keeps failing", async () => {
    const w = fakeWatch()
    const down = (): Error => ipcError("k8s:watch:start", "socket hang up")
    w.next(down(), down(), [row("w")])
    renderHook(() =>
      useK8sResource(() => Promise.resolve([] as Row[]), "ctx", {
        watch: "pods",
      }),
    )
    await flush()

    await advance(WATCH_RETRY_BASE_MS)
    expect(w.startWatch).toHaveBeenCalledTimes(2)

    // Second failure: the next try is twice as far off.
    await advance(WATCH_RETRY_BASE_MS)
    expect(w.startWatch).toHaveBeenCalledTimes(2)
    await advance(WATCH_RETRY_BASE_MS)
    expect(w.startWatch).toHaveBeenCalledTimes(3)
  })

  test("a watch the cluster forbids is not retried", async () => {
    const w = fakeWatch()
    w.next(
      ipcError(
        "k8s:watch:start",
        'HTTP-Code: 403 Message: pods is forbidden: User "dev" cannot watch',
      ),
    )
    const fetcher = vi.fn(() => Promise.resolve([row("polled")]))
    renderHook(() => useK8sResource(fetcher, "ctx", { watch: "pods" }))
    await flush()

    await advance(WATCH_RETRY_MAX_MS * 2)
    expect(w.startWatch).toHaveBeenCalledTimes(1)
    // Still polling all along.
    expect(fetcher.mock.calls.length).toBeGreaterThan(1)
  })

  test("a dropped watch keeps its rows, polls, and comes back", async () => {
    const w = fakeWatch()
    w.next([row("a")], [row("a"), row("b")])
    const fetcher = vi.fn(() => Promise.resolve([row("a")]))
    const { result } = renderHook(() =>
      useK8sResource(fetcher, "ctx", { watch: "pods" }),
    )
    await flush()

    await w.close()
    await flush()
    // Falling back never blanks the table.
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual([row("a")])
    expect(fetcher).toHaveBeenCalledTimes(1)

    await advance(WATCH_RETRY_BASE_MS)
    expect(w.startWatch).toHaveBeenCalledTimes(2)
    expect(result.current.loading).toBe(false)
    expect(result.current.data.map((r) => r.name)).toEqual(["a", "b"])
  })

  test("a drop after a healthy stretch starts the backoff over", async () => {
    const w = fakeWatch()
    const down = (): Error => ipcError("k8s:watch:start", "socket hang up")
    w.next(down(), [row("a")], [row("a")])
    renderHook(() =>
      useK8sResource(() => Promise.resolve([] as Row[]), "ctx", {
        watch: "pods",
      }),
    )
    await flush()
    await advance(WATCH_RETRY_BASE_MS)
    expect(w.startWatch).toHaveBeenCalledTimes(2)

    // Up long enough to count as healthy, then dropped: back to the base
    // delay rather than the doubled one the earlier failure set up.
    await advance(WATCH_HEALTHY_MS)
    await w.close()
    await advance(WATCH_RETRY_BASE_MS)
    expect(w.startWatch).toHaveBeenCalledTimes(3)
  })

  test("a new context gets a fresh watch attempt", async () => {
    const w = fakeWatch()
    w.next(ipcError("k8s:watch:start", "pods is forbidden"), [row("other")])
    const fetcher = vi.fn(() => Promise.resolve([] as Row[]))
    const { result, rerender } = renderHook(
      ({ ctx }) => useK8sResource(fetcher, ctx, { watch: "pods" }),
      { initialProps: { ctx: "a" } },
    )
    await flush()
    expect(w.startWatch).toHaveBeenCalledTimes(1)

    rerender({ ctx: "b" })
    await flush()
    expect(w.startWatch).toHaveBeenCalledTimes(2)
    expect(w.startWatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ contextName: "b", resource: "pods" }),
    )
    expect(result.current.data).toEqual([row("other")])
  })
})
