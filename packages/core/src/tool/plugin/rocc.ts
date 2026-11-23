export * as RoccTool from "./rocc.js"

import type { Context } from "@codeshod/plugin/effect/plugin"
import { ToolFailure } from "@codeshod/ai/effect"
import { Duration, Effect, Schema } from "effect"
import { exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Permission } from "../../permission.js"

export const name = "rocc"

// rocc ships 7 binaries, all under packages/cli/assets/rocc/bin/. The tool
// dispatches to the right one based on the `binary` input field.
const platformArch = `${process.platform}-${process.arch}`
const candidateBinDirs: readonly string[] = [
  process.env.CODESHOD_ROCC_BIN_DIR ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "rocc", "bin"),
  path.join(path.dirname(process.execPath), "rocc-bin"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "rocc-bin"),
  "/usr/lib/codeshod/rocc-bin",
].filter((value) => value.length > 0)

const resolveBinDir = (): string => {
  for (const candidate of candidateBinDirs) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate
    } catch {
      // ignore — try next candidate
    }
  }
  return ""
}

/** Resolve a single rocc binary by name (e.g. "rocc-primitives" → full path). */
const resolveBinary = (binaryName: string): string => {
  const dir = resolveBinDir()
  if (dir) {
    const platformPath = path.join(dir, `${binaryName}-${platformArch}`)
    if (fs.existsSync(platformPath)) return platformPath
    const plainPath = path.join(dir, binaryName)
    if (fs.existsSync(plainPath)) return plainPath
  }
  return binaryName // fall back to PATH lookup
}

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 5 * 60_000
const Timeout = Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_MS))

/**
 * Which rocc binary to invoke. rocc is a workspace with 7 binaries:
 *   rocc-substrate  — the AMBIGUITY ledger (reference, bounds everything)
 *   rocc-primitives — exercise every primitive (list, demo)
 *   rocc-compose    — chains that declare primitives (list, smuggle, jwt, nonce-reuse)
 *   rocc-conformance — the validation gate (the only source of truth for "is it done")
 *   rocc-products   — usable batteries (smugglekit, phishstack, timing, signer-demo)
 *   rocc-tools      — build layer: cross-compile recipes, strip, pack, obf
 *   rocc-bench      — measure reliability and cost (writes bench/RESULTS.md)
 */
export const Binary = Schema.Literals([
  "rocc-substrate",
  "rocc-primitives",
  "rocc-compose",
  "rocc-conformance",
  "rocc-products",
  "rocc-tools",
  "rocc-bench",
]).annotate({
  description:
    "Which rocc binary to invoke. rocc-substrate prints the AMBIGUITY ledger (parsing/protocol/spec ambiguities with RFC references). rocc-primitives lists/demos the 10 irreducible primitives. rocc-compose runs chains (smuggle/jwt/nonce-reuse). rocc-conformance is the validation gate (the only source of truth for 'is it done'). rocc-products runs usable batteries (smugglekit/phishstack/timing/signer-demo). rocc-tools emits build recipes (cross/strip/pack/obf) and performs pack/obf transforms. rocc-bench measures reliability and cost.",
})

export const Input = Schema.Struct({
  binary: Binary,
  subcommand: Schema.optionalKey(Schema.String).annotate({
    description:
      "Subcommand to pass to the binary. Examples: 'ambiguity' (substrate), 'list'/'demo' (primitives), 'list'/'smuggle'/'jwt'/'nonce-reuse' (compose), 'md' or empty (conformance), 'list'/'smugglekit'/'phishstack'/'timing'/'signer-demo' (products), 'targets'/'emit'/'pack'/'obf' (tools). Omit for the default subcommand (usually 'version' or the help table).",
  }),
  args: Schema.optionalKey(Schema.Array(Schema.String)).annotate({
    description:
      "Additional positional/flag arguments to pass after the subcommand. For rocc-tools pack: ['--in', '/path/in', '--out', '/path/out']. For rocc-tools obf: ['--transform', 'xor-rolling', '--in', '/path/in', '--out', '/path/out']. For rocc-tools emit: ['cross'] or ['strip'] or ['pack'] or ['obf']. All values are shell-escaped by the tool.",
  }),
  timeout: Schema.optionalKey(Timeout).annotate({
    description: `Optional per-call wall-clock timeout in seconds (max ${MAX_TIMEOUT_MS / 1000}). Default ${DEFAULT_TIMEOUT_MS / 1000}. The conformance gate may take longer (up to 30s for the full LLL lattice reduction); bump this if needed.`,
  }),
})

