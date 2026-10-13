import { describe, expect, test } from "vitest"

import type { AlertMutes, TriageInput } from "../../shared/triage"
import {
  alertsInScope,
  partitionAlerts,
  pruneMutes,
  triageCluster,
} from "../../shared/triage"

// The Overview's "Needs attention" list is only worth having if it is quiet on
// a healthy cluster: every row that is not actionable trains the reader to
// ignore the ones that are. These pin the line between the two.
const NOW = Date.parse("2026-09-25T12:00:00Z")
const minutesAgo = (n: number): string =>
  new Date(NOW - n * 60_000).toISOString()

const EMPTY: TriageInput = {
  pods: [],
  nodes: [],
  deployments: [],
  statefulSets: [],
  daemonSets: [],
  jobs: [],
  pvcs: [],
  events: [],
}

const pod = (over: Partial<TriageInput["pods"][number]>) =>
  ({
    name: "web-1",
    namespace: "default",
    deployment: "",
    ownerKind: "ReplicaSet",
    ownerName: "web-abc",
    app: "web",
    status: "Running",
    restarts: 0,
    creationTimestamp: minutesAgo(60),
    nodeName: "node-1",
    ...over,
  }) as TriageInput["pods"][number]

const node = (over: Partial<TriageInput["nodes"][number]>) =>
  ({
    name: "node-1",
    status: "Ready",
    roles: "worker",
    creationTimestamp: minutesAgo(10_000),
    version: "v1.30.0",
    labels: {},
    annotations: {},
    capacity: {},
    allocatable: {},
    conditions: [{ type: "Ready", status: "True", reason: "", message: "" }],
    addresses: [],
    taints: [],
    systemInfo: {},
    unschedulable: false,
    ...over,
  }) as unknown as TriageInput["nodes"][number]

const event = (over: Partial<TriageInput["events"][number]>) =>
  ({
    name: "ev-1",
    namespace: "default",
    type: "Warning",
    reason: "FailedScheduling",
    involvedObjectKind: "Pod",
    involvedObjectName: "web-1",
    message: "0/3 nodes are available: insufficient cpu.",
    count: 1,
    firstTimestamp: minutesAgo(5),
    lastTimestamp: minutesAgo(5),
    creationTimestamp: minutesAgo(5),
    ...over,
  }) as TriageInput["events"][number]

