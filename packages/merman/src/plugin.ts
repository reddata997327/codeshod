import { Plugin } from "@codeshod/plugin/tui"
import { createMermaidCodeBlockRenderer } from "./markdown.js"
import { resolveCodeshodDiagramPalette } from "./palette.js"

export default Plugin.define({
  id: "codeshod.merman",
  setup(context) {
    context.markdown.registerCodeBlockRenderer(
      "mermaid",
      createMermaidCodeBlockRenderer(context.renderer, () => ({
        colors: resolveCodeshodDiagramPalette(context.theme, context.themeMode),
      })),
    )
  },
})
