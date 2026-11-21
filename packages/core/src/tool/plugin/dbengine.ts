export * as DbengineTool from "./dbengine.js"

import type { Context } from "@codeshod/plugin/effect/plugin"
import { ToolFailure } from "@codeshod/ai/effect"
import { Effect, Schema } from "effect"
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Permission } from "../../permission.js"

export const name = "dbengine"

const platformArch = `${process.platform}-${process.arch}`
const candidateBinaries: readonly string[] = [
  process.env.CODESHOD_DBENGINE_BIN ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "dbengine", "bin", `dbengine-${platformArch}`),
  path.join(path.dirname(process.execPath), "dbengine"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "dbengine"),
  "/usr/lib/codeshod/dbengine",
  "dbengine",
].filter((value) => value.length > 0)

const resolveBinary = (): string => {
  for (const candidate of candidateBinaries) {
    if (candidate === "dbengine") return candidate
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {}
  }
  return "dbengine"
}

/**
 * dbengine is an MCP stdio server (JSON-RPC 2.0 over stdin/stdout).
 * Unlike the other tools which are one-shot CLIs, dbengine requires a
 * multi-line handshake: initialize → notifications/initialized → tools/call.
 *
 * This function spawns the binary, performs the handshake, calls one tool,
 * and returns the response. The binary is killed after each call.
 */
const callMcpTool = (
  binary: string,
  homeDir: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok: boolean; result: string; error?: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(binary, ["serve", "--home", homeDir], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, DBENGINE_HOME: homeDir },
    })

    let settled = false
    let initialized = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        child.kill("SIGKILL")
        reject(new Error(`dbengine MCP call exceeded ${timeoutMs}ms`))
      }
    }, timeoutMs)

    const send = (msg: object) => {
      child.stdin?.write(JSON.stringify(msg) + "\n")
    }

    const onLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed) return
      let msg: any
      try {
        msg = JSON.parse(trimmed)
      } catch {
        return
      }

      // Handle initialize response
      if (msg.id === 1 && msg.result?.serverInfo) {
        // Send initialized notification
        send({ jsonrpc: "2.0", method: "notifications/initialized" })
        initialized = true
        // Now send the tools/call request
        send({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: toolName, arguments: args },
        })
        return
      }

      // Handle tools/call response
      if (msg.id === 2) {
        settled = true
        clearTimeout(timer)
        child.kill("SIGKILL")
        if (msg.error) {
          resolve({ ok: false, result: "", error: msg.error.message || JSON.stringify(msg.error) })
        } else if (msg.result?.isError) {
          const text = msg.result.content?.[0]?.text ?? "unknown error"
          resolve({ ok: false, result: text, error: text })
        } else {
          const text = msg.result?.content?.[0]?.text ?? JSON.stringify(msg.result ?? {})
          resolve({ ok: true, result: text })
        }
        return
      }
    }

    let stdoutBuffer = ""
    child.stdout?.on("data", (data: Buffer) => {
      stdoutBuffer += data.toString()
      const lines = stdoutBuffer.split("\n")
      stdoutBuffer = lines.pop() ?? ""
      for (const line of lines) {
        onLine(line)
      }
    })

    child.stderr?.on("data", (data: Buffer) => {
      // stderr is for logging/debugging — capture but don't fail
    })

    child.on("close", (code: number) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        if (initialized) {
          reject(new Error(`dbengine closed before responding (exit ${code})`))
        } else {
          reject(new Error(`dbengine failed to initialize (exit ${code})`))
        }
      }
    })

    // Start the handshake
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "codeshod", version: "1.0" },
      },
    })
  })

export const Input = Schema.Struct({
  tool: Schema.String.annotate({
    description:
      "The dbengine MCP tool to call. 27 tools: db_status, db_create_table, db_drop_table, db_schema, db_insert, db_get, db_update, db_delete, db_scan, db_count, db_sql, db_compact, db_keys, db_graph, db_topo, db_diff, db_snapshot, db_branch, db_merge, db_sync, db_connect, db_remote_query, db_remote_schema, db_extract, db_import_bundle, db_export_bundle, db_fingerprint.",
  }),
  arguments: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)).annotate({
    description:
      "Tool arguments as key/value pairs. Each tool has its own schema — see the dbengine skill for details. Example for db_create_table: {db: 'mydb', table: 'users', columns: [{name: 'id', dtype: 'integer', auto: true}, {name: 'name', dtype: 'text'}], primary_key: ['id']}.",
  }),
  home: Schema.optionalKey(Schema.String).annotate({
    description: "Data directory (overrides DBENGINE_HOME env, default ~/.dbengine). Use a workspace path like /tmp/mydb to keep data local to a project.",
  }),
})

export const Output = Schema.Struct({
  tool: Schema.String,
  ok: Schema.Boolean,
  result: Schema.String,
  error: Schema.optionalKey(Schema.String),
})

