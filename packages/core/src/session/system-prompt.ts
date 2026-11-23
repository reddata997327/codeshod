export * as SessionSystemPrompt from "./system-prompt.js"

import PROMPT from "./runner/prompt/system.txt"

export function make(tools: string[]) {
  return render(PROMPT, tools)
}

export function render(prompt: string, tools: string[]) {
  const instructions: string[] = []
  if (tools.includes("shell")) {
    instructions.push(
      "- Prefer dedicated tools over shell commands; fall back to the shell when a tool cannot do what you need.",
      "- Do not chain shell commands with separators like `echo \"====\";` or `printf '---'`; the output becomes noisy in a way that makes the user's side of the conversation worse.",
    )
  }
  if (tools.includes("write")) {
    instructions.push(
      "- Use the write tool to create files or completely replace their content. Prefer using the edit tool for targeted changes.",
    )
  }
  if (tools.includes("edit")) {
    instructions.push(
      "- Use the edit tool for targeted changes to existing text files. It replaces the exact text in `oldString` with `newString`, and the values must differ. By default, `oldString` must occur exactly once. If it occurs multiple times, include more surrounding context to make it unique or set `replaceAll` to true to replace every occurrence.",
    )
  }
  if (tools.includes("nmap")) {
    instructions.push(
      "- Use the nmap tool for network reconnaissance: port scans, service detection, OS fingerprinting, traceroute, and Rhai-based service probes. Prefer `--top-ports 100` for quick sweeps over full 1-65535 ranges. Use timing T3 (default) for normal work, T1-T2 for stealth, T4-T5 for trusted internal networks. SYN/ACK/FIN/Xmas/Null scans and OS fingerprinting require root or CAP_NET_RAW and auto-fall back to TCP connect scan otherwise.",
    )
  }
  if (tools.includes("msfx")) {
    instructions.push(
      "- Use the msfx tool for Metasploit-style exploitation work: TCP port scans, banner grabs, HTTP/SSH fingerprinting, reverse/bind shell payload generation, cyclic pattern exploit-dev helpers, the lab stack-overflow exploit template, and the XOR encoder. msfx is a pure-Rust framework bundled with Codeshod, NOT a system metasploit shell-out. Pick operation='modules.list' to discover modules, operation='module.info' to inspect a module's options, operation='module.run' to execute a module with options, operation='payload.generate' for msfvenom-style payload generation, and operation='pattern.create'/'pattern.offset' for exploit-dev. The msfx RPC server is intentionally NOT exposed through this tool — every action is one-shot.",
    )
  }
  if (tools.includes("shark")) {
    instructions.push(
      "- Use the shark tool for Wireshark-style packet capture analysis: read pcap/pcapng files, apply display filters (tcp.port == 80, dns.qry.name contains \"example\", http && !udp), extract fields (ip.src, tcp.dstport, dns.qry.name, http.host), compute protocol hierarchy and conversation stats, inspect file metadata (capinfos/captype), edit/merge/reorder captures, generate deterministic test packets (randpkt), and enumerate dissectable fields (list_fields). shark is a pure-Rust headless Wireshark bundled with Codeshod, NOT a system tshark shell-out. Ten real Wireshark sample captures are bundled at packages/cli/assets/shark/samples/ — pass useSample='http.pcap' to use one. Live capture (dumpcap) is Linux AF_PACKET only and requires root/CAP_NET_RAW.",
    )
  }
  if (tools.includes("rustango")) {
    instructions.push(
      "- Use the rustango tool for Django-style web framework work: scaffold a new project (operation='startproject' with projectName + projectDir), scaffold an app inside a project (operation='startapp' with appName), run management commands (makemigrations/migrate/showmigrations/createsuperuser/clearsessions/check), or start the dev server (operation='runserver' with addr='127.0.0.1:8000', 15-second default timeout — long enough to verify a project boots and curl an endpoint). rustango is a pure-Rust Django-parity framework bundled with Codeshod, NOT a system django-admin/manage.py shell-out. Pick operation='check' to validate a project config, operation='version' for the framework version. The tool caps runserver at 60 seconds per call — for continuous dev work the user should run rustango directly in a terminal.",
    )
  }
  if (tools.includes("rocc")) {
    instructions.push(
      "- Use the rocc tool for offensive security primitive research and chain planning: rocc-substrate (the AMBIGUITY ledger of CL/TE/double-CL parsing ambiguities with RFC references), rocc-primitives (list/demo the 10 irreducible primitives: secp256k1, ecdsa-nonce, sha256-merkle, http-smuggle, jwt, uuid-seq, data-infer, mem-race, evade-encode, cost-model), rocc-compose (chains: smuggle/jwt/nonce-reuse), rocc-conformance (the validation gate — the only source of truth for 'is it done', 10/10 primitives pass), rocc-products (usable batteries: smugglekit/phishstack/timing/signer-demo), rocc-tools (build layer: targets/emit/pack/obf with xor-rolling or reverse transforms), rocc-bench (reliability + cost measurement). rocc is a pure-Rust registry of offensive capability bundled with Codeshod, 7 binaries at packages/cli/assets/rocc/bin/. Select the binary via the 'binary' input field, then 'subcommand' and 'args'.",
    )
  }
  if (tools.includes("enigma")) {
    instructions.push(
      "- Use the enigma tool to statically unpack and devirtualize Enigma Protector-protected 32-bit Windows PE files. Four operations: 'unpack' (brute-force the 32-bit section salt via CUDA/WGPU/CPU, decrypt RC4+IDEA-CBC sections, recover imports, rebuild a runnable EXE + EVB files into an adjacent unpack/ directory), 'runtime' (extract just the embedded Enigma VM loader DLL), 'scan' (list template-VM entry point RVAs), 'devirt' (lift one VM entry RVA back to x86 assembly or machine code). enigma-rs is a pure-Rust static Enigma unpacker bundled with Codeshod — NOT a system unpacker shell-out, NOT execution of the protected binary. x86 (32-bit PE) only — x64 not supported. The bundled binary has WGPU + CPU backends (no CUDA, since the codeshod sandbox has no NVIDIA GPU); unpack on CPU is slow (2^32 keyspace).",
    )
  }
  if (tools.includes("rrx")) {
    instructions.push(
      "- Use the rrx tool for Ethereum / Remix IDE work: compile/deploy/test Solidity contracts, interact with Ethereum mainnet (balances, transactions, blocks, gas prices), replay/debug mainnet transactions locally in a real EVM interpreter, verify cryptographic state proofs against block stateRoots, compute keccak256/function selectors/ENS namehash/unit conversions, manage secp256k1 keys, sign EIP-191 messages, fetch verified contract sources from Sourcify/Etherscan, run live event log queries with Transfer/Approval decoding. rrx is a pure-Rust headless Remix IDE reimplementation bundled with Codeshod — 38 tools, real EVM (Istanbul→Cancun), real mainnet RPC with endpoint auto-failover. Pass the subcommand as a single string (e.g. subcommand='utils keccak hello', subcommand='plugins', subcommand='block latest'). Use subcommand='plugins' to list all 38 tools with their Remix IDE origins. Write operations (deploy/send/verify) require explicit confirmation and may spend real funds on mainnet.",
    )
  }
  if (tools.includes("dbengine")) {
    instructions.push(
      "- Use the dbengine tool for local database operations through its MCP tool interface (27 tools): create tables with primary keys / foreign keys / unique keys / indexes, insert/get/update/delete rows, scan with filters, run mini-SQL SELECT, view the key-graph map (db_keys), walk FK edges N hops (db_graph), FK-topological order + cycle detection (db_topo), diff two databases by primary key (db_diff), git-like snapshots/branches/merges, incremental sync to remote PostgreSQL/MySQL, schema fingerprinting from raw JSON. dbengine is a pure-Rust single-file database engine (zero deps, 1.2 MB binary) bundled with Codeshod AND registered as an MCP server in ~/.claude.json via dbengine-setup.sh (linked setup). Pass the tool name via 'tool' and arguments via 'arguments'. Use tool='db_status' for engine overview, tool='db_create_table' to create a table with keys, tool='db_scan' to query rows.",
    )
  }
  return prompt.replace("${CODESHOD_TOOL_GUIDANCE}", instructions.join("\n"))
}
