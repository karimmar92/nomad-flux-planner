import type { Visibility } from "./geoprivacy";

/** Filter axes are deliberately limited to skill, looking_for and availability.
 *  There is no gender field anywhere in this app and there must never be one. */
export const LOOKING_FOR = [
  "cofounder",
  "contract_work",
  "hiring",
  "collaborators",
  "coffee",
] as const;
export type LookingFor = (typeof LOOKING_FOR)[number];

export const LOOKING_FOR_LABELS: Record<LookingFor, string> = {
  cofounder: "Cofounder",
  contract_work: "Contract work",
  hiring: "Hiring",
  collaborators: "Collaborators",
  coffee: "Coffee",
};

export const AVAILABILITY = ["available", "limited", "booked"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  available: "Available now",
  limited: "Limited capacity",
  booked: "Booked up",
};

/** Mirrors the `profiles` radar columns. `cell_lat`/`cell_lng` are snapped
 *  centroids — there is no column anywhere for a precise position. */
export type RadarProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  headline: string;
  skills: string[];
  looking_for: LookingFor[];
  availability: Availability;
  bio: string;
  links: { label: string; url: string }[];
  timezone: string;
  visibility: Visibility;
  cell_lat: number | null;
  cell_lng: number | null;
  last_active_at: string;
  radar_city_id: string | null;
};

export type ConnectionStatus = "pending" | "accepted" | "declined";

export type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: ConnectionStatus;
  intro_note: string;
  created_at: string;
};

export type Block = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export const REPORT_REASONS = [
  "harassment",
  "spam",
  "impersonation",
  "inappropriate_content",
  "safety_concern",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment or abuse",
  spam: "Spam or solicitation",
  impersonation: "Impersonation",
  inappropriate_content: "Inappropriate content",
  safety_concern: "Safety concern",
  other: "Something else",
};

export type Report = {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: ReportReason;
  detail: string;
  created_at: string;
  status: "open" | "reviewing" | "closed";
};

export const INTRO_NOTE_MAX = 200;
export const BIO_MAX = 300;

/** Density gate: the radar only exists where there are enough people for it. */
export const RADAR_CITY_ID = "bali-id";
