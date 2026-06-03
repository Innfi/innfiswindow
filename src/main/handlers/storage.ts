import { CoreV1Api } from "@kubernetes/client-node"

import { PVCInfo, PVInfo } from "./types"

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
    creationTimestamp: pvc.metadata?.creationTimestamp?.toISOString() ?? "",
    labels: pvc.metadata?.labels ?? {},
    annotations: pvc.metadata?.annotations ?? {},
  }))
}
