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

// The Content-Security-Policy in src/main/index.ts is only as good as the
// surfaces it has been run against: Monaco loads its editor from a worker, and
// xterm writes styles into the document. Both are the kind of thing a policy
// silently breaks. This drives them and fails on any violation.

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

function createTestKubeconfig(): string {
  const tmpPath = join(os.tmpdir(), "innfiswindow-e2e-kubeconfig.yaml")
  try {
    const kubeconfig = execSync(
      "kind get kubeconfig --name innfiswindow-test",
      { encoding: "utf8", stdio: "pipe" },
    )
    writeFileSync(tmpPath, kubeconfig)
    return tmpPath
  } catch {
    const kubeconfig = execSync("kubectl config view --raw", {
      encoding: "utf8",
      stdio: "pipe",
    })
    writeFileSync(
      tmpPath,
      kubeconfig.replace(
        /^current-context:.*$/m,
        "current-context: kind-innfiswindow-test",
      ),
    )
    return tmpPath
  }
}

const kindClusterAvailable = isKindClusterAvailable()
const MAIN_JS = path.resolve(__dirname, "../out/main/index.js")

declare global {
  interface Window {
    __cspViolations?: string[]
  }
}

test.describe("Content-Security-Policy", () => {
  let electronApp: ElectronApplication
  let page: Page
  /** Chromium logs every refusal to the console, which catches violations from
   *  contexts the in-page listener doesn't see (workers, for one). */
  const consoleRefusals: string[] = []

  test.beforeAll(async () => {
    if (!kindClusterAvailable) return

    electronApp = await electron.launch({
      args: [MAIN_JS],
      env: {
        ...process.env,
        KUBECONFIG: createTestKubeconfig(),
        NODE_ENV: "test",
      },
    })

    page = await electronApp.firstWindow()
    page.on("console", (msg) => {
      const text = msg.text()
      if (/Content Security Policy|Refused to/i.test(text)) {
        consoleRefusals.push(text)
      }
    })

    // Reload after installing the listener so the app's own startup is covered
    // too, not just what happens once the test starts clicking.
    await page.addInitScript(() => {
      window.__cspViolations = []
      document.addEventListener("securitypolicyviolation", (e) => {
        window.__cspViolations?.push(
          `${e.violatedDirective} blocked ${e.blockedURI || "inline"}`,
        )
      })
    })
    await page.reload()
    await page.waitForLoadState("domcontentloaded")
  })

  test.afterAll(async () => {
    if (electronApp) await electronApp.close()
  })

  async function violations(): Promise<string[]> {
    const inPage = await page.evaluate(() => window.__cspViolations ?? [])
    return [...inPage, ...consoleRefusals]
  }

  /** The sidebar and the view heading both render the resource name, so tree
   *  clicks have to be scoped to the tree. */
  function treeItem(label: string) {
    return page.locator("div.w-60").getByText(label, { exact: true })
  }

  test("app starts clean under the policy", async () => {
    test.skip(!kindClusterAvailable, "kind cluster is not reachable")

    await expect(page.getByText("Innfiswindow", { exact: true })).toBeVisible({
      timeout: 20000,
    })
    expect(await violations()).toEqual([])
  })

  test("Monaco YAML editor loads its worker without a violation", async () => {
    test.skip(!kindClusterAvailable, "kind cluster is not reachable")

    await treeItem("Deployments").click()
    const nginx = page
      .getByRole("cell", { name: "nginx-deploy", exact: true })
      .first()
    await expect(nginx).toBeVisible({ timeout: 20000 })
    await nginx.click()

    // `exact` matters: the app bar's "Edit context alias" button would match a
    // substring search and open the wrong thing.
    await page
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click()

    // Monaco is lazy-loaded and ~6 MB, so give it room.
    await expect(page.locator(".monaco-editor").first()).toBeVisible({
      timeout: 30000,
    })
    expect(await violations()).toEqual([])
  })

  test("pod logs and shell panels open without a violation", async () => {
    test.skip(!kindClusterAvailable, "kind cluster is not reachable")

    await treeItem("Pods").click()
    const pod = page.getByRole("cell", { name: /^nginx-deploy-/ }).first()
    await expect(pod).toBeVisible({ timeout: 20000 })
    await pod.click()

    await page.getByTitle("Logs").first().click()
    await page.getByTitle("Shell").first().click()

    // xterm renders into a .xterm container once the stream is attached.
    await expect(page.locator(".xterm").first()).toBeVisible({
      timeout: 30000,
    })
    expect(await violations()).toEqual([])
  })
})