export const Output = Schema.Struct({
  binary: Schema.String,
  subcommand: Schema.optionalKey(Schema.String),
  ok: Schema.Boolean,
  summary: Schema.String,
  stdout: Schema.String,
  stderr: Schema.String,
  raw: Schema.Struct({
    exitCode: Schema.Number,
    argv: Schema.String,
    binaryPath: Schema.String,
  }),
})

const description = `Run the built-in rocc registry of offensive capability and return its output.

rocc is a pure-Rust registry of offensive security primitives, chains, harnesses, products, and build tools shipped with Codeshod as a first-party built-in. It is NOT a shell-out to any external tool — the 7 stripped release binaries live at packages/cli/assets/rocc/bin/ (2.8 MB total, zero external dependencies, std-only) and are bundled with every Codeshod installation.

rocc decomposes every offensive act into irreducible primitives, each with a substrate bound (physics/math/semantics/economics) and a conformance gate. Nothing is "done" until rocc-conformance says so.

THE 7 BINARIES (select via the \`binary\` input field):

- rocc-substrate — the AMBIGUITY ledger (CL/TE, double-CL, obfuscated-TE, etc. with RFC references). Subcommand: 'ambiguity'.
- rocc-primitives — list/demo the 10 irreducible primitives. Subcommands: 'list', 'demo'.
- rocc-compose — chains that declare primitives (never reimplement them). Subcommands: 'list', 'smuggle' (CL/TE desync plan), 'jwt' (alg:none/HS-confusion/kid-path forgery), 'nonce-reuse' (ECDSA nonce-reuse key recovery demo).
- rocc-conformance — the validation gate. Runs all 10 primitives' conformance suites and prints PASS/FAIL per primitive. Subcommand: 'md' (markdown) or empty (plain table).
- rocc-products — usable batteries composed from chains. Subcommands: 'list', 'smugglekit' (multi-variant smuggling payloads), 'phishstack' (JWT forgery against a verifier model), 'timing' (race-window plan), 'signer-demo' (ECDSA key recovery from a signature corpus).
- rocc-tools — build layer. Subcommands: 'targets' (cross-compile matrix), 'emit <cross|strip|pack|obf>' (shell recipes), 'pack --in F --out F', 'obf --transform <xor-rolling|reverse> --in F --out F'.
- rocc-bench — measure reliability and cost (writes bench/RESULTS.md). Subcommand: 'write'.

THE 10 PRIMITIVES (all conformance-green, reliability 1.0):
- crypto/secp256k1     — point ops, SEC1, ECDSA sign/verify/recover, nonce-reuse detection
- crypto/ecdsa-nonce   — biased-nonce private-key recovery (HNP + exact integral LLL)
- chain/sha256-merkle  — SHA-256 + RFC 6962 trees, inclusion proofs, empty-tree root
- net/http-smuggle     — CL/TE parser differential + payload construction
- identity/jwt         — alg:none, HS-vs-RS confusion, kid path traversal
- identity/uuid-seq    — predictable-id classification → IDOR surface
- data/infer           — k-anonymity breaches, differencing, frequency bounds
- mem/race             — race-window success as a function of window and attempt period
- evade/encode         — encoding transforms and their inverses, plus the detector
- finance/cost-model   — expected value and break-even from measured reliability

USE THIS TOOL WHEN:
- The user asks about offensive security primitives (ECDSA nonce reuse, JWT alg:none forgery, CL/TE request smuggling, Merkle proofs, race windows, k-anonymity).
- The user wants to plan an attack chain (compose primitives into a smuggling payload, JWT forgery, timing attack).
- The user wants to verify a primitive works (rocc-conformance is the gate).
- The user wants to pack or obfuscate a payload (rocc-tools pack/obf with xor-rolling or reverse transforms).
- The user wants the AMBIGUITY ledger of parsing/protocol/spec ambiguities (rocc-substrate).
- The user mentions rocc, "irreducible primitives", "conformance gate", "HNP", "LLL lattice", "CL/TE desync", "alg:none", "kid path traversal", or "race-window success model".

DO NOT USE THIS TOOL FOR:
- Live network scanning — use 'nmap'.
- Live packet capture — use 'shark' (dumpcap).
- Metasploit-style exploitation with payloads — use 'msfx'.
- Web app scaffolding — use 'rustango'.
- Local file reads, code search, or web fetches.

PERMISSIONS:
- The action 'rocc' is asserted against the binary name (e.g. 'rocc-primitives') as the resource. Repository rules typically allow all read-only operations (list, demo, ambiguity, conformance, targets, emit) and ask before write operations (pack, obf, bench write).
- The full operation shape (binary, subcommand, args) is in 'metadata' so approval prompts show exactly what will run.

OUTPUT:
- Always a JSON object: { binary, subcommand, ok, summary, stdout, stderr, raw }. The 'stdout' and 'stderr' fields carry the raw subprocess output (truncated to 32 KB / 4 KB). The 'raw' field carries the exit code, argv, and resolved binary path for debugging.

The rocc source is intentionally NOT bundled in the codeshod tree — only the 7 stripped release binaries. Rebuilds land in packages/cli/assets/rocc/bin/ via the release workflow.
`

