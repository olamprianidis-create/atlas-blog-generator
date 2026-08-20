import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  try {
    const { testConnection } = await import("../utils/anthropic");
    const ok = await testConnection();
    console.log(ok ? "✅ Anthropic API connection OK" : "❌ Unexpected response from Anthropic API");
    process.exit(ok ? 0 : 1);
  } catch (error) {
    console.error("❌ Anthropic API connection failed:", error);
    process.exit(1);
  }
})();
