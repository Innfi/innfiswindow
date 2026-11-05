import { app, safeStorage } from "electron"
import * as fs from "fs"
import { join } from "path"

import type { AwsInventoryConfigState } from "../shared/aws"
import { AwsInventory } from "./handlers/aws-inventory"

interface StoredConfig {
  /** Base64 of the `safeStorage`-encrypted URL. Never plain text. */
  databaseUrl?: string
}

function getConfigPath(): string {
  return join(app.getPath("userData"), "aws-inventory-config.json")
}

function loadConfig(): StoredConfig {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf-8")) as StoredConfig
  } catch {
    return {}
  }
}

/**
 * Linux's `basic_text` backend reports encryption as available while using a
 * hard-coded key, which protects nothing.
 */
function encryptionAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  return (
    process.platform !== "linux" ||
    safeStorage.getSelectedStorageBackend() !== "basic_text"
  )
}

function storedDatabaseUrl(): string | undefined {
  const { databaseUrl } = loadConfig()
  if (!databaseUrl || !encryptionAvailable()) return undefined
  try {
    return safeStorage.decryptString(Buffer.from(databaseUrl, "base64"))
  } catch {
    return undefined
  }
}

function getDatabaseUrl(): string | undefined {
  return storedDatabaseUrl() ?? (process.env.DATABASE_URL || undefined)
}

export function getAwsInventoryConfig(): AwsInventoryConfigState {
  const stored = storedDatabaseUrl()
  const inherited = process.env.DATABASE_URL
  return {
    hasDatabaseUrl: Boolean(stored || inherited),
    source: stored ? "stored" : inherited ? "env" : null,
    encryptionAvailable: encryptionAvailable(),
  }
}

/** An empty value clears the stored URL. */
export function setAwsInventoryDatabaseUrl(
  databaseUrl: string,
): AwsInventoryConfigState {
  const value = databaseUrl.trim()
  if (value && !encryptionAvailable()) {
    throw new Error(
      "Secure storage is unavailable; set DATABASE_URL in the environment instead",
    )
  }
  const config: StoredConfig = value
    ? { databaseUrl: safeStorage.encryptString(value).toString("base64") }
    : {}
  fs.writeFileSync(getConfigPath(), JSON.stringify(config), {
    encoding: "utf-8",
    mode: 0o600,
  })
  // An idle child holds a pool on the old database.
  awsInventory.restartIdle()
  return getAwsInventoryConfig()
}

function binaryPath(): string {
  const file = process.platform === "win32" ? "awsinv.exe" : "awsinv"
  const dir = `${process.platform}-${process.arch}`
  return app.isPackaged
    ? join(process.resourcesPath, "bin", dir, file)
    : join(app.getAppPath(), "resources", "bin", dir, file)
}

let notifyChanged: () => void = () => {}

/** Set when IPC is registered, which is when there is a window to tell. */
export function setAwsInventoryChangeListener(listener: () => void): void {
  notifyChanged = listener
}

export const awsInventory = new AwsInventory({
  getCommand: () => ({ command: binaryPath() }),
  binaryExists: () => fs.existsSync(binaryPath()),
  getDatabaseUrl,
  onChange: () => notifyChanged(),
})
