import type { CodeshodEvent } from "@codeshod/client"
import type { SelectedEvent, SubscribeOptions } from "@codeshod/client/promise/api"

type EventType = Exclude<CodeshodEvent["type"], "server.connected">

export interface EventDomain {
  readonly subscribe: <Type extends EventType = EventType>(
    options?: SubscribeOptions<Type>,
  ) => AsyncIterable<SelectedEvent<CodeshodEvent, Type>>
}
