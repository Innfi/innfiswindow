import { CoreV1Api, CustomObjectsApi, StorageV1Api, V1PersistentVolume } from "@kubernetes/client-node"

import { PVCInfo, PVInfo, PVSourceInfo, StorageClassInfo, VolumeSnapshotInfo } from "./types"

function detectPVSource(pv: V1PersistentVolume): PVSourceInfo {
  const s = pv.spec
  if (!s) return { type: "Unknown", detail: "" }
  if (s.csi) return { type: "CSI", detail: s.csi.driver }
  if (s.nfs) return { type: "NFS", detail: `${s.nfs.server}:${s.nfs.path}` }
  if (s.hostPath) return { type: "HostPath", detail: s.hostPath.path }
  if (s.local) return { type: "Local", detail: s.local.path ?? "" }
  if (s.awsElasticBlockStore)
    return { type: "AWSElasticBlockStore", detail: s.awsElasticBlockStore.volumeID }
  if (s.gcePersistentDisk)
    return { type: "GCEPersistentDisk", detail: s.gcePersistentDisk.pdName }
  if (s.azureDisk)
    return { type: "AzureDisk", detail: s.azureDisk.diskName }
  if (s.azureFile)
    return { type: "AzureFile", detail: s.azureFile.shareName }
  if (s.iscsi)
    return { type: "iSCSI", detail: `${s.iscsi.targetPortal}/${s.iscsi.iqn}` }
  if (s.fc)
    return { type: "FC", detail: (s.fc.targetWWNs ?? []).join(",") }
  if (s.rbd)
    return { type: "RBD", detail: s.rbd.image }
  if (s.glusterfs)
    return { type: "Glusterfs", detail: `${s.glusterfs.endpoints}/${s.glusterfs.path}` }
  if (s.portworxVolume)
    return { type: "Portworx", detail: s.portworxVolume.volumeID }
  if (s.flexVolume)
    return { type: "FlexVolume", detail: s.flexVolume.driver }
  return { type: "Other", detail: "" }
}

export async function listPVs(api: CoreV1Api): Promise<PVInfo[]> {
  const res = await api.listPersistentVolume()
  return res.items.map((pv) => {
    const claimRef = pv.spec?.claimRef
      ? {
          namespace: pv.spec.claimRef.namespace ?? "",
          name: pv.spec.claimRef.name ?? "",
        }
      : null
    return {
      name: pv.metadata?.name ?? "",
      capacity: pv.spec?.capacity?.["storage"] ?? "",
      accessModes: pv.spec?.accessModes ?? [],
      reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy ?? "",
      status: pv.status?.phase ?? "",
      claimRef,
      storageClass: pv.spec?.storageClassName ?? "",
      volumeMode: pv.spec?.volumeMode ?? "",
      creationTimestamp: pv.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: pv.metadata?.labels ?? {},
      annotations: pv.metadata?.annotations ?? {},
      source: detectPVSource(pv),
    }
  })
}

export async function listPVCs(api: CoreV1Api): Promise<PVCInfo[]> {
  const res = await api.listPersistentVolumeClaimForAllNamespaces()
  return res.items.map((pvc) => ({
    name: pvc.metadata?.name ?? "",
    namespace: pvc.metadata?.namespace ?? "",
    status: pvc.status?.phase ?? "",
    volumeName: pvc.spec?.volumeName ?? "",
    capacity: pvc.status?.capacity?.["storage"] ?? "",
    accessModes: pvc.spec?.accessModes ?? [],
    storageClass: pvc.spec?.storageClassName ?? "",
    volumeMode: pvc.spec?.volumeMode ?? "",
    creationTimestamp: pvc.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: pvc.metadata?.labels ?? {},
    annotations: pvc.metadata?.annotations ?? {},
  }))
}

export async function listStorageClasses(api: StorageV1Api): Promise<StorageClassInfo[]> {
  const res = await api.listStorageClass()
  return res.items.map((sc) => ({
    name: sc.metadata?.name ?? "",
    provisioner: sc.provisioner ?? "",
    reclaimPolicy: sc.reclaimPolicy ?? "",
    volumeBindingMode: sc.volumeBindingMode ?? "",
    allowVolumeExpansion: sc.allowVolumeExpansion ?? false,
    parameters: sc.parameters ?? {},
    creationTimestamp: sc.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: sc.metadata?.labels ?? {},
    annotations: sc.metadata?.annotations ?? {},
  }))
}

export async function listVolumeSnapshots(api: CustomObjectsApi): Promise<VolumeSnapshotInfo[]> {
  try {
    const res = await api.listClusterCustomObject({
      group: "snapshot.storage.k8s.io",
      version: "v1",
      plural: "volumesnapshots",
    }) as { items?: unknown[] }
    const items = res.items ?? []
    return items.map((item: unknown) => {
      const snap = item as Record<string, unknown>
      const meta = (snap.metadata ?? {}) as Record<string, unknown>
      const spec = (snap.spec ?? {}) as Record<string, unknown>
      const status = (snap.status ?? {}) as Record<string, unknown>
      const src = (spec.source ?? {}) as Record<string, unknown>
      return {
        name: (meta.name as string) ?? "",
        namespace: (meta.namespace as string) ?? "",
        volumeSnapshotClassName: (spec.volumeSnapshotClassName as string) ?? "",
        sourcePVCName: (src.persistentVolumeClaimName as string) ?? "",
        readyToUse: (status.readyToUse as boolean | null) ?? null,
        restoreSize: (status.restoreSize as string) ?? "",
        creationTimestamp: meta.creationTimestamp
          ? new Date(meta.creationTimestamp as string).toISOString()
          : "",
        labels: (meta.labels as Record<string, string>) ?? {},
        annotations: (meta.annotations as Record<string, string>) ?? {},
      }
    })
  } catch (e: unknown) {
    const err = e as { response?: { statusCode?: number }; statusCode?: number }
    const code = err?.response?.statusCode ?? err?.statusCode
    if (code === 404 || code === 403) return []
    throw e
  }
}
