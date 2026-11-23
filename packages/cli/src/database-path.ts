import path from "node:path"
import { CODESHOD_CHANNEL } from "./version"

export function databasePath(data: string) {
  const filename =
    process.env.CODESHOD_DB ??
    (["latest", "dev", "beta", "next", "prod"].includes(CODESHOD_CHANNEL) ||
    process.env.CODESHOD_DISABLE_CHANNEL_DB === "1" ||
    process.env.CODESHOD_DISABLE_CHANNEL_DB === "true"
      ? "codeshod.db"
      : `codeshod-${CODESHOD_CHANNEL.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
  return filename === ":memory:" ? filename : path.resolve(data, filename)
}
