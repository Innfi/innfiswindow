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
    listPods: () => ipcRenderer.invoke('k8s:pods:list'),
    getClusterType: () => ipcRenderer.invoke('k8s:cluster:type')
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
