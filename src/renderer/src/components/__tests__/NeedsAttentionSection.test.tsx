import { describe, expect, test, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import type { ClusterAlert } from "../../../../shared/triage"
import { NeedsAttentionSection } from "../NeedsAttentionSection"

const alert = (over: Partial<ClusterAlert> = {}): ClusterAlert => ({
  id: "pod-status/shop/web-1",
  severity: "critical",
  title: "CrashLoopBackOff",
  kind: "Pod",
  name: "web-1",
  namespace: "shop",
  detail: "3 restarts. Check the container's logs.",
  since: new Date().toISOString(),
  ...over,
})

function renderSection(
  props: Partial<Parameters<typeof NeedsAttentionSection>[0]> = {},
): {
  onMute: ReturnType<typeof vi.fn>
  onRestore: ReturnType<typeof vi.fn>
} {
  const onMute = vi.fn()
  const onRestore = vi.fn()
  render(
    <NeedsAttentionSection
      alerts={[]}
      muted={[]}
      mutes={{}}
      namespace={null}
      onMute={onMute}
      onRestore={onRestore}
      {...props}
    />,
  )
  return { onMute, onRestore }
}

describe("NeedsAttentionSection", () => {
  test("a quiet cluster says so", () => {
    renderSection()
    expect(screen.getByText(/Nothing needs attention/)).toBeTruthy()
  })

  test("a scoped quiet cluster names the namespace", () => {
    renderSection({ namespace: "shop" })
    expect(screen.getByText(/Nothing needs attention in shop/)).toBeTruthy()
  })

  test("lists each alert with its counts", () => {
    renderSection({
      alerts: [
        alert(),
        alert({ id: "x", severity: "warning", title: "Cordoned" }),
      ],
    })
    expect(screen.getByText("CrashLoopBackOff")).toBeTruthy()
    expect(screen.getByText("Cordoned")).toBeTruthy()
    expect(screen.getByText(/1 critical/)).toBeTruthy()
    expect(screen.getByText(/1 warning/)).toBeTruthy()
  })

  test("snoozing asks for a deadline an hour out", () => {
    const a = alert()
    const { onMute } = renderSection({ alerts: [a] })
    const before = Date.now()
    fireEvent.click(
      screen.getByLabelText("Snooze or dismiss CrashLoopBackOff on web-1"),
    )
    fireEvent.click(screen.getByText("Snooze 1 hour"))

    expect(onMute).toHaveBeenCalledTimes(1)
    const [muted, until] = onMute.mock.calls[0]
    expect(muted).toBe(a)
    expect(until).toBeGreaterThanOrEqual(before + 60 * 60 * 1000)
    expect(until).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000)
  })

  test("dismissing has no deadline", () => {
    const { onMute } = renderSection({ alerts: [alert()] })
    fireEvent.click(screen.getByTitle("Snooze or dismiss"))
    fireEvent.click(screen.getByText("Dismiss until resolved"))
    expect(onMute).toHaveBeenCalledWith(expect.anything(), null)
  })

  test("muted alerts are counted, listed on request, and restorable", () => {
    const a = alert()
    const { onRestore } = renderSection({
      muted: [a],
      mutes: { [a.id]: { until: null, namespace: "shop" } },
    })
    expect(
      screen.getByText(/everything raised is snoozed or dismissed/),
    ).toBeTruthy()
    expect(screen.queryByText("until resolved")).toBeNull()

    fireEvent.click(screen.getByText("1 hidden (snoozed or dismissed)"))
    expect(screen.getByText("until resolved")).toBeTruthy()

    fireEvent.click(screen.getByText("Restore"))
    expect(onRestore).toHaveBeenCalledWith([a])
    fireEvent.click(screen.getByText("Restore all"))
    expect(onRestore).toHaveBeenLastCalledWith([a])
  })
})
