import { rateCoarenaReply } from "@codeshod/core/plugin/provider/coarena"
import { createSignal, Match, Show, Switch } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useToast } from "../ui/toast"
import { errorMessage } from "../util/error"

/** Sends a thumbs up/down for a Coarena reply through POST /api/v1/feedback. */
export function DialogFeedback(props: { requestID?: string }) {
  const dialog = useDialog()
  const toast = useToast()
  const theme = useTheme().surface("dialog")
  const [step, setStep] = createSignal(props.requestID ? 1 : 0)
  const [requestID, setRequestID] = createSignal(props.requestID ?? "")
  const [error, setError] = createSignal<string>()

  async function submit(value: string) {
    const rating = Number(value.trim())
    if (!Number.isInteger(rating) || rating < -1 || rating > 1) {
      setError("Enter -1 for a bad reply or 1 for a good reply")
      return
    }
    setError(undefined)
    try {
      await rateCoarenaReply(requestID(), rating)
      toast.show({ variant: "success", message: "Feedback sent" })
      dialog.clear()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <Switch>
      <Match when={step() === 0}>
        <DialogPrompt
          title="Reply request ID"
          placeholder="From the reply id or x-coarena-request-id"
          onConfirm={(value) => {
            if (!value.trim()) return
            setRequestID(value.trim())
            setStep(1)
          }}
        />
      </Match>
      <Match when={step() === 1}>
        <DialogPrompt
          title="Rate reply (-1 bad, 1 good)"
          placeholder="1"
          onConfirm={(value) => void submit(value)}
          description={() => (
            <Show when={error()}>{(value) => <text fg={theme.text.feedback.error.base}>{value()}</text>}</Show>
          )}
        />
      </Match>
    </Switch>
  )
}
