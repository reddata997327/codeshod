export * as RustangoTool from "./rustango.js"

import type { Context } from "@codeshod/plugin/effect/plugin"
import { ToolFailure } from "@codeshod/ai/effect"
import { Duration, Effect, Schema } from "effect"
import { exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Permission } from "../../permission.js"

export const name = "rustango"

// Binary resolution mirrors the nmap/msfx/shark tool pattern.
const platformArch = `${process.platform}-${process.arch}`
const candidateBinaries: readonly string[] = [
  process.env.CODESHOD_RUSTANGO_BIN ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "rustango", "bin", `rustango-${platformArch}`),
  path.join(path.dirname(process.execPath), "rustango"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "rustango"),
  "/usr/lib/codeshod/rustango",
  "rustango",
].filter((value) => value.length > 0)

const resolveBinary = (): string => {
  for (const candidate of candidateBinaries) {
    if (candidate === "rustango") return candidate
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {
      // ignore — try next candidate
    }
  }
  return "rustango"
}

// rustango runserver is a long-lived dev server — we DO expose it but with a
// default short duration cap (10 seconds) so the agent can verify a scaffolded
// project boots, then return. The agent can also use the one-shot commands
// (check, makemigrations, migrate, showmigrations, createsuperuser,
// clearsessions, startproject, startapp, version, help) without any server.
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 5 * 60_000
// runserver is the one operation that may need a longer timeout if the agent
// wants to leave it running while it tests endpoints. We cap it at 60 seconds
// per call — long enough to verify a project boots and curl an endpoint, short
// enough not to block a session step indefinitely.
const RUNSERVER_DEFAULT_TIMEOUT_MS = 15_000
const RUNSERVER_MAX_TIMEOUT_MS = 60_000

const Timeout = Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_MS))

/**
 * The unified operation the agent wants to perform. Mirrors the msfx/shark
 * tool pattern: a single `operation` parameter selects one of the rustango
 * management subcommands.
 */
export const Operation = Schema.Literals([
  "version",
  "help",
  "check",
  "startproject",
  "startapp",
  "makemigrations",
  "migrate",
  "showmigrations",
  "createsuperuser",
  "clearsessions",
  "runserver",
]).annotate({
  description:
    "Which rustango management command to run. 'version' / 'help' / 'check' are read-only introspection. 'startproject NAME DIR' / 'startapp NAME DIR' scaffold new projects/apps. 'makemigrations' / 'migrate' / 'showmigrations' manage the ORM schema. 'createsuperuser -u NAME -p PW' creates an admin user. 'clearsessions' purges expired sessions. 'runserver ADDR' starts the dev server (15-second default timeout — long enough to verify a project boots and curl an endpoint).",
})

export const Input = Schema.Struct({
  operation: Operation,
  projectName: Schema.optionalKey(Schema.String).annotate({
    description: "Project name for startproject (e.g. 'mysite'). Required for startproject.",
  }),
  projectDir: Schema.optionalKey(Schema.String).annotate({
    description: "Output directory for startproject/startapp. Defaults to the project/app name.",
  }),
  appName: Schema.optionalKey(Schema.String).annotate({
    description: "App name for startapp (e.g. 'polls'). Required for startapp. Must be lowercase ASCII.",
  }),
  appArg: Schema.optionalKey(Schema.String).annotate({
    description: "Optional app name argument for makemigrations / migrate (e.g. 'core'). Defaults to 'core'.",
  }),
  username: Schema.optionalKey(Schema.String).annotate({
    description: "Superuser username for createsuperuser. Required for createsuperuser.",
  }),
  password: Schema.optionalKey(Schema.String).annotate({
    description: "Superuser password for createsuperuser. Required for createsuperuser.",
  }),
  addr: Schema.optionalKey(Schema.String).annotate({
    description: "Bind address for runserver, e.g. '127.0.0.1:8000'. Defaults to '127.0.0.1:8000'.",
  }),
  database: Schema.optionalKey(Schema.String).annotate({
    description:
      "Database spec (overrides RUSTANGO_DB env). 'memory' (default, ephemeral), 'json:<path>' (persistent JSON file), or a backend URL.",
  }),
  migrationsDir: Schema.optionalKey(Schema.String).annotate({
    description: "Migrations directory (overrides RUSTANGO_MIGRATIONS_DIR env). Default: 'migrations'.",
  }),
  timeout: Schema.optionalKey(Timeout).annotate({
    description: `Optional per-call wall-clock timeout in seconds (max ${MAX_TIMEOUT_MS / 1000}). Default ${DEFAULT_TIMEOUT_MS / 1000} for one-shot commands, ${RUNSERVER_DEFAULT_TIMEOUT_MS / 1000} for runserver (max ${RUNSERVER_MAX_TIMEOUT_MS / 1000}).`,
  }),
})

