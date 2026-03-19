import { useEffect, useState } from 'react'

function App(): JSX.Element {
  const [currentContext, setCurrentContext] = useState<string>('')

  useEffect(() => {
    window.api.k8s.getCurrentContext().then(setCurrentContext).catch(console.error)
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <span className="flex-1 font-semibold">Innfiswindow</span>
        {currentContext && (
          <span className="rounded border px-2 py-0.5 text-xs">{currentContext}</span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-60 shrink-0 border-r h-full overflow-y-auto" />

        {/* Main content */}
        <div className="flex-1 overflow-auto p-4" />
      </div>
    </div>
  )
}

export default App
