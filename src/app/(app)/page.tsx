import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { ACTIVE_STAGES, POSITIVE_OUTCOMES, STAGES, type LeadStage } from "@/lib/supabase/types";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";

const STAGE_COLORS: Record<LeadStage, string> = {
  Cold: "bg-gray-300",
  Attempting: "bg-sky-400",
  Contacted: "bg-blue-500",
  Engaged: "bg-indigo-500",
  "Materials Sent": "bg-purple-500",
  "CIM Received": "bg-violet-500",
  "LOI Stage": "bg-[var(--accent)]",
  Won: "bg-emerald-500",
  "Dead - Not Interested": "bg-red-500",
  "Dead - Unresponsive": "bg-red-700",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [leadsByStage, totalLeadsRes, callsRes, positiveRes, callerStatsRes, hotLeadsRes, stalledRes] = await Promise.all([
    supabase.from("leads").select("stage"),
    supabase.from("leads").select("*", { count: "exact", head: true }),
    supabase.from("activities")
      .select("*", { count: "exact", head: true })
      .eq("channel", "Call")
      .gte("occurred_at", since7d),
    supabase.from("activities")
      .select("*", { count: "exact", head: true })
      .in("outcome", POSITIVE_OUTCOMES)
      .gte("occurred_at", since7d),
    supabase.from("activities")
      .select("caller_name, channel, outcome")
      .gte("occurred_at", since7d),
    supabase.from("activities")
      .select("lead_id, occurred_at, outcome, caller_name, lead:leads(business_name, stage)")
      .in("outcome", POSITIVE_OUTCOMES)
      .gte("occurred_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("occurred_at", { ascending: false })
      .limit(8),
    supabase.from("leads")
      .select("id, business_name, stage, last_contact_at, industry")
      .in("stage", ["Engaged", "Materials Sent", "CIM Received"])
      .or(`last_contact_at.lt.${since14d},last_contact_at.is.null`)
      .limit(8),
  ]);

  const stageCounts: Record<string, number> = {};
  for (const r of leadsByStage.data ?? []) stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + 1;
  const maxCount = Math.max(1, ...Object.values(stageCounts));

  const totalLeads = totalLeadsRes.count ?? 0;
  const activePipeline = ACTIVE_STAGES.reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0);
  const callsThisWeek = callsRes.count ?? 0;
  const positiveThisWeek = positiveRes.count ?? 0;

  const callerStats = aggregateCallerStats(callerStatsRes.data ?? []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Live snapshot of pipeline and outreach activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={totalLeads} />
        <StatCard label="Active Pipeline" value={activePipeline} />
        <StatCard label="Calls This Week" value={callsThisWeek} />
        <StatCard label="Positive Responses 7d" value={positiveThisWeek} highlight />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Pipeline Funnel</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {STAGES.map((s) => {
              const c = stageCounts[s] ?? 0;
              return (
                <Link
                  key={s}
                  href={`/leads?stage=${encodeURIComponent(s)}`}
                  className="grid grid-cols-[170px_1fr_40px] items-center gap-3 group"
                >
                  <div className="text-sm">{s}</div>
                  <div className="h-6 rounded bg-[var(--muted)] overflow-hidden">
                    <div
                      className={`h-full ${STAGE_COLORS[s]} group-hover:opacity-80 transition-opacity`}
                      style={{ width: `${(c / maxCount) * 100}%` }}
                    />
                  </div>
                  <div className="text-sm text-right tabular-nums">{c}</div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Caller Leaderboard (7d)</CardTitle></CardHeader>
          <CardContent>
            {callerStats.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No activity logged in the last 7 days.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-[var(--muted-foreground)]">
                    <th className="pb-2 font-medium">Caller</th>
                    <th className="pb-2 font-medium text-right">Calls</th>
                    <th className="pb-2 font-medium text-right">Conv</th>
                    <th className="pb-2 font-medium text-right">Pos</th>
                  </tr>
                </thead>
                <tbody>
                  {callerStats.map((c) => (
                    <tr key={c.caller_name} className="border-b last:border-0">
                      <td className="py-2 font-medium">{c.caller_name}</td>
                      <td className="py-2 text-right tabular-nums">{c.calls}</td>
                      <td className="py-2 text-right tabular-nums">{c.conversations}</td>
                      <td className="py-2 text-right tabular-nums">{c.positive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Hot Leads</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(hotLeadsRes.data ?? []).length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">No positive responses in the last 30 days.</p>
            ) : (
              (hotLeadsRes.data ?? []).map((row, i) => {
                const leadArr = row.lead as { business_name: string; stage: string }[] | { business_name: string; stage: string } | null;
                const lead = Array.isArray(leadArr) ? leadArr[0] : leadArr;
                return (
                  <Link
                    key={`${row.lead_id}-${i}`}
                    href={`/leads/${row.lead_id}`}
                    className="block p-3 rounded-md hover:bg-[var(--muted)] border border-transparent hover:border-[var(--border)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">{lead?.business_name ?? "—"}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{formatRelativeTime(row.occurred_at)}</div>
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {row.outcome} · {row.caller_name}
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Stalled (no activity in 14d)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(stalledRes.data ?? []).length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Nothing stalled.</p>
            ) : (
              (stalledRes.data ?? []).map((row) => (
                <Link
                  key={row.id}
                  href={`/leads/${row.id}`}
                  className="block p-3 rounded-md hover:bg-[var(--muted)] border border-transparent hover:border-[var(--border)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{row.business_name}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{row.stage}</div>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Last contact: {formatRelativeTime(row.last_contact_at)} · {row.industry ?? "—"}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-[var(--accent)]/30" : ""}>
      <CardContent className="p-5">
        <div className="text-xs uppercase text-[var(--muted-foreground)] font-medium tracking-wider">{label}</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  );
}

function aggregateCallerStats(rows: { caller_name: string; channel: string; outcome: string }[]) {
  const map = new Map<string, { caller_name: string; calls: number; conversations: number; positive: number }>();
  for (const r of rows) {
    const e = map.get(r.caller_name) ?? { caller_name: r.caller_name, calls: 0, conversations: 0, positive: 0 };
    if (r.channel === "Call") e.calls++;
    if (r.outcome.startsWith("Spoke") || r.outcome === "Asked for Materials" || r.outcome === "Scheduled Meeting") {
      e.conversations++;
    }
    if (POSITIVE_OUTCOMES.includes(r.outcome as typeof POSITIVE_OUTCOMES[number])) e.positive++;
    map.set(r.caller_name, e);
  }
  return Array.from(map.values()).sort((a, b) => b.calls - a.calls);
}
