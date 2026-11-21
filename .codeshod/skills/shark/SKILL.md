---
name: shark
description: Use when the user asks to analyze, dissect, or read a pcap/pcapng capture file, apply Wireshark-style display filters, extract packet fields (ip.src, tcp.dstport, dns.qry.name, http.host), compute protocol hierarchy or conversation statistics, inspect capture file metadata, edit/merge/reorder captures, generate deterministic test packets, or mentions wireshark, tshark, tcpdump, pcap, pcapng, packet capture, or network forensics. Also when the user wants live capture via AF_PACKET (Linux, needs root). Covers all 11 operations, the supported protocol set, the bundled sample captures, and when to use shark vs nmap vs msfx.
---

# shark — Pure-Rust headless Wireshark as a built-in Codeshod tool

Codeshod ships with `shark`, a pure-Rust Wireshark-style packet capture analyzer, as a first-party built-in tool. It is registered under plugin id `codeshod.tool.shark`, exposed to the model as the `shark` tool, and bundled with every Codeshod installation (1.1 MB stripped binary at `packages/cli/assets/shark/bin/`). It is NOT an MCP server (the upstream `sharkd-mcp` JSON-RPC wrapper was removed during integration) and NOT a shell-out to system `tshark`/`wireshark`.

**Reading and analyzing capture files is safe everywhere.** Live capture (dumpcap) is Linux AF_PACKET only and requires root or `CAP_NET_RAW`; without privileges it fails gracefully. Live capture on a network you do not own or have permission to monitor may be illegal.

This skill teaches you when to use it, which operation to pick, and how to reason about the JSON result it returns.

## When To Use

Use the `shark` tool when the user's intent is one of these:

- **Read packets from a pcap/pcapng file** — apply a Wireshark-style display filter, extract specific fields, or just dump the full packet JSON. Use operation `tshark`.
- **Protocol hierarchy statistics** — "what protocols are in this capture", "how many packets are TCP vs UDP vs DNS". Use operation `protocol_hierarchy`.
- **Conversation statistics** — "who talked to whom", "list all TCP connections in this capture", "top talkers by bytes". Use operation `conversations`.
- **Capture file metadata** — "how many packets are in this file", "what's the capture duration", "what format is this file". Use operation `capinfos`.
- **Identify capture file format** — pcap (microsecond), pcap (nanosecond), or pcapng. Use operation `captype`.
- **Edit a capture file** — truncate packets to a snapshot length, remove duplicates, keep a packet range. Use operation `editcap`.
- **Merge multiple captures** — chronologically sorted k-way merge. Use operation `mergecap`.
- **Sort a capture by timestamp** — useful when packets arrive out of order. Use operation `reordercap`.
- **Generate test packets** — deterministic with a seed, types tcp/udp/dns/arp/icmp/random. Use operation `randpkt`.
- **Enumerate dissectable fields** — find field names like `dns.qry.name`, `tcp.flags.syn`, `http.host`. Use operation `list_fields`.
- **Live capture on Linux** — capture from a network interface via AF_PACKET. Use operation `dumpcap` (needs root/CAP_NET_RAW).

The user said "wireshark", "tshark", "pcap", "pcapng", "packet capture", "packet analysis", "network forensics", "display filter", "capture file", or "dissect packets" → use this skill.

## When To Use shark vs nmap vs msfx

The three pentest tools have overlapping but distinct purposes. Pick by intent:

| Intent | Use |
|--------|-----|
| Live network scanning (port discovery, OS fingerprint, traceroute) | `nmap` |
| Metasploit-style exploitation (payloads, BOF template, encoder) | `msfx` |
| Analyze an existing pcap/pcapng capture file | `shark` |
| Apply Wireshark-style display filters to packets | `shark` |
| Extract specific packet fields (ip.src, dns.qry.name, http.host) | `shark` |
| Protocol hierarchy / conversation statistics | `shark` |
| Capture file editing (snaplen, dedup, range) | `shark` |
| Generate test packets with a deterministic seed | `shark` (randpkt) |
| Live packet capture on Linux | `shark` (dumpcap, needs root) |

