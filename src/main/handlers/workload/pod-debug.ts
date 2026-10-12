// Ephemeral debug containers (`kubectl debug`)

import { CoreV1Api, V1EphemeralContainer } from "@kubernetes/client-node"

import { DebugContainerRequest, DebugContainerResult } from "../types"
import { MERGE_PATCH, statusMessage } from "./shared"

/** Container names are DNS labels, which is stricter than a label key. */
const DNS_LABEL = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/

/** Waiting reasons the kubelet will not recover from on its own, so the wait
 *  gives up on them instead of burning the whole timeout. */
const TERMINAL_WAITING_REASONS = new Set([
  "CreateContainerConfigError",
  "CreateContainerError",
  "ErrImagePull",
  "ImagePullBackOff",
  "InvalidImageName",
])

/** Five lowercase alphanumerics, the same shape `kubectl debug` generates. */
export function randomDebugSuffix(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

/** Turns the dialog's answers into the container the patch adds, or throws with
 *  the reason it can't. Pure so the rules can be checked without a cluster:
 *  the API server's own rejection for a name clash is a 422 whose message does
 *  not say which container it collided with. */
export function buildEphemeralContainer(
  request: DebugContainerRequest,
  pod: { containers: string[]; takenNames: string[] },
  suffix: () => string = randomDebugSuffix,
): V1EphemeralContainer {
  const image = request.image.trim()
  if (!image) throw new Error("A debug container needs an image.")

  const requested = (request.name ?? "").trim()
  const name = requested || `debugger-${suffix()}`
  if (name.length > 63 || !DNS_LABEL.test(name)) {
    throw new Error(
      `Container name "${name}" is not a DNS label: lowercase letters, digits and dashes, starting and ending with an alphanumeric, at most 63 characters.`,
    )
  }
  if (pod.takenNames.includes(name)) {
    throw new Error(
      `The pod already has a container named "${name}". Ephemeral containers cannot be replaced, so pick another name.`,
    )
  }

  const target = (request.targetContainer ?? "").trim()
  if (target && !pod.containers.includes(target)) {
    throw new Error(
      `No container named "${target}" in this pod — target one of: ${pod.containers.join(", ")}.`,
    )
  }

  const command = (request.command ?? [])
    .map((part) => part.trim())
    .filter((part) => part !== "")

  return {
    name,
    image,
    // Held open by the kubelet so a shell started from the image's own
    // entrypoint keeps waiting for input instead of exiting immediately.
    stdin: true,
    tty: true,
    terminationMessagePolicy: "File",
    ...(command.length > 0 ? { command } : {}),
    ...(target ? { targetContainerName: target } : {}),
  }
}

function describeContainerState(
  status:
    | {
        state?: {
          running?: object
          waiting?: { reason?: string; message?: string }
          terminated?: { reason?: string; exitCode?: number }
        }
      }
    | undefined,
): { running: boolean; state: string } {
  const state = status?.state
  if (!state) return { running: false, state: "Pending" }
  if (state.running) return { running: true, state: "Running" }
  if (state.terminated) {
    const term = state.terminated
    return {
      running: false,
      state: `${term.reason ?? "Terminated"} (exit ${term.exitCode ?? "?"})`,
    }
  }
  if (state.waiting) {
    const wait = state.waiting
    return {
      running: false,
      state: wait.message
        ? `${wait.reason ?? "Waiting"}: ${wait.message}`
        : (wait.reason ?? "Waiting"),
    }
  }
  return { running: false, state: "Pending" }
}

/** Polls until the kubelet reports the container running, or until a reason it
 *  won't recover from shows up. A caller that gets `running: false` back has a
 *  container that exists — ephemeral containers can't be removed — but nothing
 *  to attach to. */
async function waitForEphemeralContainer(
  api: CoreV1Api,
  namespace: string,
  podName: string,
  containerName: string,
  timeoutMs: number,
  pollMs = 1000,
): Promise<{ running: boolean; state: string }> {
  const deadline = Date.now() + timeoutMs
  let last: { running: boolean; state: string } = {
    running: false,
    state: "Pending",
  }
  for (;;) {
    const pod = await api.readNamespacedPod({ name: podName, namespace })
    const status = (pod.status?.ephemeralContainerStatuses ?? []).find(
      (s) => s.name === containerName,
    )
    last = describeContainerState(status)
    if (last.running) return last
    if (status?.state?.terminated) return last
    const reason = status?.state?.waiting?.reason
    if (reason && TERMINAL_WAITING_REASONS.has(reason)) return last
    if (Date.now() + pollMs > deadline) return last
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
}

/**
 * Adds an ephemeral container to a running pod — what `kubectl debug` does.
 * The patch goes to the `ephemeralcontainers` subresource, the only way to add
 * one: the container list of a running pod is otherwise immutable. Strategic
 * merge appends by the `name` merge key, so the existing containers are left
 * alone without resending them.
 */
export async function addEphemeralContainer(
  api: CoreV1Api,
  namespace: string,
  podName: string,
  request: DebugContainerRequest,
  waitMs = 30000,
): Promise<DebugContainerResult> {
  const pod = await api.readNamespacedPod({ name: podName, namespace })
  const container = buildEphemeralContainer(request, {
    containers: (pod.spec?.containers ?? []).map((c) => c.name),
    takenNames: [
      ...(pod.spec?.containers ?? []),
      ...(pod.spec?.initContainers ?? []),
      ...(pod.spec?.ephemeralContainers ?? []),
    ].map((c) => c.name),
  })

  try {
    await api.patchNamespacedPodEphemeralcontainers(
      {
        name: podName,
        namespace,
        body: { spec: { ephemeralContainers: [container] } },
      },
      MERGE_PATCH,
    )
  } catch (e: unknown) {
    const detail =
      statusMessage((e as { body?: unknown }).body) ??
      (e instanceof Error ? e.message : String(e))
    throw new Error(
      `Could not add debug container "${container.name}" to ${namespace}/${podName}: ${detail}`,
    )
  }

  const { running, state } = await waitForEphemeralContainer(
    api,
    namespace,
    podName,
    container.name,
    waitMs,
  )
  return {
    success: true,
    name: podName,
    namespace,
    containerName: container.name,
    running,
    state,
  }
}
