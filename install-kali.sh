#!/usr/bin/env bash
# Codeshod installer for Kali Linux (and any Debian/Ubuntu-family Linux).
#
# One-command install:
#   curl -fsSL https://raw.githubusercontent.com/reddata997327/codeshod/main/install-kali.sh | bash
#
# Installs the standalone binary from GitHub Releases. The binary is self-contained
# (Bun runtime embedded): no Node.js, no Bun, no build tools required on the target.
#
# Options:
#   -h, --help              Show this help
#   -v, --version <tag>     Install a specific release tag (default: latest)
#   -d, --dir <path>        Install root (default: ~/.codeshod)
#       --from-source       Build from source instead of downloading the binary
#                           (needs git + Bun; use on arm64 or if no release matches)
#       --no-modify-path    Don't touch shell config files
#       --uninstall         Remove Codeshod and revert PATH changes
set -euo pipefail

APP="codeshod"
REPO="reddata997327/codeshod"
RAW_URL="https://raw.githubusercontent.com/${REPO}/main"
RELEASE_BASE="https://github.com/${REPO}/releases"

# --- output helpers -----------------------------------------------------------
if [ -t 1 ]; then
  BOLD='\033[1m'; GREEN='\033[32m'; YELLOW='\033[33m'; RED='\033[31m'; DIM='\033[2m'; NC='\033[0m'
else
  BOLD=''; GREEN=''; YELLOW=''; RED=''; DIM=''; NC=''
fi
info()  { echo -e "${GREEN}[info]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn]${NC} $1"; }
fail()  { echo -e "${RED}[error]${NC} $1" >&2; exit 1; }

usage() {
  cat <<'USAGE'
Codeshod installer for Kali Linux (and any Debian/Ubuntu-family Linux)

Usage: install-kali.sh [options]

Options:
    -h, --help              Show this help
    -v, --version <tag>     Install a specific release tag (default: latest)
    -d, --dir <path>        Install root (default: ~/.codeshod)
        --from-source       Build from source instead of downloading the binary
        --no-modify-path    Don't touch shell config files
        --uninstall         Remove Codeshod and revert PATH changes

One-command install:
    curl -fsSL https://raw.githubusercontent.com/reddata997327/codeshod/main/install-kali.sh | bash
USAGE
}

# --- defaults -----------------------------------------------------------------
requested_version=""
install_root="${CODESHOD_HOME:-$HOME/.codeshod}"
from_source=false
no_modify_path=false
uninstall=false
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -v|--version) requested_version="${2:-}"; [ -n "$requested_version" ] || fail "--version requires a tag (e.g. v2.3.0)"; shift 2 ;;
    -d|--dir) install_root="${2:-}"; [ -n "$install_root" ] || fail "--dir requires a path"; shift 2 ;;
    --from-source) from_source=true; shift ;;
    --no-modify-path) no_modify_path=true; shift ;;
    --uninstall) uninstall=true; shift ;;
    *) warn "unknown option '$1' ignored"; shift ;;
  esac
done

BIN_DIR="$install_root/bin"
SRC_DIR="$install_root/src"

# --- uninstall ----------------------------------------------------------------
if [ "$uninstall" = true ]; then
  info "removing $BIN_DIR and $SRC_DIR"
  rm -rf "$BIN_DIR" "$SRC_DIR"
  for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "$rc" ]; then
      sed -i '/\.codeshod\/bin/d' "$rc" 2>/dev/null || true
    fi
  done
  for link in "$HOME/.local/bin/$APP" "/usr/local/bin/$APP"; do
    [ -L "$link" ] && rm -f "$link" && info "removed link $link"
  done
  info "Codeshod uninstalled."
  exit 0
fi

# --- platform -----------------------------------------------------------------
[ "$(uname -s)" = "Linux" ] || fail "this installer supports Linux (Kali/Debian/Ubuntu). Your OS: $(uname -s)"
arch="$(uname -m)"
case "$arch" in
  x86_64)  target="linux-x64" ;;
  aarch64|arm64) target="linux-arm64" ;;
  *) fail "unsupported architecture: $arch (supported: x86_64, aarch64)" ;;
esac

# --- prerequisites ------------------------------------------------------------
need_apt=""
for cmd in curl tar; do
  command -v "$cmd" >/dev/null 2>&1 || need_apt="$need_apt $cmd"
