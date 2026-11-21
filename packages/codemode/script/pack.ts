#!/usr/bin/env bun

import { $ } from "bun"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pack } from "@codeshod/script/pack"

const tarball = await pack(path.resolve(import.meta.dir, ".."))

// The package must import under Node and under Bun's workerd conditions once installed from the tarball.
const consumer = await mkdtemp(path.join(tmpdir(), "codeshod-codemode-"))
try {
  await Bun.write(
    path.join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module", dependencies: { "@codeshod/codemode": `file:${tarball}` } }),
  )
  await $`npm install --ignore-scripts --no-audit --no-fund`.cwd(consumer)
  await $`node --input-type=module -e ${'await import("@codeshod/codemode")'}`.cwd(consumer)
  await $`bun --conditions=workerd -e ${'await import("@codeshod/codemode")'}`.cwd(consumer)
} finally {
  await rm(consumer, { recursive: true, force: true })
}
