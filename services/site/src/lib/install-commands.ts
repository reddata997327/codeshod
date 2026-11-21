// Every Codeshod install command the site shows: the home install row, the Terminal, Mini and SDK
// pages, the docs, llms.txt, the view-source comment, voice answers and the console API.
// Checked on 5 Nov 2026 against the release workflow on origin/dev (.github/release/publish-npm.sh,
// publish-homebrew.sh, publish-aur.sh, the repo's install script) and the live registries, where each
// one installed Codeshod 2.2.5:
// - npm: @codeshod/cli, dist-tag latest = 2.2.5. Its postinstall links the platform binary, so Bun
//   needs --trust and pnpm needs --allow-build. mise resolves `codeshod` to npm:@codeshod/cli.
// - https://codeshod.ai/v2/install reads codeshod.ai/update/api/latest/cli/npm (@codeshod/cli 2.2.5).
// - Homebrew: reddata997327/tap/codeshod-v2 = 2.2.5. AUR: codeshod-beta = 2.2.5-1.
// Codeshod 1 still lives under the old names: the codeshod-ai npm package (1.19.5),
// https://codeshod.ai/install, reddata997327/tap/codeshod (1.19.5) and the codeshod-bin AUR package
// (1.19.5). test/install-commands.test.ts keeps them out of the site.

/** The home install row, the Terminal and Mini pages, llms.txt, the console API and the view-source comment. */
export const installs = [
  { id: "curl", name: "Script", command: "curl -fsSL https://codeshod.ai/v2/install | bash" },
  { id: "npm", name: "npm", command: "npm install -g @codeshod/cli" },
  { id: "bun", name: "Bun", command: "bun install -g --trust @codeshod/cli" },
  { id: "brew", name: "Homebrew", command: "brew install reddata997327/tap/codeshod-v2" },
  { id: "paru", name: "AUR", command: "paru -S codeshod-beta" },
] as const

/** The docs intro's install tabs: every channel that installs Codeshod 2. */
export const docsInstalls = [
  { label: "curl", code: installs[0].command },
  { label: "homebrew", code: installs[3].command },
  { label: "npm", code: installs[1].command },
  { label: "bun", code: installs[2].command },
  { label: "pnpm", code: "pnpm add -g --allow-build=@codeshod/cli @codeshod/cli" },
  { label: "yarn", code: "yarn global add @codeshod/cli" },
  { label: "vite+", code: "vp install -g @codeshod/cli" },
  { label: "aur", code: installs[4].command },
  { label: "mise", code: "mise use -g codeshod" },
]

/** The v2 SDK (@codeshod/sdk, dist-tag latest = 2.2.5). */
export const sdkInstalls = [
  { id: "npm", command: "npm i @codeshod/sdk" },
  { id: "bun", command: "bun add @codeshod/sdk" },
] as const

/** The desktop app's Homebrew cask (codeshod-desktop = 2.2.5). */
export const desktopInstall = { id: "cask", command: "brew install --cask codeshod-desktop" }
