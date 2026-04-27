"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardContent } from "@/components/ui/primitives";
import { type Duplicate } from "@/lib/supabase/types";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

export default function DuplicatesPage() {
  const qc = useQueryClient();
  const { data: duplicates = [], isLoading } = useQuery({
    queryKey: ["duplicates"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("duplicates")
        .select("*")
        .eq("resolved", false)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data as Duplicate[];
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ id, action, dup }: { id: string; action: "deleted" | "merged" | "promoted"; dup: Duplicate }) => {
      const supabase = createClient();
      if (action === "merged" && dup.matched_lead_id) {
        const { data: existing } = await supabase.from("leads").select("*").eq("id", dup.matched_lead_id).single();
        if (existing) {
          const patch: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(dup)) {
            if (k === "id" || k === "matched_lead_id" || k === "match_reason" || k === "uploaded_at" || k === "resolved" || k === "resolution") continue;
            if (existing[k] == null && v != null) patch[k] = v;
          }
          if (Object.keys(patch).length > 0) {
            const { error: upErr } = await supabase.from("leads").update(patch).eq("id", dup.matched_lead_id);
            if (upErr) throw upErr;
          }
        }
      } else if (action === "promoted") {
        const { id: _id, matched_lead_id: _m, match_reason: _r, uploaded_at: _u, resolved: _re, resolution: _res, ...rest } = dup;
        const { error } = await supabase.from("leads").insert(rest);
        if (error) throw error;
      }
      const { error } = await supabase.from("duplicates").update({ resolved: true, resolution: action }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`Marked ${vars.action}`);
      qc.invalidateQueries({ queryKey: ["duplicates"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Duplicates</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{duplicates.length} unresolved duplicate{duplicates.length === 1 ? "" : "s"}.</p>
      </div>

      {isLoading ? (
        <div className="text-[var(--muted-foreground)]">Loading...</div>
      ) : duplicates.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-[var(--muted-foreground)]">No duplicates flagged.</CardContent></Card>
      ) : (
        duplicates.map(dup => (
          <Card key={dup.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="font-medium">{dup.business_name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Match: <span className="font-medium">{dup.match_reason.replace("_", " ")}</span> · uploaded {formatRelativeTime(dup.uploaded_at)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {dup.matched_lead_id && (
                    <Link href={`/leads/${dup.matched_lead_id}`} className="text-sm underline">View matched lead →</Link>
                  )}
                </div>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Show incoming data</summary>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {Object.entries(dup).filter(([k]) => !["id","matched_lead_id","match_reason","uploaded_at","resolved","resolution"].includes(k) && dup[k as keyof Duplicate] != null).map(([k, v]) => (
                    <div key={k} className="text-xs"><span className="text-[var(--muted-foreground)]">{k}:</span> {String(v)}</div>
                  ))}
                </div>
              </details>

              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => resolve.mutate({ id: dup.id, action: "deleted", dup })}>Delete duplicate</Button>
                {dup.matched_lead_id && (
                  <Button variant="outline" size="sm" onClick={() => resolve.mutate({ id: dup.id, action: "merged", dup })}>Merge into existing (fill blanks)</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => resolve.mutate({ id: dup.id, action: "promoted", dup })}>Promote (false positive → new lead)</Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
