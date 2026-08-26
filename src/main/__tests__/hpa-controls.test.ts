import { describe, expect, test } from "vitest"
import { AutoscalingV2Api } from "@kubernetes/client-node"

import {
  listHPAs,
  updateHPAMetrics,
  updateHPAReplicas,
} from "../handlers/autoscaling"

// The HPA writes are the checks they make before a single patch, plus the
// shape of that patch — a kind cluster has no metrics-server behind it, so it
// could not tell a good target from a rejected one anyway.
type Call = { method: string; args: unknown[] }

function contentType(call: Call): string | undefined {
  const opts = call.args[1] as {
    middleware?: { pre: (req: unknown) => unknown }[]
  }
  const headers: Record<string, string> = {}
  const request = {
    setHeaderParam: (k: string, v: string) => {
      headers[k] = v
    },
  }
  for (const mw of opts?.middleware ?? []) mw.pre(request)
  return headers["Content-Type"]
}

function hpaStub(hpa: unknown): { calls: Call[]; api: AutoscalingV2Api } {
  const calls: Call[] = []
  const api = {
    readNamespacedHorizontalPodAutoscaler: () => Promise.resolve(hpa),
    listNamespacedHorizontalPodAutoscaler: () =>
      Promise.resolve({ items: [hpa] }),
    patchNamespacedHorizontalPodAutoscaler: (...args: unknown[]) => {
      calls.push({ method: "patchNamespacedHorizontalPodAutoscaler", args })
      return Promise.resolve({})
    },
  } as unknown as AutoscalingV2Api
  return { calls, api }
}

const CPU_HPA = {
  metadata: { name: "web", namespace: "ns" },
  spec: {
    scaleTargetRef: { kind: "Deployment", name: "web" },
    minReplicas: 2,
    maxReplicas: 10,
    metrics: [
      {
        type: "Resource",
        resource: { name: "cpu", target: { averageUtilization: 70 } },
      },
    ],
  },
  status: {
    currentReplicas: 3,
    desiredReplicas: 3,
    currentMetrics: [
      {
        type: "Resource",
        resource: { name: "cpu", current: { averageUtilization: 42 } },
      },
    ],
  },
}

function patchBody(call: Call): { spec: Record<string, unknown> } {
  return (call.args[0] as { body: { spec: Record<string, unknown> } }).body
}

describe("listHPAs", () => {
  test("pairs each resource metric with its current reading", async () => {
    const { api } = hpaStub(CPU_HPA)
    const [hpa] = await listHPAs(api, "ns")
    expect(hpa.resourceMetrics).toEqual([
      {
        kind: "Resource",
        name: "cpu",
        container: "",
        targetType: "Utilization",
        averageUtilization: 70,
        value: "",
        currentUtilization: 42,
        currentValue: "",
      },
    ])
    expect(hpa.otherMetricCount).toBe(0)
  })

  test("matches a ContainerResource reading on name and container", async () => {
    const { api } = hpaStub({
      ...CPU_HPA,
      spec: {
        ...CPU_HPA.spec,
        metrics: [
          {
            type: "ContainerResource",
            containerResource: {
              name: "memory",
              container: "app",
              target: { averageValue: "500Mi" },
            },
          },
        ],
      },
      status: {
        ...CPU_HPA.status,
        currentMetrics: [
          {
            type: "ContainerResource",
            containerResource: {
              name: "memory",
              container: "sidecar",
              current: { averageValue: "10Mi" },
            },
          },
          {
            type: "ContainerResource",
            containerResource: {
              name: "memory",
              container: "app",
              current: { averageValue: "300Mi" },
            },
          },
        ],
      },
    })
    const [hpa] = await listHPAs(api, "ns")
    expect(hpa.resourceMetrics).toEqual([
      {
        kind: "ContainerResource",
        name: "memory",
        container: "app",
        targetType: "AverageValue",
        averageUtilization: null,
        value: "500Mi",
        currentUtilization: null,
        currentValue: "300Mi",
      },
    ])
  })

  test("counts the metrics the editor cannot represent", async () => {
    const { api } = hpaStub({
      ...CPU_HPA,
      spec: {
        ...CPU_HPA.spec,
        metrics: [
          ...CPU_HPA.spec.metrics,
          {
            type: "External",
            external: {
              metric: { name: "queue_depth" },
              target: { value: "30" },
            },
          },
        ],
      },
    })
    const [hpa] = await listHPAs(api, "ns")
    expect(hpa.resourceMetrics).toHaveLength(1)
    expect(hpa.otherMetricCount).toBe(1)
  })
})

