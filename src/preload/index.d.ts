import { ElectronAPI } from '@electron-toolkit/preload'

export interface K8sContext {
  name: string
  cluster: string
  user: string
}

export interface K8sAPI {
  listContexts: () => Promise<K8sContext[]>
  getCurrentContext: () => Promise<string>
}

export interface API {
  k8s: K8sAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
