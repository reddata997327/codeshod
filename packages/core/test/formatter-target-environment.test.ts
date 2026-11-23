import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Context, Effect, Layer } from "effect"
import type { ChildProcess } from "effect/process"
import { AppNodeBuilder } from "@codeshod/core/effect/app-node-builder"
import { makeLocationNode } from "@codeshod/util/effect/app-node"
import { LayerNode } from "@codeshod/util/effect/layer-node"
import { AppProcess } from "@codeshod/util/process"
import { Config } from "@codeshod/core/config"
import { Environment } from "@codeshod/core/environment/index"
import { FileAccess } from "@codeshod/core/file-access"
import { FileMutation } from "@codeshod/core/file-mutation"
import { FileWrite } from "@codeshod/core/file-write"
import { Flag } from "@codeshod/core/flag"
import { Formatter } from "@codeshod/core/formatter"
import { Location } from "@codeshod/core/location"
import { Permission } from "@codeshod/core/permission"
import { Session } from "@codeshod/core/session"
import { Tool } from "@codeshod/core/tool"
import { PatchTool } from "@codeshod/core/tool/plugin/patch"
import { WriteTool } from "@codeshod/core/tool/plugin/write"
import { hostEnvironmentLayer } from "./fixture/environment"
import { elsewhere } from "./fixture/target-environment"
import { withTempDir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"
import { executeTool, registerToolPlugin, toolIdentity } from "./lib/tool"

const fileToolsNode = makeLocationNode({
  name: "test/formatter-target-environment-plugins",
  layer: Layer.effectDiscard(
    Effect.all([registerToolPlugin(WriteTool.Plugin), registerToolPlugin(PatchTool.Plugin)], { discard: true }),
  ),
  deps: [
    Config.node,
    Environment.node,
    FileAccess.node,
    FileMutation.node,
    FileWrite.node,
    Flag.node,
    Formatter.node,
    Location.node,
    Permission.node,
    Tool.node,
  ],
})

const sessionID = Session.ID.make("ses_formatter_target_environment_test")
const it = testEffect(Layer.succeed(Flag.Overrides, undefined))

// Writes notes.md and then patches it, with a formatter configured that appends to the file it is given, and
// reports every process the server started. The formatter's process still really runs, so a formatted file shows it.
const run = (other: ReturnType<typeof elsewhere>) => {
  const started: ChildProcess.Command[] = []
  const execute = (registry: Tool.Interface, name: string, input: unknown) =>
    executeTool(registry, {
      sessionID,
      ...toolIdentity,
      call: { type: "tool-call", id: `call-${name}`, name, input },
    })

  return Effect.gen(function* () {
    const formatter = yield* Formatter.Service
    yield* formatter.transform((editor) =>
      editor.set({
        name: "append",
        extensions: [".md"],
        enabled: Effect.succeed([
          process.execPath,
          "-e",
          "require('fs').appendFileSync(process.argv.at(-1), 'formatted\\n')",
          "$FILE",
        ]),
      }),
    )
    const registry = yield* Tool.Service
    expect(yield* execute(registry, "write", { path: "notes.md", content: "one\n" })).toMatchObject({
      status: "completed",
    })
    expect(
      yield* execute(registry, "patch", {
        patchText: "*** Begin Patch\n*** Update File: notes.md\n@@\n-one\n+two\n*** End Patch",
      }),
    ).toMatchObject({ status: "completed" })
    return started
  }).pipe(
    Effect.provide(
      AppNodeBuilder.build(LayerNode.group([Tool.node, Formatter.node, fileToolsNode]), [
        ...other.replacements,
        AppProcess.node.replace(
          Layer.effect(
            AppProcess.Service,
            Effect.gen(function* () {
              const processes = yield* AppProcess.Service
              return AppProcess.Service.of({
                ...processes,
                run: (command, options) =>
                  Effect.sync(() => started.push(command)).pipe(Effect.andThen(processes.run(command, options))),
              })
            }),
          ).pipe(Layer.provide(LayerNode.compile(AppProcess.node))),
        ),
        Config.node.replace(Config.testLayer()),
      ]),
    ),
  )
}

describe("formatter", () => {
  it.live("does not run for a file in another environment, nor on this machine's file at the same path", () =>
    withTempDir((tmp) =>
      Effect.gen(function* () {
        const file = path.join(tmp.path, "notes.md")
        yield* Effect.promise(() => fs.writeFile(file, "session\n"))
        const other = elsewhere(tmp.path)

        expect(yield* run(other)).toEqual([])
        expect(new TextDecoder().decode((yield* other.environment.files.read(file)).bytes)).toBe("two\n")
        expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe("session\n")
      }),
    ),
  )

  it.live("runs for a file whose environment has this machine's id", () =>
    withTempDir((tmp) =>
      Effect.gen(function* () {
        const file = path.join(tmp.path, "notes.md")
        const host = Context.get(yield* Layer.build(hostEnvironmentLayer), Environment.Service)

        expect(yield* run(elsewhere(tmp.path, host))).toMatchObject([
          { args: expect.arrayContaining([file]) },
          { args: expect.arrayContaining([file]) },
        ])
        expect(yield* Effect.promise(() => fs.readFile(file, "utf8"))).toBe("two\nformatted\nformatted\n")
      }),
    ),
  )
})
