import { useEffect, useState } from 'react'
import { TreeView } from './components/TreeView'
import { NamespacesView } from './components/NamespacesView'
import { NodesView } from './components/NodesView'
import { DeploymentsView } from './components/DeploymentsView'
import { PodsView } from './components/PodsView'
import { useAppStore } from '../store/app.store'

function App(): JSX.Element {
  const [currentContext, setCurrentContext] = useState<string>('')
  const [clusterType, setClusterType] = useState<'EKS' | 'AKS' | 'Local'>('Local')
  const selectedResourceType = useAppStore((s) => s.selectedResourceType)

  useEffect(() => {
    window.api.k8s.getCurrentContext().then(setCurrentContext).catch(console.error)
    window.api.k8s.getClusterType().then(setClusterType).catch(console.error)
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <span className="flex-1 font-semibold">Innfiswindow</span>
        <span className="rounded border px-2 py-0.5 text-xs mr-2">{clusterType}</span>
        {currentContext && (
          <span className="rounded border px-2 py-0.5 text-xs">{currentContext}</span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-60 shrink-0 border-r h-full overflow-y-auto">
          <TreeView />
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {selectedResourceType === 'Namespaces' && <NamespacesView />}
          {selectedResourceType === 'Nodes' && <NodesView />}
          {selectedResourceType === 'Deployments' && <DeploymentsView />}
          {selectedResourceType === 'Pods' && <PodsView />}
        </div>
      </div>
    </div>
  )
}

export default App
