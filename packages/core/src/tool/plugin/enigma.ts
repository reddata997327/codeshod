export * as EnigmaTool from "./enigma.js"

import type { Context } from "@codeshod/plugin/effect/plugin"
import { ToolFailure } from "@codeshod/ai/effect"
import { Duration, Effect, Schema } from "effect"
import { exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Permission } from "../../permission.js"

export const name = "enigma"

// Binary resolution mirrors the other tool patterns.
const platformArch = `${process.platform}-${process.arch}`
const candidateBinaries: readonly string[] = [
  process.env.CODESHOD_ENIGMA_BIN ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "enigma", "bin", `enigma-rs-${platformArch}`),
  path.join(path.dirname(process.execPath), "enigma-rs"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "enigma-rs"),
  "/usr/lib/codeshod/enigma-rs",
  "enigma-rs",
].filter((value) => value.length > 0)

const resolveBinary = (): string => {
  for (const candidate of candidateBinaries) {
    if (candidate === "enigma-rs") return candidate
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {
      // ignore — try next candidate
    }
  }
  return "enigma-rs"
}

// Unpack mode brute-forces a 32-bit salt across up to 2^32 keys. On CPU this
// can take hours-to-days per binary. Default 10 minutes, max 30 minutes —
// long enough for a quick CPU sweep or a GPU-accelerated unpack.
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 5 * 60_000
// Unpack gets a longer default because the salt search is expensive even on GPU.
const UNPACK_DEFAULT_TIMEOUT_MS = 10 * 60_000
const UNPACK_MAX_TIMEOUT_MS = 30 * 60_000

const Timeout = Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_MS))

/**
 * Which enigma-rs operation to perform. Mirrors the `--mode` CLI flag.
 */
export const Operation = Schema.Literals(["unpack", "runtime", "scan", "devirt"]).annotate({
  description:
    "Which enigma-rs operation to perform. 'unpack' (default) brute-forces the section salt, decrypts sections, recovers imports, and rebuilds a runnable unpacked EXE + extracted EVB files into an 'unpack/' directory next to the input. 'runtime' extracts just the embedded RVA-mapped loader DLL (the Enigma VM). 'scan' lists template-VM entry point RVAs. 'devirt' lifts one VM entry RVA back to x86 assembly or machine code.",
})

export const Backend = Schema.Literals(["cuda", "wgpu", "cpu"]).annotate({
  description:
    "Search backend for unpack mode. 'cuda' uses an NVIDIA GPU (fastest, requires NVIDIA driver + CUDA runtime). 'wgpu' uses any compatible GPU via WebGPU. 'cpu' uses every logical CPU core (slow — 2^32 keyspace). Omit to auto-select (tries CUDA → WGPU → CPU). Only valid with operation='unpack'.",
})

export const Input = Schema.Struct({
  operation: Operation,
  input: Schema.String.annotate({
    description:
      "Path to the protected EXE (32-bit Windows PE) or an extracted RVA-mapped runtime DLL. May be relative to the workspace or absolute.",
  }),
  rva: Schema.optionalKey(Schema.String).annotate({
    description:
      "Hexadecimal vm_enter RVA for devirt mode (e.g. '0x23b053' or '23b053'). Required for devirt, ignored by other modes. Use scan to discover valid RVAs first.",
  }),
  output: Schema.optionalKey(Schema.String).annotate({
    description:
      "Output path. For scan/devirt: defaults to stdout; specify a file to write instead. For devirt: extension '.bin' writes raw x86 machine code, anything else writes assembly text. For runtime: defaults to 'unpack/runtime.dll' next to the input; specify to override. Ignored by unpack (always writes to the adjacent 'unpack/' directory).",
  }),
  backend: Schema.optionalKey(Backend).annotate({
    description: "Search backend for unpack mode. Omit to auto-select (CUDA → WGPU → CPU).",
  }),
  timeout: Schema.optionalKey(Timeout).annotate({
    description: `Optional per-call wall-clock timeout in seconds (max ${MAX_TIMEOUT_MS / 1000} for read ops, ${UNPACK_MAX_TIMEOUT_MS / 1000} for unpack). Default ${DEFAULT_TIMEOUT_MS / 1000} for read ops, ${UNPACK_DEFAULT_TIMEOUT_MS / 1000} for unpack.`,
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
    binaryPath: Schema.String,
  }),
})

