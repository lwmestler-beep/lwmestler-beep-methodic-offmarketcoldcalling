"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { CHANNELS, OUTCOMES_BY_CHANNEL, STAGES, type ActivityChannel, type Outcome, type LeadStage, type PersonReached } from "@/lib/supabase/types";
import { toast } from "sonner";
import { X } from "lucide-react";

interface Props {
  leadId: string;
  open: boolean;
  onClose: () => void;
  callerName: string;
  callerEmail: string;
  callerId: string;
}

export function LogActivityDialog({ leadId, open, onClose, callerName, callerEmail, callerId }: Props) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<ActivityChannel>("Call");
  const [personReached, setPersonReached] = useState<PersonReached | "">("");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [duration, setDuration] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [stageAfter, setStageAfter] = useState<LeadStage | "">("");
  const [occurredAt, setOccurredAt] = useState<string>(() => new Date().toISOString().slice(0, 16));

  useEffect(() => {
    if (!open) {
      setChannel("Call");
      setPersonReached("");
      setOutcome("");
      setDuration("");
      setNotes("");
      setStageAfter("");
      setOccurredAt(new Date().toISOString().slice(0, 16));
    }
  }, [open]);

  const validOutcomes = OUTCOMES_BY_CHANNEL[channel] ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      if (!outcome) throw new Error("Outcome required");
      const supabase = createClient();
      const payload = {
        lead_id: leadId,
        caller_id: callerId,
        caller_name: callerName,
        caller_email: callerEmail,
        occurred_at: new Date(occurredAt).toISOString(),
        channel,
        person_reached: personReached || null,
        outcome,
        duration_min: duration ? parseInt(duration) : null,
        notes: notes || null,
        stage_after: stageAfter || null,
      };
      const { error } = await supabase.from("activities").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Activity logged");
      qc.invalidateQueries({ queryKey: ["lead", leadId] });
      qc.invalidateQueries({ queryKey: ["activities", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--background)] rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Log Activity</h2>
            <p className="text-xs text-[var(--muted-foreground)]">as {callerName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[var(--muted)] rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="p-5 space-y-4"
        >
          <div>
            <Label>Channel</Label>
            <div className="mt-1.5 flex gap-1 flex-wrap">
              {CHANNELS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => { setChannel(c); setOutcome(""); setPersonReached(""); }}
                  className={`text-xs px-3 py-1.5 rounded-md border ${
                    channel === c
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Date / Time</Label>
            <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
          </div>

          {(channel === "Call" || channel === "VM") && (
            <div>
              <Label>Person Reached</Label>
              <div className="mt-1.5 flex gap-1 flex-wrap">
                {(["Owner", "Gatekeeper", "VM", "Wrong Number", "No Answer"] as PersonReached[]).map(p => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setPersonReached(p)}
                    className={`text-xs px-3 py-1.5 rounded-md border ${
                      personReached === p
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                        : "border-[var(--border)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Outcome <span className="text-[var(--destructive)]">*</span></Label>
            <div className="mt-1.5 flex gap-1 flex-wrap">
              {validOutcomes.map(o => (
                <button
                  type="button"
                  key={o}
                  onClick={() => setOutcome(o)}
                  className={`text-xs px-3 py-1.5 rounded-md border ${
                    outcome === o
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                      : "border-[var(--border)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {channel === "Call" && outcome.startsWith("Spoke") && (
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was said? Anything to remember next time..." />
          </div>

          <div>
            <Label>Update Stage (optional)</Label>
            <Select value={stageAfter} onChange={(e) => setStageAfter(e.target.value as LeadStage | "")}>
              <option value="">Don&apos;t change</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!outcome || mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Log Activity"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
