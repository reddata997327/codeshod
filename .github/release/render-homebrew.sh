#!/usr/bin/env bash
# render-homebrew.sh <sign-macos dir> <build-archives dir> <tap dir>: writes Formula codeshod-v2.rb with the
# hashes of the signed macOS and the Linux archives.
. "$(dirname "$0")/lib.sh"

macos=$1 archives=$2 tap=$3
sum() { sha256 "$1" | cut -c1-64; }
base="https://codeshod.ai/files/bin/$CODESHOD_VERSION"
cat > "$tap/codeshod-v2.rb" <<FORMULA
# typed: false
# frozen_string_literal: true

class CodeshodV2 < Formula
  desc "Codeshod V2 - the AI coding agent for the terminal"
  homepage "https://github.com/reddata997327/codeshod"
  version "$CODESHOD_VERSION"
  license "MIT"

  depends_on "ripgrep"
  conflicts_with "codeshod", because: "both install an codeshod binary"

  on_macos do
    if Hardware::CPU.arm?
      url "$base/codeshod-darwin-arm64.zip"
      sha256 "$(sum "$macos/codeshod-darwin-arm64.zip")"
    else
      url "$base/codeshod-darwin-x64-baseline.zip"
      sha256 "$(sum "$macos/codeshod-darwin-x64-baseline.zip")"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "$base/codeshod-linux-arm64.tar.gz"
      sha256 "$(sum "$archives/codeshod-linux-arm64.tar.gz")"
    else
      url "$base/codeshod-linux-x64-baseline.tar.gz"
      sha256 "$(sum "$archives/codeshod-linux-x64-baseline.tar.gz")"
    end
  end

  def install
    bin.install "codeshod"
  end
end
FORMULA
cat "$tap/codeshod-v2.rb"
