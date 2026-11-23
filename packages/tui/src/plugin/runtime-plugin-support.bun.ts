import { ensurePluginRuntime, provides } from "@codeshod/plugin/runtime"
import { Plugin, PluginContextProvider, usePlugin } from "@codeshod/plugin/tui"
import { ensureRuntimePluginSupport } from "@opentui/solid/runtime-plugin-support/configure"

ensurePluginRuntime()
ensureRuntimePluginSupport({
  additional: {
    "@codeshod/plugin/tui": { Plugin, PluginContextProvider, usePlugin },
  },
  preserve: provides,
})
