import { Pool } from "pg";

// Read-only connection to the ATLAS Website's Neon Postgres database
// (a separate project from this app's own Supabase database) — powers
// the Statistics pages, which surface data that's actually generated
// and stored by the Website app (join requests, onboarding survey
// answers). Never write through this connection from here.
let pool: Pool | null = null;

function getPool(): Pool {
  const connectionString = process.env.WEBSITE_DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing WEBSITE_DATABASE_URL in environment variables");
  }

  if (!pool) {
    pool = new Pool({ connectionString });
  }
  return pool;
}

export interface MembershipRequest {
  id: string;
  fullName: string;
  invitedBy: string;
  reason: string;
  availability: string;
  email: string;
  phone: string;
  whyAdmit: string;
  createdAt: string;
}

export async function listMembershipRequests(): Promise<MembershipRequest[]> {
  const { rows } = await getPool().query(
    `SELECT id, "fullName", "invitedBy", reason, availability, email, phone, "whyAdmit", "createdAt"
     FROM "MembershipRequest"
     ORDER BY "createdAt" DESC`
  );
  return rows;
}

export interface OnboardingSurveyResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  whyJoined: string;
  whatToGain: string;
  growthArea: string;
  createdAt: string;
}

const SURVEY_RETENTION_DAYS = 90;

export async function listOnboardingSurveyResponses(): Promise<OnboardingSurveyResponse[]> {
  const { rows } = await getPool().query(
    `SELECT r.id, u."firstName", u."lastName", u.email,
            r."whyJoined", r."whatToGain", r."growthArea", r."createdAt"
     FROM "OnboardingResponse" r
     JOIN "User" u ON u.id = r."userId"
     WHERE r."createdAt" >= now() - interval '${SURVEY_RETENTION_DAYS} days'
     ORDER BY r."createdAt" DESC`
  );
  return rows;
}
