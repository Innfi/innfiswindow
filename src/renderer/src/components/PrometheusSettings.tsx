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
  const [url, setUrl] = useState("")
  const [token, setToken] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      window.api
        .getPrometheusConfig()
        .then((cfg) => {
          setUrl(cfg.prometheusUrl)
          setToken(cfg.prometheusToken)
        })
        .catch(console.error)
    }
  }, [open])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.api.setPrometheusConfig({
        prometheusUrl: url,
        prometheusToken: token,
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
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Prometheus Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prom-url">Prometheus URL</Label>
            <Input
              id="prom-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://prometheus:9090"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prom-token">Bearer Token (optional)</Label>
            <Input
              id="prom-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="eyJhbGci..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