When in doubt: `nmap` for live network recon, `msfx` for exploitation, `shark` for capture file analysis. All three are pure-Rust, all three are first-party Codeshod built-ins, all three are bundled with every installation.

## When NOT To Use

- **Live port scanning.** Use `nmap` — it's purpose-built for it.
- **Exploitation / payload generation.** Use `msfx`.
- **Local file reads, code search, or web fetches.** Use `read`, `grep`, or `webfetch`.
- **Live capture on non-Linux systems.** `dumpcap` is Linux AF_PACKET only — it will fail gracefully with a clear error.
- **Continuous monitoring.** The tool caps wall-clock time at 5 minutes per call.
- **Code Mode sessions.** The tool is not exposed in Code Mode (read-only filesystem mode) — for consistency with nmap/msfx, the whole tool is excluded even though pcap analysis itself is read-only.
- **TLS-encrypted traffic dissection.** shark reads packets but does not decrypt TLS. For TLS cert inspection on a live endpoint, use `nmap --tls`.

## Operations

The tool exposes a single `operation` parameter. Pick the right one:

| Operation | What it does | Required input fields |
|-----------|--------------|----------------------|
| `tshark` | Read packets, apply display filter, extract fields | `file` or `useSample`; optional `filter`, `fields`, `count`, `skip` |
| `protocol_hierarchy` | -z io,phs stats (packets/bytes per protocol, nested tree) | `file` or `useSample`; optional `filter` |
| `conversations` | Who-talked-to-whom stats | `file` or `useSample`; optional `protos` (e.g. "tcp,ip"), `filter` |
| `capinfos` | File metadata: format, packet count, duration, rates | `file` or `useSample` |
| `captype` | Identify capture file format | `file` or `useSample` |
| `editcap` | Edit: snaplen, dedup, range selection | `input`, `output`; optional `snaplen`, `dedup`, `start`, `rangeCount`, `invertRange` |
| `mergecap` | Merge multiple captures chronologically | `inputs` (array), `output` |
| `reordercap` | Sort packets by timestamp | `input`, `output` |
| `dumpcap` | LIVE capture via AF_PACKET (Linux, root) | `output`; optional `iface`, `count`, `duration`, `filter`, `listInterfaces` |
| `randpkt` | Generate deterministic test packets | `output`; optional `count`, `ptype`, `seed` |
| `list_fields` | Enumerate dissectable field names (~110 fields) | optional `prefix` (e.g. "dns.") |

## Sample Captures

Ten real Wireshark sample captures are bundled at `packages/cli/assets/shark/samples/`. Use `useSample: "<name>"` to reference one without an absolute path:

| Sample | Format | What it contains |
|--------|--------|------------------|
| `arp.pcap` | pcap (microsecond) | Frame Relay DLT107 — opaque data, validates no false dissection |
| `dhcp.pcap` | pcap (microsecond) | DHCP over UDP |
| `dhcp-nanosecond.pcap` | pcap (nanosecond) | Same DHCP capture, nanosecond timestamps |
| `dhcp.pcapng` | pcapng | DHCP in pcapng format |
| `dhcp_big_endian.pcapng` | pcapng (big-endian) | Validates BE pcapng reader |
| `dns-mdns.pcap` | pcap (microsecond) | 587 packets — DNS, mDNS, ICMP, ICMPv6, ARP, IPv6 |
| `dns_port.pcap` | pcap (microsecond) | DNS over non-standard port |
| `http.pcap` | pcap (microsecond) | HTTP HEAD request to windowsupdate.microsoft.com |
| `icmp_ascii.pcapng` | pcapng | ICMP packets with ASCII payload |
| `ipv6.pcap` | pcap (microsecond) | IPv6 traffic |

`http.pcap` is the smallest sample (1 packet, 207 bytes) — use it for quick tests. `dns-mdns.pcap` is the largest (587 packets, 72 KB) — use it for stats and conversation analysis.

## Display Filter Subset

shark supports a practical Wireshark-style display filter subset (no regex). Examples:

