export * as RrxTool from "./rrx.js"

import type { Context } from "@codeshod/plugin/effect/plugin"
import { ToolFailure } from "@codeshod/ai/effect"
import { Duration, Effect, Schema } from "effect"
import { exec } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { Permission } from "../../permission.js"

export const name = "rrx"

const platformArch = `${process.platform}-${process.arch}`
const candidateBinaries: readonly string[] = [
  process.env.CODESHOD_RRX_BIN ?? "",
  path.join(__dirname, "..", "..", "..", "cli", "assets", "rrx", "bin", `rrx-${platformArch}`),
  path.join(path.dirname(process.execPath), "rrx"),
  path.join(path.dirname(process.execPath), "..", "lib", "codeshod", "rrx"),
  "/usr/lib/codeshod/rrx",
  "rrx",
].filter((value) => value.length > 0)

const resolveBinary = (): string => {
  for (const candidate of candidateBinaries) {
    if (candidate === "rrx") return candidate
    try {
      if (fs.existsSync(candidate)) return candidate
    } catch {}
  }
  return "rrx"
}

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 5 * 60_000
const Timeout = Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(MAX_TIMEOUT_MS))

export const Input = Schema.Struct({
  subcommand: Schema.String.annotate({
    description:
      "The rrx subcommand to run (e.g. 'plugins', 'utils keccak hello', 'compile', 'deploy Contract', 'debugtx 0xHASH', 'net', 'chain', 'block latest', 'account vitalik.eth', 'token 0xADDR', 'ens name.eth', 'keys new', 'gasprice', 'proof 0xADDR --slot N'). Use 'rrx plugins' to list all 38 tools with their Remix IDE origins.",
  }),
  rpc: Schema.optionalKey(Schema.String).annotate({
    description: "JSON-RPC endpoint URL (overrides RRX_RPC env). Use for read/write operations against a specific Ethereum node. Omit to use built-in mainnet auto-failover.",
  }),
  mainnet: Schema.optionalKey(Schema.Boolean).annotate({
    description: "Force the built-in mainnet endpoint failover list even if RRX_RPC is set.",
  }),
  yes: Schema.optionalKey(Schema.Boolean).annotate({
    description: "Confirm a MAINNET (chain id 1) broadcast — real funds will be spent. Required for send/deploy to mainnet.",
  }),
  timeout: Schema.optionalKey(Timeout).annotate({
    description: `Optional per-call wall-clock timeout in seconds (max ${MAX_TIMEOUT_MS / 1000}). Default ${DEFAULT_TIMEOUT_MS / 1000}. Network operations (debugtx, proof, logs) may need longer.`,
  }),
})

export const Output = Schema.Struct({
  ok: Schema.Boolean,
  summary: Schema.String,
  stdout: Schema.String,
  stderr: Schema.String,
  raw: Schema.Struct({
    exitCode: Schema.Number,
    argv: Schema.String,
    binary: Schema.String,
  }),
})

const description = `Run the built-in rrx headless Remix IDE — Ethereum development tools rebuilt in pure Rust.

rrx is a pure-Rust reimplementation of Remix IDE's 38 tools: real EVM interpreter (Istanbul→Cancun), real Merkle-Patricia state, real gas metering, real secp256k1 signing, real solc compilation, real mainnet RPC with endpoint auto-failover. No simulation anywhere. The stripped release binary lives at packages/cli/assets/rrx/bin/ (8.7 MB, std-only + clap + rrx-* crates) and is bundled with every Codeshod installation.

38 TOOLS (use subcommand='plugins' to list them all with Remix IDE origins):
- workspace/file/search — workspace + file management
- compile/analyze/test — Solidity compiler, static analysis, unit testing
- deploy/call/send — contract deployment, read-only calls, signed transactions
- debugtx — replay a REAL mainnet transaction in the local EVM interpreter
- logs/ens/token/sources — live mainnet queries (event logs, ENS, token inspection, verified source fetch)
- proof — cryptographic state proofs (account + storage MPT verified locally against block stateRoot)
- follow — live mainnet head tracker
- utils — keccak256, unit conversion (wei/gwei/ether), function selector, ENS namehash
- gas/gasprice — gas estimation, live network gas prices
- debug/flatten/uml/doc — debugger, contract flattener, UML generator, doc generator
- script — script runner (.rrx DSL on the real chain)
- git — mini git for the workspace
- verify — verify a contract on Etherscan V2
- keys/sign — secp256k1 key management, EIP-191 message signing
- precompiles — execute a real precompile directly
- solc — solc binary manager
- node — run a real local JSON-RPC node
- net/chain — live mainnet connectivity matrix, chain dashboard
- block/tx/account/trace — live block/transaction/account/trace reports
- ethcall — live eth_call with return type decoding
- wildtoken/fakeasset — scam-token analysis pipeline

USE THIS TOOL WHEN:
- The user asks to compile, deploy, test, or analyze Solidity contracts.
- The user wants to interact with Ethereum mainnet (check balances, transactions, blocks, gas prices).
- The user wants to replay/debug a mainnet transaction locally.
- The user wants cryptographic state proofs against a block stateRoot.
- The user wants keccak256, function selectors, ENS namehash, unit conversions.
- The user mentions Remix IDE, Solidity, EVM, Ethereum, Web3, smart contracts, gas, or ABI.

DO NOT USE THIS TOOL FOR:
- Non-Ethereum blockchains (Bitcoin, Solana, etc. — each needs its own tool).
- Live packet capture (use 'shark'), port scanning (use 'nmap'), or exploitation (use 'msfx').
- Local file reads unrelated to Solidity projects (use 'read').

PERMISSIONS:
- The action 'rrx' is asserted against the subcommand as the resource. Repository rules typically allow read-only operations (plugins, utils, net, chain, block, tx, account, ens, token, gasprice) and ask before write operations (deploy, send, verify — which broadcast to mainnet and may spend real funds).
- For send/deploy to mainnet, the 'yes' field must be set to true (explicit confirmation that real funds will be spent).

OUTPUT:
- Always a JSON object: { ok, summary, stdout, stderr, raw }. The 'stdout' field carries the raw rrx output (truncated to 32 KB). The 'raw' field carries the exit code, argv, and binary name.
`