export const Output = Schema.Struct({
  operation: Schema.String,
  ok: Schema.Boolean,
  summary: Schema.String,
  stdout: Schema.String,
  stderr: Schema.String,
  data: Schema.Unknown,
  raw: Schema.Struct({
    exitCode: Schema.Number,
    argv: Schema.String,
    binary: Schema.String,
  }),
})

const description = `Run the built-in rustango Django-style web framework CLI and return its output.

rustango is a pure-Rust Django-style batteries-included web framework shipped with Codeshod as a first-party built-in tool. It is NOT a shell-out to system \`django-admin\` or \`manage.py\` — the stripped release binary lives at packages/cli/assets/rustango/bin/ (2.3 MB, no C deps, std-only + tokio + axum + serde + RustCrypto + chrono + uuid + flate2 + thiserror) and is bundled with every Codeshod installation.

The rustango binary supports 11 management commands mirroring Django's \`manage.py\` surface:

- version / help / check       — introspection (read-only)
- startproject NAME DIR        — scaffold a new project (creates Cargo.toml + src/main.rs + templates/)
- startapp NAME DIR            — scaffold a new app inside a project (creates models.rs + views.rs + templates/)
- makemigrations [APP]         — detect schema changes, write migration files
- migrate [APP]                — apply pending migrations
- showmigrations               — list applied/pending migrations
- createsuperuser -u NAME -p PW — create or reset a superuser (Django-compatible PBKDF2-SHA256 hash)
- clearsessions                — purge expired sessions
- runserver [ADDR]             — start the dev HTTP server (default 127.0.0.1:8000, 15-second default timeout)

WHAT RUSTANGO HAS (Django-parity surface):
- Settings (builder + TOML overlay), URL routing with path converters (<int:id>, <path:rest>, etc.)
- Function views + class-based views, Django Template Language (DTL) with filters
- Model/ORM layer with migrations (in-memory or JSON-file backend)
- Forms with validation, sessions, authentication (PBKDF2-SHA256 in Django wire format), CSRF
- Flash messages, middleware, auto-generated admin site, i18n catalogs, cache framework
- Static files, management CLI, optional contrib.ai LLM/agent module (feature-gated, not in this binary)

USE THIS TOOL WHEN:
- The user asks to scaffold a new Rust web project ("create a Django-style project", "scaffold mysite").
- The user asks to scaffold a new app inside a project ("add a polls app").
- The user asks to run Django-style management commands (makemigrations, migrate, createsuperuser).
- The user asks to validate a rustango project configuration (check).
- The user asks to start the dev server and verify it boots.
- The user mentions Django, manage.py, django-admin, startproject, makemigrations, or "batteries-included Rust web framework".

DO NOT USE THIS TOOL FOR:
- Production serving. runserver is a single-process dev server. Production serving needs a reverse proxy + workers (out of scope for this tool).
- General HTTP requests. Use 'webfetch' for one-shot HTTP calls.
- Live packet capture or port scanning. Use 'shark' or 'nmap'.
- Long-running dev sessions. The tool caps runserver at 60 seconds per call. For continuous dev work, the user should run rustango directly in a terminal.

PERMISSIONS:
- The action 'rustango' is asserted against the operation-specific resource (project name for startproject, app name for startapp, username for createsuperuser, address for runserver, operation name for read-only ops). The full operation shape is in 'metadata'.
- For runserver, the metadata includes the bind address so approval prompts show what port will be opened.

OUTPUT:
- Always a JSON object: { operation, ok, summary, stdout, stderr, data, raw }. The 'stdout' and 'stderr' fields carry the raw subprocess output (truncated to 32 KB / 4 KB). The 'data' field carries parsed structured data when applicable (e.g. scaffolded file paths for startproject/startapp, migration counts for makemigrations/migrate, superuser pk for createsuperuser). The 'raw' field carries the exit code, argv, and binary name for debugging.

The rustango source is intentionally NOT bundled in the codeshod tree — only the stripped release binary. The source lives upstream and rebuilds land in packages/cli/assets/rustango/bin/ via the release workflow.
`

const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

