import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { KubeConfig, CoreV1Api, AppsV1Api } from '@kubernetes/client-node'

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

  ipcMain.handle('k8s:contexts:list', () => {
    return kc.getContexts().map((ctx) => ({ name: ctx.name, cluster: ctx.cluster, user: ctx.user }))
  })

  ipcMain.handle('k8s:context:current', () => {
    return kc.getCurrentContext()
  })

  ipcMain.handle('k8s:cluster:type', () => {
    const cluster = kc.getCurrentCluster()
    const user = kc.getCurrentUser()
    const server = cluster?.server ?? ''
    const execCommand = user?.exec?.command ?? ''
    if (server.includes('eks.amazonaws.com') || execCommand === 'aws') return 'EKS'
    if (server.includes('azmk8s.io') || execCommand === 'az') return 'AKS'
    return 'Local'
  })

  ipcMain.handle('k8s:namespaces:list', async () => {
    const res = await coreV1Api.listNamespace()
    return res.items.map((ns) => ({
      name: ns.metadata?.name ?? '',
      status: ns.status?.phase ?? '',
      creationTimestamp: ns.metadata?.creationTimestamp?.toISOString() ?? '',
      labels: ns.metadata?.labels ?? {},
      annotations: ns.metadata?.annotations ?? {}
    }))
  })

  ipcMain.handle('k8s:deployments:list', async () => {
    const res = await appsV1Api.listDeploymentForAllNamespaces()
    return res.items.map((d) => ({
      name: d.metadata?.name ?? '',
      namespace: d.metadata?.namespace ?? '',
      replicas: d.spec?.replicas ?? 0,
      readyReplicas: d.status?.readyReplicas ?? 0,
      updatedReplicas: d.status?.updatedReplicas ?? 0,
      availableReplicas: d.status?.availableReplicas ?? 0,
      strategy: d.spec?.strategy?.type ?? '',
      creationTimestamp: d.metadata?.creationTimestamp?.toISOString() ?? '',
      selector: d.spec?.selector?.matchLabels ?? {},
      containers: (d.spec?.template?.spec?.containers ?? []).map((c) => ({
        name: c.name,
        image: c.image ?? ''
      })),
      conditions: (d.status?.conditions ?? []).map((c) => ({
        type: c.type,
        status: c.status,
        reason: c.reason ?? '',
        message: c.message ?? ''
      }))
    }))
  })

  ipcMain.handle('k8s:replicasets:list', async () => {
    const res = await appsV1Api.listReplicaSetForAllNamespaces()
    return res.items.map((rs) => ({
      name: rs.metadata?.name ?? '',
      namespace: rs.metadata?.namespace ?? '',
      desiredReplicas: rs.spec?.replicas ?? 0,
      currentReplicas: rs.status?.replicas ?? 0,
      readyReplicas: rs.status?.readyReplicas ?? 0,
      creationTimestamp: rs.metadata?.creationTimestamp?.toISOString() ?? '',
      selector: rs.spec?.selector?.matchLabels ?? {},
      containers: (rs.spec?.template?.spec?.containers ?? []).map((c) => ({
        name: c.name,
        image: c.image ?? ''
      })),
      ownerReferences: (rs.metadata?.ownerReferences ?? []).map((o) => ({
        kind: o.kind,
        name: o.name
      })),
      podTemplateLabels: rs.spec?.template?.metadata?.labels ?? {}
    }))
  })

  ipcMain.handle('k8s:pods:list', async () => {
    const res = await coreV1Api.listPodForAllNamespaces()
    return res.items.map((pod) => {
      const ownerRef = (pod.metadata?.ownerReferences ?? []).find((r) => r.kind === 'ReplicaSet')
      const deploymentName = ownerRef ? ownerRef.name.replace(/-[a-z0-9]+$/, '') : ''
      const restarts = (pod.status?.containerStatuses ?? []).reduce(
        (sum, cs) => sum + (cs.restartCount ?? 0),
        0
      )
      return {
        name: pod.metadata?.name ?? '',
        namespace: pod.metadata?.namespace ?? '',
        deployment: deploymentName,
        app: pod.metadata?.labels?.['app'] ?? '',
        status: pod.status?.phase ?? '',
        restarts,
        creationTimestamp: pod.metadata?.creationTimestamp?.toISOString() ?? '',
        nodeName: pod.spec?.nodeName ?? '',
        containers: (pod.spec?.containers ?? []).map((c) => ({
          name: c.name,
          image: c.image ?? '',
          restartCount:
            (pod.status?.containerStatuses ?? []).find((cs) => cs.name === c.name)
              ?.restartCount ?? 0
        })),
        conditions: (pod.status?.conditions ?? []).map((c) => ({
          type: c.type,
          status: c.status,
          reason: c.reason ?? '',
          message: c.message ?? ''
        }))
      }
    })
  })

  ipcMain.handle('k8s:daemonsets:list', async () => {
    const res = await appsV1Api.listDaemonSetForAllNamespaces()
    return res.items.map((ds) => ({
      name: ds.metadata?.name ?? '',
      namespace: ds.metadata?.namespace ?? '',
      desiredNumberScheduled: ds.status?.desiredNumberScheduled ?? 0,
      currentNumberScheduled: ds.status?.currentNumberScheduled ?? 0,
      numberReady: ds.status?.numberReady ?? 0,
      updatedNumberScheduled: ds.status?.updatedNumberScheduled ?? 0,
      numberAvailable: ds.status?.numberAvailable ?? 0,
      creationTimestamp: ds.metadata?.creationTimestamp?.toISOString() ?? '',
      updateStrategy: ds.spec?.updateStrategy?.type ?? '',
      selector: ds.spec?.selector?.matchLabels ?? {},
      nodeSelector: ds.spec?.template?.spec?.nodeSelector ?? {},
      containers: (ds.spec?.template?.spec?.containers ?? []).map((c) => ({
        name: c.name,
        image: c.image ?? ''
      })),
      tolerations: (ds.spec?.template?.spec?.tolerations ?? []).map((t) => ({
        key: t.key ?? '',
        operator: t.operator ?? '',
        value: t.value ?? '',
        effect: t.effect ?? ''
      }))
    }))
  })

  ipcMain.handle('k8s:statefulsets:list', async () => {
    const res = await appsV1Api.listStatefulSetForAllNamespaces()
    return res.items.map((ss) => ({
      name: ss.metadata?.name ?? '',
      namespace: ss.metadata?.namespace ?? '',
      replicas: ss.spec?.replicas ?? 0,
      readyReplicas: ss.status?.readyReplicas ?? 0,
      creationTimestamp: ss.metadata?.creationTimestamp?.toISOString() ?? '',
      serviceName: ss.spec?.serviceName ?? '',
      updateStrategy: ss.spec?.updateStrategy?.type ?? '',
      selector: ss.spec?.selector?.matchLabels ?? {},
      containers: (ss.spec?.template?.spec?.containers ?? []).map((c) => ({
        name: c.name,
        image: c.image ?? ''
      })),
      volumeClaimTemplates: (ss.spec?.volumeClaimTemplates ?? []).map((vct) => ({
        name: vct.metadata?.name ?? '',
        storage: vct.spec?.resources?.requests?.['storage'] ?? ''
      }))
    }))
  })

  ipcMain.handle('k8s:configmaps:list', async () => {
    const res = await coreV1Api.listConfigMapForAllNamespaces()
    return res.items.map((cm) => {
      const dataKeys = Object.keys(cm.data ?? {})
      const binaryDataKeys = Object.keys(cm.binaryData ?? {})
      return {
        name: cm.metadata?.name ?? '',
        namespace: cm.metadata?.namespace ?? '',
        creationTimestamp: cm.metadata?.creationTimestamp?.toISOString() ?? '',
        labels: cm.metadata?.labels ?? {},
        annotations: cm.metadata?.annotations ?? {},
        data: cm.data ?? {},
        binaryData: Object.fromEntries(
          Object.entries(cm.binaryData ?? {}).map(([k, v]) => [k, v ? v.length : 0])
        ),
        keys: [...dataKeys, ...binaryDataKeys]
      }
    })
  })

  ipcMain.handle('k8s:secrets:list', async () => {
    const res = await coreV1Api.listSecretForAllNamespaces()
    return res.items.map((secret) => {
      const dataKeys = Object.keys(secret.data ?? {})
      return {
        name: secret.metadata?.name ?? '',
        namespace: secret.metadata?.namespace ?? '',
        type: secret.type ?? 'Opaque',
        creationTimestamp: secret.metadata?.creationTimestamp?.toISOString() ?? '',
        labels: secret.metadata?.labels ?? {},
        annotations: secret.metadata?.annotations ?? {},
        data: secret.data ?? {},
        keys: dataKeys
      }
    })
  })

  ipcMain.handle('k8s:nodes:list', async () => {
    const res = await coreV1Api.listNode()
    return res.items.map((node) => {
      const labels = node.metadata?.labels ?? {}
      const roles = Object.keys(labels)
        .filter((k) => k.startsWith('node-role.kubernetes.io/'))
        .map((k) => k.replace('node-role.kubernetes.io/', ''))
      const readyCondition = node.status?.conditions?.find((c) => c.type === 'Ready')
      const status = readyCondition?.status === 'True' ? 'Ready' : 'NotReady'
      return {
        name: node.metadata?.name ?? '',
        status,
        roles: roles.length > 0 ? roles.join(',') : '<none>',
        creationTimestamp: node.metadata?.creationTimestamp?.toISOString() ?? '',
        version: node.status?.nodeInfo?.kubeletVersion ?? '',
        labels,
        capacity: node.status?.capacity ?? {},
        allocatable: node.status?.allocatable ?? {},
        conditions: (node.status?.conditions ?? []).map((c) => ({
          type: c.type,
          status: c.status,
          reason: c.reason ?? '',
          message: c.message ?? ''
        }))
      }
    })
  })

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
