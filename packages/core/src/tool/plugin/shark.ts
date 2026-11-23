export * as SharkTool from "./shark.js"

import type { Context } from "@codeshod/plugin/effect/plugin"
import { ToolFailure } from "@codeshod/ai/effect"
import { Duration, Effect, Schema } from "effect"
import { exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Permission } from "../../permission.js"

export const name = "shark"

// Binary + samples resolution mirrors the nmap/msfx tool pattern.
const platformArch = `${process.platform}-${process.arch}`
const candidateBinaries: readonly string[] = [
  process.env.CODESHOD_SHARK_BIN ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "shark", "bin", `shark-${platformArch}`),
  path.join(path.dirname(process.execPath), "shark"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "shark"),
  "/usr/lib/codeshod/shark",
  "shark",
].filter((value) => value.length > 0)

const candidateSampleDirs: readonly string[] = [
  process.env.CODESHOD_SHARK_SAMPLES ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "shark", "samples"),
  path.join(path.dirname(process.execPath), "shark-samples"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "shark-samples"),
  "/usr/lib/codeshod/shark-samples",
].filter((value) => value.length > 0)

const resolveBinary = (): string => {
  for (const candidate of candidateBinaries) {
    if (candidate === "shark") return candidate
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {
      // ignore — try next candidate
    }
  }
  return "shark"
}

const resolveSampleDir = (): string | undefined => {
  for (const candidate of candidateSampleDirs) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate
    } catch {
      // ignore — try next candidate
    }
  }
  return undefined
}

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 5 * 60_000

const Timeout = Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_MS))

/**
 * The unified operation the agent wants to perform, mirroring the msfx tool pattern.
 *
 * Each operation maps to a `shark <subcommand>` invocation. The shark binary is a
 * single executable with subcommands: `tshark`, `capinfos`, `captype`, `editcap`,
 * `mergecap`, `reordercap`, `dumpcap`, `randpkt`, `list-fields`. (The original
 * `sharkd-mcp` JSON-RPC stdio server was removed when this was integrated as a
 * first-party Codeshod built-in — every action is one-shot through the CLI.)
 */
export const Operation = Schema.Literals([
  "tshark",
  "protocol_hierarchy",
  "conversations",
  "capinfos",
  "captype",
  "editcap",
  "mergecap",
  "reordercap",
  "dumpcap",
  "randpkt",
  "list_fields",
]).annotate({
  description:
    "Which shark operation to perform. 'tshark' reads packets with optional display filter + field extraction. 'protocol_hierarchy' / 'conversations' produce stats. 'capinfos' / 'captype' inspect a file. 'editcap' / 'mergecap' / 'reordercap' rewrite captures. 'dumpcap' is Linux live capture (needs root). 'randpkt' generates test packets. 'list_fields' enumerates dissectable field names.",
})

