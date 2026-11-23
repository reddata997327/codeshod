import { expect, test } from "bun:test"
import { selectTheme, selectThemeMode, supportsThemeMode, themeModes } from "@codeshod/theme/tui"
import { getCodeshodClassicTheme } from "../../../src/theme"

test("selects complete light and dark themes independently", () => {
  const light = selectTheme(getCodeshodClassicTheme(), "light")
  const dark = selectTheme(getCodeshodClassicTheme(), "dark")
  expect(selectTheme(getCodeshodClassicTheme())).toEqual(light)
  expect(light.hue).toEqual(getCodeshodClassicTheme().light.hue)
  expect(dark.text).toEqual(getCodeshodClassicTheme().base.text)
  expect(dark.hue).toEqual(getCodeshodClassicTheme().dark.hue)
  expect(selectThemeMode(getCodeshodClassicTheme(), "dark")).toEqual({ theme: dark, mode: "dark" })
})

test("selects the available mode when the requested mode is missing", () => {
  const lightOnly = { base: getCodeshodClassicTheme().base, light: getCodeshodClassicTheme().light } as const
  const darkOnly = { base: getCodeshodClassicTheme().base, dark: getCodeshodClassicTheme().dark } as const

  expect(themeModes(lightOnly)).toEqual(["light"])
  expect(themeModes(darkOnly)).toEqual(["dark"])
  expect(supportsThemeMode(lightOnly, "light")).toBeTrue()
  expect(supportsThemeMode(lightOnly, "dark")).toBeFalse()
  expect(selectThemeMode(lightOnly, "dark")).toEqual({ theme: selectTheme(getCodeshodClassicTheme(), "light"), mode: "light" })
  expect(selectThemeMode(darkOnly, "light")).toEqual({ theme: selectTheme(getCodeshodClassicTheme(), "dark"), mode: "dark" })
})
