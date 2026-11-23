import { expect, test } from "bun:test"
import { App } from "@codeshod/core/app"

test("formats app metadata as a user agent", () => {
  expect(App.useragent(App.make({ name: "sdk", version: "1.2.3", channel: "beta" }))).toBe("codeshod/beta/1.2.3/sdk")
})
