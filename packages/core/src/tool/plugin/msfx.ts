export * as MsfxTool from "./msfx.js"

import type { Context } from "@codeshod/plugin/effect/plugin"
import { ToolFailure } from "@codeshod/ai/effect"
import { Duration, Effect, Schema } from "effect"
import { exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Permission } from "../../permission.js"

export const name = "msfx"

// Binary resolution mirrors the nmap tool: env override → cli assets → exe dir → /usr/lib → PATH.
const platformArch = `${process.platform}-${process.arch}`
const candidateBinaries: readonly string[] = [
  process.env.CODESHOD_MSFX_BIN ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "msfx", "bin", `msfx-${platformArch}`),
  path.join(path.dirname(process.execPath), "msfx"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "msfx"),
  "/usr/lib/codeshod/msfx",
  "msfx",
].filter((value) => value.length > 0)

const resolveBinary = (): string => {
  for (const candidate of candidateBinaries) {
    if (candidate === "msfx") return candidate
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {
      // ignore — try next candidate
    }
  }
  return "msfx"
}

// msfx runs subcommands: `modules`, `venom`, `tools`, `console -q -x "..."`, `rpc`.
// `rpc` is a long-lived server — we do NOT expose it through this tool because the
// agent cannot keep a TCP server alive across tool calls. Instead, every action is
// driven through the `console -q -x "<cmd>; <cmd>; ..."` non-interactive path or
// the `venom` / `tools` / `modules` one-shot subcommands.
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 5 * 60_000

const Timeout = Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_MS))

/**
 * The unified operation the agent wants to perform.
 *
 * - `modules.list` → `msfx modules [--type T] --json` — list every module
 * - `module.info` → `msfx -q -x "use <module>; info; exit"` — inspect one module
 * - `module.run` → `msfx -q -x "use <module>; set K V; ...; run; exit"` — run a module
 *   (portscan, banner_grab, http_version, ssh_version, handler/reverse_tcp,
 *   exploit/lab/stack_overflow_template, encoder/xor)
 * - `payload.generate` → `msfx venom -p <payload> -f <format> -L LHOST -P LPORT [K=V ...]`
 * - `pattern.create` → `msfx tools pattern-create <len>`
 * - `pattern.offset` → `msfx tools pattern-offset <needle> [max]`
 * - `search` → `msfx -q -x "search <kw>; exit"`
 * - `sessions.list` → no-op for one-shot CLI; sessions only exist within a single
 *   `module.run` that opens them. The handler/reverse_tcp module returns them in
 *   its RunResult.data.sessions array.
 */
export const Operation = Schema.Literals([
  "modules.list",
  "module.info",
  "module.run",
  "payload.generate",
  "pattern.create",
  "pattern.offset",
  "search",
]).annotate({
  description:
    "Which msfx operation to perform. 'modules.list' lists every module. 'module.info' inspects one module's options. 'module.run' executes a module (portscan, banner_grab, http_version, ssh_version, handler/reverse_tcp, exploit template, xor encoder). 'payload.generate' produces a reverse/bind shell one-liner. 'pattern.create' / 'pattern.offset' are exploit-dev helpers. 'search' does a keyword search over module names/titles/descriptions.",
})

export const Input = Schema.Struct({
  operation: Operation,
  module: Schema.optionalKey(Schema.String).annotate({
    description:
      "Module name (with or without full path). Suffix match is accepted: 'portscan/tcp' resolves to 'auxiliary/scanner/portscan/tcp'. Required for module.info and module.run; optional for payload.generate (alias for the payload name).",
  }),
  options: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)).annotate({
    description:
      "Module option key/value pairs (RHOSTS, PORTS, THREADS, RPORT, LHOST, LPORT, etc.). Required for module.run when the module has required options. For payload.generate, use LHOST and LPORT here or via the short -L/-P form.",
  }),
  payload: Schema.optionalKey(Schema.String).annotate({
    description:
      "Payload module name for payload.generate (e.g. 'reverse_tcp' or 'payload/single/reverse_tcp'). Suffix match is accepted.",
  }),
  format: Schema.optionalKey(Schema.Literals(["sh", "python", "rust", "bytes"])).annotate({
    description: "Output format for payload.generate. Default 'sh'. 'bytes' returns hex.",
  }),
  keyword: Schema.optionalKey(Schema.String).annotate({
    description: "Search keyword for the 'search' operation.",
  }),
  type: Schema.optionalKey(Schema.Literals(["auxiliary", "exploit", "payload", "encoder"])).annotate({
    description: "Filter modules.list by module type.",
  }),
  patternLength: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "Length for pattern.create (max 4,000,000).",
  }),
  needle: Schema.optionalKey(Schema.String).annotate({
    description: "Needle for pattern.offset (typically a captured EIP value as hex or ASCII).",
  }),
  patternMax: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "Max pattern bytes to search for pattern.offset (default 200,000).",
  }),
  timeout: Schema.optionalKey(Timeout).annotate({
    description: `Optional per-call wall-clock timeout in seconds (max ${MAX_TIMEOUT_MS / 1000}). Default ${DEFAULT_TIMEOUT_MS / 1000}.`,
  }),
})