const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "'\\''")}'`
}

const buildArgs = (input: (typeof Input.Type)): readonly string[] => {
  const parts = input.subcommand.trim().split(/\s+/)
  const args: string[] = parts.map(shellEscape)
  if (input.rpc) args.push("--rpc", shellEscape(input.rpc))
  if (input.mainnet) args.push("--mainnet")
  if (input.yes) args.push("--yes")
  return args
}

const runRrx = (
  binary: string,
  argv: readonly string[],
  timeoutMs: number,
): Effect.Effect<{ stdout: string; stderr: string; exitCode: number }, Error> =>
  Effect.callback<{ stdout: string; stderr: string; exitCode: number }, Error, never>((resume) => {
    const child = exec(
      [binary, ...argv].join(" "),
      { maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs, env: { ...process.env } },
      (err, stdout, stderr) => {
        if (err && "killed" in err && err.killed === true) {
          resume(Effect.fail(new Error(`rrx call exceeded ${timeoutMs}ms wall-clock timeout`)))
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
      orElse: () => Effect.fail(new Error(`rrx call exceeded ${timeoutMs}ms wall-clock timeout`)),
    }),
  )

export const Plugin = {
  id: "codeshod.tool.rrx",
  effect: Effect.fn("RrxTool.Plugin")(function* (ctx: Context) {
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
              const firstWord = input.subcommand.trim().split(/\s+/)[0] ?? "plugins"
              const isWriteOp = ["deploy", "send", "verify", "script"].includes(firstWord)
              yield* permission.assert({
                action: name,
                resources: [firstWord],
                save: ["*"],
                metadata: {
                  subcommand: input.subcommand,
                  rpc: input.rpc,
                  mainnet: input.mainnet,
                  yes: input.yes,
                  writeOp: isWriteOp,
                },
                ...Permission.invocation(context),
              })

              const binary = resolveBinary()
              const argv = buildArgs(input)
              const timeoutMs = (input.timeout ?? DEFAULT_TIMEOUT_MS / 1_000) * 1_000

              const { stdout, stderr, exitCode } = yield* runRrx(binary, argv, timeoutMs).pipe(
                Effect.mapError(
                  (error) => new ToolFailure({ message: `rrx invocation failed: ${error.message}`, error }),
                ),
              )

              const out = stdout.trim()
              const summary = exitCode === 0
                ? out.split("\n").slice(0, 5).join("\n").slice(0, 500)
                : (stderr.trim().split("\n")[0] ?? `rrx exited with code ${exitCode}`)

              return {
                output: {
                  ok: exitCode === 0,
                  summary,
                  stdout: stdout.slice(0, 32_768),
                  stderr: stderr.slice(0, 4_096),
                  raw: {
                    exitCode,
                    argv: argv.join(" ").slice(0, 512),
                    binary: path.basename(binary),
                  },
                },
                content: [
                  { type: "text" as const, text: `rrx ${firstWord}: ${exitCode === 0 ? "ok" : "failed"}\n${summary}` },
                  ...(stderr.trim().length > 0
                    ? [{ type: "text" as const, text: `[rrx stderr]\n${stderr.trim().slice(0, 4_096)}` }]
                    : []),
                ],
                metadata: {
                  exitCode,
                  binary: path.basename(binary),
                  subcommand: firstWord,
                  ok: exitCode === 0,
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

export const __test = {
  resolveBinary,
  buildArgs,
  shellEscape,
  candidateBinaries,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
}