- `tcp.port == 80` — single equality
- `tcp.port == 80 && ip.addr == 10.0.0.0/8` — combined with CIDR
- `dns.qry.name contains "example"` — substring match
- `http && !udp` — protocol presence / absence
- `tcp.flags.syn == 1` — TCP flag bit
- `arp.opcode == 1` — ARP request
- `ip.addr == 224.0.0.251` — multicast address

If the filter is invalid, shark exits with code 1 and a "display filter error" message in stderr — the tool surfaces it as `ok: false` with the error in the summary.

## Dissectable Fields (~110)

Use operation `list_fields` with optional `prefix` to enumerate. Common fields:

- **Frame**: `frame.number`, `frame.len`, `frame.cap_len`, `frame.time`, `frame.time_utc`, `frame.protocols`, `frame.link_type`
- **Ethernet**: `eth.src`, `eth.dst`, `eth.type`
- **ARP**: `arp.opcode`, `arp.src.proto_ipv4`, `arp.dst.proto_ipv4`, `arp.src.hw_mac`
- **IPv4**: `ip.src`, `ip.dst`, `ip.addr`, `ip.proto`, `ip.ttl`, `ip.len`, `ip.id`
- **IPv6**: `ipv6.src`, `ipv6.dst`, `ipv6.hop_limit`, `ipv6.nxt`
- **TCP**: `tcp.srcport`, `tcp.dstport`, `tcp.port`, `tcp.flags`, `tcp.flags.syn`, `tcp.flags.ack`, `tcp.flags.fin`, `tcp.flags.reset`, `tcp.seq`, `tcp.ack`, `tcp.len`, `tcp.window_size`, `tcp.checksum`
- **UDP**: `udp.srcport`, `udp.dstport`, `udp.port`, `udp.length`
- **ICMP**: `icmp.type`, `icmp.code`, `icmp.checksum`
- **DNS**: `dns.id`, `dns.flags`, `dns.flags.response`, `dns.qry.name`, `dns.qry.type`, `dns.a`, `dns.aaaa`, `dns.cname`, `dns.ns`, `dns.ptr`, `dns.mx`, `dns.txt`, `dns.rcode`, `dns.opcode`
- **HTTP**: `http.request.method`, `http.request.uri`, `http.request.full_uri`, `http.request.version`, `http.host`, `http.accept`, `http.response.code`, `http.response.phrase`

## Output Reading

The tool returns a JSON object with shape:

```jsonc
{
  "operation": "tshark",
  "ok": true,
  "summary": "matched 5 of 587 packets, returned 5",
  "data": { /* the parsed JSON output from shark */ },
  "raw": {
    "exitCode": 0,
    "stdout": "...",   // truncated to 32 KB
    "stderr": ""       // truncated to 4 KB
  }
}
```

Operation-specific `data` shapes:

- `tshark` → `{ file, filter, total_packets_in_file, matched_packets, returned, packets: [...] }`
- `protocol_hierarchy` → `{ file, filter, link_type, packets_considered, protocol_hierarchy: [{ protocol, packets, bytes, percent_packets, percent_bytes, children: [...] }] }`
- `conversations` → `{ file, filter, link_type, packets_considered, conversations: [{ proto, addr_a, addr_b, port_a, port_b, packets_a_to_b, packets_b_to_a, packets_total, bytes_a_to_b, bytes_b_to_a, bytes_total, duration_sec, start_rel_sec }] }`
- `capinfos` → `{ file, file_type, number_of_packets, file_size_bytes, data_bytes, capture_duration_seconds, first_packet_time_utc, last_packet_time_utc, average_packets_per_sec, average_bytes_per_sec, average_packet_size_bytes, snapshot_length, link_type, interfaces: [...] }`
- `captype` → `{ file, type }` where type is one of "pcap (microsecond)", "pcap (nanosecond)", "pcapng"
- `editcap` → `{ input, output, packets_in, packets_written, dropped_duplicates, dropped_by_range }`
- `mergecap` → `{ inputs, output, packets_in_total, packets_written, mode: "chronological" }`
- `reordercap` → `{ input, output, packets_read, packets_written, out_of_order_pairs_in_input }`
- `dumpcap` → `{ output, interface, packets_captured, duration_sec }` (or error if no privileges)
- `randpkt` → `{ output, type, seed, packets_written }`
- `list_fields` → `{ count, fields: [{ name, type, description }] }`

