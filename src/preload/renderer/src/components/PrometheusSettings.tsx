import { useEffect, useState } from "react"

import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"

interface PrometheusSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PrometheusSettings({
  open,
  onOpenChange,
}: PrometheusSettingsProps): JSX.Element {
  const [namespace, setNamespace] = useState("monitoring")
  const [service, setService] = useState("prometheus-operated")
  const [port, setPort] = useState("9090")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      window.api
        .getPrometheusConfig()
        .then((cfg) => {
          setNamespace(cfg.namespace)
          setService(cfg.service)
          setPort(String(cfg.port))
        })
        .catch(console.error)
    }
  }, [open])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.api.setPrometheusConfig({
        namespace,
        service,
        port: parseInt(port, 10),
      })
      onOpenChange(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="bg-white">
        <DialogHeader>
          <DialogTitle>Prometheus Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prom-ns">Namespace</Label>
            <Input
              id="prom-ns"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              placeholder="monitoring"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prom-svc">Service</Label>
            <Input
              id="prom-svc"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="prometheus-operated"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prom-port">Port</Label>
            <Input
              id="prom-port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="9090"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
