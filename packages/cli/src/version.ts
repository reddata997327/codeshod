import { Option, Schema } from "effect"

declare const CODESHOD_VERSION: string
declare const CODESHOD_CHANNEL: string
declare const CODESHOD_ARTIFACT: string
declare const CODESHOD_RELEASE_HIGHLIGHTS: string

const version = typeof CODESHOD_VERSION === "string" ? CODESHOD_VERSION : "local"
const channel = typeof CODESHOD_CHANNEL === "string" ? CODESHOD_CHANNEL : "local"
const artifact = typeof CODESHOD_ARTIFACT === "string" ? CODESHOD_ARTIFACT : "cli"
// Stable release builds embed the release notes' Highlights; every other build has none.
const highlights =
  typeof CODESHOD_RELEASE_HIGHLIGHTS === "string"
    ? Option.getOrElse(
        Schema.decodeUnknownOption(
          Schema.fromJsonString(Schema.Array(Schema.Struct({ title: Schema.String, body: Schema.String }))),
        )(CODESHOD_RELEASE_HIGHLIGHTS),
        () => [],
      )
    : []

export {
  version as CODESHOD_VERSION,
  channel as CODESHOD_CHANNEL,
  artifact as CODESHOD_ARTIFACT,
  highlights as CODESHOD_HIGHLIGHTS,
}
export const CODESHOD_LOCAL = channel === "local"