const description = `Run the built-in dbengine pure-Rust database engine through its MCP tool interface.

dbengine is a complete database engine in a single Rust source file (~5,900 lines, std-only — zero external dependencies) shipped as a Model Context Protocol server with **27 tools**. The stripped release binary lives at packages/cli/assets/dbengine/bin/ (1.2 MB) and is bundled with every Codeshod installation. It is also registered as an MCP server in ~/.claude.json via the dbengine-setup.sh script (linked setup).

The engine is built around one idea: **where key data lives in a database** — primary keys, foreign keys, unique keys, indexes — and what that key graph makes possible (graph traversal, topology, diffs, snapshots, branches, merges, sync).

27 TOOLS (pass the tool name via the 'tool' field and its arguments via 'arguments'):

**Core engine**: db_status, db_create_table, db_drop_table, db_schema, db_insert, db_get (key-addressed read), db_update, db_delete, db_scan, db_count, db_sql (mini SELECT), db_compact.

**Keys engine (novel layer)**: db_keys (key-graph map), db_graph (FK walk N hops), db_topo (FK-topological order + cycles), db_diff (key-addressed diff), db_snapshot (git-like), db_branch (full copy), db_merge (key-based merge), db_sync (incremental local↔remote).

**Remote + extractor**: db_connect (postgres/mysql/http), db_remote_query, db_remote_schema, db_extract (FK-topological extraction), db_import_bundle, db_export_bundle.

**Fingerprint**: db_fingerprint — infer schema + keys + FKs from raw API/JSON payloads and materialize as a real local database.

USE THIS TOOL WHEN:
- The user wants to create and query a local database (create tables, insert rows, scan, SQL).
- The user wants to analyze key relationships (PK/FK graph, topology, foreign-key traversal).
- The user wants to diff two databases, take snapshots, branch, or merge.
- The user wants to connect to a remote PostgreSQL/MySQL database, query it, or extract its schema + data locally.
- The user wants to infer a database schema from raw JSON/API responses.
- The user mentions dbengine, "key-addressed database", "FK graph", "database snapshot", "database branch", "database sync", "schema fingerprinting".

PERMISSIONS:
- The action 'dbengine' is asserted against the tool name as the resource.
- Write operations (db_create_table, db_insert, db_update, db_delete, db_drop_table, db_compact, db_snapshot create/drop, db_branch, db_merge, db_sync pull/push, db_extract, db_import_bundle) are typically asked before running.
- Read operations (db_status, db_schema, db_get, db_scan, db_count, db_sql, db_keys, db_graph, db_topo, db_diff, db_snapshot list, db_remote_query, db_remote_schema, db_export_bundle, db_fingerprint) are typically allowed.

OUTPUT:
- Always a JSON object: { tool, ok, result, error? }. The 'result' field carries the raw JSON text from the dbengine tool response. The 'error' field is present only when ok=false.
`

export const Plugin = {
  id: "codeshod.tool.dbengine",
  effect: Effect.fn("DbengineTool.Plugin")(function* (ctx: Context) {
    const permission = yield* Permission.Service

    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const toolName = input.tool
              const args = input.arguments ?? {}
              const homeDir = input.home ?? process.env.DBENGINE_HOME ?? path.join(process.env.HOME ?? "/tmp", ".dbengine")

              yield* permission.assert({
                action: name,
                resources: [toolName],
                save: ["*"],
                metadata: {
                  tool: toolName,
                  arguments: args,
                  home: homeDir,
                },
                ...Permission.invocation(context),
              })

              const binary = resolveBinary()
              const timeoutMs = 30_000

              const result = yield* Effect.tryPromise({
                try: () => callMcpTool(binary, homeDir, toolName, args, timeoutMs),
                catch: (error) =>
                  new ToolFailure({
                    message: `dbengine MCP call failed: ${error instanceof Error ? error.message : String(error)}`,
                    error: error instanceof Error ? error : undefined,
                  }),
              })

              const summary = result.ok
                ? result.result.split("\n").slice(0, 10).join("\n").slice(0, 1_000)
                : result.error ?? "unknown error"

              return {
                output: {
                  tool: toolName,
                  ok: result.ok,
                  result: result.result.slice(0, 32_768),
                  error: result.error?.slice(0, 4_096),
                },
                content: [
                  { type: "text" as const, text: `dbengine ${toolName}: ${result.ok ? "ok" : "failed"}\n${summary}` },
                  ...(!result.ok && result.error
                    ? [{ type: "text" as const, text: `[dbengine error] ${result.error.slice(0, 4_096)}` }]
                    : []),
                ],
                metadata: {
                  tool: toolName,
                  ok: result.ok,
                  binary: path.basename(binary),
                  home: homeDir,
                },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: String(error) }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}

export const __test = {
  resolveBinary,
  callMcpTool,
  candidateBinaries,
}
