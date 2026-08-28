export interface ResourceGvk {
  apiVersion: string
  kind: string
}

/** The kinds this app has a view for. Custom resources are not in here — they
 *  are addressed by the GVK their CRD declares, passed alongside the kind. */
const GVK = {
  Deployment: { apiVersion: "apps/v1", kind: "Deployment" },
  ReplicaSet: { apiVersion: "apps/v1", kind: "ReplicaSet" },
  DaemonSet: { apiVersion: "apps/v1", kind: "DaemonSet" },
  StatefulSet: { apiVersion: "apps/v1", kind: "StatefulSet" },
  Pod: { apiVersion: "v1", kind: "Pod" },
  Service: { apiVersion: "v1", kind: "Service" },
  ConfigMap: { apiVersion: "v1", kind: "ConfigMap" },
  Secret: { apiVersion: "v1", kind: "Secret" },
  Namespace: { apiVersion: "v1", kind: "Namespace" },
  ServiceAccount: { apiVersion: "v1", kind: "ServiceAccount" },
  PersistentVolume: { apiVersion: "v1", kind: "PersistentVolume" },
  PersistentVolumeClaim: { apiVersion: "v1", kind: "PersistentVolumeClaim" },
  ResourceQuota: { apiVersion: "v1", kind: "ResourceQuota" },
  LimitRange: { apiVersion: "v1", kind: "LimitRange" },
  Ingress: { apiVersion: "networking.k8s.io/v1", kind: "Ingress" },
  NetworkPolicy: { apiVersion: "networking.k8s.io/v1", kind: "NetworkPolicy" },
  HPA: { apiVersion: "autoscaling/v2", kind: "HorizontalPodAutoscaler" },
  PodDisruptionBudget: {
    apiVersion: "policy/v1",
    kind: "PodDisruptionBudget",
  },
  CronJob: { apiVersion: "batch/v1", kind: "CronJob" },
  Job: { apiVersion: "batch/v1", kind: "Job" },
  Role: { apiVersion: "rbac.authorization.k8s.io/v1", kind: "Role" },
  ClusterRole: {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRole",
  },
  RoleBinding: {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "RoleBinding",
  },
  ClusterRoleBinding: {
    apiVersion: "rbac.authorization.k8s.io/v1",
    kind: "ClusterRoleBinding",
  },
  Node: { apiVersion: "v1", kind: "Node" },
  Endpoints: { apiVersion: "v1", kind: "Endpoints" },
  StorageClass: { apiVersion: "storage.k8s.io/v1", kind: "StorageClass" },
  VolumeSnapshot: {
    apiVersion: "snapshot.storage.k8s.io/v1",
    kind: "VolumeSnapshot",
  },
  CustomResourceDefinition: {
    apiVersion: "apiextensions.k8s.io/v1",
    kind: "CustomResourceDefinition",
  },
} as const satisfies Record<string, ResourceGvk>

export type BuiltinResourceKind = keyof typeof GVK

/**
 * A kind the shared write buttons can act on. The open arm keeps the built-in
 * names as autocomplete suggestions while still admitting a custom resource's
 * kind, which is only known at runtime — such a kind must be passed with its
 * own `gvk`, since there is nothing to look it up in. (`Record<never, never>`
 * is `{}` spelled in a way the ban-types rule allows: intersecting it with
 * `string` is what stops the union collapsing to plain `string`.)
 */
export type ResourceKind = BuiltinResourceKind | (string & Record<never, never>)

/** Resolves a kind to its group/version. `override` is what a custom resource
 *  passes: the CRD supplies the GVK, so no lookup happens. */
export function resourceGvk(
  kind: ResourceKind,
  override?: ResourceGvk,
): ResourceGvk {
  if (override) return override
  const known = GVK[kind as BuiltinResourceKind]
  if (!known) {
    throw new Error(
      `No apiVersion known for kind "${kind}" — pass its GVK explicitly.`,
    )
  }
  return known
}