export const Input = Schema.Struct({
  operation: Operation,
  file: Schema.optionalKey(Schema.String).annotate({
    description:
      "Path to the capture file (.pcap or .pcapng) for read operations. May be relative to the workspace, or an absolute path. For operations that take a sample, set `useSample` instead.",
  }),
  useSample: Schema.optionalKey(Schema.String).annotate({
    description:
      "Name of a built-in sample capture to use (e.g. 'http.pcap', 'dns-mdns.pcap', 'dhcp.pcapng'). The tool resolves it from the bundled samples directory. Mutually exclusive with `file`.",
  }),
  filter: Schema.optionalKey(Schema.String).annotate({
    description:
      "Wireshark-style display filter (practical subset, no regex). Examples: 'tcp.port == 80', 'dns.qry.name contains \"example\"', 'http && !udp', 'ip.addr == 10.0.0.0/8'.",
  }),
  fields: Schema.optionalKey(Schema.Array(Schema.String)).annotate({
    description:
      "Fields to extract (like tshark -e). Empty = full packet JSON. Examples: 'ip.src', 'tcp.dstport', 'dns.qry.name', 'http.host'. Use operation='list_fields' to enumerate all field names.",
  }),
  count: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "Stop after this many matched packets (tshark) or generated packets (randpkt), or stop after N packets captured (dumpcap).",
  }),
  skip: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))).annotate({
    description: "Skip the first N matched packets (tshark only).",
  }),
  protos: Schema.optionalKey(Schema.String).annotate({
    description:
      "Comma-separated protocol list for 'conversations' (e.g. 'tcp,ip' or 'udp,ipv6,eth'). Default: all of eth, ip, ipv6, tcp, udp.",
  }),
  output: Schema.optionalKey(Schema.String).annotate({
    description:
      "Output capture file path for editcap/mergecap/reordercap/dumpcap/randpkt. May be relative to the workspace or absolute.",
  }),
  inputs: Schema.optionalKey(Schema.Array(Schema.String)).annotate({
    description: "Input capture file paths for mergecap (2 or more files merged chronologically).",
  }),
  input: Schema.optionalKey(Schema.String).annotate({
    description: "Input capture file path for editcap/reordercap (single file).",
  }),
  snaplen: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "editcap: truncate packets to this many bytes (like -s).",
  }),
  dedup: Schema.optionalKey(Schema.Boolean).annotate({
    description: "editcap: remove duplicate packets (sliding FNV-1a hash window).",
  }),
  start: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "editcap: keep packets starting from this 1-based number.",
  }),
  rangeCount: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "editcap: keep this many packets from `start`.",
  }),
  invertRange: Schema.optionalKey(Schema.Boolean).annotate({
    description: "editcap: invert the range selection (keep everything outside start..start+count).",
  }),
  iface: Schema.optionalKey(Schema.String).annotate({
    description: "dumpcap: interface name (default: first non-loopback). Use operation='dumpcap' with `listInterfaces: true` to enumerate.",
  }),
  duration: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0))).annotate({
    description: "dumpcap: stop after this many seconds.",
  }),
  listInterfaces: Schema.optionalKey(Schema.Boolean).annotate({
    description: "dumpcap: list interfaces and exit (no capture).",
  }),
  ptype: Schema.optionalKey(Schema.Literals(["tcp", "udp", "dns", "arp", "icmp", "random"])).annotate({
    description: "randpkt: packet type. Default 'random'.",
  }),
  seed: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))).annotate({
    description: "randpkt: RNG seed for reproducible output. Default 42.",
  }),
  prefix: Schema.optionalKey(Schema.String).annotate({
    description: "list_fields: filter by prefix (e.g. 'dns.' or 'tcp.'). Empty = all fields.",
  }),
  pretty: Schema.optionalKey(Schema.Boolean).annotate({
    description: "Pretty-print the JSON output from shark before parsing. Default false (compact).",
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
  raw: Schema.Struct({
    exitCode: Schema.Number,
    stdout: Schema.String,
    stderr: Schema.String,
  }),
})

