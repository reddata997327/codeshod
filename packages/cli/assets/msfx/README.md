# MSF-X — a Metasploit-style framework in pure Rust

MSF-X is a from-scratch, pure-Rust rebuild of the **Metasploit Framework
architecture**: module system, registry, option handling, scanners, payload
generation, session handling, an msfconsole-style REPL, an msfvenom-style
generator, and a JSON-RPC server designed for driving the framework from an
external agent CLI.

> **Scope, honestly stated.** Metasploit itself is ~4M lines of Ruby with
> 2,300+ modules built over ~20 years. MSF-X ships the *full framework core*
> (everything you need to build, run and drive modules) plus 9 reference
> modules, in ~2,500 lines of Rust. It is designed so that porting more
> modules is a matter of implementing one trait and registering the module.

**Authorized use only.** Use MSF-X exclusively against systems you own or
have explicit written permission to test.

---

## Layout

```
rustmsf/
├── crates/
│   ├── msf-core/       framework core (no external deps beyond serde)
│   │   ├── module.rs   Module/Payload traits, ModuleInfo, Options, Ctx, RunResult
│   │   ├── registry.rs factory registry + search + suffix matching
│   │   ├── opts.rs     option bag, RHOSTS expansion (CIDR/ranges/DNS), port specs
│   │   ├── session.rs  session manager (RPC-serializable metadata)
│   │   ├── pattern.rs  Metasploit-compatible cyclic pattern_create/pattern_offset
│   │   └── util.rs     hex encode/decode
│   ├── msf-modules/    built-in modules (see table below)
│   └── msfx/           binary: console, venom, tools, RPC server
└── ...
```

Built-in modules:

| Module | Type | What it does |
| --- | --- | --- |
| `auxiliary/scanner/portscan/tcp` | scanner | concurrent TCP connect scan, thread pool |
| `auxiliary/gather/banner_grab` | scanner | greeting/probe banner capture for any TCP service |
| `auxiliary/scanner/http/http_version` | scanner | HTTP status + Server/X-Powered-By fingerprint |
| `auxiliary/scanner/ssh/ssh_version` | scanner | SSH identification banner |
| `auxiliary/handler/reverse_tcp` | handler | accepts reverse connections, registers sessions |
| `exploit/lab/stack_overflow_template` | exploit | lab-only BOF template, exploit→payload pipeline |
| `payload/single/reverse_tcp` | payload | reverse shell gen: `sh` / `python` / `rust` / `bytes` |
| `payload/single/bind_tcp` | payload | bind shell gen: `sh` / `python` / `rust` / `bytes` |
| `encoder/generic/xor` | encoder | demonstrates the encoder interface |

## Build & quickstart

```
cargo build --release          # binary: target/release/msfx (~1 MB)
cargo test --release           # 8 unit tests

./target/release/msfx                      # interactive console
./target/release/msfx -q -x "use portscan/tcp; set RHOSTS 127.0.0.1; set PORTS 8000-8100; run; exit"
./target/release/msfx modules --json
```

Console commands: `search`, `use`, `info`, `set/unset/get`, `show options`,
`run`, `sessions -l|-k|-i`, `pattern_create`, `pattern_offset`, `back`, `exit`.
`use` accepts suffixes: `use portscan/tcp`.

## Payload generation (msfvenom-style)

```
msfx venom -p reverse_tcp -f sh     -L 10.0.0.1 -P 4444
msfx venom -p reverse_tcp -f python -L 10.0.0.1 -P 4444
msfx venom -p bind_tcp     -f rust  -P 5555
msfx venom -p reverse_tcp -f bytes -L 10.0.0.1 -P 4444   # hex output
msfx tools pattern-create 2048
msfx tools pattern-offset 41424344
```

## Agent-CLI integration (three options)

### 1. JSON-lines RPC (recommended for a separate agent process)

```
msfx rpc --bind 127.0.0.1 --port 55552
```

Each request is one JSON object per line; each response is one JSON line.

Request:  `{"id": 1, "method": "...", "params": {...}}`
Response: `{"id": 1, "result": ...}` or `{"id": 1, "error": "..."}`

