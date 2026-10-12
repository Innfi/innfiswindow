// What the per-kind workload modules have in common: the pod-template
// mapping every controller shares, and the patch bodies behind restart and
// scale.

import {
  PatchStrategy,
  setHeaderOptions,
  V1Container,
  V1EnvVar,
  V1Probe,
  V1Volume,
} from "@kubernetes/client-node"

import { DetailedContainerInfo, EnvVar, ProbeInfo, VolumeInfo } from "../types"

/** The generated client defaults patch requests to JSON Patch, which rejects
 *  the object-shaped bodies used here; every patch below is a merge. */
export const MERGE_PATCH = setHeaderOptions(
  "Content-Type",
  PatchStrategy.StrategicMergePatch,
)

function formatProbe(probe: V1Probe | null | undefined): ProbeInfo | null {
  if (!probe) return null
  let type = "unknown"
  let description = ""
  if (probe.httpGet) {
    type = "http-get"
    const port = String(probe.httpGet.port ?? "")
    const path = probe.httpGet.path ?? "/"
    const host = probe.httpGet.host ?? ""
    description = `http-get http://${host}:${port}${path}`
  } else if (probe.exec) {
    type = "exec"
    description = `exec [${(probe.exec.command ?? []).join(" ")}]`
  } else if (probe.tcpSocket) {
    type = "tcp-socket"
    description = `tcp-socket :${String(probe.tcpSocket.port ?? "")}`
  }
  return {
    type,
    description,
    initialDelaySeconds: probe.initialDelaySeconds ?? 0,
    periodSeconds: probe.periodSeconds ?? 10,
    timeoutSeconds: probe.timeoutSeconds ?? 1,
    failureThreshold: probe.failureThreshold ?? 3,
    successThreshold: probe.successThreshold ?? 1,
  }
}

function formatEnvVar(env: V1EnvVar): EnvVar {
  if (env.value !== undefined) {
    return { name: env.name, value: env.value }
  }
  if (env.valueFrom) {
    const vf = env.valueFrom
    if (vf.secretKeyRef) {
      return {
        name: env.name,
        value: "",
        valueFrom: `secret:${vf.secretKeyRef.name ?? ""}/${vf.secretKeyRef.key ?? ""}`,
      }
    }
    if (vf.configMapKeyRef) {
      return {
        name: env.name,
        value: "",
        valueFrom: `configmap:${vf.configMapKeyRef.name ?? ""}/${vf.configMapKeyRef.key ?? ""}`,
      }
    }
    if (vf.fieldRef) {
      return {
        name: env.name,
        value: "",
        valueFrom: `field:${vf.fieldRef.fieldPath ?? ""}`,
      }
    }
    if (vf.resourceFieldRef) {
      return {
        name: env.name,
        value: "",
        valueFrom: `resource:${vf.resourceFieldRef.resource ?? ""}`,
      }
    }
  }
  return { name: env.name, value: "" }
}

export function formatVolume(vol: V1Volume): VolumeInfo {
  if (vol.persistentVolumeClaim) {
    return {
      name: vol.name,
      type: "PersistentVolumeClaim",
      detail: vol.persistentVolumeClaim.claimName ?? "",
    }
  }
  if (vol.configMap) {
    return {
      name: vol.name,
      type: "ConfigMap",
      detail: vol.configMap.name ?? "",
    }
  }
  if (vol.secret) {
    return {
      name: vol.name,
      type: "Secret",
      detail: vol.secret.secretName ?? "",
    }
  }
  if (vol.emptyDir !== undefined) {
    return { name: vol.name, type: "EmptyDir", detail: "" }
  }
  if (vol.hostPath) {
    return { name: vol.name, type: "HostPath", detail: vol.hostPath.path ?? "" }
  }
  if (vol.projected) {
    return { name: vol.name, type: "Projected", detail: "" }
  }
  return { name: vol.name, type: "Unknown", detail: "" }
}

export function mapDetailedContainer(c: V1Container): DetailedContainerInfo {
  return {
    name: c.name,
    image: c.image ?? "",
    ports: (c.ports ?? []).map((p) => ({
      name: p.name ?? "",
      containerPort: p.containerPort,
      protocol: p.protocol ?? "TCP",
    })),
    env: (c.env ?? []).map(formatEnvVar),
    resources: {
      requests: Object.fromEntries(
        Object.entries(c.resources?.requests ?? {}).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
      limits: Object.fromEntries(
        Object.entries(c.resources?.limits ?? {}).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
    },
    volumeMounts: (c.volumeMounts ?? []).map((vm) => ({
      name: vm.name,
      mountPath: vm.mountPath,
      readOnly: vm.readOnly ?? false,
    })),
    livenessProbe: formatProbe(c.livenessProbe),
    readinessProbe: formatProbe(c.readinessProbe),
    startupProbe: formatProbe(c.startupProbe),
  }
}

/** Strategic-merge patch bumping the pod-template restart annotation, which
 *  triggers a rolling restart exactly like `kubectl rollout restart`. */
export function restartPatchBody(): object {
  return {
    spec: {
      template: {
        metadata: {
          annotations: {
            "kubectl.kubernetes.io/restartedAt": new Date().toISOString(),
          },
        },
      },
    },
  }
}

/** Patches the `scale` subresource, exactly as `kubectl scale` does, so the
 *  request is rejected when the workload is HPA-managed rather than fighting
 *  the autoscaler through a full-object update. */
export function scaleBody(replicas: number): object {
  if (!Number.isInteger(replicas) || replicas < 0) {
    throw new Error(
      `Replica count must be a non-negative integer, got ${replicas}`,
    )
  }
  return { spec: { replicas } }
}

/** Best-effort read of `.message` out of a `metav1.Status` payload, which the
 *  client hands back either parsed or as the raw JSON string. */
export function statusMessage(body: unknown): string | null {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as { message?: unknown }
      return typeof parsed.message === "string" ? parsed.message : body
    } catch {
      return body
    }
  }
  if (body && typeof body === "object") {
    const message = (body as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return null
}
