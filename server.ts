import "dotenv/config";
import { createApp, bootstrapDatabase } from "./app";
import { startPollScheduler } from "./server/sched/closePoll";
const log = require("pino")();

const PORT = process.env.PORT || 3000;

// Start server
const app = createApp();
app.listen(PORT, async () => {
  log.info("Lil Fogees Story Engine server started on port %d", PORT);
  log.info("Environment: %s", process.env.NODE_ENV || "development");
  
  await bootstrapDatabase(); // Run the bootstrap logic on startup
  // On Vercel (serverless), do not rely on in-process cron.
  // Use Vercel Cron Jobs to call a protected endpoint instead.
  if (!process.env.VERCEL && process.env.ENABLE_IN_PROCESS_SCHEDULER !== "false") {
    startPollScheduler();
  }
  
  const requiredEnvVars = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "OPENROUTER_API_KEY"];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log.warn("Missing required environment variables: %s", missingVars.join(", "));
  } else {
    log.info("All required environment variables are configured");
  }
});

export default app;