const description = `Run the built-in shark headless Wireshark suite against a capture file or live interface and return structured JSON.

shark is a pure-Rust Wireshark-style packet analyzer shipped with Codeshod as a first-party built-in tool. It is NOT an MCP server (the upstream sharkd-mcp JSON-RPC wrapper was removed during integration) and NOT a shell-out to system tshark/wireshark. The stripped release binary lives at packages/cli/assets/shark/bin/ (1.1 MB, no C deps, std-only + serde + nom + chrono + clap + libc) and is bundled with every Codeshod installation. Ten real Wireshark sample captures are bundled at packages/cli/assets/shark/samples/ for offline testing.

9 OPERATIONS (mirroring Wireshark's CLI tools):
- tshark             — read packets, apply display filters, extract fields
- protocol_hierarchy — -z io,phs stats (packets/bytes per protocol, nested tree)
- conversations      — who-talked-to-whom stats (eth/ip/ipv6/tcp/udp)
- capinfos           — file metadata: format, packet count, duration, rates, link type
- captype            — identify the capture file format
- editcap            — edit: snaplen, dedup, range selection (writes classic pcap)
- mergecap           — merge multiple captures chronologically
- reordercap         — sort packets by timestamp
- dumpcap            — LIVE capture via AF_PACKET (Linux, needs root/CAP_NET_RAW)
- randpkt            — generate deterministic random test packets
- list_fields        — enumerate all dissectable field names (~110 fields)

SUPPORTED PROTOCOLS: Ethernet, VLAN, ARP, IPv4, IPv6, TCP, UDP, ICMP, ICMPv6, DNS, mDNS, LLMNR, HTTP.

USE THIS TOOL WHEN:
- The user asks to analyze, dissect, or read a pcap/pcapng capture file.
- The user wants to apply a Wireshark-style display filter to a capture.
- The user wants to extract specific fields (ip.src, tcp.dstport, dns.qry.name, http.host, etc.) from packets.
- The user asks for protocol hierarchy or conversation statistics from a capture.
- The user wants to inspect capture file metadata (format, packet count, duration, rates).
- The user wants to edit, merge, reorder, or generate capture files.
- The user mentions wireshark, tshark, pcap, pcapng, packet capture, packet analysis, or network forensics.
- The user wants to generate test packets with a deterministic seed.

DO NOT USE THIS TOOL FOR:
- Live network scanning or port discovery — use the 'nmap' tool instead.
- Metasploit-style exploitation work — use the 'msfx' tool instead.
- Local file reads, code search, or web fetches — use 'read', 'grep', or 'webfetch' instead.
- Live capture on non-Linux systems — dumpcap is Linux AF_PACKET only.
- Continuous monitoring — the tool caps wall-clock time at 5 minutes per call.

PERMISSIONS:
- The action 'shark' is asserted against the operation-specific resource (file path for read ops, output path for write ops, operation name for read-only ops). Repository rules typically allow workspace paths and the bundled samples directory.
- For dumpcap (live capture), the metadata includes the interface name so approval prompts show what will be captured.

OUTPUT:
- Always a JSON object: { operation, ok, summary, data, raw }. The 'data' field carries the parsed JSON output from shark (packet list, stats, file info, edit counts, etc.). The 'raw' field carries the subprocess exit code and stdout/stderr for debugging.

AUTHORIZED USE ONLY for live capture (dumpcap). Reading and analyzing capture files is safe everywhere. Live capture on a network you do not own or have permission to monitor may be illegal.
`

/** Resolve the file path: if `useSample` is set, resolve from the bundled samples dir; otherwise use `file` as-is. */
const resolveFile = (input: (typeof Input.Type), sampleDir: string | undefined): string | undefined => {
  if (input.useSample) {
    if (!sampleDir) return undefined
    const candidate = path.join(sampleDir, input.useSample)
    return fs.existsSync(candidate) ? candidate : undefined
  }
  return input.file
}

/** Escape a single argv value for safe shell passing. */
const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

