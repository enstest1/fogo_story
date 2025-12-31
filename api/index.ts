// Ensure Vercel bundles this dependency. `feather-ai` references it by string in pino transport config.
import "pino-pretty";
import { bootstrapDatabase, createApp } from "../app";
const log = require("pino")();

const app = createApp();

// Vercel Serverless entry: make bootstrap safe and return clear errors instead of crashing.
export default async function handler(req: any, res: any) {
  try {
    await bootstrapDatabase();
    return app(req, res);
  } catch (err) {
    log.error(err, "[api] handler failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).send(
      `Serverless Function error. Most common cause: missing env vars (SUPABASE_URL / SUPABASE_ANON_KEY / OPENROUTER_API_KEY / API_TOKEN). Details: ${message}`
    );
  }
}