const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

const buildArgs = (input: (typeof Input.Type)): readonly string[] => {
  const args: string[] = []
  if (input.subcommand) args.push(shellEscape(input.subcommand))
  for (const a of input.args ?? []) args.push(shellEscape(a))
  return args
}

const runRocc = (
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
          resume(Effect.fail(new Error(`rocc call exceeded ${timeoutMs}ms wall-clock timeout`)))
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
      orElse: () => Effect.fail(new Error(`rocc call exceeded ${timeoutMs}ms wall-clock timeout`)),
    }),
  )

const summarize = (
  binaryName: string,
  subcommand: string | undefined,
  result: { stdout: string; stderr: string; exitCode: number },
): string => {
  const lines: string[] = [`rocc ${binaryName}${subcommand ? ` ${subcommand}` : ""}: exit ${result.exitCode}`]
  const out = result.stdout.trim()
  if (out) {
    const outLines = out.split("\n").slice(0, 20)
    lines.push(...outLines)
    if (out.split("\n").length > 20) lines.push(`... (${out.split("\n").length - 20} more lines)`)
  }
  if (result.stderr.trim()) {
    lines.push(`[stderr] ${result.stderr.trim().slice(0, 1_024)}`)
  }
  return lines.join("\n")
}

export const Plugin = {
  id: "codeshod.tool.rocc",
  effect: Effect.fn("RoccTool.Plugin")(function* (ctx: Context) {
    const permission = yield* Permission.Service

    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name,
          // rocc is an offensive security research tool — never exposed in Code Mode.
          options: { codemode: false },
          description,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              // Permission: assert against the binary name as the resource.
              const resource = input.binary
              yield* permission.assert({
                action: name,
                resources: [resource],
                save: ["*"],
                metadata: {
                  binary: input.binary,
                  subcommand: input.subcommand,
                  args: input.args,
                },
                ...Permission.invocation(context),
              })

              const binaryPath = resolveBinary(input.binary)
              const argv = buildArgs(input)
              const timeoutMs = (input.timeout ?? DEFAULT_TIMEOUT_MS / 1_000) * 1_000

              const { stdout, stderr, exitCode } = yield* runRocc(binaryPath, argv, timeoutMs).pipe(
                Effect.mapError(
                  (error) => new ToolFailure({ message: `rocc invocation failed: ${error.message}`, error }),
                ),
              )

              // rocc exit codes: 0 ok, 1 conformance failure (a primitive is not
              // "done"), 2 unknown command / bad args. We don't fail the call on
              // any of these — the agent still gets stdout/stderr to reason about.
              // Exit 1 from rocc-conformance specifically means "a primitive
              // failed its checks" which is meaningful information.
              const summary = summarize(input.binary, input.subcommand, { stdout, stderr, exitCode })

              return {
                output: {
                  binary: input.binary,
                  subcommand: input.subcommand,
                  ok: exitCode === 0,
                  summary,
                  stdout: stdout.slice(0, 32_768),
                  stderr: stderr.slice(0, 4_096),
                  raw: {
                    exitCode,
                    argv: argv.join(" ").slice(0, 512),
                    binaryPath,
                  },
                },
                content: [
                  { type: "text" as const, text: summary },
                  ...(stderr.trim().length > 0
                    ? [{ type: "text" as const, text: `[rocc stderr]\n${stderr.trim().slice(0, 4_096)}` }]
                    : []),
                ],
                metadata: {
                  exitCode,
                  binary: input.binary,
                  subcommand: input.subcommand,
                  ok: exitCode === 0,
                  argv: argv.join(" ").slice(0, 512),
                  binaryPath,
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
  resolveBinDir,
  resolveBinary,
  buildArgs,
  shellEscape,
  summarize,
  candidateBinDirs,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
}
