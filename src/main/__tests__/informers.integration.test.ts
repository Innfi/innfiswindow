import { WebContents } from "electron"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { AppsV1Api, CoreV1Api, KubeConfig } from "@kubernetes/client-node"

import { WatchEventMessage } from "../../shared/watch"
import {
  InformerDeps,
  startWatch,
  stopAllWatches,
  stopWatch,
  WATCH_EVENT_CHANNEL,
} from "../informers"
import { ApiClients } from "../ipc/context-clients"
import { listPods } from "../k8s-handlers"

const KIND_CONTEXT = "kind-innfiswindow-test"
const NAMESPACE = "test-ns-1"

function hasKindContext(): boolean {
  try {
    const kc = new KubeConfig()
    kc.loadFromDefault()
    return kc.getContexts().some((ctx) => ctx.name === KIND_CONTEXT)
  } catch {
    return false
  }
}

const kindAvailable = hasKindContext()

/** Stands in for a renderer's WebContents: the informer registry only ever
 *  calls these three. */
function fakeSender(): {
  sender: WebContents
  messages: WatchEventMessage[]
} {
  const messages: WatchEventMessage[] = []
  const sender = {
    send: (channel: string, message: WatchEventMessage) => {
      if (channel === WATCH_EVENT_CHANNEL) messages.push(message)
    },
    isDestroyed: () => false,
    on: () => {},
  }
  return { sender: sender as unknown as WebContents, messages }
}

async function waitFor<T>(
  probe: () => T | undefined,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = probe()
    if (hit !== undefined) return hit
    if (Date.now() > deadline) throw new Error("timed out waiting for event")
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

let kc: KubeConfig
let coreApi: CoreV1Api
let deps: InformerDeps

beforeAll(() => {
  if (!kindAvailable) return
  kc = new KubeConfig()
  kc.loadFromDefault()
  kc.setCurrentContext(KIND_CONTEXT)
  coreApi = kc.makeApiClient(CoreV1Api)
  const appsApi = kc.makeApiClient(AppsV1Api)
  deps = {
    getKubeConfig: () => kc,
    // Only the clients the watched resources need are real; the registry never
    // touches the rest.
    getContextClients: () =>
      ({ coreV1: coreApi, appsV1: appsApi }) as ApiClients,
  }
})

afterAll(() => {
  if (kindAvailable) stopAllWatches()
})

describe.skipIf(!kindAvailable)("informers against kind cluster", () => {
  test("pods watch snapshot matches the list handler", async () => {
    const { sender } = fakeSender()
    const { subId, items } = await startWatch(
      deps,
      { resource: "pods", contextName: KIND_CONTEXT, namespace: NAMESPACE },
      sender,
    )
    try {
      const listed = await listPods(coreApi, NAMESPACE)
      const watched = items as Awaited<ReturnType<typeof listPods>>
      expect(watched.map((p) => p.name).sort()).toEqual(
        listed.map((p) => p.name).sort(),
      )

      // The ReplicaSet informer must resolve owners the way the list's bulk
      // lookup does, not fall back to stripping the pod-template hash.
      const nginx = watched.find((p) => p.name.startsWith("nginx-deploy-"))
      expect(nginx?.ownerKind).toBe("Deployment")
      expect(nginx?.ownerName).toBe("nginx-deploy")
    } finally {
      stopWatch(subId)
    }
  })

  test("events watch snapshot carries mapped events", async () => {
    const { sender } = fakeSender()
    const { subId, items } = await startWatch(
      deps,
      { resource: "events", contextName: KIND_CONTEXT, namespace: NAMESPACE },
      sender,
    )
    try {
      expect(Array.isArray(items)).toBe(true)
      for (const item of items as { name: string; namespace: string }[]) {
        expect(typeof item.name).toBe("string")
        expect(item.namespace).toBe(NAMESPACE)
      }
    } finally {
      stopWatch(subId)
    }
  })

  test("a pod created after subscribing arrives as add then delete", async () => {
    const { sender, messages } = fakeSender()
    const { subId } = await startWatch(
      deps,
      { resource: "pods", contextName: KIND_CONTEXT, namespace: NAMESPACE },
      sender,
    )
    const name = `watch-probe-${Date.now()}`
    try {
      await coreApi.createNamespacedPod({
        namespace: NAMESPACE,
        body: {
          metadata: { name, namespace: NAMESPACE },
          spec: {
            containers: [{ name: "pause", image: "registry.k8s.io/pause:3.9" }],
          },
        },
      })

      const added = await waitFor(() =>
        messages.find(
          (m) => m.type === "add" && (m.item as { name: string }).name === name,
        ),
      )
      expect(added.subId).toBe(subId)

      await coreApi.deleteNamespacedPod({ name, namespace: NAMESPACE })
      await waitFor(() =>
        messages.find(
          (m) =>
            m.type === "delete" && (m.item as { name: string }).name === name,
        ),
      )
    } finally {
      stopWatch(subId)
      await coreApi
        .deleteNamespacedPod({ name, namespace: NAMESPACE })
        .catch(() => {})
    }
  }, 90_000)

  test("two subscribers share one informer and both see the snapshot", async () => {
    const first = fakeSender()
    const second = fakeSender()
    const a = await startWatch(
      deps,
      { resource: "pods", contextName: KIND_CONTEXT, namespace: NAMESPACE },
      first.sender,
    )
    const b = await startWatch(
      deps,
      { resource: "pods", contextName: KIND_CONTEXT, namespace: NAMESPACE },
      second.sender,
    )
    try {
      expect(a.subId).not.toBe(b.subId)
      expect(b.items.length).toBe(a.items.length)
    } finally {
      stopWatch(a.subId)
      stopWatch(b.subId)
    }
  })
})
