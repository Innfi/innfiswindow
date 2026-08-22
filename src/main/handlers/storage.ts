import {
  CoreV1Api,
  CustomObjectsApi,
  PatchStrategy,
  setHeaderOptions,
  StorageV1Api,
  V1PersistentVolume,
} from "@kubernetes/client-node"

import { parseStorageQuantity } from "../../shared/quantity"
import {
  Condition,
  MutationResult,
  PVCInfo,
  PVInfo,
  PVSourceInfo,
  StorageClassInfo,
  VolumeSnapshotInfo,
} from "./types"

/** The generated client defaults patch requests to JSON Patch, which rejects
 *  the object-shaped bodies used here; every patch below is a merge. */
const MERGE_PATCH = setHeaderOptions(
  "Content-Type",
  PatchStrategy.StrategicMergePatch,
)

function detectPVSource(pv: V1PersistentVolume): PVSourceInfo {
  const s = pv.spec
  if (!s) return { type: "Unknown", detail: "" }
  if (s.csi) return { type: "CSI", detail: s.csi.driver }
  if (s.nfs) return { type: "NFS", detail: `${s.nfs.server}:${s.nfs.path}` }
  if (s.hostPath) return { type: "HostPath", detail: s.hostPath.path }
  if (s.local) return { type: "Local", detail: s.local.path ?? "" }
  if (s.awsElasticBlockStore)
    return {
      type: "AWSElasticBlockStore",
      detail: s.awsElasticBlockStore.volumeID,
    }
  if (s.gcePersistentDisk)
    return { type: "GCEPersistentDisk", detail: s.gcePersistentDisk.pdName }
  if (s.azureDisk) return { type: "AzureDisk", detail: s.azureDisk.diskName }
  if (s.azureFile) return { type: "AzureFile", detail: s.azureFile.shareName }
  if (s.iscsi)
    return { type: "iSCSI", detail: `${s.iscsi.targetPortal}/${s.iscsi.iqn}` }
  if (s.fc) return { type: "FC", detail: (s.fc.targetWWNs ?? []).join(",") }
  if (s.rbd) return { type: "RBD", detail: s.rbd.image }
  if (s.glusterfs)
    return {
      type: "Glusterfs",
      detail: `${s.glusterfs.endpoints}/${s.glusterfs.path}`,
    }
  if (s.portworxVolume)
    return { type: "Portworx", detail: s.portworxVolume.volumeID }
  if (s.flexVolume) return { type: "FlexVolume", detail: s.flexVolume.driver }
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

/** Which StorageClasses allow expansion, keyed by name. Read once per list so
 *  every claim can say up front whether resizing it is even possible. A
 *  cluster that refuses the read (no RBAC on storage.k8s.io) yields an empty
 *  map, and the claims report `null` rather than a wrong `false`. */
async function storageClassExpansion(
  storageApi: StorageV1Api,
): Promise<Map<string, boolean>> {
  try {
    const res = await storageApi.listStorageClass()
    return new Map(
      res.items.map((sc) => [
        sc.metadata?.name ?? "",
        sc.allowVolumeExpansion ?? false,
      ]),
    )
  } catch {
    return new Map()
  }
}

export async function listPVCs(
  api: CoreV1Api,
  namespace?: string,
  storageApi?: StorageV1Api,
): Promise<PVCInfo[]> {
  const res = namespace
    ? await api.listNamespacedPersistentVolumeClaim({ namespace })
    : await api.listPersistentVolumeClaimForAllNamespaces()
  const expansion = storageApi
    ? await storageClassExpansion(storageApi)
    : new Map<string, boolean>()
  return res.items.map((pvc) => {
    const storageClass = pvc.spec?.storageClassName ?? ""
    const conditions: Condition[] = (pvc.status?.conditions ?? []).map((c) => ({
      type: c.type ?? "",
      status: c.status ?? "",
      reason: c.reason ?? "",
      message: c.message ?? "",
    }))
    return {
      name: pvc.metadata?.name ?? "",
      namespace: pvc.metadata?.namespace ?? "",
      status: pvc.status?.phase ?? "",
      volumeName: pvc.spec?.volumeName ?? "",
      capacity: pvc.status?.capacity?.["storage"] ?? "",
      requestedStorage: pvc.spec?.resources?.requests?.["storage"] ?? "",
      accessModes: pvc.spec?.accessModes ?? [],
      storageClass,
      volumeMode: pvc.spec?.volumeMode ?? "",
      allowVolumeExpansion: expansion.get(storageClass) ?? null,
      conditions,
      creationTimestamp: pvc.metadata?.creationTimestamp?.toISOString() ?? "",
      labels: pvc.metadata?.labels ?? {},
      annotations: pvc.metadata?.annotations ?? {},
    }
  })
}

export async function listStorageClasses(
  api: StorageV1Api,
): Promise<StorageClassInfo[]> {
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

export async function listVolumeSnapshots(
  api: CustomObjectsApi,
  namespace?: string,
): Promise<VolumeSnapshotInfo[]> {
  const gvr = {
    group: "snapshot.storage.k8s.io",
    version: "v1",
    plural: "volumesnapshots",
  }
  try {
    const res = (
      namespace
        ? await api.listNamespacedCustomObject({ ...gvr, namespace })
        : await api.listClusterCustomObject(gvr)
    ) as { items?: unknown[] }
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

/** Grow a PVC by raising `spec.resources.requests.storage`, the same edit
 *  `kubectl patch pvc` makes.
 *
 *  Two things are checked before the patch, because the API server's own
 *  rejections for them are terse: the StorageClass has to set
 *  `allowVolumeExpansion`, and the new size has to be larger — Kubernetes
 *  never shrinks a bound volume. The resize itself is asynchronous: the
 *  request returns as soon as the spec is updated, and the claim reports
 *  progress through its `Resizing` / `FileSystemResizePending` conditions
 *  until `status.capacity` catches up. A claim whose pods are running may
 *  need them restarted for a filesystem resize to finish. */
export async function expandPVC(
  api: CoreV1Api,
  storageApi: StorageV1Api,
  namespace: string,
  name: string,
  storage: string,
): Promise<MutationResult> {
  const target = parseStorageQuantity(storage)
  if (target === null || target <= 0) {
    throw new Error(
      `"${storage}" is not a valid storage quantity — use a value like 20Gi or 500M.`,
    )
  }

  const pvc = await api.readNamespacedPersistentVolumeClaim({ name, namespace })
  const current = pvc.spec?.resources?.requests?.["storage"] ?? ""
  const currentBytes = parseStorageQuantity(current)
  if (currentBytes !== null && target < currentBytes) {
    throw new Error(
      `Cannot shrink ${namespace}/${name} from ${current} to ${storage} — Kubernetes only supports growing a PersistentVolumeClaim.`,
    )
  }

  const storageClass = pvc.spec?.storageClassName ?? ""
  if (storageClass) {
    const expansion = await storageClassExpansion(storageApi)
    if (expansion.get(storageClass) === false) {
      throw new Error(
        `StorageClass "${storageClass}" does not allow volume expansion, so ${namespace}/${name} cannot be resized.`,
      )
    }
  }

  await api.patchNamespacedPersistentVolumeClaim(
    {
      name,
      namespace,
      body: { spec: { resources: { requests: { storage } } } },
    },
    MERGE_PATCH,
  )
  return { success: true, name, namespace }
}
