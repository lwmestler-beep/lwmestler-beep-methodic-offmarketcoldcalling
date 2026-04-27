"use client";

import { use, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { StagePill, VetBadge, TierBadge, OutcomeChip } from "@/components/leads/badges";
import { LogActivityDialog } from "@/components/leads/log-activity-dialog";
import { STAGES, type Lead, type Activity, type LeadStage } from "@/lib/supabase/types";
import { formatCurrency, formatRelativeTime, initials } from "@/lib/utils";
import { ArrowLeft, Phone, Mail, Globe, MessageSquare, PhoneCall, ExternalLink, FileText, Voicemail } from "lucide-react";
import { toast } from "sonner";

type Profile = { id: string; email: string; display_name: string };

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [logOpen, setLogOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data as Profile | null;
    },
  });

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Lead;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities", id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("lead_id", id)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return data as Activity[];
    },
  });

  const updateLead = useMutation({
    mutationFn: async (patch: Partial<Lead>) => {
      const supabase = createClient();
      const { error } = await supabase.from("leads").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLead = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead deleted");
      qc.invalidateQueries({ queryKey: ["leads"] });
      router.push("/leads");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !lead) {
    return <div className="p-6 text-[var(--muted-foreground)]">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
        <Button onClick={() => setLogOpen(true)}>+ Log Activity</Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold">{lead.business_name}</h1>
                <VetBadge status={lead.vet_status} />
                <TierBadge tier={lead.fit_tier} />
                <StagePill stage={lead.stage} />
              </div>
              <div className="text-sm text-[var(--muted-foreground)] mt-1">
                {lead.industry ?? "—"} {lead.source && <span>· {lead.source}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-[var(--muted-foreground)]">Stage</Label>
              <Select
                className="w-48"
                value={lead.stage}
                onChange={(e) => updateLead.mutate({ stage: e.target.value as LeadStage })}
              >
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ContactLine icon={<Phone className="h-4 w-4" />} label="Business Phone" value={lead.business_phone} href={lead.business_phone ? `tel:${lead.business_phone}` : undefined} />
              <ContactLine icon={<Mail className="h-4 w-4" />} label="Business Email" value={lead.business_email} href={lead.business_email ? `mailto:${lead.business_email}` : undefined} />
              <div className="border-t border-[var(--border)] pt-3" />
              <EditableField label="Owner Name" value={lead.owner_name} onSave={(v) => updateLead.mutate({ owner_name: v })} />
              <ContactLine icon={<PhoneCall className="h-4 w-4" />} label="Owner Phone" value={lead.owner_phone} href={lead.owner_phone ? `tel:${lead.owner_phone}` : undefined} editable onSave={(v) => updateLead.mutate({ owner_phone: v })} />
              <ContactLine icon={<Mail className="h-4 w-4" />} label="Owner Email" value={lead.owner_email} href={lead.owner_email ? `mailto:${lead.owner_email}` : undefined} editable onSave={(v) => updateLead.mutate({ owner_email: v })} />
              <ContactLine icon={<Globe className="h-4 w-4" />} label="Website" value={lead.website} href={lead.website ?? undefined} />
              <div className="text-sm">
                <div className="text-xs uppercase text-[var(--muted-foreground)] tracking-wider mb-0.5">Address</div>
                <div>{[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ") || "—"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline ({activities.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)] text-center py-6">No activity yet. Click + Log Activity above.</p>
              ) : (
                activities.map((a) => (
                  <div key={a.id} className="flex gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                    <div className="h-8 w-8 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] text-xs flex items-center justify-center font-semibold shrink-0">
                      {initials(a.caller_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <span className="font-medium">{a.caller_name}</span>
                        <ChannelIcon channel={a.channel} />
                        <OutcomeChip outcome={a.outcome} />
                        {a.duration_min ? <span className="text-xs text-[var(--muted-foreground)]">{a.duration_min}min</span> : null}
                        <span className="text-xs text-[var(--muted-foreground)] ml-auto">{formatRelativeTime(a.occurred_at)}</span>
                      </div>
                      {a.notes && <div className="mt-1 text-sm text-[var(--foreground)] whitespace-pre-wrap">{a.notes}</div>}
                      {a.stage_after && <div className="mt-1 text-xs text-[var(--muted-foreground)]">→ Stage moved to {a.stage_after}</div>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Operating Data</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <NumberField label="Annual Revenue" value={lead.annual_revenue} onSave={(v) => updateLead.mutate({ annual_revenue: v })} format={(n) => formatCurrency(n)} />
              <NumberField label="Employees" value={lead.employees} onSave={(v) => updateLead.mutate({ employees: v })} />
              <NumberField label="Founded" value={lead.founded_year} onSave={(v) => updateLead.mutate({ founded_year: v })} />
              {lead.description && (
                <div>
                  <div className="text-xs uppercase text-[var(--muted-foreground)] tracking-wider mb-0.5">Description</div>
                  <div className="text-sm whitespace-pre-wrap text-[var(--muted-foreground)] line-clamp-6">{lead.description}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <EditableField label="Next Action" value={lead.next_action} onSave={(v) => updateLead.mutate({ next_action: v })} />
              <div>
                <Label className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Next Action Date</Label>
                <Input
                  type="date"
                  defaultValue={lead.next_action_date ?? ""}
                  onBlur={(e) => updateLead.mutate({ next_action_date: e.target.value || null })}
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">Status Notes</Label>
                <Textarea
                  defaultValue={lead.status_notes ?? ""}
                  onBlur={(e) => updateLead.mutate({ status_notes: e.target.value || null })}
                />
              </div>
              <div className="pt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => updateLead.mutate({ stage: "Won" })}>Mark Won</Button>
                <Button variant="outline" size="sm" onClick={() => updateLead.mutate({ stage: "Dead - Not Interested" })}>Mark Dead</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (confirm(`Delete ${lead.business_name}? This removes all activity history.`)) deleteLead.mutate();
                }}
              >
                Delete lead
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {profile && (
        <LogActivityDialog
          leadId={lead.id}
          open={logOpen}
          onClose={() => setLogOpen(false)}
          callerName={profile.display_name}
          callerEmail={profile.email}
          callerId={profile.id}
        />
      )}
    </div>
  );
}

function ContactLine({
  icon, label, value, href, editable, onSave,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
  editable?: boolean;
  onSave?: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  if (editing && editable) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[var(--muted-foreground)]">{icon}</span>
        <Input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { setEditing(false); if (v !== (value ?? "")) onSave?.(v || null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (v !== (value ?? "")) onSave?.(v || null); } }}
        />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 group">
      <span className="text-[var(--muted-foreground)]">{icon}</span>
      <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{label}:</span>
      {value ? (
        href ? (
          <a href={href} className="underline hover:text-[var(--primary)]">{value}</a>
        ) : (
          <span>{value}</span>
        )
      ) : (
        <span className="text-[var(--muted-foreground)]">—</span>
      )}
      {editable && (
        <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-xs text-[var(--muted-foreground)] underline ml-auto">
          {value ? "edit" : "add"}
        </button>
      )}
    </div>
  );
}

function EditableField({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{label}</Label>
      {editing ? (
        <Input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { setEditing(false); if (v !== (value ?? "")) onSave(v || null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { setEditing(false); if (v !== (value ?? "")) onSave(v || null); } }}
        />
      ) : (
        <button
          className="block w-full text-left px-3 py-2 rounded-md hover:bg-[var(--muted)] text-sm"
          onClick={() => setEditing(true)}
        >
          {value || <span className="text-[var(--muted-foreground)]">— click to add</span>}
        </button>
      )}
    </div>
  );
}

function NumberField({ label, value, onSave, format }: { label: string; value: number | null; onSave: (v: number | null) => void; format?: (n: number) => string }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value?.toString() ?? "");
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{label}</Label>
      {editing ? (
        <Input
          autoFocus
          type="number"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const n = v === "" ? null : Number(v);
            if (n !== value) onSave(n);
          }}
        />
      ) : (
        <button className="block w-full text-left px-3 py-2 rounded-md hover:bg-[var(--muted)] text-sm" onClick={() => setEditing(true)}>
          {value != null ? (format ? format(value) : value.toLocaleString()) : <span className="text-[var(--muted-foreground)]">— click to add</span>}
        </button>
      )}
    </div>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  const map: Record<string, React.ReactNode> = {
    Call: <PhoneCall className="h-3.5 w-3.5" />,
    VM: <Voicemail className="h-3.5 w-3.5" />,
    Email: <Mail className="h-3.5 w-3.5" />,
    Text: <MessageSquare className="h-3.5 w-3.5" />,
    LinkedIn: <ExternalLink className="h-3.5 w-3.5" />,
    Meeting: <PhoneCall className="h-3.5 w-3.5" />,
    Note: <FileText className="h-3.5 w-3.5" />,
  };
  return <span className="text-[var(--muted-foreground)]">{map[channel] ?? null}</span>;
}
