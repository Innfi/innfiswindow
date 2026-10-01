import { spawn } from "child_process"
import { KubeConfig, User } from "@kubernetes/client-node"

/** Treat an exec credential as expired this long before the plugin says it
 *  is. `aws eks get-token` presigns with the current AWS session credentials,
 *  and the token dies with them — with `aws login` that can be well before the
 *  token's own `expirationTimestamp`. */
const EXPIRY_SKEW_MS = 2 * 60 * 1000

interface ExecCredential {
  status?: {
    token?: string
    clientCertificateData?: string
    clientKeyData?: string
    expirationTimestamp?: string
  }
}

interface AuthOptions {
  headers?: Record<string, unknown>
  cert?: unknown
  key?: unknown
}

interface ExecConfig {
  command?: string
  args?: string[]
  env?: { name: string; value: string }[]
}

function execConfigOf(user: User): ExecConfig | null {
  return (user.exec ??
    user.authProvider?.config?.exec ??
    null) as ExecConfig | null
}

function runPlugin(exec: ExecConfig): Promise<ExecCredential> {
  const { command } = exec
  if (!command) {
    return Promise.reject(
      new Error("No command was specified for exec authProvider!"),
    )
  }
  const env = exec.env
    ? {
        ...process.env,
        ...Object.fromEntries(exec.env.map((e) => [e.name, e.value])),
      }
    : undefined
  return new Promise((resolve, reject) => {
    let stdout = ""
    let stderr = ""
    let spawnError: Error | undefined
    const child = spawn(command, exec.args ?? [], env ? { env } : {})
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (d: string) => (stdout += d))
    child.stderr.on("data", (d: string) => (stderr += d))
    child.on("error", (err) => (spawnError = err))
    child.on("close", (code) => {
      if (spawnError) return reject(spawnError)
      if (code !== 0) return reject(new Error(stderr))
      try {
        resolve(JSON.parse(stdout) as ExecCredential)
      } catch (err) {
        reject(err)
      }
    })
  })
}

/**
 * Drop-in replacement for client-node's built-in `ExecAuth` that refreshes
 * early, runs the plugin once per user even under concurrent requests, and can
 * be cleared on demand (after a 401).
 */
class RefreshingExecAuth {
  private cache = new Map<string, ExecCredential>()
  private inFlight = new Map<string, Promise<ExecCredential>>()

  isAuthProvider(user: User): boolean {
    if (!user) return false
    if (user.exec) return true
    if (!user.authProvider) return false
    return user.authProvider.name === "exec" || !!user.authProvider.config?.exec
  }

  async applyAuthentication(user: User, opts: AuthOptions): Promise<void> {
    const status = (await this.getCredential(user))?.status
    if (!status) return
    if (status.clientCertificateData) opts.cert = status.clientCertificateData
    if (status.clientKeyData) opts.key = status.clientKeyData
    if (status.token) {
      opts.headers = opts.headers ?? {}
      opts.headers["Authorization"] = `Bearer ${status.token}`
    }
  }

  clear(): void {
    this.cache.clear()
  }

  private async getCredential(user: User): Promise<ExecCredential | null> {
    const cached = this.cache.get(user.name)
    if (cached) {
      const expires = Date.parse(cached.status?.expirationTimestamp ?? "")
      if (expires - EXPIRY_SKEW_MS > Date.now()) return cached
      this.cache.delete(user.name)
    }
    const exec = execConfigOf(user)
    if (!exec) return null

    const pending = this.inFlight.get(user.name)
    if (pending) return pending
    const run = runPlugin(exec)
      .then((cred) => {
        this.cache.set(user.name, cred)
        return cred
      })
      .finally(() => this.inFlight.delete(user.name))
    this.inFlight.set(user.name, run)
    return run
  }
}

/**
 * Installs `RefreshingExecAuth` ahead of the built-in `ExecAuth` on `kc` and
 * returns a function that forgets its cached credentials. KubeConfig picks the
 * first matching authenticator from its private `authenticators` list, and
 * `addAuthenticator` only appends to a fallback list the built-in one shadows,
 * so the list is reached into directly.
 */
export function installExecAuth(kc: KubeConfig): () => void {
  const auth = new RefreshingExecAuth()
  const internals = kc as unknown as { authenticators?: unknown[] }
  if (Array.isArray(internals.authenticators)) {
    internals.authenticators.unshift(auth)
  } else {
    console.warn(
      "[exec-auth] KubeConfig internals changed; using built-in ExecAuth",
    )
  }
  return () => auth.clear()
}