/** Build the argv list for the rustango subprocess based on the operation. */
const buildArgs = (input: (typeof Input.Type)): readonly string[] => {
  switch (input.operation) {
    case "version":
      return ["version"]
    case "help":
      return ["help"]
    case "check":
      return ["check"]
    case "startproject": {
      const args = ["startproject"]
      if (input.projectName) args.push(shellEscape(input.projectName))
      if (input.projectDir) args.push(shellEscape(input.projectDir))
      return args
    }
    case "startapp": {
      const args = ["startapp"]
      if (input.appName) args.push(shellEscape(input.appName))
      if (input.projectDir) args.push(shellEscape(input.projectDir))
      return args
    }
    case "makemigrations": {
      const args = ["makemigrations"]
      if (input.appArg) args.push(shellEscape(input.appArg))
      return args
    }
    case "migrate": {
      const args = ["migrate"]
      if (input.appArg) args.push(shellEscape(input.appArg))
      return args
    }
    case "showmigrations":
      return ["showmigrations"]
    case "createsuperuser": {
      const args = ["createsuperuser"]
      if (input.username) args.push("-u", shellEscape(input.username))
      if (input.password) args.push("-p", shellEscape(input.password))
      return args
    }
    case "clearsessions":
      return ["clearsessions"]
    case "runserver": {
      const args = ["runserver"]
      if (input.addr) args.push(shellEscape(input.addr))
      return args
    }
    default:
      return ["help"]
  }
}

const runRustango = (
  binary: string,
  argv: readonly string[],
  timeoutMs: number,
  envOverrides: Record<string, string>,
): Effect.Effect<{ stdout: string; stderr: string; exitCode: number }, Error> =>
  Effect.callback<{ stdout: string; stderr: string; exitCode: number }, Error, never>((resume) => {
    const child = exec(
      [binary, ...argv].join(" "),
      {
        maxBuffer: 32 * 1024 * 1024,
        timeout: timeoutMs,
        env: { ...process.env, ...envOverrides },
      },
      (err, stdout, stderr) => {
        if (err && "killed" in err && err.killed === true) {
          // For runserver, hitting the timeout is the expected way to stop —
          // treat it as success with whatever output was captured.
          if (argv[0] === "runserver") {
            resume(Effect.succeed({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 }))
            return
          }
          resume(Effect.fail(new Error(`rustango call exceeded ${timeoutMs}ms wall-clock timeout`)))
          return
        }
        const exitCode = err ? (err as NodeJS.ErrnoException).code ?? 1 : 0
        resume(Effect.succeed({ stdout, stderr: stderr ?? "", exitCode: typeof exitCode === "number" ? exitCode : 1 }))
      },
    )
    return Effect.sync(() => child.kill("SIGKILL"))
  }).pipe(
    Effect.timeoutOrElse({
      duration: Duration.millis(timeoutMs + 2_000),
      orElse: () => Effect.fail(new Error(`rustango call exceeded ${timeoutMs}ms wall-clock timeout`)),
    }),
  )

/**
 * Parse rustango stdout/stderr into a structured result.
 *
 * rustango commands print human-readable text to stdout (and errors to stderr).
 * We synthesize a one-line summary and extract structured data where possible.
 */
