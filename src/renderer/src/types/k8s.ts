// K8s type definitions for renderer-side view components.
// Aliased onto the canonical shapes in src/shared/k8s.ts (which main's IPC
// handlers also produce) so the two sides can't drift apart.
import type * as Shared from "../../../shared/k8s"

export type K8sContext = Shared.ContextInfo
export type K8sNamespace = Shared.NamespaceInfo
export type K8sNodeCondition = Shared.Condition
export type K8sNode = Shared.NodeInfo
export type K8sNodeAddress = Shared.NodeAddress
export type K8sNodeTaint = Shared.NodeTaint
export type K8sNodeSystemInfo = Shared.NodeSystemInfo
export type K8sDeploymentCondition = Shared.Condition
export type K8sDeploymentContainer = Shared.DetailedContainerInfo
export type K8sDeploymentContainerPort = Shared.ContainerPort
export type K8sEnvVar = Shared.EnvVar
export type K8sProbeInfo = Shared.ProbeInfo
export type K8sVolumeInfo = Shared.VolumeInfo
export type K8sDeploymentSummary = Shared.DeploymentSummary
export type K8sDeployment = Shared.DeploymentInfo
export type K8sReplicaSetContainer = Shared.ContainerInfo
export type K8sOwnerRef = { kind: string; name: string }
export type K8sReplicaSetSummary = Shared.ReplicaSetSummary
export type K8sReplicaSet = Shared.ReplicaSetInfo
export type K8sStatefulSetContainer = Shared.ContainerInfo
export type K8sStatefulSetVolumeClaimTemplate = {
  name: string
  storage: string
}
export type K8sStatefulSetSummary = Shared.StatefulSetSummary
export type K8sStatefulSet = Shared.StatefulSetInfo
export type K8sDaemonSetContainer = Shared.ContainerInfo
export type K8sDaemonSetToleration = {
  key: string
  operator: string
  value: string
  effect: string
}
export type K8sDaemonSetSummary = Shared.DaemonSetSummary
export type K8sDaemonSet = Shared.DaemonSetInfo
export type K8sPodContainer = Shared.PodContainerInfo
export type K8sPodCondition = Shared.Condition
export type K8sPodSummary = Shared.PodSummary
export type K8sPod = Shared.PodInfo
export type K8sContainerMetric = Shared.ContainerMetric
export type K8sPodMetric = Shared.PodMetric
export type K8sServicePort = Shared.ServicePortInfo
export type K8sService = Shared.ServiceInfo
export type K8sIngressTLS = Shared.IngressTLSInfo
export type K8sIngressPath = Shared.IngressPathInfo
export type K8sIngressRule = Shared.IngressRuleInfo
export type K8sNetworkPolicyPeer = Shared.NetworkPolicyPeer
export type K8sNetworkPolicyPort = Shared.NetworkPolicyPortInfo
export type K8sNetworkPolicyRule = Shared.NetworkPolicyRule
export type K8sNetworkPolicySummary = Shared.NetworkPolicySummary
export type K8sNetworkPolicy = Shared.NetworkPolicyInfo
export type K8sIngressSummary = Shared.IngressSummary
export type K8sIngress = Shared.IngressInfo
export type K8sIngressClassParametersRef = Shared.IngressClassParametersRef
export type K8sIngressClass = Shared.IngressClassInfo
export type K8sConfigMapSummary = Shared.ConfigMapSummary
export type K8sConfigMap = Shared.ConfigMapInfo
export type K8sSecretSummary = Shared.SecretSummary
export type K8sSecret = Shared.SecretInfo
export type K8sServiceAccount = Shared.ServiceAccountInfo
export type K8sRoleRule = Shared.RbacRule
export type K8sRoleSummary = Shared.RoleSummary
export type K8sRole = Shared.RoleInfo
export type K8sClusterRoleSummary = Shared.ClusterRoleSummary
export type K8sClusterRole = Shared.ClusterRoleInfo
export type BindingSubject = Shared.RbacSubject
export type RoleRef = Shared.RoleRef
export type K8sRoleBinding = Shared.RoleBindingInfo
export type K8sClusterRoleBinding = Shared.ClusterRoleBindingInfo
export type K8sEvent = Shared.EventInfo
export type K8sHPAMetric = Shared.HPAMetric
export type K8sHPACondition = Shared.Condition
export type K8sHPA = Shared.HPAInfo
export type K8sHPAMetricTargetType = Shared.HPAMetricTargetType
export type K8sHPAResourceMetric = Shared.HPAResourceMetric
export type K8sHPAResourceMetricSpec = Shared.HPAResourceMetricSpec
export type K8sPV = Shared.PVInfo
export type K8sPVC = Shared.PVCInfo
export type K8sJobCondition = Shared.Condition
export type K8sJob = Shared.JobInfo
export type K8sCronJob = Shared.CronJobInfo
export type K8sResourceQuota = Shared.ResourceQuotaInfo
export type K8sLimitRangeItem = Shared.LimitRangeLimit
export type K8sLimitRange = Shared.LimitRangeInfo
export type K8sEndpointAddress = Shared.EndpointAddress
export type K8sEndpointSubset = Shared.EndpointSubset
export type K8sEndpointSummary = Shared.EndpointSummary
export type K8sEndpoint = Shared.EndpointInfo
export type K8sEndpointSlicePort = Shared.EndpointSlicePortInfo
export type K8sEndpointSliceEndpoint = Shared.EndpointSliceEndpoint
export type K8sEndpointSliceSummary = Shared.EndpointSliceSummary
export type K8sEndpointSlice = Shared.EndpointSliceInfo
export type K8sPDB = Shared.PDBInfo
export type K8sStorageClass = Shared.StorageClassInfo
export type K8sVolumeSnapshot = Shared.VolumeSnapshotInfo
export type K8sVolumeSnapshotClass = Shared.VolumeSnapshotClassInfo
export type K8sCRDPrinterColumn = Shared.CRDPrinterColumn
export type K8sCRDVersion = Shared.CRDVersionInfo
export type K8sCRD = Shared.CRDInfo
export type K8sCustomResourceScope = Shared.CustomResourceScope
export type K8sCustomResourceRef = Shared.CustomResourceRef
export type K8sCustomResource = Shared.CustomResourceInfo
export type K8sCustomResourceDetail = Shared.CustomResourceDetail
export type DryRunResult = Shared.DryRunResult
