import { requireClinic } from "@/lib/clinic"
import { createClient } from "@/lib/supabase/server"
import { getDayView } from "@/lib/appointments-data"
import { istDateKey, formatISTDate, formatISTWeekday } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { DateNav } from "@/components/calendar/date-nav"
import { DayView, type BlockChip } from "@/components/calendar/day-view"
import { BlockTimeDialog } from "@/components/calendar/block-time-dialog"

function isValidDateKey(s?: string): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const clinic = await requireClinic()
  const { date } = await searchParams
  const dateKey = isValidDateKey(date) ? date : istDateKey()

  const supabase = await createClient()
  const [rows, { data: blockData }, { data: override }] = await Promise.all([
    getDayView(clinic, dateKey),
    supabase
      .from("slot_blocks")
      .select("id, start_time, end_time, reason")
      .eq("clinic_id", clinic.id)
      .eq("date", dateKey)
      .order("start_time", { ascending: true }),
    supabase
      .from("availability_overrides")
      .select("closed")
      .eq("clinic_id", clinic.id)
      .eq("date", dateKey)
      .maybeSingle(),
  ])

  const blocks = (blockData ?? []) as BlockChip[]
  const dayClosed = override?.closed === true
  const title = `${formatISTWeekday(dateKey + "T12:00:00Z")}, ${formatISTDate(dateKey + "T12:00:00Z")}`

  return (
    <div>
      <PageHeader title="Calendar" description="Book and manage appointments.">
        <div className="flex items-center gap-2">
          <BlockTimeDialog dateKey={dateKey} />
          <DateNav dateKey={dateKey} title={title} />
        </div>
      </PageHeader>
      <DayView rows={rows} dateKey={dateKey} blocks={blocks} dayClosed={dayClosed} />
    </div>
  )
}
