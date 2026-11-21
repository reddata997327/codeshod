import type { CodeshodEvent } from "@codeshod/client"
import { useClient } from "./client"

type EventMetadata = {
  directory: string | undefined
}
type CodeshodEventMap = { [Type in CodeshodEvent["type"]]: Extract<CodeshodEvent, { type: Type }> }

export function useEvent() {
  const client = useClient()

  function subscribe(handler: (event: CodeshodEvent, metadata: EventMetadata) => void) {
    return client.event.listen(({ details }) => {
      if (details.type === "server.connected") return
      handler(details, { directory: details.location?.directory })
    })
  }

  function on<T extends CodeshodEvent["type"]>(
    type: T,
    handler: (event: CodeshodEventMap[T], metadata: EventMetadata) => void,
  ) {
    return client.event.on(type, (event) => {
      handler(event, { directory: event.location?.directory })
    })
  }

  return {
    subscribe,
    on,
  }
}
