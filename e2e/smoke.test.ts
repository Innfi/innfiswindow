import { execSync } from "child_process"
import { writeFileSync } from "fs"
import * as os from "os"
import * as path from "path"
import { join } from "path"
import {
  _electron as electron,
  ElectronApplication,
  expect,
  Page,
  test,
} from "@playwright/test"

// ---------------------------------------------------------------------------
// Kind cluster availability check
// ---------------------------------------------------------------------------

function isKindClusterAvailable(): boolean {
  try {
    execSync("kubectl cluster-info --context kind-innfiswindow-test", {
      stdio: "pipe",
      timeout: 5000,
    })
    return true
  } catch {
    return false
  }
}

/**
 * Create a temporary kubeconfig that has kind-innfiswindow-test as the
 * current context. Tries `kind get kubeconfig` first, falls back to
 * rewriting the current-context field in the default kubeconfig.
 */
function createTestKubeconfig(): string {
  const tmpPath = join(os.tmpdir(), "innfiswindow-e2e-kubeconfig.yaml")

  try {
    const kubeconfig = execSync(
      "kind get kubeconfig --name innfiswindow-test",
      {
        encoding: "utf8",
        stdio: "pipe",
      },
    )
    writeFileSync(tmpPath, kubeconfig)
    return tmpPath
  } catch {
    // Fallback: patch the existing kubeconfig's current-context
    const kubeconfig = execSync("kubectl config view --raw", {
      encoding: "utf8",
      stdio: "pipe",
    })
    const patched = kubeconfig.replace(
      /^current-context:.*$/m,
      "current-context: kind-innfiswindow-test",
    )
    writeFileSync(tmpPath, patched)
    return tmpPath
  }
}

// Evaluate cluster availability once at module load time so tests can skip early.
const kindClusterAvailable = isKindClusterAvailable()

const MAIN_JS = path.resolve(__dirname, "../out/main/index.js")

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Innfiswindow smoke tests", () => {
  let electronApp: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    if (!kindClusterAvailable) return // individual tests will skip via test.skip()

    const kubeconfigPath = createTestKubeconfig()

    electronApp = await electron.launch({
      args: [MAIN_JS],
      env: {
        ...process.env,
        KUBECONFIG: kubeconfigPath,
        NODE_ENV: "test",
      },
    })

    page = await electronApp.firstWindow()
    await page.waitForLoadState("domcontentloaded")
  })

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close()
    }
  })

  // -------------------------------------------------------------------------
  // 1. App launch — top bar title
  // -------------------------------------------------------------------------
  test("app loads and shows Innfiswindow title", async () => {
    test.skip(
      !kindClusterAvailable,
      "kind cluster kind-innfiswindow-test is not reachable",
    )

    await expect(page.getByText("Innfiswindow", { exact: true })).toBeVisible({
      timeout: 15000,
    })
  })

  // -------------------------------------------------------------------------
  // 2. Context badge contains 'innfiswindow-test'
  // -------------------------------------------------------------------------
  test("top bar shows context badge containing innfiswindow-test", async () => {
    test.skip(
      !kindClusterAvailable,
      "kind cluster kind-innfiswindow-test is not reachable",
    )

    // The context badge is a <span> rendered from currentContext state.
    // Wait for the IPC call to resolve and the badge to appear.
    await expect(
      page.locator("span").filter({ hasText: /innfiswindow-test/ }),
    ).toBeVisible({ timeout: 20000 })
  })

  // -------------------------------------------------------------------------
  // 3. Namespaces view contains test-ns-1
  // -------------------------------------------------------------------------
  test("Namespaces view shows test-ns-1", async () => {
    test.skip(
      !kindClusterAvailable,
      "kind cluster kind-innfiswindow-test is not reachable",
    )

    await page.getByText("Namespaces", { exact: true }).click()

    // Wait for the table to populate with data from the kind cluster
    await expect(
      page.getByRole("cell", { name: "test-ns-1", exact: true }),
    ).toBeVisible({ timeout: 20000 })
  })

  // -------------------------------------------------------------------------
  // 4. Deployments view contains nginx-deploy
  // -------------------------------------------------------------------------
  test("Deployments view shows nginx-deploy row", async () => {
    test.skip(
      !kindClusterAvailable,
      "kind cluster kind-innfiswindow-test is not reachable",
    )

    await page.getByText("Deployments", { exact: true }).click()

    await expect(
      page.getByRole("cell", { name: "nginx-deploy", exact: true }).first(),
    ).toBeVisible({ timeout: 20000 })
  })

  // -------------------------------------------------------------------------
  // 5. Clicking nginx-deploy row opens detail panel with container image
  // -------------------------------------------------------------------------
  test("clicking nginx-deploy row opens detail panel with container image", async () => {
    test.skip(
      !kindClusterAvailable,
      "kind cluster kind-innfiswindow-test is not reachable",
    )

    // Ensure we are on the Deployments view
    await page.getByText("Deployments", { exact: true }).click()

    const nginxCell = page
      .getByRole("cell", { name: "nginx-deploy", exact: true })
      .first()
    await expect(nginxCell).toBeVisible({ timeout: 20000 })

    // Click the row — the click bubbles up from the cell to the <tr> onClick handler
    await nginxCell.click()

    // The detail panel (w-80 border-l) should appear with the container image text
    const detailPanel = page
      .locator('.w-80.border-l, [class*="w-80"][class*="border-l"]')
      .first()
    await expect(detailPanel).toBeVisible({ timeout: 10000 })

    // The panel should display the container image: nginx:alpine
    await expect(detailPanel.getByText("nginx:alpine")).toBeVisible({
      timeout: 10000,
    })
  })
})