export const Output = Schema.Struct({
  operation: Schema.String,
  ok: Schema.Boolean,
  summary: Schema.String,
  data: Schema.Unknown,
  log: Schema.Array(Schema.String),
  raw: Schema.Struct({
    exitCode: Schema.Number,
    stdout: Schema.String,
    stderr: Schema.String,
  }),
})

const description = `Run the built-in msfx Metasploit-style framework against an authorized target and return structured JSON.

msfx is a pure-Rust framework shipped with Codeshod that mirrors Metasploit's architecture: module registry, option handling, scanners, payload generation, session handling, and an msfconsole-style command surface. It is NOT an MCP server and NOT a shell-out to system metasploit — the stripped release binary lives at packages/cli/assets/msfx/bin/ and is bundled with every Codeshod installation.

9 BUILT-IN MODULES:
- auxiliary/scanner/portscan/tcp     — concurrent TCP connect scan (THREADS, TIMEOUT_MS)
- auxiliary/gather/banner_grab       — generic TCP service banner grab (auto HTTP probe on web ports)
- auxiliary/scanner/http/http_version — HTTP status + Server / X-Powered-By / Content-Type fingerprint
- auxiliary/scanner/ssh/ssh_version  — SSH identification banner
- auxiliary/handler/reverse_tcp      — listens on LHOST:LPORT for reverse-shell callbacks, registers sessions
- exploit/lab/stack_overflow_template — educational BOF exploit template (pattern mode + exploit→payload pipeline)
- payload/single/reverse_tcp         — generates reverse-shell one-liners (sh / python / rust / bytes)
- payload/single/bind_tcp            — generates bind-shell one-liners (sh / python / rust / bytes)
- encoder/generic/xor                — single-byte XOR encoder (demonstrates the encoder interface)

USE THIS TOOL WHEN:
- The user asks to scan ports, fingerprint services, or grab banners (similar to nmap but with Metasploit-style option semantics).
- The user asks to generate a reverse shell or bind shell payload (msfvenom-style).
- The user asks for Metasploit pattern_create / pattern_offset exploit-dev helpers.
- The user explicitly says "metasploit", "msfconsole", "msfvenom", "use module", "set RHOSTS", or "run exploit".
- The user is doing authorized pentest work and wants a structured JSON result instead of console text.

DO NOT USE THIS TOOL FOR:
- Any target you do not own or have explicit written permission to test. Unauthorized scanning or exploitation is illegal.
- Pure port scanning without service fingerprinting — prefer the lighter-weight 'nmap' tool in that case.
- Local file reads, code search, or web fetches.
- Long-lived handlers: the 'auxiliary/handler/reverse_tcp' module with WAIT_SEC > 30 will block the tool call. Use WAIT_SEC ≤ 30 or set up the handler outside the agent loop.

PERMISSIONS:
- The action 'msfx' is asserted against the operation-specific resource (module name for module.run, payload name for payload.generate, keyword for search). Repository rules may allow lab ranges and localhost, and ask before any external target.
- For module.run, the full option set is included in the permission metadata so approval prompts show the user exactly what will run (module, RHOSTS, PORTS, LHOST, LPORT, etc.).

OUTPUT:
- Always a JSON object: { operation, ok, summary, data, log[], raw }. The 'data' field carries the module's structured result (e.g. portscan's 'open' array, payload.generate's 'payload' string). The 'log' field carries the human-readable console lines the module printed. The 'raw' field carries the subprocess exit code and stdout/stderr for debugging.

This tool does NOT expose the msfx RPC server (msfx rpc). The RPC server is a long-lived TCP listener that cannot be kept alive across tool calls. Every action is driven through one-shot subprocess invocations (msfx modules --json, msfx venom -p ..., msfx -q -x "use ...; set ...; run; exit", msfx tools pattern-create N).
`

