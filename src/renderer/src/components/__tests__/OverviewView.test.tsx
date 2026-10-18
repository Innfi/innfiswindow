import { describe, expect, test, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { useAppStore } from "../../../store/app.store"
import { installApi } from "../../test/mock-api"
import type { K8sPodSummary } from "../../types/k8s"
import { OverviewView } from "../OverviewView"

const crashing = (name: string, namespace: string): K8sPodSummary => ({
  name,
  namespace,
  deployment: "",
  ownerKind: "",
  ownerName: "",
  app: "",
  status: "CrashLoopBackOff",
  restarts: 3,
  creationTimestamp: new Date(Date.now() - 3_600_000).toISOString(),
  nodeName: "node-1",
})

/** Every list the Overview reads, empty unless a test says otherwise. */
function mockCluster(
  pods: () => K8sPodSummary[],
): ReturnType<typeof installApi> {
  const empty = (): Promise<never[]> => Promise.resolve([])
  return installApi({
    k8s: {
      listPods: vi.fn(() => Promise.resolve(pods())),
      listNodes: vi.fn(empty),
      listDeployments: vi.fn(empty),
      listStatefulSets: vi.fn(empty),
      listDaemonSets: vi.fn(empty),
      listJobs: vi.fn(empty),
      listPVCs: vi.fn(empty),
    },
    listEvents: vi.fn(empty),
  })
}

const muteButton = (name: string): HTMLElement =>
  screen.getByLabelText(`Snooze or dismiss CrashLoopBackOff on ${name}`)

describe("OverviewView", () => {
  test("reads namespaced lists under the app bar scope, nodes cluster-wide", async () => {
    useAppStore.setState({ selectedContext: "kind", selectedNamespace: "shop" })
    const api = mockCluster(() => [crashing("web-1", "shop")])
    render(<OverviewView />)
    await screen.findByLabelText(/on web-1/)

    expect(api.k8s.listPods).toHaveBeenCalledWith({
      contextName: "kind",
      namespace: "shop",
    })
    expect(api.listEvents).toHaveBeenCalledWith({
      contextName: "kind",
      namespace: "shop",
    })
    expect(api.k8s.listNodes).toHaveBeenCalledWith({ contextName: "kind" })
  })

  test("shows only the scoped namespace even if a list answers wider", async () => {
    useAppStore.setState({ selectedNamespace: "shop" })
    mockCluster(() => [crashing("web-1", "shop"), crashing("pay-1", "billing")])
    render(<OverviewView />)

    await screen.findByLabelText(/on web-1/)
    // The API answered with billing too; the triage still keeps to "shop".
    expect(screen.queryByLabelText(/on pay-1/)).toBeNull()
  })

  test("a dismissed alert hides, is remembered, and is forgotten once resolved", async () => {
    useAppStore.setState({ selectedContext: "kind" })
    let broken = true
    mockCluster(() => (broken ? [crashing("web-1", "shop")] : []))
    render(<OverviewView />)

    fireEvent.click(await screen.findByLabelText(/on web-1/))
    fireEvent.click(screen.getByText("Dismiss until resolved"))

    expect(screen.queryByLabelText(/on web-1/)).toBeNull()
    expect(screen.getByText("1 hidden (snoozed or dismissed)")).toBeTruthy()
    expect(useAppStore.getState().alertMutes).toEqual({
      kind: { "pod-status/shop/web-1": { until: null, namespace: "shop" } },
    })

    // Still broken on the next read: still hidden, still remembered.
    fireEvent.click(screen.getByTitle("Refresh"))
    await waitFor(() =>
      expect(screen.getByText("1 hidden (snoozed or dismissed)")).toBeTruthy(),
    )
    expect(useAppStore.getState().alertMutes.kind).toBeDefined()

    // Fixed: the dismissal goes with it, so the next breakage is shown.
    broken = false
    fireEvent.click(screen.getByTitle("Refresh"))
    await waitFor(() => expect(useAppStore.getState().alertMutes).toEqual({}))
    expect(screen.queryByText(/hidden \(snoozed or dismissed\)/)).toBeNull()
  })

  test("a mute outside the scope survives a scoped read", async () => {
    useAppStore.setState({
      selectedContext: "kind",
      selectedNamespace: "shop",
      alertMutes: {
        kind: {
          "pod-status/billing/pay-1": { until: null, namespace: "billing" },
        },
      },
    })
    mockCluster(() => [crashing("web-1", "shop")])
    render(<OverviewView />)
    await screen.findByLabelText(/on web-1/)

    expect(useAppStore.getState().alertMutes.kind).toHaveProperty(
      "pod-status/billing/pay-1",
    )
  })

  test("restoring brings the row back", async () => {
    useAppStore.setState({
      selectedContext: "kind",
      alertMutes: {
        kind: {
          "pod-status/shop/web-1": {
            until: Date.now() + 3_600_000,
            namespace: "shop",
          },
        },
      },
    })
    mockCluster(() => [crashing("web-1", "shop")])
    render(<OverviewView />)

    fireEvent.click(await screen.findByText("1 hidden (snoozed or dismissed)"))
    fireEvent.click(screen.getByText("Restore"))
    expect(muteButton("web-1")).toBeTruthy()
    expect(useAppStore.getState().alertMutes).toEqual({})
  })
})
