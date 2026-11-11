// Builds the awsinv sidecar into resources/bin/<platform>-<arch>/, where
// src/main/aws-inventory.ts looks for it in dev and electron-builder's
// extraResources picks it up for packaging.
//
// Usage: node scripts/build-awsinv.mjs [--platform <node platform>] [--arch <node arch>]
// Defaults to the host. AWSINV_DIR points at the awsinv source (default ../golang/awsinv).
//
// A missing source directory is a warning, not an error: the app still builds,
// and only the AWS feature reports the binary as missing.

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const GOOS = { win32: "windows", darwin: "darwin", linux: "linux" }
const GOARCH = { x64: "amd64", arm64: "arm64", ia32: "386" }

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const platform = arg("platform", process.platform)
const arch = arg("arch", process.arch)
const goos = GOOS[platform]
const goarch = GOARCH[arch]
if (!goos || !goarch) {
  console.error(`[build-awsinv] unsupported target ${platform}-${arch}`)
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(root, process.env.AWSINV_DIR || "../golang/awsinv")
if (!existsSync(join(source, "go.mod"))) {
  console.warn(
    `[build-awsinv] no awsinv source at ${source}; skipping. Set AWSINV_DIR to build it.`,
  )
  process.exit(0)
}

const outDir = join(root, "resources", "bin", `${platform}-${arch}`)
const outFile = join(outDir, platform === "win32" ? "awsinv.exe" : "awsinv")
mkdirSync(outDir, { recursive: true })

console.log(`[build-awsinv] ${source} -> ${outFile}`)
const result = spawnSync(
  "go",
  ["build", "-trimpath", "-ldflags=-s -w", "-o", outFile, "./cmd/awsinv"],
  {
    cwd: source,
    stdio: "inherit",
    env: { ...process.env, GOOS: goos, GOARCH: goarch, CGO_ENABLED: "0" },
  },
)
if (result.error) {
  console.error(`[build-awsinv] could not run go: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
