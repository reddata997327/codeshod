import {
  migrateV1,
  migrateV1NewDesigns,
  parseThemeDocument,
  type ThemeDocument,
  type ModeDefinition,
} from "@codeshod/theme/tui"
import { resolveThemeColors } from "./resolve"
import { DEFAULT_THEMES, type Theme, type ThemeV1Json } from "./v1"
import codeshodClassic from "./assets/v2/codeshod-classic.json" with { type: "json" }
import codeshod from "./assets/v2/codeshod.json" with { type: "json" }

export { DEFAULT_THEMES, type Theme, type ThemeV1Json } from "./v1"

export type ThemeDocumentSource = Record<string, unknown>

let customThemes: Record<string, ThemeDocumentSource> = {}
let systemTheme: ThemeDocumentSource | undefined
const listeners = new Set<(themes: Record<string, ThemeDocumentSource>) => void>()
const parsed = { current: new WeakMap<object, ThemeDocument>(), newDesigns: new WeakMap<object, ThemeDocument>() }
type BothModes = ThemeDocument & {
  readonly light: ModeDefinition
  readonly dark: ModeDefinition
}
let codeshodTheme: BothModes | undefined
let codeshodClassicTheme: BothModes | undefined

/** The default "codeshod" theme. */
export function getCodeshodTheme() {
  codeshodTheme ??= parseThemeDocument(codeshod, "codeshod") as BothModes
  return codeshodTheme
}

/** The previous "codeshod" theme, offered as "codeshod-classic". */
export function getCodeshodClassicTheme() {
  codeshodClassicTheme ??= parseThemeDocument(codeshodClassic, "codeshod-classic") as BothModes
  return codeshodClassicTheme
}

function listThemes(): Record<string, ThemeDocumentSource> {
  // Priority: defaults < custom files < generated system.
  const themes: Record<string, ThemeDocumentSource> = {
    ...DEFAULT_THEMES,
    codeshod: getCodeshodTheme(),
    "codeshod-classic": getCodeshodClassicTheme(),
    ...customThemes,
  }
  return {
    ...themes,
    system: systemTheme ?? themes.system ?? themes.codeshod,
  }
}

function syncThemes() {
  const themes = listThemes()
  for (const listener of listeners) listener(themes)
}

export function allThemes() {
  return listThemes()
}

export function isThemeSource(source: unknown): source is ThemeDocumentSource {
  if (typeof source !== "object" || source === null || Array.isArray(source)) return false
  return "theme" in source || "base" in source
}

export function parseTheme(source: ThemeDocumentSource, name = "theme", options: { newDesigns?: boolean } = {}) {
  const cache = options.newDesigns ? parsed.newDesigns : parsed.current
  const cached = cache.get(source)
  if (cached) return cached

  const migrate = options.newDesigns ? migrateV1NewDesigns : migrateV1
  const document = "theme" in source ? migrate(source as ThemeV1Json) : parseThemeDocument(source, name)

  cache.set(source, document)
  return document
}

export function subscribeThemes(listener: (themes: Record<string, ThemeDocumentSource>) => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setCustomThemes(themes: Record<string, unknown>) {
  customThemes = Object.fromEntries(
    Object.entries(themes).filter((entry): entry is [string, ThemeDocumentSource] => isThemeSource(entry[1])),
  )
  syncThemes()
}

export function setSystemTheme(theme: ThemeDocumentSource | undefined) {
  systemTheme = theme
  syncThemes()
}

export function hasTheme(name: string) {
  if (!name) return false
  return allThemes()[name] !== undefined
}

export function resolveTheme(theme: ThemeV1Json, mode: "dark" | "light"): Theme {
  const resolved = resolveThemeColors(theme, mode)
  return {
    ...resolved.theme,
    _hasSelectedListItemText: resolved.hasSelectedListItemText,
    thinkingOpacity: resolved.thinkingOpacity,
  }
}
