import type { ComponentType } from "react"

import { CustomStreamView } from "../components/ui/CustomStreamView"
import { AlarmActiveView, AlarmRulesView } from "./components/AlarmsView"
import { ClusterRoleBindingsView } from "./components/ClusterRoleBindingsView"
import { ClusterRolesView } from "./components/ClusterRolesView"
import { ConfigMapsView } from "./components/ConfigMapsView"
import { CronJobsView } from "./components/CronJobsView"
import { DaemonSetsView } from "./components/DaemonSetsView"
import { DeploymentsView } from "./components/DeploymentsView"
import { EndpointsView } from "./components/EndpointsView"
import { EventsView } from "./components/EventsView"
import { HelmReleasesView, HelmRepositoriesView } from "./components/HelmView"
import { HistoryView } from "./components/HistoryView"
import { HPAsView } from "./components/HPAsView"
import { IngressesView } from "./components/IngressesView"
import { JobsView } from "./components/JobsView"
import { LimitRangesView } from "./components/LimitRangesView"
import { NamespacesView } from "./components/NamespacesView"
import { NetworkPoliciesView } from "./components/NetworkPoliciesView"
import { NodesView } from "./components/NodesView"
import { OverviewView } from "./components/OverviewView"
import { PDBsView } from "./components/PDBsView"
import { PodsView } from "./components/PodsView"
import { PVCsView } from "./components/PVCsView"
import { PVsView } from "./components/PVsView"
import { ReplicaSetsView } from "./components/ReplicaSetsView"
import { ResourceQuotasView } from "./components/ResourceQuotasView"
import { RoleBindingsView } from "./components/RoleBindingsView"
import { RolesView } from "./components/RolesView"
import { SecretsView } from "./components/SecretsView"
import { ServiceAccountsView } from "./components/ServiceAccountsView"
import { ServicesView } from "./components/ServicesView"
import { StatefulSetsView } from "./components/StatefulSetsView"
import { StorageClassesView } from "./components/StorageClassesView"
import { VolumeSnapshotsView } from "./components/VolumeSnapshotsView"
import type { ResourceType } from "./types/resource"

export const resourceViews: Record<ResourceType, ComponentType> = {
  Namespaces: NamespacesView,
  Nodes: NodesView,
  Deployments: DeploymentsView,
  ReplicaSets: ReplicaSetsView,
  StatefulSets: StatefulSetsView,
  DaemonSets: DaemonSetsView,
  ConfigMaps: ConfigMapsView,
  Secrets: SecretsView,
  Pods: PodsView,
  Services: ServicesView,
  Ingresses: IngressesView,
  NetworkPolicies: NetworkPoliciesView,
  Endpoints: EndpointsView,
  Events: EventsView,
  HPAs: HPAsView,
  ServiceAccounts: ServiceAccountsView,
  Roles: RolesView,
  ClusterRoles: ClusterRolesView,
  RoleBindings: RoleBindingsView,
  ClusterRoleBindings: ClusterRoleBindingsView,
  PersistentVolumes: PVsView,
  PersistentVolumeClaims: PVCsView,
  StorageClasses: StorageClassesView,
  VolumeSnapshots: VolumeSnapshotsView,
  Jobs: JobsView,
  CronJobs: CronJobsView,
  ResourceQuotas: ResourceQuotasView,
  LimitRanges: LimitRangesView,
  PodDisruptionBudgets: PDBsView,
  overview: OverviewView,
  "custom-stream": CustomStreamView,
  history: HistoryView,
  "helm-repositories": HelmRepositoriesView,
  "helm-releases": HelmReleasesView,
  "alarm-rules": AlarmRulesView,
  "alarm-active": AlarmActiveView,
}