The tool also returns a human-readable summary as the first content item, e.g.:

```
shark tshark: ok — matched 5 of 587 packets, returned 5
first packet:
  eth.dst = "00:e0:81:00:b0:28"
  eth.src = "00:09:6b:88:f5:c9"
  eth.type = 2048
  ...
```

## Exit Codes

The tool surfaces the shark exit code in `metadata.exitCode`:

| Code | Meaning | Tool behavior |
|------|---------|---------------|
| 0 | OK | Return parsed JSON with `ok: true` |
| 1 | Error (file not found, bad filter, AF_PACKET permission, etc.) | Return parsed result with `ok: false` and stderr surfaced |

The tool does NOT fail the call on exit 1 — the agent still gets stderr to reason about. Only timeout and process-spawn errors fail at the `runShark` layer.

## Recommended Workflows

### 1. Inspect an unknown capture file

User: "what's in this capture file capture.pcap?"

```
// Step 1: identify format and metadata
shark({ operation: "capinfos", file: "/path/to/capture.pcap" })

// Step 2: protocol hierarchy
shark({ operation: "protocol_hierarchy", file: "/path/to/capture.pcap" })

// Step 3: list first 10 packets with all fields
shark({ operation: "tshark", file: "/path/to/capture.pcap", count: 10 })
```

### 2. Find all HTTP requests in a capture

User: "show me all HTTP requests in http.pcap"

```
shark({
  operation: "tshark",
  useSample: "http.pcap",
  filter: "http.request",
  fields: ["frame.number", "ip.src", "ip.dst", "http.request.method", "http.request.uri", "http.host"]
})
```

### 3. Find DNS queries for a specific domain

User: "find all DNS queries containing 'example' in dns-mdns.pcap"

```
shark({
  operation: "tshark",
  useSample: "dns-mdns.pcap",
  filter: 'dns.qry.name contains "example"',
  fields: ["frame.number", "ip.src", "dns.qry.name", "dns.qry.type"],
  count: 20
})
```

### 4. Conversation statistics

User: "who talked to whom in http.pcap?"

```
shark({
  operation: "conversations",
  useSample: "http.pcap",
  protos: "tcp,ip"
})
```

### 5. Protocol hierarchy breakdown

User: "what protocols are in dns-mdns.pcap?"

```
shark({ operation: "protocol_hierarchy", useSample: "dns-mdns.pcap" })
```

### 6. Edit a capture (snaplen + range)

User: "take the first 50 packets of dns-mdns.pcap and truncate each to 64 bytes"

```
shark({
  operation: "editcap",
  input: "/path/to/dns-mdns.pcap",   // or useSample if it's a bundled sample
  output: "/tmp/truncated.pcap",
  snaplen: 64,
  start: 1,
  rangeCount: 50
})
```

### 7. Merge multiple captures chronologically

User: "merge dhcp.pcap and dhcp.pcapng into one file"

```
shark({
  operation: "mergecap",
  inputs: ["/path/to/dhcp.pcap", "/path/to/dhcp.pcapng"],
  output: "/tmp/merged.pcap"
})
```

### 8. Generate test packets deterministically

User: "generate 100 DNS test packets with seed 42"

```
shark({
  operation: "randpkt",
  output: "/tmp/test-dns.pcap",
  count: 100,
  ptype: "dns",
  seed: 42
})
```

The same seed always produces byte-identical output — useful for reproducible test fixtures.

### 9. Enumerate dissectable fields

User: "what DNS fields can I extract?"

```
shark({ operation: "list_fields", prefix: "dns." })
```

### 10. Live capture on Linux (needs root)

User: "capture 100 packets on eth0"

```
shark({
  operation: "dumpcap",
  output: "/tmp/live.pcap",
  iface: "eth0",
  count: 100
})
```

