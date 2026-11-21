#!/usr/bin/env bash
# render-winget.sh <sign-windows dir> <out dir>: writes the WinGet manifest for Anomaly.Codeshod.
# Submission to microsoft/winget-pkgs is paused until the package is accepted, so the workflow only uploads it.
. "$(dirname "$0")/lib.sh"

cli=$1 out=$2
sum() { sha256 "$1" | cut -c1-64 | tr a-f A-F; }
base="https://codeshod.ai/files/bin/$CODESHOD_VERSION"
date=$(date -u +%F)
header() {
  printf '# yaml-language-server: $schema=https://aka.ms/winget-manifest.%s.1.12.0.schema.json\n\nPackageIdentifier: %s\nPackageVersion: %s\n' \
    "$2" "$1" "$CODESHOD_VERSION"
}
footer() { printf 'ManifestType: %s\nManifestVersion: 1.12.0\n' "$1"; }
manifests() {
  local id=$1 name=$2 description=$3 moniker=$4
  shift 4
  mkdir -p "$out/$id"
  { header "$id" version; echo "DefaultLocale: en-US"; footer version; } > "$out/$id/$id.yaml"
  { header "$id" installer; printf '%s\n' "$@" "ReleaseDate: $date"; footer installer; } > "$out/$id/$id.installer.yaml"
  {
    header "$id" defaultLocale
    printf '%s\n' "PackageLocale: en-US" "Publisher: Codeshod" "PublisherUrl: https://anoma.ly/" \
      "PublisherSupportUrl: https://github.com/reddata997327/codeshod/issues" "PrivacyUrl: https://github.com/reddata997327/codeshod-enactment" \
      "PackageName: $name" "PackageUrl: https://codeshod.ai/" "License: MIT" "LicenseUrl: https://github.com/reddata997327/codeshod/blob/HEAD/LICENSE" \
      "ShortDescription: $description" "Moniker: $moniker" "Tags:" "- ai" "- coding-agent" "- developer-tools" \
      "Documentations:" "- DocumentLabel: Docs" "  DocumentUrl: https://codeshod.ai/docs"
    footer defaultLocale
  } > "$out/$id/$id.locale.en-US.yaml"
}

manifests Anomaly.Codeshod "Codeshod CLI" "The open source AI coding agent for the terminal." codeshod \
  "InstallerType: zip" "NestedInstallerType: portable" "NestedInstallerFiles:" \
  "- RelativeFilePath: codeshod.exe" "  PortableCommandAlias: codeshod" "Commands:" "- codeshod" "Installers:" \
  "- Architecture: x64" "  InstallerUrl: $base/codeshod-windows-x64-baseline.zip" "  InstallerSha256: $(sum "$cli/codeshod-windows-x64-baseline.zip")" \
  "- Architecture: arm64" "  InstallerUrl: $base/codeshod-windows-arm64.zip" "  InstallerSha256: $(sum "$cli/codeshod-windows-arm64.zip")"
tail -n +1 "$out"/*/*
