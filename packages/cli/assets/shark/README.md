# shark-rs

Headless Wireshark suite in **pure Rust** — pcap/pcapng parsing, Wireshark-style display
filters, protocol dissection, capture statistics, capture editing, and live capture.
No libpcap, no C dependencies; only `serde`, `serde_json`, `nom`, `chrono`, `libc`, `clap`.

> The original `sharkd-mcp` JSON-RPC stdio server has been **removed**. This crate now ships
> only the `shark` CLI binary (with 8 alias binaries: `tshark-rs`, `capinfos-rs`, `captype-rs`,
> `editcap-rs`, `mergecap-rs`, `reordercap-rs`, `dumpcap-rs`, `randpkt-rs`). The MCP wrapper
> was unnecessary once shark was integrated as a first-party built-in tool in Codeshod —
> every action is one-shot through the `shark <subcommand>` CLI.

## Layout

```
crates/
  shark-core/   pcap (LE/BE, us/ns) + pcapng readers, classic pcap writer,
                dissectors (Eth/VLAN/ARP/IPv4/IPv6/TCP/UDP/ICMP/DNS/mDNS/LLMNR/HTTP),
                ~110-field extraction registry, nom-based display filter,
                protocol hierarchy + conversation stats, AF_PACKET live capture
  shark-cli/    8 tools (tshark-rs, capinfos-rs, captype-rs, editcap-rs,
                mergecap-rs, reordercap-rs, dumpcap-rs, randpkt-rs)
                + `shark` multiplexer; all output JSON
samples/        real Wireshark sample captures (pcap, big-endian pcapng, ns pcap, ...)
scripts/        test_e2e_cli.py (29 checks against real captures)
```

## Build

Requires Rust 1.75+ (stable).

```sh
cargo build --release          # all binaries in target/release/
cargo test                     # unit tests (3)
python3 scripts/test_e2e_cli.py    # end-to-end suite vs real captures (29 checks)
```

## Use the CLI

```sh
shark --version
shark tshark    --read samples/http.pcap --filter "http.request" --field ip.src --field http.host
shark capinfos  --file samples/dns-mdns.pcap
shark captype   --file samples/dhcp.pcapng
shark tshark    --read samples/dns-mdns.pcap --phs
shark tshark    --read samples/http.pcap --conversations tcp,ip
shark list-fields --prefix dns.
shark randpkt   --output /tmp/test.pcap --count 50 --ptype dns --seed 42
shark editcap   --input samples/dns-mdns.pcap --output /tmp/e.pcap --snaplen 64 --start 1 --count 50
shark mergecap  --inputs samples/dhcp.pcap samples/dhcp.pcapng --output /tmp/m.pcap
shark reordercap --input samples/dns-mdns.pcap --output /tmp/r.pcap
shark dumpcap   --output /tmp/live.pcap --count 10 --duration 5   # needs root/CAP_NET_RAW
```

All output is JSON.

## Known limits

- No TCP reassembly / multi-packet HTTP bodies
- pcapng is read-only; writes are classic pcap
- Display filter is a practical Wireshark subset (no regex)
- Live capture (dumpcap) is Linux AF_PACKET only, needs root or CAP_NET_RAW

