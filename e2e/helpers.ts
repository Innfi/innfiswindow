import { execSync } from "child_process"
import { writeFileSync } from "fs"
import * as os from "os"
import * as path from "path"
import { _electron as electron, ElectronApplication } from "@playwright/test"

export const KIND_CONTEXT = "kind-innfiswindow-test"

export const SKIP_REASON = `kind cluster ${KIND_CONTEXT} is not reachable — run scripts/setup-kind.sh`

const MAIN_JS = path.resolve(__dirname, "../out/main/index.js")

export function isKindClusterAvailable(): boolean {
  try {
    execSync(`kubectl cluster-info --context ${KIND_CONTEXT}`, {
      stdio: "pipe",
      timeout: 5000,
    })
    return true
  } catch {
    return false
  }
}

/** A kubeconfig whose current context is the kind cluster, so the app starts
 *  on it without touching the reader's own kubeconfig. */
export function createTestKubeconfig(): string {
  const tmpPath = path.join(os.tmpdir(), "innfiswindow-e2e-kubeconfig.yaml")
  try {
    writeFileSync(
      tmpPath,
      execSync("kind get kubeconfig --name innfiswindow-test", {
        encoding: "utf8",
        stdio: "pipe",
      }),
    )
  } catch {
    const kubeconfig = execSync("kubectl config view --raw", {
      encoding: "utf8",
      stdio: "pipe",
    })
    writeFileSync(
      tmpPath,
      kubeconfig.replace(
        /^current-context:.*$/m,
        `current-context: ${KIND_CONTEXT}`,
      ),
    )
  }
  return tmpPath
}

/** The built app (`out/`, from `npm run test:e2e`'s build step) against the
 *  kind cluster. */
export function launchApp(): Promise<ElectronApplication> {
  return electron.launch({
    args: [MAIN_JS],
    env: {
      ...process.env,
      KUBECONFIG: createTestKubeconfig(),
      NODE_ENV: "test",
    },
  })
}
