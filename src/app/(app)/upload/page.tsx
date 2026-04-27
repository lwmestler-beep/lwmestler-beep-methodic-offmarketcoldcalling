"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/primitives";
import { extractDomain, normalizeName, normalizePhone } from "@/lib/dedupe";
import { toast } from "sonner";
import { Upload as UploadIcon } from "lucide-react";

const SCHEMA_FIELDS = [
  "business_name", "industry", "source", "business_phone", "business_email",
  "owner_name", "owner_phone", "owner_email", "website", "address", "city",
  "state", "zip", "annual_revenue", "employees", "founded_year", "rating",
  "reviews", "description", "linkedin_url", "facebook_url", "instagram_url",
  "google_maps_url", "fit_tier", "vet_status",
] as const;

type Field = typeof SCHEMA_FIELDS[number];

const FIELD_LABELS: Record<Field, string> = {
  business_name: "Business Name *", industry: "Industry", source: "Source",
  business_phone: "Business Phone", business_email: "Business Email",
  owner_name: "Owner Name", owner_phone: "Owner Phone", owner_email: "Owner Email",
  website: "Website", address: "Address", city: "City", state: "State", zip: "Zip",
  annual_revenue: "Annual Revenue", employees: "Employees", founded_year: "Founded",
  rating: "Rating", reviews: "Reviews", description: "Description",
  linkedin_url: "LinkedIn", facebook_url: "Facebook", instagram_url: "Instagram",
  google_maps_url: "Google Maps URL", fit_tier: "Fit Tier (A/B/C)",
  vet_status: "Vet Status (Vetted/Maybe-Fit/Unvetted)",
};

function autoMap(headers: string[]): Record<string, Field | ""> {
  const map: Record<string, Field | ""> = {};
  for (const h of headers) {
    const k = h.toLowerCase().trim();
    if (k.includes("business name") || k === "name" || k === "company name" || k === "title") map[h] = "business_name";
    else if (k.includes("industry") || k.includes("category")) map[h] = "industry";
    else if (k.includes("source")) map[h] = "source";
    else if (k.includes("owner") && k.includes("phone")) map[h] = "owner_phone";
    else if (k.includes("owner") && k.includes("email")) map[h] = "owner_email";
    else if (k.includes("owner") && k.includes("name")) map[h] = "owner_name";
    else if (k.includes("phone") || k.includes("tel")) map[h] = "business_phone";
    else if (k.includes("email")) map[h] = "business_email";
    else if (k.includes("website") || k.includes("url") && !k.includes("maps") && !k.includes("linked") && !k.includes("face") && !k.includes("inst")) map[h] = "website";
    else if (k.includes("address")) map[h] = "address";
    else if (k === "city" || k.includes("location") && !k.includes("state")) map[h] = "city";
    else if (k === "state") map[h] = "state";
    else if (k === "zip" || k === "postal" || k.includes("zip code")) map[h] = "zip";
    else if (k.includes("annual revenue") || k === "revenue" || k.includes("est revenue") || k.includes("est. revenue")) map[h] = "annual_revenue";
    else if (k.includes("employee") || k === "# employees") map[h] = "employees";
    else if (k.includes("founded") || k.includes("year founded")) map[h] = "founded_year";
    else if (k === "rating") map[h] = "rating";
    else if (k === "reviews" || k.includes("review")) map[h] = "reviews";
    else if (k.includes("description") || k.includes("notes") || k.includes("short desc")) map[h] = "description";
    else if (k.includes("linkedin")) map[h] = "linkedin_url";
    else if (k.includes("facebook")) map[h] = "facebook_url";
    else if (k.includes("instagram")) map[h] = "instagram_url";
    else if (k.includes("google maps") || k.includes("maps url") || k.includes("maps link")) map[h] = "google_maps_url";
    else if (k.includes("fit tier") || k === "tier") map[h] = "fit_tier";
    else if (k.includes("vet")) map[h] = "vet_status";
    else map[h] = "";
  }
  return map;
}

