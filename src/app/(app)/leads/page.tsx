"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Select } from "@/components/ui/primitives";
import { StagePill, VetBadge, TierBadge } from "@/components/leads/badges";
import { ACTIVE_STAGES, DEAD_STAGES, POSITIVE_OUTCOMES, STAGES, type Lead, type LeadStage, type VetStatus, type FitTier } from "@/lib/supabase/types";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { Search } from "lucide-react";

type QuickFilter = "all" | "uncalled" | "no-response" | "positive" | "active" | "dead" | "vetted";

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStage = searchParams.get("stage");

  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [stage, setStage] = useState<LeadStage | "">((initialStage as LeadStage) ?? "");
  const [tier, setTier] = useState<FitTier | "">("");
  const [vet, setVet] = useState<VetStatus | "">("");
  const [industry, setIndustry] = useState<string>("");

  useEffect(() => {
    if (initialStage) setStage(initialStage as LeadStage);
  }, [initialStage]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: positiveLeadIds = new Set<string>() } = useQuery({
    queryKey: ["positive-lead-ids"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("activities")
        .select("lead_id")
        .in("outcome", POSITIVE_OUTCOMES);
      return new Set((data ?? []).map(r => r.lead_id as string));
    },
  });

  const { data: spokeLeadIds = new Set<string>() } = useQuery({
    queryKey: ["spoke-lead-ids"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("activities")
        .select("lead_id, outcome")
        .like("outcome", "Spoke%");
      return new Set((data ?? []).map(r => r.lead_id as string));
    },
  });

  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.industry) set.add(l.industry);
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let rows = leads;
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        l =>
          l.business_name.toLowerCase().includes(s) ||
          (l.owner_name?.toLowerCase().includes(s) ?? false) ||
          (l.city?.toLowerCase().includes(s) ?? false),
      );
    }
    if (stage) rows = rows.filter(l => l.stage === stage);
    if (tier) rows = rows.filter(l => l.fit_tier === tier);
    if (vet) rows = rows.filter(l => l.vet_status === vet);
    if (industry) rows = rows.filter(l => l.industry === industry);

    if (quick === "uncalled") rows = rows.filter(l => l.attempts_count === 0);
    if (quick === "no-response") rows = rows.filter(l => l.attempts_count > 0 && !spokeLeadIds.has(l.id));
    if (quick === "positive") rows = rows.filter(l => positiveLeadIds.has(l.id));
    if (quick === "active") rows = rows.filter(l => ACTIVE_STAGES.includes(l.stage));
    if (quick === "dead") rows = rows.filter(l => DEAD_STAGES.includes(l.stage));
    if (quick === "vetted") rows = rows.filter(l => l.vet_status === "Vetted");
    return rows;
  }, [leads, search, stage, tier, vet, industry, quick, positiveLeadIds, spokeLeadIds]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{filtered.length} of {leads.length} shown</p>
        </div>
        <Link href="/upload"><Button>Upload xlsx</Button></Link>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
            <Input
              placeholder="Search business name, owner, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={stage} onChange={(e) => setStage(e.target.value as LeadStage | "")} className="w-44">
            <option value="">All stages</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={tier} onChange={(e) => setTier(e.target.value as FitTier | "")} className="w-32">
            <option value="">All tiers</option>
            <option value="A">Tier A</option>
            <option value="B">Tier B</option>
            <option value="C">Tier C</option>
          </Select>
          <Select value={vet} onChange={(e) => setVet(e.target.value as VetStatus | "")} className="w-36">
            <option value="">Any vet status</option>
            <option value="Vetted">Vetted</option>
            <option value="Maybe-Fit">Maybe-Fit</option>
            <option value="Unvetted">Unvetted</option>
          </Select>
          <Select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-44">
            <option value="">All industries</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </Select>
        </div>

        <div className="flex gap-2 flex-wrap">
          {([
            ["all", "All"],
            ["uncalled", "Uncalled"],
            ["no-response", "No Response"],
            ["positive", "Positive Response"],
            ["active", "Active Pipeline"],
            ["dead", "Dead"],
            ["vetted", "Vetted"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setQuick(key)}
              className={`text-xs px-3 py-1 rounded-full border ${
                quick === key
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                  : "bg-[var(--background)] border-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
          {(stage || tier || vet || industry || quick !== "all" || search) && (
            <button
              onClick={() => { setSearch(""); setStage(""); setTier(""); setVet(""); setIndustry(""); setQuick("all"); router.replace("/leads"); }}
              className="text-xs px-3 py-1 rounded-full text-[var(--muted-foreground)] hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--muted)] sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Business</th>
                <th className="px-3 py-2 font-medium">Industry</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">Business Phone</th>
                <th className="px-3 py-2 font-medium">Owner</th>
                <th className="px-3 py-2 font-medium">Owner Phone</th>
                <th className="px-3 py-2 font-medium text-right">Revenue</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium text-right">Attempts</th>
                <th className="px-3 py-2 font-medium">Last Contact</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="p-8 text-center text-[var(--muted-foreground)]">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-12 text-center text-[var(--muted-foreground)]">
                  No leads match. <Link href="/upload" className="underline">Upload an xlsx</Link> to get started.
                </td></tr>
              ) : (
                filtered.map((l) => (
                  <tr key={l.id} className="border-t border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer" onClick={() => router.push(`/leads/${l.id}`)}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{l.business_name}</span>
                        <VetBadge status={l.vet_status} />
                        <TierBadge tier={l.fit_tier} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">{l.industry ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">{l.city ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{l.business_phone ?? "—"}</td>
                    <td className="px-3 py-2">{l.owner_name ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{l.owner_phone ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(l.annual_revenue)}</td>
                    <td className="px-3 py-2"><StagePill stage={l.stage} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.attempts_count}</td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">{formatRelativeTime(l.last_contact_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
