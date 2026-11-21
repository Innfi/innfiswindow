import { useEffect, useRef } from "react"
import { toast } from "sonner"

export interface AwsCredentialResult {
  valid: boolean
  type: "env" | "file" | "sso-cache" | "metadata" | "none"
  hasSessionToken?: boolean
  expiresAt?: string
  ssoSession?: string
}

export interface ConnectionStatus {
  connected: boolean
  reason?: "network" | "auth" | "unknown"
  error?: string
}

const NEAR_EXPIRY_MS = 5 * 60 * 1000
const TOAST_ID = "aws-credential-status"

type Issue = {
  key: string
  tone: "error" | "warning"
  message: string
  action: "reconnect" | "recheck"
}

function detectIssue(
  result: AwsCredentialResult | null,
  connection: ConnectionStatus | null,
): Issue | null {
  // A dropped cluster connection is the most urgent thing to report.
  if (connection && !connection.connected) {
    const message =
      connection.reason === "network"
        ? "Cluster connection lost — the API server is unreachable. Retrying automatically."
        : connection.reason === "auth"
          ? "Cluster connection lost — credentials were rejected or expired. Reconnect, or run 'aws sso login' to refresh."
          : "Cluster connection lost."
    return {
      key: `connection:${connection.reason ?? "unknown"}`,
      tone: connection.reason === "network" ? "warning" : "error",
      message,
      action: "reconnect",
    }
  }

  if (result && !result.valid) {
    return {
      key: "credentials:missing",
      tone: "error",
      message: "No AWS credentials found. EKS clusters may not be accessible.",
      action: "recheck",
    }
  }

  // Temporary SSO credentials nearing expiry are worth a heads-up so a refresh
  // can happen before requests start failing — but only in the final window.
  if (result?.type === "sso-cache" && result.expiresAt) {
    const expiresAtMs = Date.parse(result.expiresAt)
    if (
      !Number.isNaN(expiresAtMs) &&
      expiresAtMs - Date.now() < NEAR_EXPIRY_MS
    ) {
      const expiresLabel = new Date(result.expiresAt).toLocaleTimeString()
      return {
        key: `credentials:expiring:${result.expiresAt}`,
        tone: "warning",
        message: `AWS SSO credentials expire soon (${expiresLabel}). Run 'aws sso login' to refresh.`,
        action: "recheck",
      }
    }
  }

  return null
}

/** Surfaces cluster-access problems as a single persistent toast. Valid
 *  temporary credentials (AWS SSO, session tokens, exec plugins) are accepted
 *  silently. The toast is raised once per distinct problem — a dismissed toast
 *  stays dismissed until the problem changes — and cleared once resolved. */
export function useAwsCredentialNotifications({
  result,
  connection,
  onRecheck,
  onReconnect,
}: {
  result: AwsCredentialResult | null
  connection: ConnectionStatus | null
  onRecheck: () => void
  onReconnect: () => Promise<void>
}): void {
  const shownKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const issue = detectIssue(result, connection)
    if (!issue) {
      shownKeyRef.current = null
      toast.dismiss(TOAST_ID)
      return
    }
    if (issue.key === shownKeyRef.current) return
    shownKeyRef.current = issue.key

    const notify = issue.tone === "error" ? toast.error : toast.warning
    notify(issue.message, {
      id: TOAST_ID,
      duration: Infinity,
      action: {
        label: issue.action === "reconnect" ? "Reconnect" : "Re-check",
        onClick: () => {
          // Forget the shown issue so the next check re-raises it if the
          // action did not fix things.
          shownKeyRef.current = null
          if (issue.action === "reconnect") {
            toast.loading("Reconnecting…", { id: TOAST_ID })
            void onReconnect()
          } else {
            onRecheck()
          }
        },
      },
    })
  }, [result, connection, onRecheck, onReconnect])
}