interface ParsedRow {
  raw: Record<string, unknown>;
  mapped: Partial<Record<Field, unknown>>;
}

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, Field | "">>({});
  const [committing, setCommitting] = useState(false);
  const [dedupePreview, setDedupePreview] = useState<{ unique: number; withinBatch: number; matchExisting: number } | null>(null);

  function handleFile(f: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
        if (data.length === 0) { toast.error("No rows in file"); return; }
        const hs = Object.keys(data[0]);
        setHeaders(hs);
        const map = autoMap(hs);
        setMapping(map);
        setRows(data.map(d => ({ raw: d, mapped: applyMapping(d, map) })));
        setFile(f);
      } catch (err) {
        toast.error(`Parse error: ${(err as Error).message}`);
      }
    };
    reader.readAsArrayBuffer(f);
  }

  function applyMapping(row: Record<string, unknown>, map: Record<string, Field | "">): Partial<Record<Field, unknown>> {
    const out: Partial<Record<Field, unknown>> = {};
    for (const [header, field] of Object.entries(map)) {
      if (!field) continue;
      const v = row[header];
      out[field] = v;
    }
    return out;
  }

  function updateMapping(header: string, field: Field | "") {
    const newMap = { ...mapping, [header]: field };
    setMapping(newMap);
    setRows(rows.map(r => ({ raw: r.raw, mapped: applyMapping(r.raw, newMap) })));
    setDedupePreview(null);
  }

  function buildCleanRow(mapped: Partial<Record<Field, unknown>>) {
    const cleaned: Record<string, unknown> = {};
    for (const f of SCHEMA_FIELDS) {
      const v = mapped[f];
      if (v === undefined || v === null || v === "") { cleaned[f] = null; continue; }
      if (["annual_revenue", "rating"].includes(f)) {
        const n = Number(String(v).replace(/[$,]/g, ""));
        cleaned[f] = isNaN(n) ? null : n;
      } else if (["employees", "founded_year", "reviews"].includes(f)) {
        const n = parseInt(String(v).replace(/[^\d-]/g, ""));
        cleaned[f] = isNaN(n) ? null : n;
      } else if (f === "fit_tier") {
        const s = String(v).trim().toUpperCase();
        cleaned[f] = ["A", "B", "C"].includes(s) ? s : null;
      } else if (f === "vet_status") {
        const s = String(v).trim();
        if (s === "Vetted" || s.toLowerCase() === "yes" || s.toLowerCase() === "green") cleaned[f] = "Vetted";
        else if (s === "Maybe-Fit" || s.toLowerCase().includes("maybe") || s.toLowerCase() === "yellow") cleaned[f] = "Maybe-Fit";
        else cleaned[f] = "Unvetted";
      } else {
        cleaned[f] = String(v).trim() || null;
      }
    }
    cleaned.website_domain = extractDomain(cleaned.website as string | null);
    cleaned.phone_digits = normalizePhone(cleaned.business_phone as string | null) ?? normalizePhone(cleaned.owner_phone as string | null);
    cleaned.name_normalized = normalizeName(cleaned.business_name as string | null);
    return cleaned;
  }

  async function previewDedupe() {
    if (rows.length === 0) return;

    const cleaned = rows.map(r => buildCleanRow(r.mapped)).filter(r => r.business_name);

    // Within-batch dedupe
    const seen = { domain: new Set<string>(), phone: new Set<string>(), name: new Set<string>() };
    let withinBatch = 0;
    const unique: typeof cleaned = [];
    for (const r of cleaned) {
      const d = r.website_domain as string | null;
      const p = r.phone_digits as string | null;
      const n = r.name_normalized as string;
      const dup = (d && seen.domain.has(d)) || (p && seen.phone.has(p)) || (n && seen.name.has(n));
      if (dup) { withinBatch++; continue; }
      if (d) seen.domain.add(d);
      if (p) seen.phone.add(p);
      if (n) seen.name.add(n);
      unique.push(r);
    }

    // Match existing
    const supabase = createClient();
    const domains = unique.map(r => r.website_domain).filter(Boolean) as string[];
    const phones = unique.map(r => r.phone_digits).filter(Boolean) as string[];
    const names = unique.map(r => r.name_normalized).filter(Boolean) as string[];

    const { data: existing } = await supabase
      .from("leads")
      .select("id, website_domain, phone_digits, name_normalized")
      .or([
        domains.length ? `website_domain.in.(${domains.map(d => `"${d}"`).join(",")})` : "",
        phones.length ? `phone_digits.in.(${phones.map(p => `"${p}"`).join(",")})` : "",
        names.length ? `name_normalized.in.(${names.map(n => `"${n}"`).join(",")})` : "",
      ].filter(Boolean).join(","));

    const exDomains = new Map<string, string>();
    const exPhones = new Map<string, string>();
    const exNames = new Map<string, string>();
    for (const e of existing ?? []) {
      if (e.website_domain) exDomains.set(e.website_domain, e.id);
      if (e.phone_digits) exPhones.set(e.phone_digits, e.id);
      if (e.name_normalized) exNames.set(e.name_normalized, e.id);
    }

    let matchExisting = 0;
    for (const r of unique) {
      const d = r.website_domain as string | null;
      const p = r.phone_digits as string | null;
      const n = r.name_normalized as string;
      if ((d && exDomains.has(d)) || (p && exPhones.has(p)) || (n && exNames.has(n))) matchExisting++;
    }

    setDedupePreview({
      unique: unique.length - matchExisting,
      withinBatch,
      matchExisting,
    });
  }

  async function commit() {
    setCommitting(true);
    try {
      const supabase = createClient();
      const cleaned = rows.map(r => buildCleanRow(r.mapped)).filter(r => r.business_name);

      // Within-batch dedupe again
      const seen = { domain: new Set<string>(), phone: new Set<string>(), name: new Set<string>() };
      const unique: typeof cleaned = [];
      const withinBatchDupes: typeof cleaned = [];
      for (const r of cleaned) {
        const d = r.website_domain as string | null;
        const p = r.phone_digits as string | null;
        const n = r.name_normalized as string;
        const dup = (d && seen.domain.has(d)) || (p && seen.phone.has(p)) || (n && seen.name.has(n));
        if (dup) { withinBatchDupes.push(r); continue; }
        if (d) seen.domain.add(d);
        if (p) seen.phone.add(p);
        if (n) seen.name.add(n);
        unique.push(r);
      }

      // Match against existing
      const domains = unique.map(r => r.website_domain).filter(Boolean) as string[];
      const phones = unique.map(r => r.phone_digits).filter(Boolean) as string[];
      const names = unique.map(r => r.name_normalized).filter(Boolean) as string[];
      const orParts = [
        domains.length ? `website_domain.in.(${domains.map(d => `"${d}"`).join(",")})` : "",
        phones.length ? `phone_digits.in.(${phones.map(p => `"${p}"`).join(",")})` : "",
        names.length ? `name_normalized.in.(${names.map(n => `"${n}"`).join(",")})` : "",
      ].filter(Boolean).join(",");
      const { data: existing } = orParts
        ? await supabase.from("leads").select("id, website_domain, phone_digits, name_normalized").or(orParts)
        : { data: [] };

      const exDomains = new Map<string, string>();
      const exPhones = new Map<string, string>();
      const exNames = new Map<string, string>();
      for (const e of (existing ?? []) as { id: string; website_domain: string | null; phone_digits: string | null; name_normalized: string | null }[]) {
        if (e.website_domain) exDomains.set(e.website_domain, e.id);
        if (e.phone_digits) exPhones.set(e.phone_digits, e.id);
        if (e.name_normalized) exNames.set(e.name_normalized, e.id);
      }

      const toInsert: Record<string, unknown>[] = [];
      const toDup: Record<string, unknown>[] = [];

      for (const r of unique) {
        const d = r.website_domain as string | null;
        const p = r.phone_digits as string | null;
        const n = r.name_normalized as string;
        let matchedId: string | undefined;
        let reason: "website_domain" | "phone_digits" | "name_normalized" | undefined;
        if (d && exDomains.has(d)) { matchedId = exDomains.get(d); reason = "website_domain"; }
        else if (p && exPhones.has(p)) { matchedId = exPhones.get(p); reason = "phone_digits"; }
        else if (n && exNames.has(n)) { matchedId = exNames.get(n); reason = "name_normalized"; }
        if (matchedId) {
          toDup.push({ ...r, matched_lead_id: matchedId, match_reason: reason });
        } else {
          toInsert.push(r);
        }
      }
      for (const r of withinBatchDupes) {
        toDup.push({ ...r, matched_lead_id: null, match_reason: "within_batch" });
      }

      if (toInsert.length) {
        const { error } = await supabase.from("leads").insert(toInsert);
        if (error) throw error;
      }
      if (toDup.length) {
        const { error } = await supabase.from("duplicates").insert(toDup);
        if (error) throw error;
      }

      toast.success(`Imported ${toInsert.length} leads, flagged ${toDup.length} duplicates`);
      router.push(toDup.length ? "/duplicates" : "/leads");
    } catch (e) {
      toast.error(`Commit failed: ${(e as Error).message}`);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Upload Leads</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Drag/drop an .xlsx file. Headers will auto-map. Duplicates against existing data go to the Duplicates tab.</p>
      </div>

      {!file && (
        <Card>
          <CardContent className="p-12">
            <label
              className="block border-2 border-dashed border-[var(--border)] rounded-lg p-12 text-center cursor-pointer hover:border-[var(--primary)] transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <UploadIcon className="h-10 w-10 mx-auto mb-3 text-[var(--muted-foreground)]" />
              <div className="font-medium">Drop xlsx here or click to choose</div>
              <div className="text-xs text-[var(--muted-foreground)] mt-1">First sheet only. First row should be headers.</div>
            </label>
          </CardContent>
        </Card>
      )}

      {file && (
        <>
          <Card>
            <CardHeader><CardTitle>{file.name} · {rows.length} rows</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-3">Map each xlsx column to a database field. Required: Business Name.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {headers.map(h => (
                  <div key={h} className="flex items-center gap-2 text-sm">
                    <span className="w-1/2 truncate font-medium">{h}</span>
                    <span className="text-[var(--muted-foreground)]">→</span>
                    <Select className="flex-1" value={mapping[h] ?? ""} onChange={(e) => updateMapping(h, e.target.value as Field | "")}>
                      <option value="">— skip —</option>
                      {SCHEMA_FIELDS.map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => { setFile(null); setRows([]); setHeaders([]); setDedupePreview(null); }}>Restart</Button>
                <Button onClick={previewDedupe}>Preview dedupe</Button>
              </div>
            </CardContent>
          </Card>

          {dedupePreview && (
            <Card>
              <CardHeader><CardTitle>Dedupe Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div><div className="text-3xl font-semibold text-emerald-600">{dedupePreview.unique}</div><div className="text-xs text-[var(--muted-foreground)]">New leads</div></div>
                  <div><div className="text-3xl font-semibold text-amber-600">{dedupePreview.matchExisting}</div><div className="text-xs text-[var(--muted-foreground)]">Match existing</div></div>
                  <div><div className="text-3xl font-semibold text-orange-600">{dedupePreview.withinBatch}</div><div className="text-xs text-[var(--muted-foreground)]">Dupes in upload</div></div>
                </div>
                <Button onClick={commit} disabled={committing} className="w-full">
                  {committing ? "Committing..." : `Insert ${dedupePreview.unique} leads + log ${dedupePreview.matchExisting + dedupePreview.withinBatch} duplicates`}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
