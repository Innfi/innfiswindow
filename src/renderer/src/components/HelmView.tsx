import { useEffect, useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/AlertDialog"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/Table"
import { useAppStore } from "../../store/app.store"
import { useRecordHistory } from "../hooks/useRecordHistory"

interface HelmRepo {
  name: string
  url: string
}

interface HelmRelease {
  name: string
  namespace: string
  chart: string
  chartVersion: string
  appVersion: string
  status: string
  updated: string
}

// ── Repositories ────────────────────────────────────────────────────────────

export function HelmRepositoriesView(): JSX.Element {
  const [repos, setRepos] = useState<HelmRepo[]>([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [repoName, setRepoName] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const recordHistory = useRecordHistory()

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const data = await window.api.helm.repoList()
      setRepos(data)
    } catch (e) {
      toast.error(`Failed to load helm repos: ${String(e)}`)
      useAppStore.getState().addGlobalError(String(e), "Helm: repo list")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleAdd(): Promise<void> {
    if (!repoName.trim() || !repoUrl.trim()) return
    setSaving(true)
    try {
      const result = await window.api.helm.repoAdd(
        repoName.trim(),
        repoUrl.trim(),
      )
      recordHistory(
        {
          action: "create",
          resourceKind: "HelmRepo",
          resourceName: repoName.trim(),
          namespace: null,
        },
        { success: result.success, error: result.error },
      )
      if (result.success) {
        toast.success(`Repo "${repoName}" added`)
        setAddOpen(false)
        setRepoName("")
        setRepoUrl("")
        void load()
      } else {
        toast.error(result.error ?? "Failed to add repo")
        useAppStore
          .getState()
          .addGlobalError(
            result.error ?? "Failed to add repo",
            "Helm: repo add",
          )
      }
    } catch (e) {
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Helm: repo add")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-lg font-semibold">Helm Repositories</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => void load()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAddOpen(true)}
          >
            Add / Update Repo
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && repos.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No helm repositories configured.
        </p>
      )}

      {repos.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repos.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {r.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.url}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add / Update Helm Repository</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="repo-name" className="text-xs">
                Name
              </Label>
              <Input
                id="repo-name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="bitnami"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="repo-url" className="text-xs">
                URL
              </Label>
              <Input
                id="repo-url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://charts.bitnami.com/bitnami"
                className="h-7 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => void handleAdd()}
              disabled={saving || !repoName.trim() || !repoUrl.trim()}
            >
              {saving ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Releases ─────────────────────────────────────────────────────────────────

export function HelmReleasesView(): JSX.Element {
  const [releases, setReleases] = useState<HelmRelease[]>([])
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const recordHistory = useRecordHistory()

  // Install dialog
  const [installOpen, setInstallOpen] = useState(false)
  const [installName, setInstallName] = useState("")
  const [installChart, setInstallChart] = useState("")
  const [installNs, setInstallNs] = useState("")
  const [installValues, setInstallValues] = useState("")
  const [installing, setInstalling] = useState(false)

  // Upgrade dialog
  const [upgradeTarget, setUpgradeTarget] = useState<HelmRelease | null>(null)
  const [upgradeChart, setUpgradeChart] = useState("")
  const [upgradeValues, setUpgradeValues] = useState("")
  const [upgrading, setUpgrading] = useState(false)

  // Uninstall dialog
  const [uninstallTarget, setUninstallTarget] = useState<HelmRelease | null>(
    null,
  )
  const [uninstalling, setUninstalling] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      const data = await window.api.helm.releaseList()
      setReleases(data)
    } catch (e) {
      toast.error(`Failed to load helm releases: ${String(e)}`)
      useAppStore.getState().addGlobalError(String(e), "Helm: release list")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    window.api.k8s
      .listNamespaces()
      .then((ns) => setNamespaces(ns.map((n) => n.name)))
      .catch(() => {})
  }, [])

  function openUpgrade(release: HelmRelease): void {
    setUpgradeTarget(release)
    setUpgradeChart(release.chart)
    setUpgradeValues("")
  }

  async function handleInstall(): Promise<void> {
    if (!installName.trim() || !installChart.trim() || !installNs.trim()) return
    setInstalling(true)
    try {
      const result = await window.api.helm.releaseInstall({
        releaseName: installName.trim(),
        chart: installChart.trim(),
        namespace: installNs.trim(),
        values: installValues.trim() || undefined,
      })
      recordHistory(
        {
          action: "create",
          resourceKind: "HelmRelease",
          resourceName: installName.trim(),
          namespace: installNs.trim(),
          yamlSnapshot: installValues.trim() || undefined,
        },
        { success: result.success, error: result.error },
      )
      if (result.success) {
        toast.success(`Release "${installName}" installed`)
        setInstallOpen(false)
        setInstallName("")
        setInstallChart("")
        setInstallNs("")
        setInstallValues("")
        void load()
      } else {
        toast.error(result.error ?? "Install failed")
        useAppStore
          .getState()
          .addGlobalError(result.error ?? "Install failed", "Helm: install")
      }
    } catch (e) {
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Helm: install")
    } finally {
      setInstalling(false)
    }
  }

  async function handleUpgrade(): Promise<void> {
    if (!upgradeTarget) return
    setUpgrading(true)
    try {
      const result = await window.api.helm.releaseUpgrade({
        releaseName: upgradeTarget.name,
        chart: upgradeChart.trim() || upgradeTarget.chart,
        namespace: upgradeTarget.namespace,
        values: upgradeValues.trim() || undefined,
      })
      recordHistory(
        {
          action: "update",
          resourceKind: "HelmRelease",
          resourceName: upgradeTarget.name,
          namespace: upgradeTarget.namespace,
          yamlSnapshot: upgradeValues.trim() || undefined,
        },
        { success: result.success, error: result.error },
      )
      if (result.success) {
        toast.success(`Release "${upgradeTarget.name}" upgraded`)
        setUpgradeTarget(null)
        void load()
      } else {
        toast.error(result.error ?? "Upgrade failed")
        useAppStore
          .getState()
          .addGlobalError(result.error ?? "Upgrade failed", "Helm: upgrade")
      }
    } catch (e) {
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Helm: upgrade")
    } finally {
      setUpgrading(false)
    }
  }

  async function handleUninstall(): Promise<void> {
    if (!uninstallTarget) return
    setUninstalling(true)
    try {
      const result = await window.api.helm.releaseUninstall({
        releaseName: uninstallTarget.name,
        namespace: uninstallTarget.namespace,
      })
      recordHistory(
        {
          action: "delete",
          resourceKind: "HelmRelease",
          resourceName: uninstallTarget.name,
          namespace: uninstallTarget.namespace,
        },
        { success: result.success, error: result.error },
      )
      if (result.success) {
        toast.success(`Release "${uninstallTarget.name}" uninstalled`)
        setUninstallTarget(null)
        void load()
      } else {
        toast.error(result.error ?? "Uninstall failed")
        useAppStore
          .getState()
          .addGlobalError(result.error ?? "Uninstall failed", "Helm: uninstall")
      }
    } catch (e) {
      toast.error(String(e))
      useAppStore.getState().addGlobalError(String(e), "Helm: uninstall")
    } finally {
      setUninstalling(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-4">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-lg font-semibold">Helm Releases</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => void load()}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInstallOpen(true)}
          >
            Install Chart
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!loading && releases.length === 0 && (
        <p className="text-sm text-muted-foreground">No helm releases found.</p>
      )}

      {releases.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Name</TableHead>
                  <TableHead className="whitespace-nowrap">Namespace</TableHead>
                  <TableHead className="whitespace-nowrap">Chart</TableHead>
                  <TableHead className="whitespace-nowrap">Version</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Updated</TableHead>
                  <TableHead className="whitespace-nowrap text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.map((r) => (
                  <TableRow key={`${r.namespace}/${r.name}`}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {r.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.namespace}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.chart}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.chartVersion}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          r.status === "deployed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : r.status === "failed"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                      {r.updated}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={() => openUpgrade(r)}
                        >
                          Upgrade
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2 text-destructive hover:text-destructive"
                          onClick={() => setUninstallTarget(r)}
                        >
                          Uninstall
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Install dialog */}
      <Dialog open={installOpen} onOpenChange={setInstallOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Install Helm Chart</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="install-name" className="text-xs">
                Release Name
              </Label>
              <Input
                id="install-name"
                value={installName}
                onChange={(e) => setInstallName(e.target.value)}
                placeholder="my-release"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="install-chart" className="text-xs">
                Chart
              </Label>
              <Input
                id="install-chart"
                value={installChart}
                onChange={(e) => setInstallChart(e.target.value)}
                placeholder="bitnami/nginx"
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="install-ns" className="text-xs">
                Namespace
              </Label>
              {namespaces.length > 0 ? (
                <select
                  id="install-ns"
                  value={installNs}
                  onChange={(e) => setInstallNs(e.target.value)}
                  className="w-full rounded border px-2 py-1 text-xs bg-background text-foreground h-7"
                >
                  <option value="">Select namespace…</option>
                  {namespaces.map((ns) => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="install-ns"
                  value={installNs}
                  onChange={(e) => setInstallNs(e.target.value)}
                  placeholder="default"
                  className="h-7 text-xs"
                />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="install-values" className="text-xs">
                Values YAML (optional)
              </Label>
              <textarea
                id="install-values"
                value={installValues}
                onChange={(e) => setInstallValues(e.target.value)}
                placeholder="replicaCount: 1&#10;service:&#10;  type: ClusterIP"
                rows={6}
                className="w-full rounded border px-2 py-1 text-xs font-mono bg-background text-foreground resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setInstallOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => void handleInstall()}
              disabled={
                installing ||
                !installName.trim() ||
                !installChart.trim() ||
                !installNs.trim()
              }
            >
              {installing ? "Installing…" : "Install"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade dialog */}
      <Dialog
        open={upgradeTarget !== null}
        onOpenChange={(o) => {
          if (!o) setUpgradeTarget(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upgrade Release: {upgradeTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="upgrade-chart" className="text-xs">
                Chart
              </Label>
              <Input
                id="upgrade-chart"
                value={upgradeChart}
                onChange={(e) => setUpgradeChart(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="upgrade-values" className="text-xs">
                Values YAML (optional)
              </Label>
              <textarea
                id="upgrade-values"
                value={upgradeValues}
                onChange={(e) => setUpgradeValues(e.target.value)}
                placeholder="replicaCount: 2"
                rows={6}
                className="w-full rounded border px-2 py-1 text-xs font-mono bg-background text-foreground resize-y"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setUpgradeTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => void handleUpgrade()}
              disabled={upgrading}
            >
              {upgrading ? "Upgrading…" : "Upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uninstall confirmation */}
      <AlertDialog
        open={uninstallTarget !== null}
        onOpenChange={(o) => {
          if (!o) setUninstallTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Uninstall Release</AlertDialogTitle>
            <AlertDialogDescription>
              Uninstall <strong>{uninstallTarget?.name}</strong> from namespace{" "}
              <strong>{uninstallTarget?.namespace}</strong>? This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setUninstallTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => void handleUninstall()}
              disabled={uninstalling}
            >
              {uninstalling ? "Uninstalling…" : "Uninstall"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
