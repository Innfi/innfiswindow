import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { KubeConfig, CoreV1Api, AppsV1Api } from '@kubernetes/client-node'
import {
  listContexts,
  getCurrentContext,
  getClusterType,
  listNamespaces,
  listNodes,
  listDeployments,
  listReplicaSets,
  listStatefulSets,
  listDaemonSets,
  listPods,
  listConfigMaps,
  listSecrets
} from './k8s-handlers'

const kc = new KubeConfig()
kc.loadFromDefault()

const coreV1Api = kc.makeApiClient(CoreV1Api)
const appsV1Api = kc.makeApiClient(AppsV1Api)

// Export for use in other modules if needed
export { kc, coreV1Api, appsV1Api }

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux'
      ? {
          icon: join(__dirname, '../../build/icon.png')
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('k8s:contexts:list', () => listContexts(kc))
  ipcMain.handle('k8s:context:current', () => getCurrentContext(kc))
  ipcMain.handle('k8s:cluster:type', () => getClusterType(kc))
  ipcMain.handle('k8s:namespaces:list', () => listNamespaces(coreV1Api))
  ipcMain.handle('k8s:deployments:list', () => listDeployments(appsV1Api))
  ipcMain.handle('k8s:replicasets:list', () => listReplicaSets(appsV1Api))
  ipcMain.handle('k8s:pods:list', () => listPods(coreV1Api))
  ipcMain.handle('k8s:daemonsets:list', () => listDaemonSets(appsV1Api))
  ipcMain.handle('k8s:statefulsets:list', () => listStatefulSets(appsV1Api))
  ipcMain.handle('k8s:configmaps:list', () => listConfigMaps(coreV1Api))
  ipcMain.handle('k8s:secrets:list', () => listSecrets(coreV1Api))
  ipcMain.handle('k8s:nodes:list', () => listNodes(coreV1Api))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
