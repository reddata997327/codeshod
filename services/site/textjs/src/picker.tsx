import { initYoga } from "@textjs/core"
import { Box, createTheme, renderToConsole, Select, Text, useInput, type SelectOption } from "@textjs/react"

// CODESHOD dark theme for the console picker (brand cyan -> violet, blue shadow).
const codeshodDark = createTheme({
  id: "codeshodDark",
  name: "Codeshod Dark",
  appearance: "dark",
  bg: "#070a14",
  surface: "#0c1120",
  panel: "#0c1120",
  elevated: "#141b33",
  border: "#28325a",
  borderFocus: "#7ff3ff",
  fg: "#e8ecff",
  muted: "#8a94c0",
  subtle: "#5a6390",
  accent: "#9678ff",
  accentFg: "#070a14",
  selection: "#1d2848",
})

// codeshod.install.pick(): the install commands and desktop builds as a Text.js list in the
// DevTools console. The site passes the options, so this bundle holds no site data.

// Text.js 1.6 fetches Yoga's WebAssembly instead of carrying it inline; script/build.ts hashes the
// file and defines its name. See src/lite.tsx.
declare const __TEXTJS_YOGA__: string

type Input = { options: SelectOption<string>[]; selected?: string; dark: boolean }

export async function pick(input: Input) {
  await initYoga({ wasm: new URL(__TEXTJS_YOGA__, import.meta.url) })
  return new Promise<string | undefined>((resolve) => {
    const done = (value?: string) => {
      root.then((app) => app.unmount())
      resolve(value)
    }
    const root = renderToConsole(<Picker {...input} onDone={done} />, {
      width: 76,
      height: Math.min(input.options.length, 12) + 6,
      theme: input.dark ? codeshodDark : "geistLight",
    })
  })
}

function Picker(props: Input & { onDone: (value?: string) => void }) {
  useInput((event) => {
    if (event.key === "escape") props.onDone()
  })
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold>Install Codeshod</Text>
      <Text color="muted">↑ ↓ choose · Enter copies · Esc closes</Text>
      <Box marginTop={1}>
        <Select
          options={props.options}
          value={props.selected}
          limit={12}
          autoFocus
          onChange={(value) => props.onDone(value)}
        />
      </Box>
    </Box>
  )
}
