export * as NmapTool from "./nmap.js"

import type { Context } from "@codeshod/plugin/effect/plugin"
import { ToolFailure } from "@codeshod/ai/effect"
import { Duration, Effect, Schema } from "effect"
import { exec } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Permission } from "../../permission.js"

export const name = "nmap"

// Binary lives in the CLI package's assets directory at build time and is copied
// next to the bundled codeshod binary at install time. Resolve candidates in order:
//   1. CODESHOD_RNMAP_BIN env override (for packagers / dev worktrees).
//   2. <cli assets>/rnmap/bin/rnmap-<platform>-<arch> — source-tree location.
//   3. <codeshod executable dir>/rnmap — installed location (single-binary deploy).
//   4. /usr/lib/codeshod/rnmap — system install location.
//   5. fall back to `rnmap` on PATH.
const platformArch = `${process.platform}-${process.arch}`
const candidateBinaries: readonly string[] = [
  process.env.CODESHOD_RNMAP_BIN ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "rnmap", "bin", `rnmap-${platformArch}`),
  path.join(path.dirname(process.execPath), "rnmap"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "rnmap"),
  "/usr/lib/codeshod/rnmap",
  "rnmap",
].filter((value) => value.length > 0)

const candidateScriptDirs: readonly string[] = [
  process.env.CODESHOD_RNMAP_SCRIPTS ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "rnmap", "scripts"),
  path.join(path.dirname(process.execPath), "rnmap-scripts"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "rnmap-scripts"),
  "/usr/lib/codeshod/rnmap-scripts",
].filter((value) => value.length > 0)

const resolveBinary = (): string => {
  for (const candidate of candidateBinaries) {
    if (candidate === "rnmap") return candidate
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {
      // ignore — try next candidate
    }
  }
  return "rnmap"
}

const resolveScriptDir = (): string | undefined => {
  for (const candidate of candidateScriptDirs) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate
    } catch {
      // ignore — try next candidate
    }
  }
  return undefined
}

// rnmap produces JSON on stdout; tracing and warnings go to stderr.
// Default 30s wall-clock cap so a hung scan never blocks a session step indefinitely.
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 5 * 60_000

const Timeout = Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_MS))

/**
 * Input schema for the nmap tool. Mirrors the most common rnmap flags but
 * intentionally exposes a smaller surface than the full CLI: the agent gets
 * enough knobs to tune scans (ports, scan type, timing, scripts, profile)
 * without being able to pass arbitrary flags that could break JSON parsing.
 */
