import { DrawerTabInput } from "../store/app.store"

type YamlEditKind = Extract<
  DrawerTabInput,
  { type: "yaml-edit" }
>["resourceKind"]

export interface ResourceGvk {
  apiVersion: string
  kind: string
}

const GVK: Record<YamlEditKind, ResourceGvk> = {
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
}

export function resourceGvk(kind: YamlEditKind): ResourceGvk {
  return GVK[kind]
}
