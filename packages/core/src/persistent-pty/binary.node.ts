export const available = true

export async function resolveBinary() {
  return process.env.CODESHOD_PTY_BIN || "codeshod-pty"
}
