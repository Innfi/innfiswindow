import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  k8s: {
    listContexts: () => ipcRenderer.invoke('k8s:contexts:list'),
    getCurrentContext: () => ipcRenderer.invoke('k8s:context:current'),
    listNamespaces: () => ipcRenderer.invoke('k8s:namespaces:list'),
    listNodes: () => ipcRenderer.invoke('k8s:nodes:list'),
    listDeployments: () => ipcRenderer.invoke('k8s:deployments:list'),
    listReplicaSets: () => ipcRenderer.invoke('k8s:replicasets:list'),
    listStatefulSets: () => ipcRenderer.invoke('k8s:statefulsets:list'),
    listDaemonSets: () => ipcRenderer.invoke('k8s:daemonsets:list'),
    listConfigMaps: () => ipcRenderer.invoke('k8s:configmaps:list'),
    listSecrets: () => ipcRenderer.invoke('k8s:secrets:list'),
    listPods: () => ipcRenderer.invoke('k8s:pods:list'),
    getClusterType: () => ipcRenderer.invoke('k8s:cluster:type'),
    createDeployment: (namespace: string, name: string, image: string, replicas: number) =>
      ipcRenderer.invoke('k8s:deployment:create', namespace, name, image, replicas),
    updateDeployment: (namespace: string, name: string, image: string, replicas: number) =>
      ipcRenderer.invoke('k8s:deployment:update', namespace, name, image, replicas),
    deleteDeployment: (namespace: string, name: string) =>
      ipcRenderer.invoke('k8s:deployment:delete', namespace, name),
    createStatefulSet: (
      namespace: string,
      name: string,
      image: string,
      replicas: number,
      serviceName: string
    ) => ipcRenderer.invoke('k8s:statefulset:create', namespace, name, image, replicas, serviceName),
    updateStatefulSet: (namespace: string, name: string, image: string, replicas: number) =>
      ipcRenderer.invoke('k8s:statefulset:update', namespace, name, image, replicas),
    deleteStatefulSet: (namespace: string, name: string) =>
      ipcRenderer.invoke('k8s:statefulset:delete', namespace, name),
    createDaemonSet: (namespace: string, name: string, image: string) =>
      ipcRenderer.invoke('k8s:daemonset:create', namespace, name, image),
    updateDaemonSet: (namespace: string, name: string, image: string) =>
      ipcRenderer.invoke('k8s:daemonset:update', namespace, name, image),
    deleteDaemonSet: (namespace: string, name: string) =>
      ipcRenderer.invoke('k8s:daemonset:delete', namespace, name)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
