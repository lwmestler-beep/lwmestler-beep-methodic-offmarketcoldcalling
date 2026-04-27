// Hand-written types matching supabase_schema.sql.
// Will be replaced by `supabase gen types` once the project is wired up.

export type LeadStage =
  | "Cold"
  | "Attempting"
  | "Contacted"
  | "Engaged"
  | "Materials Sent"
  | "CIM Received"
  | "LOI Stage"
  | "Won"
  | "Dead - Not Interested"
  | "Dead - Unresponsive";

export type VetStatus = "Vetted" | "Maybe-Fit" | "Unvetted";
export type FitTier = "A" | "B" | "C";

export type ActivityChannel =
  | "Call"
  | "VM"
  | "Email"
  | "Text"
  | "LinkedIn"
  | "Meeting"
  | "Note";

export type PersonReached =
  | "Owner"
  | "Gatekeeper"
  | "VM"
  | "Wrong Number"
  | "No Answer"
  | "N/A";

export type Outcome =
  | "No Answer"
  | "Left Voicemail"
  | "Wrong Number"
  | "Gatekeeper"
  | "Spoke - Receptive"
  | "Spoke - Not Receptive"
  | "Spoke - Maybe Later"
  | "Asked for Materials"
  | "Scheduled Meeting"
  | "Sent Email"
  | "Sent Text"
  | "Note Only";

export interface Lead {
  id: string;
  business_name: string;
  industry: string | null;
  source: string | null;
  business_phone: string | null;
  business_email: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  website: string | null;
  website_domain: string | null;
  phone_digits: string | null;
  name_normalized: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  annual_revenue: number | null;
  employees: number | null;
  founded_year: number | null;
  rating: number | null;
  reviews: number | null;
  description: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
  fit_tier: FitTier | null;
  vet_status: VetStatus;
  stage: LeadStage;
  next_action: string | null;
  next_action_date: string | null;
  attempts_count: number;
  last_contact_at: string | null;
  status_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  caller_id: string | null;
  caller_name: string;
  caller_email: string;
  occurred_at: string;
  channel: ActivityChannel;
  person_reached: PersonReached | null;
  outcome: Outcome;
  duration_min: number | null;
  notes: string | null;
  stage_after: LeadStage | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface Duplicate {
  id: string;
  business_name: string;
  industry: string | null;
  source: string | null;
  business_phone: string | null;
  business_email: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  website: string | null;
  website_domain: string | null;
  phone_digits: string | null;
  name_normalized: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  annual_revenue: number | null;
  employees: number | null;
  founded_year: number | null;
  description: string | null;
  fit_tier: FitTier | null;
  vet_status: VetStatus | null;
  matched_lead_id: string | null;
  match_reason: "website_domain" | "phone_digits" | "name_normalized" | "within_batch";
  uploaded_at: string;
  resolved: boolean;
  resolution: "deleted" | "merged" | "promoted" | null;
}

export const STAGES: LeadStage[] = [
  "Cold",
  "Attempting",
  "Contacted",
  "Engaged",
  "Materials Sent",
  "CIM Received",
  "LOI Stage",
  "Won",
  "Dead - Not Interested",
  "Dead - Unresponsive",
];

export const ACTIVE_STAGES: LeadStage[] = [
  "Attempting",
  "Contacted",
  "Engaged",
  "Materials Sent",
  "CIM Received",
  "LOI Stage",
];

export const DEAD_STAGES: LeadStage[] = [
  "Dead - Not Interested",
  "Dead - Unresponsive",
];

export const POSITIVE_OUTCOMES: Outcome[] = [
  "Spoke - Receptive",
  "Asked for Materials",
  "Scheduled Meeting",
];

export const CHANNELS: ActivityChannel[] = [
  "Call", "VM", "Email", "Text", "LinkedIn", "Meeting", "Note",
];

export const OUTCOMES_BY_CHANNEL: Record<ActivityChannel, Outcome[]> = {
  Call: [
    "No Answer",
    "Left Voicemail",
    "Wrong Number",
    "Gatekeeper",
    "Spoke - Receptive",
    "Spoke - Not Receptive",
    "Spoke - Maybe Later",
    "Asked for Materials",
    "Scheduled Meeting",
  ],
  VM: ["Left Voicemail"],
  Email: ["Sent Email", "Asked for Materials"],
  Text: ["Sent Text"],
  LinkedIn: ["Sent Email", "Note Only"],
  Meeting: ["Scheduled Meeting", "Spoke - Receptive", "Spoke - Not Receptive"],
  Note: ["Note Only"],
};