done
if [ -n "$need_apt" ]; then
  if [ "$(id -u)" = "0" ]; then
    info "installing missing packages:$need_apt via apt-get"
    apt-get update -qq && apt-get install -y -qq $need_apt
  elif command -v sudo >/dev/null 2>&1; then
    info "installing missing packages:$need_apt via sudo apt-get"
    sudo apt-get update -qq && sudo apt-get install -y -qq $need_apt
  else
    fail "missing:$need_apt - install them and re-run: sudo apt install$need_apt"
  fi
fi

# --- PATH setup ---------------------------------------------------------------
modify_path() {
  [ "$no_modify_path" = true ] && return 0
  local line="export PATH=\"$BIN_DIR:\$PATH\"  # added by codeshod installer"
  local changed=false
  for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    [ -f "$rc" ] || touch "$rc"
    if ! grep -qF '.codeshod/bin' "$rc"; then
      echo "$line" >> "$rc"
      changed=true
    fi
  done
  [ "$changed" = true ] && info "PATH updated in ~/.bashrc, ~/.zshrc, ~/.profile"
}

# --- binary install (default) -------------------------------------------------
install_binary() {
  if [ "$target" = "linux-arm64" ]; then
    warn "no prebuilt binary for arm64 yet - falling back to --from-source"
    install_from_source
    return
  fi

  local asset="codeshod-${target}.tar.gz"
  local url
  if [ -n "$requested_version" ]; then
    url="$RELEASE_BASE/download/${requested_version}/${asset}"
  else
    url="$RELEASE_BASE/latest/download/${asset}"
  fi

  info "downloading Codeshod ($target)${requested_version:+ $requested_version}"
  mkdir -p "$BIN_DIR"
  curl -fSL --progress-bar -o "$BIN_DIR/$asset.tmp" "$url" \
    || fail "download failed: $url"
  tar -xzf "$BIN_DIR/$asset.tmp" -C "$BIN_DIR"
  rm -f "$BIN_DIR/$asset.tmp"
  chmod +x "$BIN_DIR/$APP"
}

# --- source install (fallback / opt-in) ---------------------------------------
install_from_source() {
  command -v git >/dev/null 2>&1 || fail "git is required for --from-source"
  if ! command -v bun >/dev/null 2>&1; then
    info "installing Bun runtime"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  if [ -d "$SRC_DIR/.git" ]; then
    info "updating existing source at $SRC_DIR"
    git -C "$SRC_DIR" pull --ff-only
  else
    rm -rf "$SRC_DIR"
    info "cloning repository to $SRC_DIR"
    git clone --depth 1 "https://github.com/${REPO}.git" "$SRC_DIR"
  fi
  info "installing dependencies (this takes a few minutes)"
  (cd "$SRC_DIR" && bun install)
  mkdir -p "$BIN_DIR"
  cat > "$BIN_DIR/$APP" <<LAUNCHER
#!/usr/bin/env bash
exec "\$(command -v bun)" run --cwd "$SRC_DIR/packages/cli" src/index.ts "\$@"
LAUNCHER
  chmod +x "$BIN_DIR/$APP"
}

if [ "$from_source" = true ]; then
  install_from_source
else
  install_binary
fi

# --- convenience symlink ------------------------------------------------------
mkdir -p "$HOME/.local/bin"
ln -sf "$BIN_DIR/$APP" "$HOME/.local/bin/$APP"
if [ "$(id -u)" = "0" ]; then
  ln -sf "$BIN_DIR/$APP" "/usr/local/bin/$APP" 2>/dev/null || true
fi

# --- verify -------------------------------------------------------------------
modify_path
export PATH="$(dirname "$BIN_DIR"):$PATH"

if "$BIN_DIR/$APP" --version >/dev/null 2>&1; then
  ver="$("$BIN_DIR/$APP" --version 2>/dev/null || echo unknown)"
  echo ""
  echo -e "${GREEN}${BOLD}Codeshod installed successfully!${NC}"
  echo -e "  version : ${BOLD}$ver${NC}"
  echo -e "  location: $BIN_DIR/$APP"
  echo ""
  echo -e "  ${BOLD}Start it:${NC}  codeshod"
  if [ "$no_modify_path" != true ]; then
    echo -e "  ${DIM}(open a new terminal, or run: source ~/.bashrc, if the command is not found)${NC}"
  fi
else
  fail "installed binary failed smoke test - run with: $BIN_DIR/$APP --version"
fi
