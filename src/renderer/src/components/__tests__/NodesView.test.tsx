import { describe, expect, test, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

import { useAppStore } from "../../../store/app.store"
import { installApi } from "../../test/mock-api"
import type { K8sNode } from "../../types/k8s"
import { NodesView } from "../NodesView"

const node = (name: string): K8sNode =>
  ({
    name,
    status: "Ready",
    roles: "worker",
    creationTimestamp: new Date().toISOString(),
    version: "v1.30.0",
    labels: {},
    annotations: {},
    capacity: { cpu: "4" },
    allocatable: { cpu: "4", memory: "8Gi" },
    conditions: [],
    addresses: [],
    taints: [],
    systemInfo: {},
    unschedulable: false,
  }) as unknown as K8sNode

function mockNodes(nodes: K8sNode[]): ReturnType<typeof installApi> {
  return installApi({
    k8s: {
      listNodes: vi.fn(() => Promise.resolve(nodes)),
      getNodeMetrics: vi.fn(() =>
        Promise.resolve({ unavailable: true as const }),
      ),
    },
  })
}

describe("NodesView", () => {
  test("lists nodes through the shared list view", async () => {
    // "off" keeps the list on a single read instead of a watch.
    useAppStore.setState({ refreshInterval: "off" })
    mockNodes([node("node-1"), node("node-2")])
    render(<NodesView />)

    expect(await screen.findByRole("cell", { name: "node-1" })).toBeTruthy()
    expect(screen.getByRole("cell", { name: "node-2" })).toBeTruthy()
    expect(screen.queryByText("Cordon")).toBeNull()
  })

  test("a cross-reference to a node opens its panel", async () => {
    // What a click on a pod's node link leaves behind for this view.
    useAppStore.setState({
      refreshInterval: "off",
      selectedResourceType: "Nodes",
      pendingSelection: { type: "Nodes", name: "node-2", namespace: "" },
    })
    mockNodes([node("node-1"), node("node-2")])
    render(<NodesView />)

    expect(await screen.findByText("Cordon")).toBeTruthy()
    await waitFor(() =>
      expect(
        (useAppStore.getState().selectedItem as K8sNode | null)?.name,
      ).toBe("node-2"),
    )
    expect(useAppStore.getState().pendingSelection).toBeNull()
  })

  test("a selection from another view does not open a node panel", async () => {
    useAppStore.setState({
      refreshInterval: "off",
      selectedItem: { name: "web-1", namespace: "default", ownerKind: "" },
    })
    mockNodes([node("node-1")])
    render(<NodesView />)

    await screen.findByRole("cell", { name: "node-1" })
    expect(screen.queryByText("Cordon")).toBeNull()
  })
})
