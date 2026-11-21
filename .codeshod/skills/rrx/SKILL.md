---
name: rrx
description: Use for Ethereum / Remix IDE / Solidity / EVM / smart contract work — compile, deploy, test, analyze Solidity contracts; interact with Ethereum mainnet (balances, transactions, blocks, gas prices); replay/debug mainnet transactions locally in a real EVM interpreter; verify cryptographic state proofs; compute keccak256/selectors/namehash/unit conversions; manage secp256k1 keys; sign EIP-191 messages; fetch verified sources; query live event logs; ENS resolution; token inspection. Also when the user mentions Remix IDE, Web3, EVM, gas, ABI, ERC-20/721/1155, or "deploy a contract".
---

# rrx — Headless Remix IDE as a built-in Codeshod tool

rrx is a pure-Rust reimplementation of Remix IDE's 38 tools, bundled with Codeshod as a first-party built-in. Real EVM interpreter (Istanbul→Cancun), real Merkle-Patricia state, real gas metering, real secp256k1 signing, real solc compilation, real mainnet RPC with endpoint auto-failover. 8.7 MB stripped binary at `packages/cli/assets/rrx/bin/`.

## When To Use

- Compile, deploy, test, or analyze Solidity contracts
- Interact with Ethereum mainnet (balances, transactions, blocks, gas prices, event logs)
- Replay/debug a mainnet transaction locally in a real EVM interpreter
- Verify cryptographic state proofs against a block stateRoot
- Compute keccak256, function selectors, ENS namehash, unit conversions (wei/gwei/ether)
- Manage secp256k1 keys, sign EIP-191 messages
- Fetch verified contract sources from Sourcify/Etherscan
- ENS resolution, token inspection (ERC-20/721/1155)

## Quick Reference — 38 Tools

Use `subcommand='plugins'` to list them all with Remix IDE origins.

| Tool | Command | What it does |
|------|---------|--------------|
| File Explorer | `rrx file ls\|cat\|write\|rm\|mv\|mkdir\|tree` | Workspace file management |
| Search | `rrx search <pattern> [--regex]` | Search in files |
| Compile | `rrx compile [--solc v] [--no-opt]` | Real solc compilation |
| Analyze | `rrx analyze` | Static analysis on the AST |
| Test | `rrx test [--gas_file]` | Solidity unit testing (remix-tests conventions) |
| Deploy | `rrx deploy <Contract> [args] [--mainnet --yes]` | Deploy a contract |
| Call | `rrx call <Contract> <fn> [args] [--mainnet]` | Read-only eth_call |
| Send | `rrx send --to <addr> [--value ETH] [--fn_sig] [--yes]` | Signed transaction on mainnet |
| DebugTx | `rrx debugtx 0x<hash> [--max-steps N] [--top N]` | Replay a real mainnet tx in local EVM |
| Logs | `rrx logs [--address] [--topic0] [--limit N]` | Live event logs with Transfer/Approval decoding |
| ENS | `rrx ens <name> [--reverse]` | Real ENS resolution |
| Token | `rrx token <addr> [--holder]` | Live ERC-20/721/1155 inspection |
| Sources | `rrx sources <addr> [--chain_id 1]` | Fetch verified sources (Sourcify/Etherscan V2) |
| Proof | `rrx proof <addr> --slot N` | Cryptographic state proof (MPT verified locally) |
| Follow | `rrx follow` | Live mainnet head tracker |
| Utils | `rrx utils keccak\|unit\|selector\|namehash` | keccak256, unit conversion, selector, namehash |
| Gas | `rrx gas estimate\|report\|price\|trace` | Gas analytics |
| GasPrice | `rrx gasprice` | Live network gas prices |
| Debug | `rrx debug <target>` | Debugger |
| Flatten | `rrx flatten <file>` | Contract flattener |
| UML | `rrx uml` | UML generator (mermaid) |
| Doc | `rrx doc` | Doc generator (markdown) |
| Script | `rrx script <file.rrx>` | Script runner on the real chain |
| Git | `rrx git ...` | Mini git for the workspace |
| Verify | `rrx verify <addr> ...` | Verify on Etherscan V2 |
| Keys | `rrx keys new\|list\|dev` | secp256k1 key management |
| Sign | `rrx sign ...` | Sign/recover EIP-191 messages |
| Precompiles | `rrx precompiles ...` | Execute a real precompile directly |
| Solc | `rrx solc ...` | solc binary manager |
| Node | `rrx node` | Run a real local JSON-RPC node |
| Net | `rrx net` | Live mainnet connectivity matrix |
| Chain | `rrx chain` | Live chain dashboard |
| Block | `rrx block latest\|finalized\|<num>` | Live block summary |
| Tx | `rrx tx 0x<hash>` | Live transaction + receipt report |
| Account | `rrx account <addr_or_ens>` | Balance / nonce / code |
| Trace | `rrx trace 0x<hash>` | Call-tree trace (callTracer) |
| EthCall | `rrx ethcall <addr> <fn> [args] --returns <type>` | Live eth_call with return type decoding |
| Plugins | `rrx plugins` | List all 38 tools with Remix IDE origins |

## When NOT To Use

- Non-Ethereum blockchains (Bitcoin, Solana, etc.)
- Live packet capture (use 'shark'), port scanning (use 'nmap'), exploitation (use 'msfx')
- Web app scaffolding (use 'rustango')
- Local file reads unrelated to Solidity (use 'read')

## Common Mistakes

- Don't forget `--yes` for mainnet send/deploy — real funds will be spent.
- Don't expect network operations to work without internet — `net`, `chain`, `block`, `tx`, `account`, `debugtx`, `proof`, `logs`, `ens`, `token`, `sources`, `gasprice`, `follow` all require RPC access.
- Use `subcommand='plugins'` to discover the full tool set with Remix IDE origin mapping.