/** Build the argv list for the shark subprocess based on the operation. */
const buildArgs = (input: (typeof Input.Type), file: string | undefined): readonly string[] => {
  const args: string[] = []
  switch (input.operation) {
    case "tshark": {
      if (!file) return ["--help"]
      args.push("tshark", "--read", shellEscape(file))
      if (input.filter) args.push("-Y", shellEscape(input.filter))
      for (const f of input.fields ?? []) args.push("-e", shellEscape(f))
      if (input.count) args.push("-c", String(input.count))
      if (input.skip && input.skip > 0) args.push("--skip", String(input.skip))
      // protocol_hierarchy and conversations are sub-modes of tshark in the CLI.
      // They have their own operation values, so we don't add --phs/--conversations here.
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "protocol_hierarchy": {
      if (!file) return ["--help"]
      args.push("tshark", "--read", shellEscape(file), "--phs")
      if (input.filter) args.push("-Y", shellEscape(input.filter))
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "conversations": {
      if (!file) return ["--help"]
      args.push("tshark", "--read", shellEscape(file))
      const protoSpec = input.protos ?? ""
      args.push("--conversations", shellEscape(protoSpec))
      if (input.filter) args.push("-Y", shellEscape(input.filter))
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "capinfos": {
      if (!file) return ["--help"]
      args.push("capinfos", "--file", shellEscape(file))
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "captype": {
      if (!file) return ["--help"]
      args.push("captype", "--file", shellEscape(file))
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "editcap": {
      const inPath = input.input ?? file
      if (!inPath || !input.output) return ["--help"]
      args.push("editcap", "--input", shellEscape(inPath), "--output", shellEscape(input.output))
      if (input.snaplen) args.push("-s", String(input.snaplen))
      if (input.dedup) args.push("-d")
      if (input.start) args.push("--start", String(input.start))
      if (input.rangeCount) args.push("--count", String(input.rangeCount))
      if (input.invertRange) args.push("-I")
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "mergecap": {
      if (!input.inputs || input.inputs.length === 0 || !input.output) return ["--help"]
      args.push("mergecap", "--inputs", ...input.inputs.map(shellEscape), "--output", shellEscape(input.output))
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "reordercap": {
      const inPath = input.input ?? file
      if (!inPath || !input.output) return ["--help"]
      args.push("reordercap", "--input", shellEscape(inPath), "--output", shellEscape(input.output))
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "dumpcap": {
      if (input.listInterfaces) {
        args.push("dumpcap", "-D")
        if (input.pretty) args.push("--pretty")
        return args
      }
      if (!input.output) return ["--help"]
      args.push("dumpcap", "--output", shellEscape(input.output))
      if (input.iface) args.push("-i", shellEscape(input.iface))
      if (input.count) args.push("-c", String(input.count))
      if (input.duration) args.push("-a", String(input.duration))
      if (input.filter) args.push("-Y", shellEscape(input.filter))
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "randpkt": {
      if (!input.output) return ["--help"]
      args.push("randpkt", "--output", shellEscape(input.output))
      if (input.count) args.push("-c", String(input.count))
      if (input.ptype) args.push("-t", input.ptype)
      if (input.seed !== undefined) args.push("-S", String(input.seed))
      if (input.pretty) args.push("--pretty")
      return args
    }
    case "list_fields": {
      args.push("list-fields")
      if (input.prefix) args.push("--prefix", shellEscape(input.prefix))
      if (input.pretty) args.push("--pretty")
      return args
    }
    default:
      return ["--help"]
  }
}

const runShark = (
  binary: string,
  argv: readonly string[],
  timeoutMs: number,
): Effect.Effect<{ stdout: string; stderr: string; exitCode: number }, Error> =>
  Effect.callback<{ stdout: string; stderr: string; exitCode: number }, Error, never>((resume) => {
    const child = exec(
      [binary, ...argv].join(" "),
      {
        maxBuffer: 32 * 1024 * 1024,
        timeout: timeoutMs,
        env: { ...process.env },
      },
      (err, stdout, stderr) => {
        if (err && "killed" in err && err.killed === true) {
          resume(Effect.fail(new Error(`shark call exceeded ${timeoutMs}ms wall-clock timeout`)))
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
      orElse: () => Effect.fail(new Error(`shark call exceeded ${timeoutMs}ms wall-clock timeout`)),
    }),
  )

/** Parse shark stdout into a structured result. shark always emits one JSON document per invocation. */
const parseOutput = (
  operation: string,
  stdout: string,
  stderr: string,
  exitCode: number,
): { ok: boolean; summary: string; data: unknown } => {
  if (exitCode !== 0) {
    return { ok: false, summary: stderr.trim() || `shark exited with code ${exitCode}`, data: null }
  }
  let parsed: any
  try {
    parsed = JSON.parse(stdout)
  } catch (error) {
    return { ok: false, summary: `Failed to parse shark JSON: ${(error as Error).message}`, data: { raw_stdout_head: stdout.slice(0, 1_024) } }
  }
  // Synthesize a one-line summary per operation.
  let summary = `${operation} ok`
  switch (operation) {
    case "tshark":
      summary = `matched ${parsed.matched_packets ?? parsed.returned ?? 0} of ${parsed.total_packets_in_file ?? "?"} packets, returned ${parsed.returned ?? 0}`
      break
    case "protocol_hierarchy":
      summary = `protocol_hierarchy: ${(parsed.protocol_hierarchy ?? []).length} top-level protocols, ${parsed.packets_considered ?? 0} packets considered`
      break
    case "conversations":
      summary = `conversations: ${(parsed.conversations ?? []).length} found across ${parsed.packets_considered ?? 0} packets`
      break
    case "capinfos":
      summary = `${parsed.file_type ?? "?"} with ${parsed.number_of_packets ?? 0} packets, ${parsed.capture_duration_seconds ?? 0}s duration`
      break
    case "captype":
      summary = `${parsed.file}: ${parsed.type}`
      break
    case "editcap":
      summary = `editcap: wrote ${parsed.packets_written ?? 0} of ${parsed.packets_in ?? 0} packets (dropped ${parsed.dropped_duplicates ?? 0} dups, ${parsed.dropped_by_range ?? 0} range)`
      break
    case "mergecap":
      summary = `mergecap: wrote ${parsed.packets_written ?? 0} of ${parsed.packets_in_total ?? 0} packets (chronological)`
      break
    case "reordercap":
      summary = `reordercap: wrote ${parsed.packets_written ?? 0} packets, ${parsed.out_of_order_pairs_in_input ?? 0} out-of-order pairs in input`
      break
    case "dumpcap":
      summary = `dumpcap: captured ${parsed.packets_captured ?? 0} packets on ${parsed.interface ?? "?"}`
      break
    case "randpkt":
      summary = `randpkt: wrote ${parsed.packets_written ?? 0} ${parsed.type ?? "random"} packets (seed ${parsed.seed ?? "?"})`
      break
    case "list_fields":
      summary = `list_fields: ${parsed.count ?? 0} fields${input_prefix_note(parsed)}`
      break
  }
  return { ok: true, summary, data: parsed }
}

const input_prefix_note = (parsed: any): string => (parsed.fields && parsed.fields.length > 0 ? ` starting with "${parsed.fields[0].name}"` : "")

/** Compress the structured result into a concise text summary for the model. */
const summarize = (operation: string, result: { ok: boolean; summary: string; data: any }): string => {
  const lines: string[] = [`shark ${operation}: ${result.ok ? "ok" : "failed"} — ${result.summary}`]
  if (!result.ok) return lines.join("\n")
  switch (operation) {
    case "tshark": {
      const packets = result.data?.packets ?? []
      if (packets.length > 0) {
        lines.push(`first packet:`)
        const first = packets[0]
        const keys = Object.keys(first).slice(0, 12)
        for (const k of keys) lines.push(`  ${k} = ${JSON.stringify(first[k])}`)
        if (packets.length > 1) lines.push(`... and ${packets.length - 1} more`)
      }
      break
    }
    case "protocol_hierarchy": {
      const top = result.data?.protocol_hierarchy ?? []
      for (const node of top.slice(0, 5)) {
        lines.push(`- ${node.protocol}: ${node.packets} pkts (${(node.percent_packets ?? 0).toFixed(1)}%)`)
      }
      break
    }
    case "conversations": {
      const convs = result.data?.conversations ?? []
      for (const c of convs.slice(0, 8)) {
        const pa = c.port_a ? `:${c.port_a}` : ""
        const pb = c.port_b ? `:${c.port_b}` : ""
        lines.push(`- ${c.proto} ${c.addr_a}${pa} <-> ${c.addr_b}${pb}: ${c.packets_total} pkts, ${c.bytes_total} bytes`)
      }
      break
    }
    case "capinfos": {
      const d = result.data
      if (d) {
        lines.push(`- file: ${d.file}`)
        lines.push(`- type: ${d.file_type}, link: ${d.link_type ?? "?"}`)
        lines.push(`- packets: ${d.number_of_packets}, size: ${d.file_size_bytes} bytes`)
        lines.push(`- duration: ${d.capture_duration_seconds}s, first: ${d.first_packet_time_utc}`)
        lines.push(`- avg: ${d.average_packets_per_sec} pkt/s, ${d.average_bytes_per_sec} B/s, ${d.average_packet_size_bytes} B/pkt`)
      }
      break
    }
    case "captype": {
      lines.push(`- ${result.data?.file}: ${result.data?.type}`)
      break
    }
    case "editcap":
    case "mergecap":
    case "reordercap":
    case "dumpcap":
    case "randpkt":
      // Summary line already covers these.
      break
    case "list_fields": {
      const fields = result.data?.fields ?? []
      for (const f of fields.slice(0, 20)) {
        lines.push(`- ${f.name} [${f.type}]: ${f.description}`)
      }
      if (fields.length > 20) lines.push(`... and ${fields.length - 20} more`)
      break
    }
  }
  return lines.join("\n")
}

export const Plugin = {
  id: "codeshod.tool.shark",
  effect: Effect.fn("SharkTool.Plugin")(function* (ctx: Context) {
    const permission = yield* Permission.Service

    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          // shark is a network packet analysis tool — never exposed in Code Mode.
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const sampleDir = resolveSampleDir()
              const file = resolveFile(input, sampleDir)

              // Permission resource depends on the operation:
              // - read ops (tshark, capinfos, captype, phs, conversations) → the file path (or sample name)
              // - write ops (editcap, mergecap, reordercap, dumpcap, randpkt) → the output path
              // - list_fields → the operation name
              const isWriteOp = ["editcap", "mergecap", "reordercap", "dumpcap", "randpkt"].includes(input.operation)
              const resource = isWriteOp
                ? input.output ?? input.operation
                : input.operation === "list_fields"
                  ? input.operation
                  : file ?? input.useSample ?? input.operation
              yield* permission.assert({
                action: name,
                resources: [resource],
                save: ["*"],
                metadata: {
                  operation: input.operation,
                  file: file ?? input.useSample,
                  filter: input.filter,
                  fields: input.fields,
                  count: input.count,
                  skip: input.skip,
                  protos: input.protos,
                  output: input.output,
                  inputs: input.inputs,
                  input: input.input,
                  snaplen: input.snaplen,
                  dedup: input.dedup,
                  start: input.start,
                  rangeCount: input.rangeCount,
                  invertRange: input.invertRange,
                  iface: input.iface,
                  duration: input.duration,
                  listInterfaces: input.listInterfaces,
                  ptype: input.ptype,
                  seed: input.seed,
                  prefix: input.prefix,
                  pretty: input.pretty,
                },
                ...Permission.invocation(context),
              })

              const binary = resolveBinary()
              const argv = buildArgs(input, file)
              const timeoutMs = (input.timeout ?? DEFAULT_TIMEOUT_MS / 1_000) * 1_000

              const { stdout, stderr, exitCode } = yield* runShark(binary, argv, timeoutMs).pipe(
                Effect.mapError(
                  (error) => new ToolFailure({ message: `shark invocation failed: ${error.message}`, error }),
                ),
              )

              // shark exit codes: 0 ok, 1 error (file not found, bad filter, etc.).
              // We don't fail the tool on exit 1 — the agent still gets stderr to reason about.
              // Only timeout and process-spawn errors fail at the runShark layer.
              const parsed = parseOutput(input.operation, stdout, stderr, exitCode)
              const summary = summarize(input.operation, parsed)

              return {
                output: {
                  operation: input.operation,
                  ok: parsed.ok,
                  summary: parsed.summary,
                  data: parsed.data,
                  raw: { exitCode, stdout: stdout.slice(0, 32_768), stderr: stderr.slice(0, 4_096) },
                },
                content: [
                  { type: "text" as const, text: summary },
                  ...(stderr.trim().length > 0
                    ? [{ type: "text" as const, text: `[shark stderr]\n${stderr.trim().slice(0, 4_096)}` }]
                    : []),
                ],
                metadata: {
                  exitCode,
                  binary: path.basename(binary),
                  operation: input.operation,
                  ok: parsed.ok,
                  argv: argv.join(" ").slice(0, 512),
                  ...(file ? { resolvedFile: file } : {}),
                  ...(sampleDir ? { sampleDir } : {}),
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
  resolveSampleDir,
  resolveFile,
  buildArgs,
  shellEscape,
  parseOutput,
  summarize,
  candidateBinaries,
  candidateSampleDirs,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
}
