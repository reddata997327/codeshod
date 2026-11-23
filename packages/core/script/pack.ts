#!/usr/bin/env bun
import path from "node:path"
import { pack } from "@codeshod/script/pack"

await pack(path.resolve(import.meta.dir, ".."), { types: "./dist/types/" })
