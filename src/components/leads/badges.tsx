import { Badge } from "@/components/ui/primitives";
import type { LeadStage, VetStatus, FitTier, Outcome } from "@/lib/supabase/types";

export function StagePill({ stage }: { stage: LeadStage }) {
  const map: Record<LeadStage, string> = {
    Cold: "bg-gray-200 text-gray-800",
    Attempting: "bg-sky-100 text-sky-900",
    Contacted: "bg-blue-100 text-blue-900",
    Engaged: "bg-indigo-100 text-indigo-900",
    "Materials Sent": "bg-purple-100 text-purple-900",
    "CIM Received": "bg-violet-100 text-violet-900",
    "LOI Stage": "bg-[var(--accent)]/20 text-[#7a6324]",
    Won: "bg-emerald-100 text-emerald-900",
    "Dead - Not Interested": "bg-red-100 text-red-900",
    "Dead - Unresponsive": "bg-red-200 text-red-950",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[stage]}`}>
      {stage}
    </span>
  );
}

export function VetBadge({ status }: { status: VetStatus }) {
  if (status === "Unvetted") return null;
  const isVetted = status === "Vetted";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        isVetted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${isVetted ? "bg-emerald-500" : "bg-amber-400"}`} />
      {isVetted ? "Vetted" : "Maybe-Fit"}
    </span>
  );
}

export function TierBadge({ tier }: { tier: FitTier | null }) {
  if (!tier) return null;
  const map = { A: "bg-emerald-100 text-emerald-900", B: "bg-gray-100 text-gray-800", C: "bg-red-50 text-red-700" };
  return <Badge className={map[tier]}>Tier {tier}</Badge>;
}

export function OutcomeChip({ outcome }: { outcome: Outcome }) {
  const map: Record<Outcome, string> = {
    "No Answer": "bg-gray-100 text-gray-700",
    "Left Voicemail": "bg-gray-100 text-gray-700",
    "Wrong Number": "bg-red-100 text-red-900",
    Gatekeeper: "bg-amber-100 text-amber-900",
    "Spoke - Receptive": "bg-emerald-100 text-emerald-900",
    "Spoke - Not Receptive": "bg-red-100 text-red-900",
    "Spoke - Maybe Later": "bg-amber-100 text-amber-900",
    "Asked for Materials": "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-400",
    "Scheduled Meeting": "bg-[var(--accent)]/20 text-[#7a6324] ring-1 ring-[var(--accent)]",
    "Sent Email": "bg-blue-100 text-blue-900",
    "Sent Text": "bg-blue-100 text-blue-900",
    "Note Only": "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[outcome]}`}>
      {outcome}
    </span>
  );
}
