import { useEffect, useState } from "react"

import type { AwsInventoryConfigState } from "../../../shared/aws"
import { Button } from "../../components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog"
import { Input } from "../../components/ui/Input"
import { Label } from "../../components/ui/Label"
import { normalizeIpcError } from "../../lib/ipc-error"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
}: SettingsDialogProps): JSX.Element {
  const [namespace, setNamespace] = useState("monitoring")
  const [service, setService] = useState("prometheus-operated")
  const [port, setPort] = useState("9090")
  const [saving, setSaving] = useState(false)
  const [awsConfig, setAwsConfig] = useState<AwsInventoryConfigState | null>(
    null,
  )
  // Write-only: main never sends the stored URL back, so this starts empty.
  const [databaseUrl, setDatabaseUrl] = useState("")
  const [clearDatabaseUrl, setClearDatabaseUrl] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDatabaseUrl("")
      setClearDatabaseUrl(false)
      setError(null)
      window.api.getAwsConfig().then(setAwsConfig).catch(console.error)
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
    setError(null)
    try {
      await window.api.setPrometheusConfig({
        namespace,
        service,
        port: parseInt(port, 10),
      })
      const url = databaseUrl.trim()
      if (url || clearDatabaseUrl) {
        setAwsConfig(await window.api.setAwsConfig({ databaseUrl: url }))
        setDatabaseUrl("")
        setClearDatabaseUrl(false)
      }
      onOpenChange(false)
    } catch (e) {
      console.error(e)
      setError(normalizeIpcError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="bg-white">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Prometheus</h3>
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
          <h3 className="pt-2 text-sm font-semibold">AWS inventory</h3>
          <div className="space-y-1.5">
            <Label htmlFor="aws-db-url">Database URL</Label>
            <Input
              id="aws-db-url"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={databaseUrl}
              onChange={(e) => {
                setDatabaseUrl(e.target.value)
                setClearDatabaseUrl(false)
              }}
              disabled={awsConfig?.encryptionAvailable === false}
              placeholder={
                awsConfig?.hasDatabaseUrl && !clearDatabaseUrl
                  ? "Leave blank to keep the current URL"
                  : "postgres://user:password@host:5432/db"
              }
            />
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span data-testid="aws-db-url-status">
                {awsDatabaseUrlStatus(awsConfig, clearDatabaseUrl)}
              </span>
              {awsConfig?.source === "stored" && !clearDatabaseUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setDatabaseUrl("")
                    setClearDatabaseUrl(true)
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
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

function awsDatabaseUrlStatus(
  config: AwsInventoryConfigState | null,
  clearing: boolean,
): string {
  if (!config) return ""
  if (!config.encryptionAvailable) {
    return config.source === "env"
      ? "Using DATABASE_URL from the environment. Secure storage is unavailable, so it cannot be changed here."
      : "Secure storage is unavailable. Set DATABASE_URL in the environment instead."
  }
  if (clearing) return "Stored URL will be removed on save."
  if (config.source === "stored") return "Stored encrypted."
  if (config.source === "env") return "Using DATABASE_URL from the environment."
  return "Not set."
}
