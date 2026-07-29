"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Copy, Trash2, UserPlus } from "lucide-react"
import { inviteStaff, revokeInvite, removeMember, type MembersState } from "@/actions/members"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type MemberRow = { user_id: string; email: string; role: "doctor" | "staff"; is_self: boolean }
export type InviteRow = { id: string; email: string; token: string; expires_at: string }

export function MembersSection({
  members,
  invites,
  appUrl,
}: {
  members: MemberRow[]
  invites: InviteRow[]
  appUrl: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team</CardTitle>
        <CardDescription>
          Invite a receptionist to manage the queue, patients and billing. Staff can&apos;t change
          clinic settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <MemberList members={members} />
        {invites.length > 0 && <InviteList invites={invites} appUrl={appUrl} />}
        <InviteForm />
      </CardContent>
    </Card>
  )
}

function MemberList({ members }: { members: MemberRow[] }) {
  const [state, action] = useActionState(removeMember, undefined)
  useToastState(state)
  return (
    <div className="space-y-2">
      {members.map((m) => (
        <div key={m.user_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{m.email}</p>
            <p className="text-xs capitalize text-muted-foreground">
              {m.role}
              {m.is_self && " · you"}
            </p>
          </div>
          {!m.is_self && (
            <form action={action}>
              <input type="hidden" name="user_id" value={m.user_id} />
              <Button type="submit" variant="ghost" size="icon" title="Remove member">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </form>
          )}
        </div>
      ))}
    </div>
  )
}

function InviteList({ invites, appUrl }: { invites: InviteRow[]; appUrl: string }) {
  const [state, action] = useActionState(revokeInvite, undefined)
  useToastState(state)
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pending invites</p>
      {invites.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{inv.email}</p>
            <p className="text-xs text-muted-foreground">Invited · not yet joined</p>
          </div>
          <div className="flex items-center gap-1">
            <CopyLinkButton link={`${appUrl}/signup?invite=${inv.token}`} />
            <form action={action}>
              <input type="hidden" name="id" value={inv.id} />
              <Button type="submit" variant="ghost" size="icon" title="Revoke invite">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  )
}

function InviteForm() {
  const [state, action, pending] = useActionState(inviteStaff, undefined)
  const router = useRouter()
  useEffect(() => {
    if (state?.ok) {
      toast.success("Invite created")
      router.refresh()
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state, router])

  return (
    <form action={action} className="space-y-3 border-t pt-4">
      <div className="space-y-2">
        <Label htmlFor="invite_email">Invite by email</Label>
        <div className="flex gap-2">
          <Input
            id="invite_email"
            name="email"
            type="email"
            placeholder="receptionist@example.com"
            required
          />
          <Button type="submit" disabled={pending}>
            <UserPlus className="size-4" />
            {pending ? "Inviting…" : "Invite"}
          </Button>
        </div>
      </div>
      {state?.ok && state.inviteLink && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate">{state.inviteLink}</span>
          <CopyLinkButton link={state.inviteLink} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        We email them an invite. You can also copy the signup link and send it yourself.
      </p>
    </form>
  )
}

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title="Copy signup link"
      onClick={async () => {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        toast.success("Link copied")
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      <Copy className={copied ? "size-4 text-primary" : "size-4"} />
    </Button>
  )
}

function useToastState(state: MembersState) {
  const router = useRouter()
  useEffect(() => {
    if (state?.ok) {
      toast.success("Done")
      router.refresh()
    } else if (state?.error) {
      toast.error(state.error)
    }
  }, [state, router])
}