const parseOutputCore = (
  operation: string,
  stdout: string,
  stderr: string,
  exitCode: number,
): { ok: boolean; summary: string; data: unknown } => {
  if (exitCode !== 0) {
    return { ok: false, summary: stderr.trim() || `rustango exited with code ${exitCode}`, data: null }
  }
  const out = stdout.trim()
  switch (operation) {
    case "version":
      return { ok: true, summary: out, data: { version: out.replace(/^rustango\s+/i, "") } }
    case "help":
      return { ok: true, summary: "help text returned", data: { text: out } }
    case "check": {
      // Multi-line output like:
      // rustango 6.2.0.dev0 — OK
      //   backend:      memory
      //   debug:        true
      //   admin:        true (at /admin/)
      //   models:       0 registered
      //   routes:       8 top-level
      //   middleware:   8
      const lines = out.split("\n").map((l) => l.trim()).filter((l) => l.length > 0)
      const info: Record<string, string> = {}
      for (const line of lines.slice(1)) {
        const m = line.match(/^(\w+):\s*(.+)$/)
        if (m) info[m[1]] = m[2]
      }
      return { ok: true, summary: lines[0] ?? "check ok", data: { config: info, raw: out } }
    }
    case "startproject": {
      // Output like: "Project scaffolded at /path/mydemo:\n  cd /path/mydemo\n  cargo run"
      const m = out.match(/Project scaffolded at ([^:]+):/)
      const projectPath = m ? m[1] : null
      return {
        ok: true,
        summary: `Project scaffolded at ${projectPath ?? "(unknown)"}`,
        data: { projectPath, raw: out },
      }
    }
    case "startapp": {
      const m = out.match(/App `([^`]+)` scaffolded at ([^\n]+)/)
      const appName = m ? m[1] : null
      const appPath = m ? m[2] : null
      return {
        ok: true,
        summary: `App '${appName ?? "?"}' scaffolded at ${appPath ?? "(unknown)"}`,
        data: { appName, appPath, raw: out },
      }
    }
    case "makemigrations": {
      // Either "No changes detected in app `core`" or "Wrote <path> (<N> ops)"
      if (out.includes("No changes detected")) {
        return { ok: true, summary: out, data: { changesDetected: false, raw: out } }
      }
      const m = out.match(/Wrote ([^ ]+) \((\d+) ops\)/)
      const migrationPath = m ? m[1] : null
      const opsCount = m ? Number(m[2]) : 0
      return {
        ok: true,
        summary: `Wrote ${migrationPath ?? "?"} (${opsCount} ops)`,
        data: { changesDetected: true, migrationPath, opsCount, raw: out },
      }
    }
    case "migrate": {
      // Either "Nothing to apply." or "Applying <name>... OK" lines.
      if (out.includes("Nothing to apply")) {
        return { ok: true, summary: "Nothing to apply", data: { applied: [], raw: out } }
      }
      const applied = out
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("Applying"))
        .map((l) => l.replace(/^Applying\s+/, "").replace(/\.\.\.\s*OK$/, ""))
      return {
        ok: true,
        summary: `Applied ${applied.length} migration(s)`,
        data: { applied, raw: out },
      }
    }
    case "showmigrations": {
      // Plain text listing — pass through.
      return { ok: true, summary: `showmigrations (${out.split("\n").filter((l) => l.trim()).length} lines)`, data: { text: out } }
    }
    case "createsuperuser": {
      // "Superuser `root` created (pk 1)."
      const m = out.match(/Superuser `([^`]+)` created \(pk (\d+)\)/)
      const username = m ? m[1] : null
      const pk = m ? Number(m[2]) : null
      return {
        ok: true,
        summary: `Superuser '${username ?? "?"}' created (pk ${pk ?? "?"})`,
        data: { username, pk, raw: out },
      }
    }
    case "clearsessions": {
      // "Deleted 0 expired session(s)."
      const m = out.match(/Deleted (\d+) expired session\(s\)/)
      const deleted = m ? Number(m[1]) : 0
      return { ok: true, summary: out, data: { deleted, raw: out } }
    }
    case "runserver": {
      // runserver prints a startup banner then runs until killed/timed out.
      // The first line is "rustango <version> serving http://<addr> (DEBUG: <bool>)".
      const firstLine = out.split("\n")[0] ?? ""
      return {
        ok: true,
        summary: `Dev server ran for the timeout window: ${firstLine}`,
        data: { banner: firstLine, raw: out },
      }
    }
    default:
      return { ok: true, summary: out.slice(0, 200), data: { raw: out } }
  }
}

const parseOutput = (
  operation: string,
  stdout: string,
  stderr: string,
  exitCode: number,
): { ok: boolean; summary: string; stdout: string; data: unknown } => ({
  ...parseOutputCore(operation, stdout, stderr, exitCode),
  stdout,
})

/** Compress the structured result into a concise text summary for the model. */
const summarize = (operation: string, result: { ok: boolean; summary: string; stdout: string; data: any }): string => {
  const lines: string[] = [`rustango ${operation}: ${result.ok ? "ok" : "failed"} — ${result.summary}`]
  if (!result.ok) {
    if (result.stdout) lines.push(`stdout: ${result.stdout.slice(0, 1_024)}`)
    return lines.join("\n")
  }
  // For scaffold commands, include the project/app path.
  if (operation === "startproject" && result.data?.projectPath) {
    lines.push(`project at: ${result.data.projectPath}`)
    lines.push(`next: cd ${result.data.projectPath} && cargo run`)
  } else if (operation === "startapp" && result.data?.appPath) {
    lines.push(`app at: ${result.data.appPath}`)
  } else if (operation === "createsuperuser" && result.data?.username) {
    lines.push(`superuser: ${result.data.username} (pk ${result.data.pk})`)
  } else if (operation === "check" && result.data?.config) {
    for (const [k, v] of Object.entries(result.data.config)) {
      lines.push(`  ${k}: ${v}`)
    }
  } else if (operation === "runserver") {
    // The stdout already has the banner; show first 5 lines.
    const out = result.stdout.split("\n").slice(0, 5).join("\n")
    if (out) lines.push(out)
  }
  return lines.join("\n")
}