If run without root/CAP_NET_RAW, the tool returns `ok: false` with a clear `AF_PACKET` / `CAP_NET_RAW` error message. Reading and analyzing the resulting pcap afterward is unprivileged.

### 11. List available interfaces (dumpcap discovery)

User: "what interfaces can I capture on?"

```
shark({ operation: "dumpcap", listInterfaces: true })
```

## Privilege Notes

- **Reading pcap/pcapng files** — unprivileged, works everywhere.
- **All dissection and statistics operations** (`tshark`, `protocol_hierarchy`, `conversations`, `capinfos`, `captype`, `list_fields`) — unprivileged.
- **All capture file editing operations** (`editcap`, `mergecap`, `reordercap`, `randpkt`) — unprivileged (just file I/O).
- **Live capture** (`dumpcap`) — Linux AF_PACKET only, requires root or `CAP_NET_RAW`. Grant with `sudo setcap cap_net_raw+ep $(which shark)` once, then the binary works without sudo.

## Permission Patterns

The tool asserts `action: "shark"` against an operation-specific resource. Suggested repository permission rules:

```jsonc
// .codeshod/codeshod.jsonc — permission section
{
  "permission": {
    "rules": [
      // Allow all read operations on workspace paths and the bundled samples
      { "action": "shark", "resource": "tshark", "effect": "allow" },
      { "action": "shark", "resource": "protocol_hierarchy", "effect": "allow" },
      { "action": "shark", "resource": "conversations", "effect": "allow" },
      { "action": "shark", "resource": "capinfos", "effect": "allow" },
      { "action": "shark", "resource": "captype", "effect": "allow" },
      { "action": "shark", "resource": "list_fields", "effect": "allow" },
      // Allow file editing in workspace /tmp paths
      { "action": "shark", "resource": "/tmp/*", "effect": "allow" },
      { "action": "shark", "resource": "./sprints/*", "effect": "allow" },
      // Always ask before live capture
      { "action": "shark", "resource": "dumpcap", "effect": "ask" },
      // Ask before writing elsewhere
      { "action": "shark", "resource": "*", "effect": "ask" }
    ]
  }
}
```

## Common Mistakes

- **Don't pass `file` and `useSample` together.** Pick one. If both are set, `useSample` wins (resolved from the bundled samples dir).
- **Don't forget to escape quotes in display filters.** The tool shell-escapes the filter value, so a filter like `dns.qry.name contains "example"` works as-is when passed as a JSON string in the tool input.
- **Don't expect TCP reassembly.** shark dissects each packet independently — multi-packet HTTP bodies or TCP stream reassembly is not supported. Use a different tool if you need stream-level analysis.
- **Don't expect pcapng writes.** pcapng is read-only in shark; writes are classic pcap. The `editcap`/`mergecap`/`reordercap`/`randpkt`/`dumpcap` operations all write classic pcap regardless of input format.
- **Don't expect regex in display filters.** The filter subset supports `==`, `!=`, `contains`, `&&`, `||`, `!`, CIDR matching, and protocol presence — no regex.
- **Don't run `dumpcap` with no count/duration cap inside the agent loop.** The tool caps wall-clock at 5 minutes, but a long-running capture blocks the call. Always set `count` or `duration`.
- **Don't use shark for live port scanning.** Use `nmap` — it's purpose-built for it.
- **Don't use shark for exploitation.** Use `msfx`.

## Source

- The tool plugin: `packages/core/src/tool/plugin/shark.ts`
- The analyzer source: `packages/cli/assets/shark/` (binary + samples + README)
- The contract: `specs/v2/tools.md#built-in-headless-wireshark-shark`
- Contributor notes: `AGENTS.md#built-in-shark-tool`

If the shark binary is missing from `packages/cli/assets/shark/bin/`, the tool falls back to `shark` on `PATH` and finally fails with a clear error. For dev worktrees, set `CODESHOD_SHARK_BIN=/path/to/shark` and `CODESHOD_SHARK_SAMPLES=/path/to/samples` to override.
