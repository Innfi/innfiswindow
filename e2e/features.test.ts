import { existsSync, readFileSync, rmSync } from "fs"
import * as os from "os"
import * as path from "path"
import { ElectronApplication, expect, Page, test } from "@playwright/test"

import { isKindClusterAvailable, launchApp, SKIP_REASON } from "./helpers"

// The features whose failure modes only show against a real cluster and the
// real app: the Nodes list, the Overview's triage (namespace scope, snooze),
// and saving a pod log through the main process. Needs the kind cluster from
// scripts/setup-kind.sh, including fixtures/06-broken-pod.yaml.

const kindClusterAvailable = isKindClusterAvailable()

/** The fixture pod that can never pull its image, in test-ns-2. */
const BROKEN_POD = "broken-image"

test.describe("Innfiswindow features", () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    if (!kindClusterAvailable) return
    app = await launchApp()
    page = await app.firstWindow()
    await page.waitForLoadState("domcontentloaded")
    await expect(page.getByText("Innfiswindow", { exact: true })).toBeVisible({
      timeout: 15000,
    })
  })

  test.afterAll(async () => {
    await app?.close()
  })

  test.beforeEach(() => {
    test.skip(!kindClusterAvailable, SKIP_REASON)
  })

  const namespaceSelect = (): ReturnType<Page["locator"]> =>
    page.locator("select").filter({ hasText: "All Namespaces" })

  const openOverview = async (): Promise<void> => {
    await page.getByText("Overview", { exact: true }).first().click()
    await expect(page.getByText("Needs attention")).toBeVisible({
      timeout: 15000,
    })
  }

  const brokenPodAlert = (): ReturnType<Page["getByLabel"]> =>
    page.getByLabel(new RegExp(`^Snooze or dismiss .* on ${BROKEN_POD}$`))

  test("Nodes view lists the kind node and opens its panel", async () => {
    await page.getByText("Nodes", { exact: true }).click()
    const nodeCell = page.getByRole("cell", { name: /control-plane$/ }).first()
    await expect(nodeCell).toBeVisible({ timeout: 20000 })

    await nodeCell.click()
    await expect(page.getByRole("button", { name: "Drain" })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^(Cordon|Uncordon)$/ }),
    ).toBeVisible()
  })

  test("Needs attention flags the pod that cannot pull its image", async () => {
    await namespaceSelect().selectOption("")
    await openOverview()

    // A previous run may have left it snoozed; this test owns that state.
    const hidden = page.getByText(/hidden \(snoozed or dismissed\)/)
    if (await hidden.isVisible()) {
      await hidden.click()
      await page.getByRole("button", { name: "Restore all" }).click()
    }

    // The kubelet needs a moment to fail the first pull.
    await expect(brokenPodAlert()).toBeVisible({ timeout: 60000 })
  })

  test("the triage follows the namespace scope", async () => {
    await openOverview()

    await namespaceSelect().selectOption("test-ns-1")
    await expect(brokenPodAlert()).toHaveCount(0, { timeout: 15000 })

    await namespaceSelect().selectOption("test-ns-2")
    await expect(brokenPodAlert()).toBeVisible({ timeout: 15000 })

    await namespaceSelect().selectOption("")
  })

  test("a snoozed alert hides, and comes back on restore", async () => {
    await openOverview()
    await expect(brokenPodAlert()).toBeVisible({ timeout: 60000 })

    await brokenPodAlert().click()
    await page.getByText("Snooze 1 hour", { exact: true }).click()
    await expect(brokenPodAlert()).toHaveCount(0)

    // Survives a re-read of the cluster.
    await page.getByTitle("Refresh").first().click()
    await expect(brokenPodAlert()).toHaveCount(0)

    await page.getByText(/1 hidden \(snoozed or dismissed\)/).click()
    await expect(page.getByText(/^until /).first()).toBeVisible()
    await page.getByRole("button", { name: "Restore", exact: true }).click()
    await expect(brokenPodAlert()).toBeVisible()
  })

  test("saving a pod log writes the file the save dialog picked", async () => {
    const target = path.join(os.tmpdir(), `innfiswindow-e2e-${Date.now()}.log`)
    // The save dialog is native and cannot be clicked through; answer it from
    // the main process instead, the way a user picking `target` would.
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath,
      })) as typeof dialog.showSaveDialog
    }, target)

    try {
      await namespaceSelect().selectOption("test-ns-1")
      await page.getByText("Pods", { exact: true }).click()
      const podCell = page.getByRole("cell", { name: /^nginx-deploy-/ }).first()
      await expect(podCell).toBeVisible({ timeout: 20000 })
      await podCell.click()
      await page.getByTitle("Logs", { exact: true }).first().click()

      await page.getByTitle(/^Save log to a file/).click()
      await expect(page.getByText(/^Saved .* to /)).toBeVisible({
        timeout: 20000,
      })
      expect(existsSync(target)).toBe(true)
      // nginx's entrypoint logs its startup, so the file is never empty.
      expect(readFileSync(target, "utf8").length).toBeGreaterThan(0)
    } finally {
      rmSync(target, { force: true })
      await namespaceSelect().selectOption("")
    }
  })
})
