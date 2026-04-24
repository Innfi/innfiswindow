import { readFileSync } from "fs"
import * as http from "http"
import { homedir } from "os"
import { join } from "path"

export interface AwsCredentialResult {
  valid: boolean
  type: "env" | "file" | "metadata" | "none"
  hasSessionToken?: boolean
}

function checkEnvCredentials(): AwsCredentialResult | null {
  const keyId = process.env["AWS_ACCESS_KEY_ID"]
  const secretKey = process.env["AWS_SECRET_ACCESS_KEY"]
  if (keyId && secretKey) {
    return {
      valid: true,
      type: "env",
      hasSessionToken: !!process.env["AWS_SESSION_TOKEN"],
    }
  }
  return null
}

function parseIni(content: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  let currentSection = "default"
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith(";") || line.startsWith("#")) continue
    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].replace(/^profile\s+/, "")
      result[currentSection] = result[currentSection] ?? {}
      continue
    }
    const eqIdx = line.indexOf("=")
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim()
      const value = line.slice(eqIdx + 1).trim()
      if (!result[currentSection]) result[currentSection] = {}
      result[currentSection][key] = value
    }
  }
  return result
}

function checkFileCredentials(): AwsCredentialResult | null {
  const credFile = join(homedir(), ".aws", "credentials")
  let content: string
  try {
    content = readFileSync(credFile, "utf-8")
  } catch {
    return null
  }
  const profile = process.env["AWS_PROFILE"] ?? "default"
  const parsed = parseIni(content)
  const section = parsed[profile] ?? parsed["default"]
  if (section?.["aws_access_key_id"] && section?.["aws_secret_access_key"]) {
    return { valid: true, type: "file" }
  }
  return null
}

function checkMetadataCredentials(): Promise<AwsCredentialResult | null> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "169.254.169.254",
        path: "/latest/meta-data/",
        method: "HEAD",
        timeout: 1000,
      },
      (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve({ valid: true, type: "metadata" })
        } else {
          resolve(null)
        }
      },
    )
    req.on("timeout", () => {
      req.destroy()
      resolve(null)
    })
    req.on("error", () => resolve(null))
    req.end()
  })
}

export async function checkAwsCredentials(): Promise<AwsCredentialResult> {
  try {
    const envResult = checkEnvCredentials()
    if (envResult) return envResult

    const fileResult = checkFileCredentials()
    if (fileResult) return fileResult

    const metaResult = await checkMetadataCredentials()
    if (metaResult) return metaResult

    return { valid: false, type: "none" }
  } catch {
    return { valid: false, type: "none" }
  }
}
