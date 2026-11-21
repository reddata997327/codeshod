import type { install } from "./console-api"

/** Set when a visitor quits Codeshod Lite: it no longer starts on its own in this browser until codeshod.try(). */
export const liteQuitKey = "codeshod-lite-quit"

/**
 * window.codeshod before anyone uses it: one line in the console, and a getter that loads the console
 * API (console-api.ts) the first time `codeshod` is read there. Until it has loaded, a call on any
 * path (codeshod.help(), codeshod.install.pick()) waits for it, so the first command typed works.
 * On desktop, Text.js's onConsoleIntent also starts Codeshod Lite once the visitor shows they want
 * the console (console-api.ts).
 */
export function installConsoleStub() {
  if (Object.hasOwn(window, "codeshod")) return
  let loading: Promise<ReturnType<typeof install>> | undefined
  const load = () =>
    (loading ??= import("./console-api").then((module) => {
      delete (window as { codeshod?: unknown }).codeshod
      return module.install()
    }))
  let greeted = false
  const greet = () =>
    void load().then((loaded) => {
      if (greeted) return
      greeted = true
      loaded.greet()
    })
  const later = (path: string[]): unknown =>
    new Proxy(() => {}, {
      // Never a thenable, so `await codeshod` doesn't wait forever.
      get: (_, key) => (typeof key === "string" && key !== "then" ? later([...path, key]) : undefined),
      apply: (_, __, args: unknown[]) =>
        load().then((loaded) =>
          (
            path.reduce<unknown>((object, key) => (object as Record<string, unknown>)[key], loaded.api) as (
              ...args: unknown[]
            ) => unknown
          )(...args),
        ),
    })
  Object.defineProperty(window, "codeshod", {
    configurable: true,
    get: () => {
      greet()
      return later([])
    },
  })
  console.log("Type codeshod to install, download or try Codeshod from here.")
  if (matchMedia("(hover: none) and (pointer: coarse)").matches || localStorage.getItem(liteQuitKey)) return
  void import("@textjs/core/experimental").then((textjs) =>
    textjs.onConsoleIntent(
      // Settings › Other › Console API removes window.codeshod when it's turned off, and Lite may have
      // been started by hand and quit since this page loaded. If Lite can't load, the greeting shows.
      (event) =>
        Object.hasOwn(window, "codeshod") &&
        !localStorage.getItem(liteQuitKey) &&
        void load().then((loaded) => loaded.startLite(event.reason).catch(greet)),
      { engageSelector: false },
    ),
    () => undefined,
  )
}
