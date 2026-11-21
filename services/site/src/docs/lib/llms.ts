import { latestDocs, type DocsSet } from "../config"
import { docsSections, type DocsSection } from "./navigation"

export function renderLlmsTxt(site: URL, set: DocsSet = latestDocs, navigation: DocsSection[] = docsSections) {
  const root = new URL(set.base, site)
  const sections = navigation.flatMap((section) => [
    `## ${section.title}`,
    "",
    ...section.groups.flatMap((group) => [
      ...(group.title && group.title !== section.title ? [`### ${group.title}`, ""] : []),
      ...group.items.flatMap((item) => {
        // A page in another set (the V1 docs' Go and Console) is in that set's llms.txt.
        if (item.href) return []
        const path = item.slug === "index" ? "" : `${item.slug.replace(/\/index$/, "")}/`
        return [`- [${item.title}](${new URL(path, root)})`]
      }),
      "",
    ]),
  ])

  return [
    ...(set.id === "latest"
      ? [
          "# Codeshod V2 Documentation",
          "",
          "> Official documentation for using, configuring, and building with Codeshod V2.",
        ]
      : [
          "# Codeshod V1 Documentation",
          "",
          "> Documentation for Codeshod V1. The latest docs, for Codeshod V2, are at https://codeshod.ai/docs/llms.txt.",
        ]),
    "",
    ...sections,
  ].join("\n")
}
