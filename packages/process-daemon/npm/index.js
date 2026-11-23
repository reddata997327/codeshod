import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const supported = process.platform === "darwin" || process.platform === "linux" || process.platform === "win32"
const arch = process.arch === "arm64" || process.arch === "x64" ? process.arch : undefined
const libc = process.platform === "linux" ? (process.report.getReport().header.glibcVersionRuntime ? "gnu" : "musl") : ""
const suffix = [process.platform, arch, libc].filter(Boolean).join("-")

let binary
if (supported && arch) {
  try {
    binary = path.join(
      path.dirname(require.resolve(`@codeshod/pty-${suffix}/package.json`)),
      "bin",
      process.platform === "win32" ? "codeshod-pty.exe" : "codeshod-pty",
    )
  } catch {
    // The platform binary package is not installed (built from source, or the
    // prebuilt npm binaries are unavailable). Degrade gracefully instead of
    // throwing at import time — callers already handle `undefined`.
    binary = undefined
  }
}

export const binaryPath = binary