describe("updateHPAReplicas", () => {
  test("patches both bounds as a JSON merge patch", async () => {
    const { calls, api } = hpaStub(CPU_HPA)
    const res = await updateHPAReplicas(api, "ns", "web", {
      minReplicas: 3,
      maxReplicas: 12,
    })
    expect(res).toEqual({ success: true, name: "web", namespace: "ns" })
    expect(calls).toHaveLength(1)
    expect(patchBody(calls[0])).toEqual({
      spec: { minReplicas: 3, maxReplicas: 12 },
    })
    expect(contentType(calls[0])).toBe("application/merge-patch+json")
  })

  test("refuses a max below the min", async () => {
    const { calls, api } = hpaStub(CPU_HPA)
    await expect(
      updateHPAReplicas(api, "ns", "web", { minReplicas: 5, maxReplicas: 2 }),
    ).rejects.toThrow(/cannot be below minReplicas/)
    expect(calls).toHaveLength(0)
  })

  test("refuses a fractional or negative bound", async () => {
    const { calls, api } = hpaStub(CPU_HPA)
    await expect(
      updateHPAReplicas(api, "ns", "web", { minReplicas: 1.5, maxReplicas: 4 }),
    ).rejects.toThrow(/whole numbers/)
    await expect(
      updateHPAReplicas(api, "ns", "web", { minReplicas: -1, maxReplicas: 4 }),
    ).rejects.toThrow(/cannot be negative/)
    await expect(
      updateHPAReplicas(api, "ns", "web", { minReplicas: 0, maxReplicas: 0 }),
    ).rejects.toThrow(/at least 1/)
    expect(calls).toHaveLength(0)
  })

  test("allows a min of 0, which only the API server can rule on", async () => {
    const { calls, api } = hpaStub(CPU_HPA)
    await updateHPAReplicas(api, "ns", "web", {
      minReplicas: 0,
      maxReplicas: 4,
    })
    expect(patchBody(calls[0])).toEqual({
      spec: { minReplicas: 0, maxReplicas: 4 },
    })
  })
})

describe("updateHPAMetrics", () => {
  test("replaces the resource metrics and keeps the rest", async () => {
    const external = {
      type: "External",
      external: { metric: { name: "queue_depth" }, target: { value: "30" } },
    }
    const { calls, api } = hpaStub({
      ...CPU_HPA,
      spec: { ...CPU_HPA.spec, metrics: [...CPU_HPA.spec.metrics, external] },
    })
    await updateHPAMetrics(api, "ns", "web", [
      {
        kind: "Resource",
        name: "memory",
        container: "",
        targetType: "AverageValue",
        averageUtilization: null,
        value: "500Mi",
      },
      {
        kind: "ContainerResource",
        name: "cpu",
        container: "app",
        targetType: "Utilization",
        averageUtilization: 60,
        value: "",
      },
    ])
    expect(patchBody(calls[0])).toEqual({
      spec: {
        metrics: [
          {
            type: "Resource",
            resource: {
              name: "memory",
              target: { type: "AverageValue", averageValue: "500Mi" },
            },
          },
          {
            type: "ContainerResource",
            containerResource: {
              name: "cpu",
              container: "app",
              target: { type: "Utilization", averageUtilization: 60 },
            },
          },
          external,
        ],
      },
    })
    expect(contentType(calls[0])).toBe("application/merge-patch+json")
  })

  test("clears the resource metrics when handed an empty list", async () => {
    const { calls, api } = hpaStub(CPU_HPA)
    await updateHPAMetrics(api, "ns", "web", [])
    expect(patchBody(calls[0])).toEqual({ spec: { metrics: [] } })
  })

  test("refuses a target that is not a quantity above zero", async () => {
    const { calls, api } = hpaStub(CPU_HPA)
    await expect(
      updateHPAMetrics(api, "ns", "web", [
        {
          kind: "Resource",
          name: "memory",
          container: "",
          targetType: "AverageValue",
          averageUtilization: null,
          value: "0Mi",
        },
      ]),
    ).rejects.toThrow(/not a quantity above zero/)
    expect(calls).toHaveLength(0)
  })

  test("refuses a ContainerResource metric with no container", async () => {
    const { calls, api } = hpaStub(CPU_HPA)
    await expect(
      updateHPAMetrics(api, "ns", "web", [
        {
          kind: "ContainerResource",
          name: "cpu",
          container: "",
          targetType: "Utilization",
          averageUtilization: 60,
          value: "",
        },
      ]),
    ).rejects.toThrow(/needs the container it reads/)
    expect(calls).toHaveLength(0)
  })

  test("refuses two metrics reading the same resource", async () => {
    const { calls, api } = hpaStub(CPU_HPA)
    const cpu = {
      kind: "Resource" as const,
      name: "cpu",
      container: "",
      targetType: "Utilization" as const,
      averageUtilization: 60,
      value: "",
    }
    await expect(
      updateHPAMetrics(api, "ns", "web", [
        cpu,
        { ...cpu, averageUtilization: 80 },
      ]),
    ).rejects.toThrow(/appears twice/)
    expect(calls).toHaveLength(0)
  })
})
