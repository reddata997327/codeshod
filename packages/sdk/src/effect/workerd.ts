export * as CodeshodWorkerd from "./workerd"

import { Layer } from "effect"
import type { Config, Scope } from "effect"
import { WorkerdProfile } from "../internal/workerd"
import { Codeshod } from "./codeshod"

export type Configuration = WorkerdProfile.Configuration

export interface CreateOptions<R = never> extends WorkerdProfile.Options {
  readonly log?: Codeshod.CreateOptions["log"]
  readonly plugins?: Codeshod.CreateOptions["plugins"]
  readonly workspaceProviders?: Codeshod.CreateOptions["workspaceProviders"]
  readonly instances?: Codeshod.CreateOptions<R>["instances"]
}

export const create = <R = never>({ log, plugins, workspaceProviders, instances, ...options }: CreateOptions<R>) => {
  const profile = WorkerdProfile.make(options)
  return Codeshod.create(
    { ...profile.options, log, plugins, workspaceProviders, instances },
    { overrides: profile.replacements },
  )
}

export const layer = <R = never>(
  options: CreateOptions<R>,
): Layer.Layer<Codeshod.Service, Config.ConfigError | Error, Exclude<R, Scope.Scope>> =>
  Layer.effect(Codeshod.Service, create(options))

export type Interface = Codeshod.Interface
export type Requirements = Scope.Scope