export const Input = Schema.Struct({
  targets: Schema.Array(Schema.String).annotate({
    description:
      "Targets to scan: IP (127.0.0.1), CIDR (10.0.0.0/24), range (10.0.0.1-50), hostname (scanme.nmap.org), or comma list. At least one target is required.",
  }),
  ports: Schema.String.annotate({
    description: 'Port spec: "80" | "1-1000" | "22,80,443" | "T:80,U:53". Defaults to "1-1000".',
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed("1-1000"))),
  scanType: Schema.Literals(["connect", "syn", "ack", "fin", "xmas", "null", "udp", "ping", "all"])
    .annotate({
      description:
        "Scan type. 'connect' is unprivileged and works everywhere. SYN/ACK/FIN/Xmas/Null require root or CAP_NET_RAW. 'all' combines SYN + UDP.",
    })
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed("connect" as const))),
  timing: Schema.Literals(["0", "1", "2", "3", "4", "5"])
    .annotate({
      description:
        "Timing template T0(paranoid) → T5(insane). T3 normal is default. Lower templates are slower and stealthier; higher are faster but noisier.",
    })
    .pipe(Schema.withDecodingDefaultKey(Effect.succeed("3" as const))),
  serviceDetection: Schema.Boolean.annotate({
    description: "Enable service/version detection (banner grab + active probes). Default false.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false as const))),
  osDetection: Schema.Boolean.annotate({
    description: "Enable OS fingerprinting via TCP SYN probes. Requires root. Default false.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false as const))),
  traceroute: Schema.Boolean.annotate({
    description: "Run UDP traceroute to each up host. Default false.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false as const))),
  scripts: Schema.optionalKey(Schema.String).annotate({
    description:
      "Rhai script ids to run, comma-separated, or 'all' to discover every script. Examples: 'banner_grab,ssh_version,http_title', 'all'.",
  }),
  topPorts: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "Scan the top N most common ports (overrides --ports). Useful for quick sweeps: --top-ports 100.",
  }),
  noPing: Schema.Boolean.annotate({
    description: "Skip host discovery; treat all targets as up. Use when ICMP is filtered but ports may still answer.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false as const))),
  ndjson: Schema.Boolean.annotate({
    description:
      "Stream NDJSON (one host JSON per line + final stats line) instead of a single JSON document. Better for large scans; the tool still returns parsed JSON to the agent.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false as const))),
  maxRate: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "Cap packets per second. Useful for slow IDS evasion or protective rate limiting.",
  }),
  profile: Schema.optionalKey(Schema.String).annotate({
    description:
      "Scan profile preset: 'quick' | 'web' | 'internal' | 'full' | 'stealth'. Overrides individual flags.",
  }),
  aggressive: Schema.Boolean.annotate({
    description: "Aggressive mode: equivalent to serviceDetection + osDetection + traceroute + scripts='all'.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false as const))),
  tlsProbe: Schema.Boolean.annotate({
    description: "Probe TLS on every open TCP port and parse the X.509 certificate.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false as const))),
  reason: Schema.Boolean.annotate({
    description: "Include a detailed `reason_detail` field per port explaining how the state was determined.",
  }).pipe(Schema.withDecodingDefaultKey(Effect.succeed(false as const))),
  timeout: Schema.optionalKey(Timeout).annotate({
    description: `Optional per-scan wall-clock timeout in seconds (max ${MAX_TIMEOUT_MS / 1000}). Default ${DEFAULT_TIMEOUT_MS / 1000}.`,
  }),
})

/**
 * Output schema. We accept the rnmap JSON report as an opaque value because the
 * scanner's schema (1.0) is itself a stable versioned contract documented at
 * https://codeshod.ai/docs/tools/nmap and in the embedded rnmap README.
 */
export const Output = Schema.Struct({
  schema_version: Schema.String,
  scanner: Schema.Struct({
    name: Schema.String,
    version: Schema.String,
    started_at: Schema.String,
    finished_at: Schema.String,
    elapsed_ms: Schema.Number,
    capabilities: Schema.Array(Schema.String),
  }),
  scan: Schema.Struct({
    targets: Schema.Array(Schema.String),
    port_spec: Schema.String,
    scan_type: Schema.String,
    timing_template: Schema.String,
    flags: Schema.Struct({
      service_detection: Schema.Boolean,
      os_detection: Schema.Boolean,
      traceroute: Schema.Boolean,
      scripts: Schema.Array(Schema.String),
      decoys: Schema.Array(Schema.String),
      fragmentation: Schema.Boolean,
      randomize_targets: Schema.Boolean,
      randomize_ports: Schema.Boolean,
    }).pipe(
      Schema.withConstructorDefault(
        Effect.succeed({
          service_detection: true,
          os_detection: false,
          traceroute: false,
          scripts: [],
          decoys: [],
          fragmentation: false,
          randomize_targets: false,
          randomize_ports: false,
        }),
      ),
    ),
  }),
  hosts: Schema.Array(Schema.Unknown),
  stats: Schema.Struct({
    hosts_total: Schema.Number,
    hosts_up: Schema.Number,
    hosts_down: Schema.Number,
    ports_total: Schema.Number,
    ports_open: Schema.Number,
    ports_closed: Schema.Number,
    ports_filtered: Schema.Number,
    scripts_run: Schema.Number,
  }),
})

const description = `Run the built-in rnmap network scanner against one or more targets and return a versioned JSON report (schema 1.0).

rnmap is a pure-Rust nmap-compatible scanner bundled with Codeshod. It supports TCP connect / SYN / ACK / FIN / Xmas / Null scans, UDP scans, host discovery, OS fingerprinting, service/version detection, traceroute, Rhai-based NSE-style scripting, TLS certificate parsing, IDS-evasion primitives (decoys, fragmentation, randomization), and timing templates T0-T5.

USE THIS TOOL WHEN:
- The user asks to scan ports, find open services, fingerprint a host, or map a network.
- The user mentions nmap, port scan, network reconnaissance, or pentest.
- You need a structured JSON port/host inventory for follow-up reasoning.

DO NOT USE THIS TOOL FOR:
- Scanning targets you do not own or have explicit written permission to test. Unauthorized scanning may be illegal.
- Local file reads, code search, or web fetches — use 'read', 'grep', or 'webfetch' instead.

PERMISSIONS:
- The action 'nmap' is asserted against the comma-joined target list. Repository rules may allow or deny specific CIDRs or hosts.
- SYN/ACK/FIN/Xmas/Null scans, OS fingerprinting, and ICMP-based host discovery require root or CAP_NET_RAW. The scanner auto-falls back to TCP connect scan when raw sockets are unavailable.

OUTPUT:
- Default: a single compact JSON document (rnmap schema 1.0). Parsed and returned to the agent as the tool result.
- With ndjson=true: the scanner streams NDJSON internally; the tool still returns the parsed final report.
- Markdown reports are not produced by this tool; the agent can format the JSON output itself.
`

/** Escape a single argv value for safe shell passing. */
const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

/** Build the rnmap argv list from typed input. */
const buildArgs = (input: (typeof Input.Type), scriptDir: string | undefined): readonly string[] => {
  const args: string[] = []
  for (const target of input.targets) {
    args.push(shellEscape(target))
  }
  args.push("-p", shellEscape(input.ports))
  args.push("-S", input.scanType)
  args.push("-T", input.timing)
  if (input.serviceDetection) args.push("-V")
  if (input.osDetection) args.push("-O")
  if (input.traceroute) args.push("--traceroute")
  if (input.scripts) args.push("--script", shellEscape(input.scripts))
  if (input.topPorts) args.push("--top-ports", String(input.topPorts))
  if (input.noPing) args.push("-P")
  if (input.ndjson) args.push("--ndjson")
  if (input.maxRate) args.push("--max-rate", String(input.maxRate))
  if (input.profile) args.push("--profile", shellEscape(input.profile))
  if (input.aggressive) args.push("-A")
  if (input.tlsProbe) args.push("--tls")
  if (input.reason) args.push("--reason")
  if (scriptDir) args.push("--script-dir", shellEscape(scriptDir))
  // Always emit compact JSON (default) — we parse it ourselves.
  return args
}

/** Run rnmap and capture stdout/stderr with a wall-clock timeout. */
const runRnmap = (
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
          resume(Effect.fail(new Error(`rnmap scan exceeded ${timeoutMs}ms wall-clock timeout`)))
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
      orElse: () => Effect.fail(new Error(`rnmap scan exceeded ${timeoutMs}ms wall-clock timeout`)),
    }),
  )

/** Compress an rnmap report into a concise text summary for the model. */
const summarize = (report: any): string => {
  const lines: string[] = []
  const stats = report.stats ?? {}
  lines.push(
    `rnmap ${report.scanner?.version ?? "?"} — ${stats.hosts_total ?? 0} target(s), ${stats.hosts_up ?? 0} up, ${stats.ports_open ?? 0} open, ${stats.ports_closed ?? 0} closed, ${stats.ports_filtered ?? 0} filtered, elapsed ${report.scanner?.elapsed_ms ?? 0}ms`,
  )
  for (const host of report.hosts ?? []) {
    if (host.state !== "up") {
      lines.push(`- ${host.address}${host.hostname ? ` (${host.hostname})` : ""}: ${host.state}`)
      continue
    }
    const openPorts = (host.ports ?? [])
      .filter((p: any) => p.state === "open" || p.state === "open|filtered")
      .map((p: any) => {
        const svc = p.service ? ` ${p.service.name}${p.service.version ? `/${p.service.version}` : ""}` : ""
        const tls = p.tls ? ` tls=${p.tls.tls_version}${p.tls.subject_cn ? ` cn=${p.tls.subject_cn}` : ""}` : ""
        return `${p.port}/${p.protocol}${svc}${tls}`
      })
    lines.push(
      `- ${host.address}${host.hostname ? ` (${host.hostname})` : ""}: up, rtt=${host.rtt_ms ?? "?"}ms, open=[${openPorts.join(", ")}]`,
    )
    if (host.os) lines.push(`  os: ${host.os.name} (${host.os.accuracy}%)`)
    if (host.traceroute && host.traceroute.length > 0) {
      const hops = host.traceroute.map((h: any) => `${h.ttl}:${h.ip}`).join(" ")
      lines.push(`  traceroute: ${hops}`)
    }
  }
  return lines.join("\n")
}

export const Plugin = {
  id: "codeshod.tool.nmap",
  effect: Effect.fn("NmapTool.Plugin")(function* (ctx: Context) {
    const permission = yield* Permission.Service

    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          // nmap is a network action tool — never exposed in Code Mode (read-only filesystem mode).
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              if (input.targets.length === 0) {
                return yield* new ToolFailure({ message: "nmap requires at least one target" })
              }
              // Permission: assert against the comma-joined target list. Repository rules
              // typically allow RFC1918 ranges and localhost, and ask before external targets.
              const targetSpec = input.targets.join(",")
              yield* permission.assert({
                action: name,
                resources: [targetSpec],
                save: ["*"],
                metadata: {
                  scanType: input.scanType,
                  timing: input.timing,
                  ports: input.ports,
                  topPorts: input.topPorts,
                  serviceDetection: input.serviceDetection,
                  osDetection: input.osDetection,
                  traceroute: input.traceroute,
                  scripts: input.scripts,
                  aggressive: input.aggressive,
                  tlsProbe: input.tlsProbe,
                  noPing: input.noPing,
                  maxRate: input.maxRate,
                  profile: input.profile,
                },
                ...Permission.invocation(context),
              })

              const binary = resolveBinary()
              const scriptDir = resolveScriptDir()
              const argv = buildArgs(input, scriptDir)
              const timeoutMs = (input.timeout ?? DEFAULT_TIMEOUT_MS / 1_000) * 1_000

              const { stdout, stderr, exitCode } = yield* runRnmap(binary, argv, timeoutMs).pipe(
                Effect.mapError(
                  (error) => new ToolFailure({ message: `rnmap invocation failed: ${error.message}`, error }),
                ),
              )

              // rnmap exit codes: 0 ok / 1 no targets up / 2 partial / 3 error / 4 bad args.
              // 1 and 2 still produce valid JSON with the hosts that were probed; only 3 and 4 are hard failures.
              if (exitCode === 3 || exitCode === 4) {
                return yield* new ToolFailure({
                  message: `rnmap exited with code ${exitCode}: ${stderr.trim() || "no stderr"}`,
                })
              }

              // Parse the JSON report from stdout. If --ndjson was requested, rnmap still ends
              // with a `{"type":"stats",...}` line; we collect host lines plus the stats summary.
              let report: any
              try {
                if (input.ndjson) {
                  const lines = stdout.split("\n").filter((line) => line.trim().length > 0)
                  const hosts: any[] = []
                  let stats: any = null
                  let scanner: any = null
                  let scan: any = null
                  let schemaVersion = "1.0"
                  for (const line of lines) {
                    const obj = JSON.parse(line)
                    if (obj.type === "stats") {
                      stats = obj.stats
                      scanner = obj.scanner
                      scan = obj.scan
                      schemaVersion = obj.schema_version ?? schemaVersion
                    } else if (obj.type === "tick" || obj.type === "tick_stats" || obj.type === "tick_diff" || obj.type === "diff_stats") {
                      // Watch/diff NDJSON records — pass through, not part of a single-scan report.
                      continue
                    } else if (obj.address) {
                      hosts.push(obj)
                    }
                  }
                  report = {
                    schema_version: schemaVersion,
                    scanner: scanner ?? { name: "rnmap", version: "?", started_at: "", finished_at: "", elapsed_ms: 0, capabilities: [] },
                    scan: scan ?? { targets: input.targets, port_spec: input.ports, scan_type: input.scanType, timing_template: input.timing, flags: {} },
                    hosts,
                    stats: stats ?? { hosts_total: hosts.length, hosts_up: hosts.filter((h) => h.state === "up").length, hosts_down: hosts.filter((h) => h.state === "down").length, ports_total: 0, ports_open: 0, ports_closed: 0, ports_filtered: 0, scripts_run: 0 },
                  }
                } else {
                  report = JSON.parse(stdout)
                }
              } catch (error) {
                return yield* new ToolFailure({
                  message: `Failed to parse rnmap JSON output: ${(error as Error).message}`,
                  metadata: { stderr: stderr.slice(0, 4_096), stdout_head: stdout.slice(0, 1_024) },
                })
              }

              const summary = summarize(report)
              return {
                output: report,
                content: [
                  { type: "text" as const, text: summary },
                  ...(stderr.trim().length > 0
                    ? [{ type: "text" as const, text: `[rnmap stderr]\n${stderr.trim().slice(0, 4_096)}` }]
                    : []),
                ],
                metadata: {
                  exitCode,
                  binary: path.basename(binary),
                  hostCount: report.hosts?.length ?? 0,
                  hostsUp: report.stats?.hosts_up ?? 0,
                  portsOpen: report.stats?.ports_open ?? 0,
                  elapsedMs: report.scanner?.elapsed_ms ?? 0,
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
  resolveScriptDir,
  buildArgs,
  shellEscape,
  summarize,
  candidateBinaries,
  candidateScriptDirs,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
}

// Ensure the node:os import is referenced (kept for future platform-specific binary selection).
void os.platform