describe("triageCluster", () => {
  test("a healthy cluster raises nothing", () => {
    const alerts = triageCluster(
      {
        ...EMPTY,
        pods: [pod({}), pod({ name: "web-2", status: "Succeeded" })],
        nodes: [node({})],
        deployments: [
          {
            name: "web",
            namespace: "default",
            replicas: 3,
            readyReplicas: 3,
            updatedReplicas: 3,
            availableReplicas: 3,
            paused: false,
            creationTimestamp: minutesAgo(500),
          },
        ],
      },
      NOW,
    )
    expect(alerts).toEqual([])
  })

  test("a broken pod status is critical and names the status", () => {
    const [alert] = triageCluster(
      { ...EMPTY, pods: [pod({ status: "CrashLoopBackOff", restarts: 7 })] },
      NOW,
    )
    expect(alert).toMatchObject({
      severity: "critical",
      title: "CrashLoopBackOff",
      kind: "Pod",
      name: "web-1",
      namespace: "default",
    })
    expect(alert.detail).toContain("7 restarts")
  })

  test("a freshly Pending pod is still scheduling, not an alert", () => {
    expect(
      triageCluster(
        {
          ...EMPTY,
          pods: [pod({ status: "Pending", creationTimestamp: minutesAgo(2) })],
        },
        NOW,
      ),
    ).toEqual([])
  })

  test("a long-Pending pod is critical and borrows the scheduler's reason", () => {
    const [alert] = triageCluster(
      {
        ...EMPTY,
        pods: [pod({ status: "Pending", creationTimestamp: minutesAgo(30) })],
        events: [event({})],
      },
      NOW,
    )
    expect(alert).toMatchObject({ severity: "critical", title: "Pending" })
    expect(alert.detail).toBe("0/3 nodes are available: insufficient cpu.")
  })

  test("restarts on a running pod are a warning, not a failure", () => {
    expect(
      triageCluster({ ...EMPTY, pods: [pod({ restarts: 9 })] }, NOW),
    ).toMatchObject([{ severity: "warning", title: "Restarting repeatedly" }])
    // At or below the threshold it is noise.
    expect(
      triageCluster({ ...EMPTY, pods: [pod({ restarts: 5 })] }, NOW),
    ).toEqual([])
  })

  test("a node that is not Ready outranks its other conditions", () => {
    const alerts = triageCluster(
      {
        ...EMPTY,
        nodes: [
          node({
            status: "NotReady",
            unschedulable: true,
            conditions: [
              { type: "Ready", status: "False", reason: "", message: "" },
              {
                type: "MemoryPressure",
                status: "True",
                reason: "",
                message: "",
              },
            ],
          }),
        ],
      },
      NOW,
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ severity: "critical", kind: "Node" })
  })

  test("a cordoned but healthy node is a warning", () => {
    expect(
      triageCluster({ ...EMPTY, nodes: [node({ unschedulable: true })] }, NOW),
    ).toMatchObject([{ severity: "warning", title: "Cordoned" }])
  })

  test("nothing available is critical; partly available is a warning", () => {
    const base = {
      name: "web",
      namespace: "default",
      readyReplicas: 0,
      updatedReplicas: 0,
      paused: false,
      creationTimestamp: minutesAgo(100),
    }
    expect(
      triageCluster(
        {
          ...EMPTY,
          deployments: [{ ...base, replicas: 3, availableReplicas: 0 }],
        },
        NOW,
      ),
    ).toMatchObject([{ severity: "critical", title: "No available replicas" }])
    expect(
      triageCluster(
        {
          ...EMPTY,
          deployments: [{ ...base, replicas: 3, availableReplicas: 2 }],
        },
        NOW,
      ),
    ).toMatchObject([{ severity: "warning", title: "Degraded" }])
    // A Deployment scaled to zero is a choice, not a fault.
    expect(
      triageCluster(
        {
          ...EMPTY,
          deployments: [{ ...base, replicas: 0, availableReplicas: 0 }],
        },
        NOW,
      ),
    ).toEqual([])
  })

  test("a failed Job reports the condition's own message", () => {
    const [alert] = triageCluster(
      {
        ...EMPTY,
        jobs: [
          {
            name: "backup",
            namespace: "ops",
            completions: 1,
            parallelism: 1,
            backoffLimit: 3,
            suspend: false,
            succeeded: 0,
            failed: 4,
            active: 0,
            startTime: minutesAgo(20),
            completionTime: "",
            duration: "",
            conditions: [
              {
                type: "Failed",
                status: "True",
                reason: "BackoffLimitExceeded",
                message: "Job has reached the specified backoff limit",
              },
            ],
            selector: {},
            creationTimestamp: minutesAgo(25),
            labels: {},
            annotations: {},
          },
        ],
      },
      NOW,
    )
    expect(alert).toMatchObject({ severity: "critical", kind: "Job" })
    expect(alert.detail).toContain("backoff limit")
  })

  test("an event about an already-flagged object does not repeat it", () => {
    const alerts = triageCluster(
      {
        ...EMPTY,
        pods: [pod({ status: "CrashLoopBackOff" })],
        events: [event({ reason: "Unhealthy", message: "probe failed" })],
      },
      NOW,
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].title).toBe("CrashLoopBackOff")
  })

  test("an event about something with no rule of its own still surfaces", () => {
    const alerts = triageCluster(
      {
        ...EMPTY,
        events: [
          event({
            involvedObjectKind: "HorizontalPodAutoscaler",
            involvedObjectName: "web",
            reason: "FailedCreate",
            message: "no metrics",
            count: 4,
          }),
        ],
      },
      NOW,
    )
    expect(alerts).toMatchObject([
      {
        severity: "warning",
        kind: "HorizontalPodAutoscaler",
        title: "FailedCreate",
      },
    ])
    expect(alerts[0].detail).toContain("(×4)")
  })

  test("stale events and uninteresting reasons are left out", () => {
    expect(
      triageCluster(
        {
          ...EMPTY,
          events: [
            event({ lastTimestamp: minutesAgo(90), involvedObjectName: "old" }),
            event({ reason: "BackOff", involvedObjectName: "noisy" }),
            event({
              type: "Normal",
              reason: "FailedMount",
              involvedObjectName: "n",
            }),
          ],
        },
        NOW,
      ),
    ).toEqual([])
  })

  test("critical sorts above warning, newest first within each", () => {
    const alerts = triageCluster(
      {
        ...EMPTY,
        pods: [
          pod({
            name: "old-crash",
            status: "Error",
            creationTimestamp: minutesAgo(600),
          }),
          pod({
            name: "new-crash",
            status: "Error",
            creationTimestamp: minutesAgo(5),
          }),
          pod({ name: "restarter", restarts: 8 }),
        ],
      },
      NOW,
    )
    expect(alerts.map((a) => a.name)).toEqual([
      "new-crash",
      "old-crash",
      "restarter",
    ])
  })
})

