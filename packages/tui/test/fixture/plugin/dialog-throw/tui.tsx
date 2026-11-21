import { Plugin } from "@codeshod/plugin/tui"

// A dialog that throws while rendering (reddata997327/codeshod#61101).
export default Plugin.define({
  id: "fixture.dialog-throw",
  setup(context) {
    context.ui.dialog.show(() => {
      throw new Error("dialog exploded")
    })
  },
})