const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

/**
 * Escape a value for inclusion inside a double-quoted shell string.
 * Inside double quotes only `"`, `$`, `` ` ``, `\`, and `!` are special — we escape
 * those by prefixing with backslash. Other characters (including commas, slashes,
 * colons) pass through unchanged. This is used for the inner script of `msfx -x "..."`
 * where single-quoting values would survive the outer shell but be passed through
 * to the msfx console as literal quote characters.
 */
const escapeForDoubleQuoted = (value: string): string =>
  value.replace(/[\\"$`!]/g, (ch) => `\\${ch}`)

/** Build the argv list for the msfx subprocess based on the operation. */
const buildArgs = (input: (typeof Input.Type)): readonly string[] => {
  switch (input.operation) {
    case "modules.list": {
      const args = ["modules", "--json"]
      if (input.type) args.push("--type", input.type)
      return args
    }
    case "module.info": {
      const mod = input.module ?? ""
      // The -x argument is a single shell token containing the whole script
      // (use; info; exit). We wrap it in double quotes when we join, with the
      // inner content already shell-safe (no double quotes appear inside).
      const script = `use ${mod}; info; exit`
      return ["-q", "-x", `"${script}"`]
    }
    case "module.run": {
      const mod = input.module ?? ""
      const opts = input.options ?? {}
      // Each option value is escaped for inclusion inside the outer double-quoted
      // -x argument (escape `"`, `$`, `` ` ``, `\`, `!` only). The whole script
      // is wrapped in double quotes for the outer shell.
      const setCommands = Object.entries(opts).map(([k, v]) => `set ${k} ${escapeForDoubleQuoted(v)}`)
      const script = [`use ${mod}`, ...setCommands, "run", "exit"].join("; ")
      return ["-q", "-x", `"${script}"`]
    }
    case "payload.generate": {
      const payload = input.payload ?? input.module ?? ""
      const args = ["venom", "-p", shellEscape(payload), "-f", input.format ?? "sh"]
      const opts = input.options ?? {}
      if (opts.LHOST) args.push("-L", shellEscape(opts.LHOST))
      if (opts.LPORT) args.push("-P", shellEscape(opts.LPORT))
      // Pass through any other K=V pairs the agent supplied.
      for (const [k, v] of Object.entries(opts)) {
        if (k === "LHOST" || k === "LPORT") continue
        args.push(`${k}=${shellEscape(v)}`)
      }
      return args
    }
    case "pattern.create": {
      return ["tools", "pattern-create", String(input.patternLength ?? 2048)]
    }
    case "pattern.offset": {
      const args = ["tools", "pattern-offset", shellEscape(input.needle ?? "")]
      if (input.patternMax) args.push(String(input.patternMax))
      return args
    }
    case "search": {
      // Wrap the keyword in double quotes for the outer shell so it survives
      // the join into a single command line.
      const kw = input.keyword ?? ""
      const script = `search ${kw}; exit`
      return ["-q", "-x", `"${script}"`]
    }
    default:
      return ["--help"]
  }
}

const runMsfx = (
  binary: string,
  argv: readonly string[],
  timeoutMs: number,
): Effect.Effect<{ stdout: string; stderr: string; exitCode: number }, Error> =>
  Effect.callback<{ stdout: string; stderr: string; exitCode: number }, Error, never>((resume) => {
    const child = exec(
      [binary, ...argv].join(" "),
      {
        maxBuffer: 16 * 1024 * 1024,
        timeout: timeoutMs,
        env: { ...process.env },
      },
      (err, stdout, stderr) => {
        if (err && "killed" in err && err.killed === true) {
          resume(Effect.fail(new Error(`msfx call exceeded ${timeoutMs}ms wall-clock timeout`)))
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
      orElse: () => Effect.fail(new Error(`msfx call exceeded ${timeoutMs}ms wall-clock timeout`)),
    }),
  )

/**
 * Parse the msfx stdout into a structured result.
 *
 * For modules.list: stdout is a JSON array.
 * For module.run / module.info / search: stdout is free-form text — we keep it as
 *   `log[]` and synthesize a summary from the last [*]/[+]/[-] line.
 * For payload.generate: stdout is the payload text itself (or hex when format=bytes).
 * For pattern.create: stdout is the pattern string.
 * For pattern.offset: stdout is the offset number (or nothing on no-match).
 */
const parseOutput = (
  operation: string,
  stdout: string,
  stderr: string,
  exitCode: number,
): { ok: boolean; summary: string; data: unknown; log: string[] } => {
  const log = stdout.split("\n").filter((line) => line.length > 0)
  switch (operation) {
    case "modules.list": {
      try {
        const arr = JSON.parse(stdout)
        return { ok: true, summary: `${Array.isArray(arr) ? arr.length : 0} modules`, data: arr, log }
      } catch {
        return { ok: false, summary: "Failed to parse modules JSON", data: null, log }
      }
    }
    case "module.info": {
      return { ok: exitCode === 0, summary: `Module info (${log.length} lines)`, data: { text: stdout }, log }
    }
    case "module.run": {
      // The console prints lines like '[*] Using ...', '[+] 127.0.0.1:80 open (tcp)',
      // '[*] Scanned N host/port combination(s), M open'. The summary is the last
      // '[*]' line, or the last non-empty line if no '[*]' appears.
      const summary = [...log].reverse().find((line) => line.startsWith("[*]")) ?? log[log.length - 1] ?? ""
      // For runs that produce structured data (portscan, banner_grab, http_version,
      // ssh_version, xor, handler/reverse_tcp), the data is embedded in the log as
      // '[*] {json}' or appears as key=value lines. We surface the raw log array
      // and let the agent extract what it needs. The handler module's data.sessions
      // array appears in the log as '[+] Session N opened (peer) -> shell reverse tcp'.
      const sessions = log
        .filter((line) => line.includes("Session ") && line.includes("opened"))
        .map((line) => {
          const m = line.match(/Session (\d+) opened \(([^)]+)\) -> (.*)$/)
          return m ? { id: Number(m[1]), peer: m[2], kind: m[3] } : null
        })
        .filter((s): s is { id: number; peer: string; kind: string } => s !== null)
      return {
        ok: exitCode === 0,
        summary,
        data: { log_lines: log.length, sessions },
        log,
      }
    }
    case "payload.generate": {
      const payload = stdout
      // For format=bytes, msfx venom prints hex; for other formats, source text.
      const isHex = /^[0-9a-f]+$/i.test(payload.trim()) && payload.trim().length > 0
      return {
        ok: exitCode === 0,
        summary: `Generated ${payload.length} byte payload`,
        data: { payload, format: isHex ? "bytes" : "text", length: payload.length },
        log,
      }
    }
    case "pattern.create": {
      const pattern = stdout.trim()
      return {
        ok: exitCode === 0,
        summary: `Generated ${pattern.length} byte cyclic pattern`,
        data: { pattern, length: pattern.length },
        log,
      }
    }
    case "pattern.offset": {
      const trimmed = stdout.trim()
      const offset = Number(trimmed)
      if (!Number.isNaN(offset) && trimmed.length > 0) {
        return { ok: true, summary: `Pattern found at offset ${offset}`, data: { offset, needle: log.length }, log }
      }
      return { ok: false, summary: stderr.trim() || "Pattern not found", data: { offset: null }, log }
    }
    case "search": {
      const hits = log.map((line) => {
        // Lines look like: 'auxiliary/scanner/ssh/ssh_version    normal    SSH Server Version Detector'
        const m = line.match(/^(\S+)\s+(\S+)\s+(.*)$/)
        return m ? { name: m[1], rank: m[2], title: m[3] } : null
      }).filter((h): h is { name: string; rank: string; title: string } => h !== null)
      return { ok: exitCode === 0, summary: `${hits.length} module(s) matched`, data: { hits }, log }
    }
    default:
      return { ok: false, summary: "Unknown operation", data: null, log }
  }
}

/** Compress the structured result into a concise text summary for the model. */
const summarize = (operation: string, result: { ok: boolean; summary: string; data: any; log: string[] }): string => {
  const lines: string[] = [`msfx ${operation}: ${result.ok ? "ok" : "failed"} — ${result.summary}`]
  if (operation === "modules.list" && Array.isArray(result.data)) {
    for (const m of result.data) {
      lines.push(`- ${m.name} [${m.type}/${m.rank}] ${m.title}`)
    }
  } else if (operation === "search" && result.data?.hits) {
    for (const h of result.data.hits) {
      lines.push(`- ${h.name} [${h.rank}] ${h.title}`)
    }
  } else if (operation === "module.run" && result.data?.sessions?.length > 0) {
    lines.push(`sessions opened:`)
    for (const s of result.data.sessions) {
      lines.push(`  #${s.id} ${s.kind} from ${s.peer}`)
    }
  } else if (operation === "payload.generate" && result.data?.payload) {
    lines.push(`payload (${result.data.format}, ${result.data.length} bytes):`)
    lines.push(result.data.payload.slice(0, 2_048))
  } else if (operation === "pattern.offset" && result.data?.offset !== null) {
    lines.push(`offset = ${result.data.offset}`)
  }
  if (result.log.length > 0 && result.log.length <= 32) {
    lines.push(`log:`)
    for (const line of result.log.slice(0, 32)) lines.push(`  ${line}`)
  } else if (result.log.length > 32) {
    lines.push(`log (first 16 of ${result.log.length}):`)
    for (const line of result.log.slice(0, 16)) lines.push(`  ${line}`)
  }
  return lines.join("\n")
}

export const Plugin = {
  id: "codeshod.tool.msfx",
  effect: Effect.fn("MsfxTool.Plugin")(function* (ctx: Context) {
    const permission = yield* Permission.Service

    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          // msfx is a network exploitation tool — never exposed in Code Mode.
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              // Permission resource depends on the operation:
              // - module.run / module.info → the module name
              // - payload.generate → the payload name
              // - modules.list / search → "list" / the keyword
              // - pattern.* → "pattern"
              const resource =
                input.operation === "module.run" || input.operation === "module.info"
                  ? input.module ?? "*"
                  : input.operation === "payload.generate"
                    ? input.payload ?? input.module ?? "*"
                    : input.operation === "search"
                      ? input.keyword ?? "*"
                      : input.operation
              yield* permission.assert({
                action: name,
                resources: [resource],
                save: ["*"],
                metadata: {
                  operation: input.operation,
                  module: input.module,
                  payload: input.payload,
                  format: input.format,
                  options: input.options,
                  keyword: input.keyword,
                  type: input.type,
                  patternLength: input.patternLength,
                  needle: input.needle,
                  patternMax: input.patternMax,
                },
                ...Permission.invocation(context),
              })

              const binary = resolveBinary()
              const argv = buildArgs(input)
              const timeoutMs = (input.timeout ?? DEFAULT_TIMEOUT_MS / 1_000) * 1_000

              const { stdout, stderr, exitCode } = yield* runMsfx(binary, argv, timeoutMs).pipe(
                Effect.mapError(
                  (error) => new ToolFailure({ message: `msfx invocation failed: ${error.message}`, error }),
                ),
              )

              // msfx exit codes: 0 ok, 1 generic error, 2 unknown command / bad args.
              // We don't fail the tool on exit 1 or 2 — the agent still gets the
              // stdout/stderr to reason about. Only timeout and process-spawn errors
              // fail at the runMsfx layer.
              const parsed = parseOutput(input.operation, stdout, stderr, exitCode)
              const summary = summarize(input.operation, parsed)

              return {
                output: {
                  operation: input.operation,
                  ok: parsed.ok,
                  summary: parsed.summary,
                  data: parsed.data,
                  log: parsed.log,
                  raw: { exitCode, stdout: stdout.slice(0, 16_384), stderr: stderr.slice(0, 4_096) },
                },
                content: [
                  { type: "text" as const, text: summary },
                  ...(stderr.trim().length > 0
                    ? [{ type: "text" as const, text: `[msfx stderr]\n${stderr.trim().slice(0, 4_096)}` }]
                    : []),
                ],
                metadata: {
                  exitCode,
                  binary: path.basename(binary),
                  operation: input.operation,
                  ok: parsed.ok,
                  argv: argv.join(" ").slice(0, 512),
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
}