const description = `Run the built-in enigma-rs static Enigma Protector unpacker and VM devirtualizer.

enigma-rs is a pure-Rust static unpacker and devirtualizer for the Enigma Protector packer — a commercial Windows executable protector that wraps 32-bit PE files with RC4 + IDEA-CBC section encryption, anti-debug checks, and a custom virtual machine that obfuscates the original x86 code. It recovers the original PE, extracts the embedded runtime DLL, lists VM entry points, and lifts VM-protected functions back to native x86.

The stripped release binary lives at packages/cli/assets/enigma/bin/ (9.1 MB, std-only + anyhow + clap + crc32fast + iced-x86 + indicatif + md5 + optional cubecl CUDA/WGPU backends) and is bundled with every Codeshod installation. Only the binary is bundled (no source code).

4 OPERATIONS (select via the 'operation' field, mirrors the --mode CLI flag):

- unpack (default) — brute-force the 32-bit section salt (CUDA/WGPU/CPU), decrypt sections with RC4 + IDEA-CBC, recover imports, rebuild a runnable unpacked EXE + extracted EVB (Virtual Box) files into an 'unpack/' directory next to the input. GPU-accelerated; on CPU the 2^32 keyspace takes hours-to-days.
- runtime — skip the salt search; just extract the embedded RVA-mapped loader DLL (the Enigma VM). Useful when you only want to inspect the VM.
- scan — parse the loader/runtime DLL, find every template-VM entry point, print their RVAs (hex addresses).
- devirt — take one VM entry RVA, decode the Enigma VM bytecode for that function, lift it back to native x86, emit assembly (.asm) or raw machine code (.bin).

USE THIS TOOL WHEN:
- The user has an Enigma-protected 32-bit Windows EXE and wants to unpack it (recover the original PE).
- The user wants to extract the Enigma VM runtime DLL for further study.
- The user wants to list VM entry points in a protected binary.
- The user wants to devirtualize a specific VM-protected function back to x86.
- The user mentions Enigma Protector, "Enigma unpacker", "VM devirtualization", "section salt brute-force", "IDEA-CBC", "RC4 section decryption", or "Virtual Box extraction".

DO NOT USE THIS TOOL FOR:
- 64-bit PE files. enigma-rs only supports x86 (32-bit PE). x64 is not supported.
- Non-Enigma packers (UPX, Themida, VMProtect, ASPack, etc.). Each packer has its own unpacker; enigma-rs is Enigma-specific.
- Production serving or execution of the unpacked binary. The output is for static analysis only.
- Live packet capture or network scanning. Use 'shark' or 'nmap'.
- General HTTP requests. Use 'webfetch'.

PERMISSIONS:
- The action 'enigma' is asserted against the operation-specific resource (the input file path for read ops, the output path for write ops). Repository rules typically allow workspace paths and ask before unpacking (which writes an 'unpack/' directory and may produce executable output).
- For devirt, the metadata includes the RVA so approval prompts show which function is being lifted.

OUTPUT:
- Always a JSON object: { operation, ok, summary, stdout, stderr, data, raw }. The 'stdout' and 'stderr' fields carry the raw subprocess output (truncated to 32 KB / 4 KB). The 'raw' field carries the exit code, argv, and resolved binary path for debugging.

LIMITATIONS:
- x86 (32-bit PE) only — x64 not supported.
- The bundled binary is built WITHOUT CUDA support (the codeshod sandbox has no NVIDIA GPU). The WGPU backend is included but requires a compatible GPU + driver at runtime. The CPU backend always works but is slow (2^32 keyspace).
- No test fixtures are bundled (Enigma-protected sample EXEs are copyrighted / potentially flagged as malware). The integration tests exercise CLI argument validation and PE-parse error paths only.
`