| Method | Params | Result |
| --- | --- | --- |
| `framework.version` | — | `{name, version, modules}` |
| `modules.list` | `type?` (auxiliary/exploit/payload/encoder) | `[{name,title,type,rank}]` |
| `module.info` | `module` | metadata + option definitions |
| `module.run` | `module`, `options: {K:V}` | `{summary, log[], data, sessions[]}` |
| `payload.generate` | `payload`, `format`, `options` | `{payload}` or `{hex}` |
| `sessions.list` | — | `[{id,kind,peer,opened_via}]` |
| `session.kill` | `id` | `{killed}` |

Python example:

```python
import json, socket

def rpc(method, **params):
    s = socket.create_connection(("127.0.0.1", 55552))
    s.sendall((json.dumps({"id": 1, "method": method, "params": params}) + "\n").encode())
    buf = b""
    while b"\n" not in buf:
        buf += s.recv(65536)
    return json.loads(buf)["result"]

print(rpc("framework.version"))
print(rpc("payload.generate", payload="reverse_tcp", format="sh",
          options={"LHOST": "10.0.0.1", "LPORT": 4444}))
r = rpc("module.run", module="auxiliary/scanner/portscan/tcp",
        options={"RHOSTS": "10.0.0.0/30", "PORTS": "22,80,443"})
print(r["data"]["open"])
```

Notes: `module.run` is synchronous (a long scan blocks that connection;
open one connection per job). Everything the console prints also arrives in
`log[]`, machine-readable results arrive in `data`.

### 2. Use it as a Rust library (embed directly in your agent)

```toml
[dependencies]
msf-core    = { path = "../rustmsf/crates/msf-core" }
msf-modules = { path = "../rustmsf/crates/msf-modules" }
```

```rust
let reg = msf_modules::build_registry();
let mut sessions = msf_core::SessionManager::new();
let mut m = reg.instantiate("auxiliary/scanner/portscan/tcp").unwrap();
let mut opts = msf_core::Options::new();
opts.set("RHOSTS", "127.0.0.1");
let mut log = |_s: &str| {};
let mut ctx = msf_core::Ctx { sessions: &mut sessions, reg: &reg, log: &mut log };
let result = m.run(&opts, &mut ctx).unwrap();
println!("{}", serde_json::to_string(&result.data).unwrap());
```

### 3. Shell out from the agent

`msfx -q -x "..."`, `msfx venom ...`, `msfx modules --json` — stable text and
JSON outputs suitable for subprocess orchestration.

## Writing your own module

Implement one trait, register the factory — the console, RPC, search and
option validation pick it up automatically:

```rust
use msf_core::*;

pub struct MyScanner;

impl Module for MyScanner {
    fn info(&self) -> ModuleInfo {
        ModuleInfo::new("auxiliary/scanner/my thing", ModuleType::Auxiliary, "My Scanner")
            .desc("...")
    }
    fn options(&self) -> Vec<OptionDef> {
        vec![OptionDef { name: "RHOSTS", desc: "targets", required: true, default: None }]
    }
    fn run(&mut self, opts: &Options, ctx: &mut Ctx) -> Res<RunResult> {
        let hosts = expand_hosts(&opts.get_str("RHOSTS", ""))?;
        // ... your logic; ctx.log() for progress; return structured data
        Ok(RunResult::with_data("done", serde_json::json!({"hosts": hosts.len()})))
    }
}

pub fn register(reg: &mut Registry) { reg.add(|| Box::new(MyScanner)); }
// then call register(&mut r) in msf-modules/src/lib.rs::build_registry()
```

## Test results (this build)

- 8/8 unit tests pass (options, host/port expansion, pattern utils, hex, encoder)
- Portscan found live services on localhost (verified against real listeners)
- `http_version` fingerprinted `SimpleHTTP/0.6 Python/3.12.16`
- `ssh_version` extracted a live SSH banner
- Reverse handler registered a real callback as `Session 1`
- RPC: 5 methods exercised end-to-end from a Python client

## Roadmap toward closer MSF parity

- TLS support for scanners/payloads (`rustls` — pure Rust)
- Meterpreter-like staged agent in Rust (TCP/TLS transport, command extensions)
- PostgreSQL-backed workspace/loot storage, `msfdb` equivalent
- SMB/FTP/SMTP/MySQL/Redis fingerprint modules, service auto-detection
- Binary shellcode payloads (x86/x64/ARM encoders, `format=elf/exe`)
- Evasion tooling and a module compatibility layer for porting MSF Ruby modules
- Jobs subsystem (`jobs -l`, background runs), thread-pool executor in core

## License

BSD-3-Clause (matching Metasploit Framework's licensing for the core).
