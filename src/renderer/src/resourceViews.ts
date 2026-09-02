import { type ComponentType, lazy } from "react"

import type { ResourceType } from "./types/resource"

/**
 * Views are code-split: only the selected one is fetched and evaluated, so the
 * initial bundle doesn't carry all 36 (plus Monaco, xterm, and recharts behind
 * them). Consumers must render these under a <Suspense> boundary.
 */
const named = <M, K extends keyof M>(
  loader: () => Promise<M>,
  key: K,
): ComponentType =>
  lazy(async () => {
    const mod = await loader()
    return { default: mod[key] as ComponentType }
  })

export const resourceViews: Record<ResourceType, ComponentType> = {
  Namespaces: named(
    () => import("./components/NamespacesView"),
    "NamespacesView",
  ),
  Nodes: named(() => import("./components/NodesView"), "NodesView"),
  Deployments: named(
    () => import("./components/DeploymentsView"),
    "DeploymentsView",
  ),
  ReplicaSets: named(
    () => import("./components/ReplicaSetsView"),
    "ReplicaSetsView",
  ),
  StatefulSets: named(
    () => import("./components/StatefulSetsView"),
    "StatefulSetsView",
  ),
  DaemonSets: named(
    () => import("./components/DaemonSetsView"),
    "DaemonSetsView",
  ),
  ConfigMaps: named(
    () => import("./components/ConfigMapsView"),
    "ConfigMapsView",
  ),
  Secrets: named(() => import("./components/SecretsView"), "SecretsView"),
  Pods: named(() => import("./components/PodsView"), "PodsView"),
  Services: named(() => import("./components/ServicesView"), "ServicesView"),
  Ingresses: named(() => import("./components/IngressesView"), "IngressesView"),
  IngressClasses: named(
    () => import("./components/IngressClassesView"),
    "IngressClassesView",
  ),
  NetworkPolicies: named(
    () => import("./components/NetworkPoliciesView"),
    "NetworkPoliciesView",
  ),
  Endpoints: named(() => import("./components/EndpointsView"), "EndpointsView"),
  EndpointSlices: named(
    () => import("./components/EndpointSlicesView"),
    "EndpointSlicesView",
  ),
  Events: named(() => import("./components/EventsView"), "EventsView"),
  HPAs: named(() => import("./components/HPAsView"), "HPAsView"),
  ServiceAccounts: named(
    () => import("./components/ServiceAccountsView"),
    "ServiceAccountsView",
  ),
  Roles: named(() => import("./components/RolesView"), "RolesView"),
  ClusterRoles: named(
    () => import("./components/ClusterRolesView"),
    "ClusterRolesView",
  ),
  RoleBindings: named(
    () => import("./components/RoleBindingsView"),
    "RoleBindingsView",
  ),
  ClusterRoleBindings: named(
    () => import("./components/ClusterRoleBindingsView"),
    "ClusterRoleBindingsView",
  ),
  PersistentVolumes: named(() => import("./components/PVsView"), "PVsView"),
  PersistentVolumeClaims: named(
    () => import("./components/PVCsView"),
    "PVCsView",
  ),
  StorageClasses: named(
    () => import("./components/StorageClassesView"),
    "StorageClassesView",
  ),
  VolumeSnapshots: named(
    () => import("./components/VolumeSnapshotsView"),
    "VolumeSnapshotsView",
  ),
  VolumeSnapshotClasses: named(
    () => import("./components/VolumeSnapshotClassesView"),
    "VolumeSnapshotClassesView",
  ),
  CustomResourceDefinitions: named(
    () => import("./components/CRDsView"),
    "CRDsView",
  ),
  "custom-resources": named(
    () => import("./components/CustomResourcesView"),
    "CustomResourcesView",
  ),
  Jobs: named(() => import("./components/JobsView"), "JobsView"),
  CronJobs: named(() => import("./components/CronJobsView"), "CronJobsView"),
  ResourceQuotas: named(
    () => import("./components/ResourceQuotasView"),
    "ResourceQuotasView",
  ),
  LimitRanges: named(
    () => import("./components/LimitRangesView"),
    "LimitRangesView",
  ),
  PodDisruptionBudgets: named(
    () => import("./components/PDBsView"),
    "PDBsView",
  ),
  overview: named(() => import("./components/OverviewView"), "OverviewView"),
  "custom-stream": named(
    () => import("../components/ui/CustomStreamView"),
    "CustomStreamView",
  ),
  history: named(() => import("./components/HistoryView"), "HistoryView"),
  "helm-repositories": named(
    () => import("./components/HelmView"),
    "HelmRepositoriesView",
  ),
  "helm-releases": named(
    () => import("./components/HelmView"),
    "HelmReleasesView",
  ),
  "alarm-rules": named(
    () => import("./components/AlarmsView"),
    "AlarmRulesView",
  ),
  "alarm-active": named(
    () => import("./components/AlarmsView"),
    "AlarmActiveView",
  ),
}