const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

/** Build the argv list for the enigma-rs subprocess. */
const buildArgs = (input: (typeof Input.Type)): readonly string[] => {
  const args: string[] = [shellEscape(input.input)]
  if (input.operation !== "unpack") {
    args.push("--mode", input.operation)
  }
  if (input.operation === "devirt" && input.rva) {
    args.push(shellEscape(input.rva))
  }
  if (input.output) {
    args.push("-o", shellEscape(input.output))
  }
  if (input.operation === "unpack" && input.backend) {
    args.push("--mod", input.backend)
  }
  return args
}

const runEnigma = (
  binary: string,
  argv: readonly string[],
  timeoutMs: number,
): Effect.Effect<{ stdout: string; stderr: string; exitCode: number }, Error> =>
  Effect.callback<{ stdout: string; stderr: string; exitCode: number }, Error, never>((resume) => {
    const child = exec(
      [binary, ...argv].join(" "),
      {
        maxBuffer: 64 * 1024 * 1024,
        timeout: timeoutMs,
        env: { ...process.env },
      },
      (err, stdout, stderr) => {
        if (err && "killed" in err && err.killed === true) {
          resume(Effect.fail(new Error(`enigma-rs call exceeded ${timeoutMs}ms wall-clock timeout`)))
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
      orElse: () => Effect.fail(new Error(`enigma-rs call exceeded ${timeoutMs}ms wall-clock timeout`)),
    }),
  )

/** Parse enigma-rs output into a structured result. */
const parseOutputCore = (
  operation: string,
  stdout: string,
  stderr: string,
  exitCode: number,
): { ok: boolean; summary: string; data: unknown } => {
  if (exitCode !== 0) {
    const errLine = stderr.trim().split("\n")[0] ?? `enigma-rs exited with code ${exitCode}`
    return { ok: false, summary: errLine, data: { stderr: stderr.slice(0, 4_096) } }
  }
  const out = stdout.trim()
  switch (operation) {
    case "unpack": {
      // unpack writes to the adjacent unpack/ directory and prints progress to stderr.
      // stdout is usually empty; the summary comes from stderr's last lines.
      const errLines = stderr.trim().split("\n").filter((l) => l.length > 0)
      const lastLine = errLines[errLines.length - 1] ?? "unpack complete"
      return {
        ok: true,
        summary: lastLine,
        data: { unpackDir: "unpack/ (adjacent to input)", stderrLines: errLines.slice(-10) },
      }
    }
    case "runtime": {
      // runtime extracts to unpack/runtime.dll (or -o path) and prints little.
      return {
        ok: true,
        summary: out || "runtime extracted (check output path)",
        data: { raw: out },
      }
    }
    case "scan": {
      // scan prints hex RVAs one per line to stdout.
      const rvas = out
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => l.replace(/^0x/i, ""))
      return {
        ok: true,
        summary: `scan found ${rvas.length} VM entry RVA(s)`,
        data: { rvas, count: rvas.length },
      }
    }
    case "devirt": {
      // devirt prints metadata to stderr ("x86: N bytes, image base=0x..., code RVA=0x...")
      // and assembly/machine code to stdout (or the -o file).
      const metaLine = stderr.trim().split("\n").find((l) => l.startsWith("x86:"))
      const byteCount = metaLine ? Number(metaLine.match(/(\d+) bytes/)?.[1] ?? 0) : 0
      const imageBase = metaLine?.match(/image base=(0x[0-9a-f]+)/i)?.[1]
      const codeRva = metaLine?.match(/code RVA=(0x[0-9a-f]+)/i)?.[1]
      return {
        ok: true,
        summary: metaLine ?? `devirt complete (${out.length} bytes output)`,
        data: {
          bytes: byteCount,
          imageBase,
          codeRva,
          outputLength: out.length,
          outputPreview: out.slice(0, 1_024),
        },
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
  const lines: string[] = [`enigma ${operation}: ${result.ok ? "ok" : "failed"} — ${result.summary}`]
  if (!result.ok) return lines.join("\n")
  switch (operation) {
    case "scan": {
      const rvas = result.data?.rvas ?? []
      if (rvas.length > 0) {
        lines.push(`VM entry RVAs:`)
        for (const rva of rvas.slice(0, 20)) lines.push(`  0x${rva}`)
        if (rvas.length > 20) lines.push(`  ... and ${rvas.length - 20} more`)
      } else {
        lines.push(`(no VM entries found)`)
      }
      break
    }
    case "devirt": {
      if (result.data?.bytes) lines.push(`lifted ${result.data.bytes} bytes of x86`)
      if (result.data?.imageBase) lines.push(`image base: ${result.data.imageBase}`)
      if (result.data?.codeRva) lines.push(`code RVA: ${result.data.codeRva}`)
      if (result.data?.outputPreview) lines.push(`output preview: ${result.data.outputPreview.slice(0, 512)}`)
      break
    }
    case "unpack": {
      if (result.data?.unpackDir) lines.push(`output: ${result.data.unpackDir}`)
      if (result.data?.stderrLines) {
        lines.push(`stderr tail:`)
        for (const l of result.data.stderrLines.slice(-5)) lines.push(`  ${l}`)
      }
      break
    }
    case "runtime": {
      lines.push(`output: unpack/runtime.dll (or -o path)`)
      break
    }
  }
  return lines.join("\n")
}

export const Plugin = {
  id: "codeshod.tool.enigma",
  effect: Effect.fn("EnigmaTool.Plugin")(function* (ctx: Context) {
    const permission = yield* Permission.Service

    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          // enigma unpacks protected binaries — not a Code Mode tool.
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              // Permission: assert against the input file path (read) or the output
              // path (write). For unpack, the "output" is the adjacent unpack/
              // directory, so we assert against the input path.
              const isWriteOp = input.operation === "unpack" || input.operation === "runtime" || !!input.output
              const resource = isWriteOp
                ? input.output ?? input.input
                : input.input
              yield* permission.assert({
                action: name,
                resources: [resource],
                save: ["*"],
                metadata: {
                  operation: input.operation,
                  input: input.input,
                  rva: input.rva,
                  output: input.output,
                  backend: input.backend,
                },
                ...Permission.invocation(context),
              })

              const binary = resolveBinary()
              const argv = buildArgs(input)
              const isUnpack = input.operation === "unpack"
              const defaultTimeout = isUnpack ? UNPACK_DEFAULT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
              const maxTimeout = isUnpack ? UNPACK_MAX_TIMEOUT_MS : MAX_TIMEOUT_MS
              const requestedTimeout = input.timeout ?? defaultTimeout / 1_000
              const timeoutSecs = Math.min(requestedTimeout, maxTimeout / 1_000)
              const timeoutMs = timeoutSecs * 1_000

              const { stdout, stderr, exitCode } = yield* runEnigma(binary, argv, timeoutMs).pipe(
                Effect.mapError(
                  (error) => new ToolFailure({ message: `enigma-rs invocation failed: ${error.message}`, error }),
                ),
              )

              // enigma-rs exit codes: 0 ok, 1 error (bad args, PE parse failure,
              // unpack failure, devirt failure). We don't fail the call on exit 1
              // — the agent still gets stdout/stderr to reason about.
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
                    binaryPath: binary,
                  },
                },
                content: [
                  { type: "text" as const, text: summary },
                  ...(stderr.trim().length > 0
                    ? [{ type: "text" as const, text: `[enigma stderr]\n${stderr.trim().slice(0, 4_096)}` }]
                    : []),
                ],
                metadata: {
                  exitCode,
                  binary: path.basename(binary),
                  operation: input.operation,
                  ok: parsed.ok,
                  argv: argv.join(" ").slice(0, 512),
                  timeoutMs,
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
  UNPACK_DEFAULT_TIMEOUT_MS,
  UNPACK_MAX_TIMEOUT_MS,
}