export const Plugin = {
  id: "codeshod.tool.rustango",
  effect: Effect.fn("RustangoTool.Plugin")(function* (ctx: Context) {
    const permission = yield* Permission.Service

    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          // rustango scaffolds and runs dev servers — not a Code Mode tool.
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              // Permission resource depends on the operation:
              // - startproject → project name
              // - startapp → app name
              // - createsuperuser → username
              // - runserver → bind address
              // - everything else → operation name (read-only)
              const resource =
                input.operation === "startproject"
                  ? input.projectName ?? input.operation
                  : input.operation === "startapp"
                    ? input.appName ?? input.operation
                    : input.operation === "createsuperuser"
                      ? input.username ?? input.operation
                      : input.operation === "runserver"
                        ? input.addr ?? "127.0.0.1:8000"
                        : input.operation
              yield* permission.assert({
                action: name,
                resources: [resource],
                save: ["*"],
                metadata: {
                  operation: input.operation,
                  projectName: input.projectName,
                  projectDir: input.projectDir,
                  appName: input.appName,
                  appArg: input.appArg,
                  username: input.username,
                  addr: input.addr,
                  database: input.database,
                  migrationsDir: input.migrationsDir,
                  // Note: password is intentionally NOT included in metadata
                  // to avoid surfacing it in approval prompts. It is still
                  // passed to the subprocess via argv (the only way rustango
                  // accepts it), but it is not logged.
                },
                ...Permission.invocation(context),
              })

              const binary = resolveBinary()
              const argv = buildArgs(input)

              // Pick timeout: runserver has its own (longer) defaults since
              // the dev server is expected to run for a while.
              const isRunserver = input.operation === "runserver"
              const defaultTimeout = isRunserver ? RUNSERVER_DEFAULT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
              const maxTimeout = isRunserver ? RUNSERVER_MAX_TIMEOUT_MS : MAX_TIMEOUT_MS
              const requestedTimeout = input.timeout ?? defaultTimeout / 1_000
              const timeoutSecs = Math.min(requestedTimeout, maxTimeout / 1_000)
              const timeoutMs = timeoutSecs * 1_000

              // Env overrides for database + migrations dir.
              const envOverrides: Record<string, string> = {}
              if (input.database) envOverrides.RUSTANGO_DB = input.database
              if (input.migrationsDir) envOverrides.RUSTANGO_MIGRATIONS_DIR = input.migrationsDir

              const { stdout, stderr, exitCode } = yield* runRustango(binary, argv, timeoutMs, envOverrides).pipe(
                Effect.mapError(
                  (error) => new ToolFailure({ message: `rustango invocation failed: ${error.message}`, error }),
                ),
              )

              // rustango exit codes: 0 ok, 1 server error / scaffold failure,
              // 2 unknown command or bad args. We don't fail the call on exit 1
              // or 2 — the agent still gets stdout/stderr to reason about.
              const parsed = parseOutput(input.operation, stdout, stderr, exitCode)
              const summary = summarize(input.operation, parsed)

              return {
                output: {
                  operation: input.operation,
                  ok: parsed.ok,
                  summary: parsed.summary,
                  stdout: stdout.slice(0, 32_768),
                  stderr: stderr.slice(0, 4_096),
                  data: parsed.data,
                  raw: {
                    exitCode,
                    argv: argv.join(" ").slice(0, 512),
                    binary: path.basename(binary),
                  },
                },
                content: [
                  { type: "text" as const, text: summary },
                  ...(stderr.trim().length > 0
                    ? [{ type: "text" as const, text: `[rustango stderr]\n${stderr.trim().slice(0, 4_096)}` }]
                    : []),
                ],
                metadata: {
                  exitCode,
                  binary: path.basename(binary),
                  operation: input.operation,
                  ok: parsed.ok,
                  argv: argv.join(" ").slice(0, 512),
                  timeoutMs,
                  ...(input.database ? { database: input.database } : {}),
                  ...(input.migrationsDir ? { migrationsDir: input.migrationsDir } : {}),
                },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: String(error) }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}

// Exported for tests and tooling.
export const __test = {
  resolveBinary,
  buildArgs,
  shellEscape,
  parseOutput,
  summarize,
  candidateBinaries,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  RUNSERVER_DEFAULT_TIMEOUT_MS,
  RUNSERVER_MAX_TIMEOUT_MS,
}
