import { execFile } from "child_process"

import { MutationResult } from "./types"

export interface HelmRepo {
  name: string
  url: string
}

export interface HelmRelease {
  name: string
  namespace: string
  chart: string
  chartVersion: string
  appVersion: string
  status: string
  updated: string
}

// Cache: null = unchecked, string = path found, 'not-found' = missing
let helmBinCache: string | null | "not-found" = null

async function findHelm(): Promise<string | null> {
  if (helmBinCache !== null) {
    return helmBinCache === "not-found" ? null : (helmBinCache as string)
  }
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which"
    execFile(cmd, ["helm"], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        helmBinCache = "not-found"
        resolve(null)
      } else {
        helmBinCache = stdout.trim().split("\n")[0].trim()
        resolve(helmBinCache as string)
      }
    })
  })
}

async function runHelm(
  args: string[],
  stdinData?: string,
): Promise<{ stdout: string; stderr: string }> {
  const helmBin = await findHelm()
  if (!helmBin) {
    throw new Error("helm CLI not found in PATH")
  }
  return new Promise((resolve, reject) => {
    const child = execFile(
      helmBin,
      args,
      { timeout: 30000 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || err.message))
        } else {
          resolve({ stdout, stderr })
        }
      },
    )
    if (stdinData !== undefined && child.stdin) {
      child.stdin.write(stdinData)
      child.stdin.end()
    }
  })
}

export async function helmRepoAdd(
  name: string,
  url: string,
): Promise<MutationResult> {
  try {
    await runHelm(["repo", "add", name, url, "--force-update"])
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message }
  }
}

export async function helmRepoList(): Promise<HelmRepo[]> {
  try {
    const { stdout } = await runHelm(["repo", "list", "-o", "json"])
    const parsed = JSON.parse(stdout) as Array<{ name: string; url: string }>
    return parsed.map((r) => ({ name: r.name, url: r.url }))
  } catch {
    return []
  }
}

export async function helmReleaseList(
  namespace?: string,
): Promise<HelmRelease[]> {
  try {
    const args = namespace
      ? ["list", "-o", "json", "-n", namespace]
      : ["list", "-o", "json", "-A"]
    const { stdout } = await runHelm(args)
    if (!stdout.trim()) return []
    const parsed = JSON.parse(stdout) as Array<{
      name: string
      namespace: string
      chart: string
      app_version: string
      status: string
      updated: string
    }>
    return parsed.map((r) => {
      const chartFull = r.chart ?? ""
      const lastDash = chartFull.lastIndexOf("-")
      const chartName = lastDash > 0 ? chartFull.slice(0, lastDash) : chartFull
      const chartVersion = lastDash > 0 ? chartFull.slice(lastDash + 1) : ""
      return {
        name: r.name,
        namespace: r.namespace,
        chart: chartName,
        chartVersion,
        appVersion: r.app_version ?? "",
        status: r.status,
        updated: r.updated,
      }
    })
  } catch {
    return []
  }
}

export async function helmReleaseInstall(
  releaseName: string,
  chart: string,
  namespace: string,
  values?: string,
): Promise<MutationResult> {
  try {
    const args = ["install", releaseName, chart, "-n", namespace]
    if (values) args.push("--values", "-")
    await runHelm(args, values)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message }
  }
}

export async function helmReleaseUpgrade(
  releaseName: string,
  chart: string,
  namespace: string,
  values?: string,
): Promise<MutationResult> {
  try {
    const args = ["upgrade", releaseName, chart, "-n", namespace, "--install"]
    if (values) args.push("--values", "-")
    await runHelm(args, values)
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message }
  }
}

export async function helmReleaseUninstall(
  releaseName: string,
  namespace: string,
): Promise<MutationResult> {
  try {
    await runHelm(["uninstall", releaseName, "-n", namespace])
    return { success: true }
  } catch (e: unknown) {
    return { success: false, error: (e as Error).message }
  }
}
