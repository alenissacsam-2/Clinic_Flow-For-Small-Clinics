"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RotateCw } from "lucide-react"
import { retryMessage } from "@/actions/whatsapp"
import { Button } from "@/components/ui/button"

export function RetryButton({ messageId }: { messageId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await retryMessage(messageId)
          if (res.error) toast.error(res.error)
          else {
            toast.success("Retried")
            router.refresh()
          }
        })
      }
    >
      <RotateCw className="size-3.5" />
      Retry
    </Button>
  )
}
