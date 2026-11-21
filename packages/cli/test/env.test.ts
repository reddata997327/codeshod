import { expect, test } from "bun:test"
import { Env } from "../src/env"

test("session environment omits server credentials", () => {
  const previousPassword = process.env.CODESHOD_PASSWORD
  const previousLegacyPassword = process.env.CODESHOD_SERVER_PASSWORD
  const previousValue = process.env.CODESHOD_SESSION_ENV_TEST
  process.env.CODESHOD_PASSWORD = "password"
  process.env.CODESHOD_SERVER_PASSWORD = "legacy"
  process.env.CODESHOD_SESSION_ENV_TEST = "included"

  const environment = Env.session()

  if (previousPassword === undefined) delete process.env.CODESHOD_PASSWORD
  else process.env.CODESHOD_PASSWORD = previousPassword
  if (previousLegacyPassword === undefined) delete process.env.CODESHOD_SERVER_PASSWORD
  else process.env.CODESHOD_SERVER_PASSWORD = previousLegacyPassword
  if (previousValue === undefined) delete process.env.CODESHOD_SESSION_ENV_TEST
  else process.env.CODESHOD_SESSION_ENV_TEST = previousValue

  expect(environment.CODESHOD_PASSWORD).toBeUndefined()
  expect(environment.CODESHOD_SERVER_PASSWORD).toBeUndefined()
  expect(environment.CODESHOD_SESSION_ENV_TEST).toBe("included")
})
