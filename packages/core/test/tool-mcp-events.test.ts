import { describe, expect } from "bun:test"
import { AppNodeBuilder } from "@codeshod/core/effect/app-node-builder"
import { Flag } from "@codeshod/core/flag"
import { Mcp } from "@codeshod/core/mcp/index"
import { McpClient } from "@codeshod/core/mcp/client"
import type { Permission } from "@codeshod/core/permission"
import { Session } from "@codeshod/core/session"
import { Tool } from "@codeshod/core/tool"
import { McpEventTools } from "@codeshod/core/tool/plugin/mcp-events"
import { Effect, Layer } from "effect"
import { hostEnvironmentLayer } from "./fixture/environment"
import { eventProducer } from "./fixture/event-server"
import { testEffect } from "./lib/effect"
import { permissionLayer } from "./lib/permission"
import { registerToolPlugin, toolIdentity, toolNodeReplacements } from "./lib/tool"

const it = testEffect(AppNodeBuilder.build(Tool.node, toolNodeReplacements()))

const setup = Effect.fnUntraced(function* (input: { flag?: string } = {}) {
  const producer = yield* eventProducer([
    {
      name: "job.finished",
      description: "A job ended",
      delivery: ["push"],
      inputSchema: {},
      payloadSchema: { type: "object" },
    },
    { name: "job.polled", delivery: ["poll"] },
  ])
  const connection = yield* McpClient.connect({
    server: "jobs",
    config: { type: "attached", transport: producer.client },
    directory: import.meta.dir,
    events: true,
  }).pipe(Effect.provide(hostEnvironmentLayer))
  const asserts: Permission.AssertInput[] = []
  yield* registerToolPlugin(McpEventTools.Plugin, {}).pipe(
    Effect.provide(permissionLayer({ assert: (input) => Effect.sync(() => void asserts.push(input)) })),
    Effect.provide(Flag.testLayer([], { overrides: input.flag ?? "mcp_events" })),
    Effect.provide(
      Layer.mock(Mcp.Service, {
        events: (server) => Effect.succeed(server === "jobs" ? connection.events : undefined),
      }),
    ),
  )
  const registry = yield* Tool.Service
  const list = (input: Record<string, unknown>) =>
    registry.snapshot([{ action: "execute", resource: "*", effect: "deny" }]).pipe(
      Effect.flatMap((tools) =>
        tools.execute({
          sessionID: Session.ID.make("ses_mcp_events"),
          ...toolIdentity,
          call: { type: "tool-call", id: "call_list", name: "codeshod_list_mcp_events", input },
        }),
      ),
    )
  return {
    asserts,
    list: (input: Record<string, unknown>) => list(input).pipe(Effect.orDie),
    fail: (input: Record<string, unknown>) => list(input).pipe(Effect.flip),
    registry,
  }
})

const jobFinished = {
  server: "jobs",
  event: "job.finished",
  description: "A job ended",
  args: {},
  data: { type: "object" },
}

describe("list_mcp_events", () => {
  it.live("is absent while the mcp_events flag is off", () =>
    Effect.gen(function* () {
      const { registry } = yield* setup({ flag: "-mcp_events" })
      expect((yield* registry.list()).map((tool) => tool.id)).not.toContain("codeshod_list_mcp_events")
    }),
  )

  it.live("lists one server's push events after asking permission", () =>
    Effect.gen(function* () {
      const { list, asserts, registry } = yield* setup()
      expect((yield* registry.list()).map((tool) => tool.id)).not.toContain("codeshod_watch_mcp_event")
      expect((yield* list({ server: "jobs" })).output).toEqual({ events: [jobFinished] })
      expect(asserts).toMatchObject([{ action: "codeshod_list_mcp_events", resources: ["jobs"], save: ["jobs"] }])
    }),
  )

  it.live("fails for a server that sends no events", () =>
    Effect.gen(function* () {
      const { fail } = yield* setup()
      expect((yield* fail({ server: "offline" })).message).toBe(
        'MCP server "offline" is not connected or sends no events',
      )
    }),
  )
})
