import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"

export type CodeshodPtyAsset = {
  readonly source: string
  readonly version: string
  readonly sha256: string
}

type Target = {
  readonly platform: string
  readonly arch: string
  readonly libc?: "glibc" | "musl"
}

const core = createRequire(path.resolve(import.meta.dirname, "../../core/package.json"))
const pty = createRequire(core.resolve("@codeshod/pty/package.json"))

export async function resolveCodeshodPty(target: Target): Promise<CodeshodPtyAsset | undefined> {
  if (target.platform !== "darwin" && target.platform !== "linux" && target.platform !== "win32") return undefined
  if (target.arch !== "arm64" && target.arch !== "x64") return undefined

  const suffix = [target.platform, target.arch, target.platform === "linux" ? (target.libc ?? "glibc") : undefined]
    .filter(Boolean)
    .map((value) => (value === "glibc" ? "gnu" : value))
    .join("-")
  const name = `@codeshod/pty-${suffix}`
  const local = process.env.CODESHOD_PTY_BIN
  if (local && (target.platform !== process.platform || target.arch !== process.arch))
    throw new Error("CODESHOD_PTY_BIN can only be embedded in a build for the current platform and architecture")

  try {
    const source = local
      ? path.resolve(local)
      : pty.resolve(`${name}/bin/${target.platform === "win32" ? "codeshod-pty.exe" : "codeshod-pty"}`)
    const manifest: unknown = local
      ? { version: "local" }
      : JSON.parse(await readFile(pty.resolve(`${name}/package.json`), "utf8"))
    if (!manifest || typeof manifest !== "object" || !("version" in manifest) || typeof manifest.version !== "string")
      throw new Error(`Invalid package metadata for ${name}`)

    return {
      source,
      version: manifest.version,
      sha256: createHash("sha256")
        .update(await readFile(source))
        .digest("hex"),
    }
  } catch (error) {
    // A local CODESHOD_PTY_BIN must exist. The npm platform package is optional: when its
    // prebuilt daemon binary is unavailable (not published / built from source), the compiled
    // binary ships without the persistent-pty daemon and runs its PTYs in-process.
    if (local) throw error
    if ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") return undefined
    if (error instanceof Error && error.message.includes("Cannot find module")) return undefined
    throw error
  }
}