describe("alertsInScope", () => {
  const alerts = triageCluster(
    {
      ...EMPTY,
      nodes: [node({ name: "node-9", status: "NotReady" })],
      pods: [
        pod({ name: "a", namespace: "shop", status: "Error" }),
        pod({ name: "b", namespace: "billing", status: "Error" }),
      ],
    },
    NOW,
  )

  test("no namespace is every alert", () => {
    expect(alertsInScope(alerts, null)).toHaveLength(3)
  })

  test("a namespace keeps its own alerts and the cluster-scoped ones", () => {
    expect(
      alertsInScope(alerts, "shop")
        .map((a) => a.name)
        .sort(),
    ).toEqual(["a", "node-9"])
  })
})

describe("alert mutes", () => {
  const alerts = triageCluster(
    {
      ...EMPTY,
      pods: [
        pod({ name: "a", namespace: "shop", status: "Error" }),
        pod({ name: "b", namespace: "billing", status: "Error" }),
      ],
    },
    NOW,
  )
  const A = "pod-status/shop/a"
  const B = "pod-status/billing/b"

  test("a dismissal and a running snooze hide; an expired snooze does not", () => {
    const mutes: AlertMutes = {
      [A]: { until: null, namespace: "shop" },
      [B]: { until: NOW - 1, namespace: "billing" },
    }
    const { active, muted } = partitionAlerts(alerts, mutes, NOW)
    expect(active.map((a) => a.id)).toEqual([B])
    expect(muted.map((a) => a.id)).toEqual([A])
    expect(
      partitionAlerts(
        alerts,
        { [B]: { until: NOW + 1, namespace: "billing" } },
        NOW,
      ).muted.map((a) => a.id),
    ).toEqual([B])
  })

  test("a mute is dropped once its alert is no longer raised", () => {
    const mutes: AlertMutes = { [A]: { until: null, namespace: "shop" } }
    expect(pruneMutes(mutes, [], null, NOW)).toEqual({})
  })

  test("an expired snooze is dropped even while the alert is raised", () => {
    const mutes: AlertMutes = { [A]: { until: NOW - 1, namespace: "shop" } }
    expect(pruneMutes(mutes, alerts, null, NOW)).toEqual({})
  })

  test("a mute outside the namespace scope is not taken for resolved", () => {
    const mutes: AlertMutes = {
      [A]: { until: null, namespace: "shop" },
      [B]: { until: null, namespace: "billing" },
    }
    // Read under "shop", the billing pod is simply not in the lists.
    const scoped = alertsInScope(alerts, "shop")
    expect(pruneMutes(mutes, scoped, "shop", NOW)).toBe(mutes)
  })

  test("nothing to drop hands back the same object", () => {
    const mutes: AlertMutes = { [A]: { until: null, namespace: "shop" } }
    expect(pruneMutes(mutes, alerts, null, NOW)).toBe(mutes)
  })
})
