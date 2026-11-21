import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Glob } from "bun"
import { desktopInstall, docsInstalls, installs, sdkInstalls } from "../src/lib/install-commands"

// The site shows Codeshod 2. These names install Codeshod 1 (see src/lib/install-commands.ts):
// the codeshod-ai npm package, the unversioned install script, the tap's codeshod formula and the
// codeshod-bin AUR package. Scoped @codeshod-ai/... packages are code samples, not installs.
const v1 = [
  { name: "the codeshod-ai npm package", pattern: /(?<![@\w/-])codeshod-ai(?![\w/-])/ },
  { name: "the Codeshod 1 install script", pattern: /codeshod\.ai\/install\b/ },
  { name: "the tap's Codeshod 1 formula", pattern: /reddata997327\/tap\/codeshod(?![\w-])/ },
  { name: "the codeshod-bin AUR package", pattern: /\bcodeshod-bin\b/ },
  { name: "the AUR codeshod package", pattern: /\b(paru|yay|pacman) -S codeshod(?![\w-])/ },
]

const app = path.join(import.meta.dir, "..")
// Site copy and the sources of every generated text file (llms.txt, llms-full.txt, the .md pages,
// the view-source comment, voice answers). Not .output: a stale build would fail the test.
const roots = ["src", "public", "script"]
const text = /\.(tsx?|jsx?|css|md|mdx|txt|json|html|xml|webmanifest)$/
// Stored GitHub data (script/github-snapshot.ts): past release notes may name Codeshod 1 packages
// as history, not as an install command. The V1 docs are Codeshod 1's, so they install it.
const exempt = (file: string) => file === "src/lib/github-snapshot.json" || file.startsWith("src/docs/v1/")

async function files() {
  const found = await Promise.all(
    roots.map((root) =>
      Array.fromAsync(new Glob(`${root}/**/*`).scan({ cwd: app, onlyFiles: true, dot: true })).then(
        (files) => files.map((file) => file.replaceAll("\\", "/")),
        () => [],
      ),
    ),
  )
  return found.flat().filter((file) => text.test(file) && !exempt(file) && !file.includes("node_modules"))
}

describe("install commands", () => {
  test("every command installs Codeshod 2", () => {
    const commands = [
      ...installs.map((item) => item.command),
      ...docsInstalls.map((item) => item.code),
      ...sdkInstalls.map((item) => item.command),
      desktopInstall.command,
    ]
    commands.forEach((command) => v1.forEach((item) => expect(command).not.toMatch(item.pattern)))
    expect(installs.map((item) => item.command)).toEqual([
      "curl -fsSL https://codeshod.ai/v2/install | bash",
      "npm install -g @codeshod/cli",
      "bun install -g --trust @codeshod/cli",
      "brew install reddata997327/tap/codeshod-v2",
      "paru -S codeshod-beta",
    ])
  })

  test("site copy and generated text name no Codeshod 1 install", async () => {
    const list = await files()
    expect(list.length).toBeGreaterThan(100)
    const hits = (
      await Promise.all(
        list.map(async (file) =>
          (await Bun.file(path.join(app, file)).text()).split("\n").flatMap((line, index) =>
            // Comments may name the Codeshod 1 packages to explain why the site doesn't.
            /^\s*(\/\/|\*|\/\*)/.test(line)
              ? []
              : v1.filter((item) => item.pattern.test(line)).map((item) => `${file}:${index + 1} ${item.name}`),
          ),
        ),
      )
    ).flat()
    expect(hits).toEqual([])
  })
})
