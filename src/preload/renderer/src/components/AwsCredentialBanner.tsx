import { AlertTriangle, Info, RefreshCw } from "lucide-react"

interface AwsCredentialResult {
  valid: boolean
  type: "env" | "file" | "metadata" | "none"
  hasSessionToken?: boolean
}

interface Props {
  result: AwsCredentialResult | null
  onRecheck: () => void
}

export function AwsCredentialBanner({
  result,
  onRecheck,
}: Props): JSX.Element | null {
  if (!result) return null

  if (!result.valid) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive px-4 py-2 text-sm shrink-0">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          No AWS credentials found. EKS clusters may not be accessible.
        </span>
        <button
          onClick={onRecheck}
          className="flex items-center gap-1 rounded border border-destructive/40 px-2 py-0.5 text-xs hover:bg-destructive/20"
        >
          <RefreshCw className="h-3 w-3" />
          Re-check
        </button>
      </div>
    )
  }

  if (result.type === "env" && result.hasSessionToken) {
    return (
      <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 px-4 py-2 text-sm shrink-0">
        <Info className="h-4 w-4 shrink-0" />
        <span className="flex-1">Using temporary AWS credentials.</span>
        <button
          onClick={onRecheck}
          className="flex items-center gap-1 rounded border border-blue-500/40 px-2 py-0.5 text-xs hover:bg-blue-500/20"
        >
          <RefreshCw className="h-3 w-3" />
          Re-check
        </button>
      </div>
    )
  }

  return null
}
