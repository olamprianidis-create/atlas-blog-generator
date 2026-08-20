import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables");
}

// Client-side / anon-key client — respects RLS policies.
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Service-role client for server-only operations (migrations, scheduled jobs)
// that need to bypass RLS. Never import this in client-side code.
export function getServiceClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment variables");
  }

  return createClient(supabaseUrl as string, serviceRoleKey);
}

export async function testConnection(): Promise<boolean> {
  const { error } = await supabase.from("scheduled_articles").select("id").limit(1);

  if (error) {
    throw error;
  }

  return true;
}

export default supabase;
