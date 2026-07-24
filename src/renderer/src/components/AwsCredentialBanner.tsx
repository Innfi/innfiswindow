import { AlertTriangle, RefreshCw } from "lucide-react"

interface AwsCredentialResult {
  valid: boolean
  type: "env" | "file" | "sso-cache" | "metadata" | "none"
  hasSessionToken?: boolean
  expiresAt?: string
  ssoSession?: string
}

interface ConnectionStatus {
  connected: boolean
  reason?: "network" | "auth" | "unknown"
  error?: string
}

const NEAR_EXPIRY_MS = 5 * 60 * 1000

type Tone = "destructive" | "amber"

const TONE_CLASS: Record<Tone, string> = {
  destructive: "bg-destructive/10 border-destructive/30 text-destructive",
  amber:
    "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
}

const BTN_TONE_CLASS: Record<Tone, string> = {
  destructive: "border-destructive/40 hover:bg-destructive/20",
  amber: "border-amber-500/40 hover:bg-amber-500/20",
}

function Banner({
  tone,
  message,
  actionLabel,
  onAction,
  busy,
}: {
  tone: Tone
  message: string
  actionLabel: string
  onAction: () => void
  busy?: boolean
}): JSX.Element {
  return (
    <div
      className={`flex items-center gap-2 border px-4 py-2 text-sm shrink-0 ${TONE_CLASS[tone]}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={onAction}
        disabled={busy}
        className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs disabled:opacity-60 ${BTN_TONE_CLASS[tone]}`}
      >
        <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
        {busy ? "Reconnecting…" : actionLabel}
      </button>
    </div>
  )
}

interface Props {
  result: AwsCredentialResult | null
  connection: ConnectionStatus | null
  reconnecting: boolean
  onRecheck: () => void
  onReconnect: () => void
}

/** Surfaces cluster-access problems only. Valid temporary credentials (AWS SSO,
 *  session tokens, exec plugins) are accepted silently — no constant banner. */
export function AwsCredentialBanner({
  result,
  connection,
  reconnecting,
  onRecheck,
  onReconnect,
}: Props): JSX.Element | null {
  // A dropped cluster connection is the most urgent thing to report.
  if (connection && !connection.connected) {
    const message =
      connection.reason === "network"
        ? "Cluster connection lost — the API server is unreachable. Retrying automatically."
        : connection.reason === "auth"
          ? "Cluster connection lost — credentials were rejected or expired. Reconnect, or run 'aws sso login' to refresh."
          : "Cluster connection lost."
    return (
      <Banner
        tone={connection.reason === "network" ? "amber" : "destructive"}
        message={message}
        actionLabel="Reconnect"
        onAction={onReconnect}
        busy={reconnecting}
      />
    )
  }

  if (result && !result.valid) {
    return (
      <Banner
        tone="destructive"
        message="No AWS credentials found. EKS clusters may not be accessible."
        actionLabel="Re-check"
        onAction={onRecheck}
      />
    )
  }

  // Temporary SSO credentials nearing expiry are worth a heads-up so a refresh
  // can happen before requests start failing — but only in the final window.
  if (result?.type === "sso-cache" && result.expiresAt) {
    const expiresAtMs = Date.parse(result.expiresAt)
    const nearExpiry =
      !Number.isNaN(expiresAtMs) && expiresAtMs - Date.now() < NEAR_EXPIRY_MS
    if (nearExpiry) {
      const expiresLabel = new Date(result.expiresAt).toLocaleTimeString()
      return (
        <Banner
          tone="amber"
          message={`AWS SSO credentials expire soon (${expiresLabel}). Run 'aws sso login' to refresh.`}
          actionLabel="Re-check"
          onAction={onRecheck}
        />
      )
    }
  }

  // Valid credentials (including temporary ones) → nothing to show.
  return null
}
