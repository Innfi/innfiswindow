import type { CSSProperties } from "react"

import { cn } from "../../lib/utils"
import type { DryRunResult } from "../../src/types/k8s"

interface DryRunDiffProps {
  preview: DryRunResult
  className?: string
  style?: CSSProperties
}

/** On an update, the diff is the answer. On a create there is nothing to diff
 *  against, so show the server's rendering instead — that's still worth seeing,
 *  since defaulting and mutating webhooks have already run on it. */
export function DryRunDiff({
  preview,
  className,
  style,
}: DryRunDiffProps): JSX.Element {
  const isDiff = preview.action === "update" && preview.diff !== ""
  const body = isDiff ? preview.diff : preview.rendered

  return (
    <div
      className={cn(
        "overflow-auto bg-muted/50 px-3 py-2 font-mono text-xs",
        className,
      )}
      style={style}
    >
      {preview.action === "update" && preview.diff === "" ? (
        <p className="italic text-muted-foreground">
          No changes — the live object already matches this manifest.
        </p>
      ) : (
        body.split("\n").map((line, idx) => (
          <div
            key={idx}
            className={cn(
              "whitespace-pre",
              isDiff && line.startsWith("+") && "text-emerald-600",
              isDiff && line.startsWith("-") && "text-destructive",
              isDiff && line.startsWith("@@") && "text-muted-foreground",
            )}
          >
            {line || " "}
          </div>
        ))
      )}
    </div>
  )
}
