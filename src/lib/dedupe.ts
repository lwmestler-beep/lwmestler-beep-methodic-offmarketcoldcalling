// Normalization helpers for duplicate detection across leads.

export function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  let s = website.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slash = s.indexOf("/");
  if (slash >= 0) s = s.slice(0, slash);
  const q = s.indexOf("?");
  if (q >= 0) s = s.slice(0, q);
  return s || null;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  let s = name.toLowerCase();
  s = s.replace(/[.,&'"]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  const suffixes = ["llc", "inc", "corp", "corporation", "company", "co", "ltd", "the"];
  const tokens = s.split(" ").filter(t => !suffixes.includes(t));
  return tokens.join(" ").trim();
}
