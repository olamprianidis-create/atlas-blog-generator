import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  try {
    const { testConnection } = await import("../utils/supabase");
    const ok = await testConnection();
    console.log(ok ? "✅ Supabase connection OK (scheduled_articles reachable)" : "❌ Unexpected response from Supabase");
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error("❌ Supabase connection failed:", error);
    console.error("   Make sure the migration in supabase/migrations/0001_init.sql has been run.");
    process.exit(1);
  }
})();
