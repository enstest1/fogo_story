// Ensure Vercel bundles this dependency. `feather-ai` references it by string in pino transport config.
import "pino-pretty";
import { bootstrapDatabase } from "../../app";
import { closePollAndTally } from "../../server/sched/closePoll";
const log = require("pino")();

/**
 * Vercel Cron target. Runs story progression on a schedule.
 * Protect with API_TOKEN (Bearer) because it mutates data and can trigger AI calls.
 */
export default async function handler(req: any, res: any) {
  try {
    const token =
      (req.headers?.authorization || "").replace("Bearer ", "") ||
      req.headers?.["x-api-token"];

    const expected = process.env.API_TOKEN;
    if (expected && token !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await bootstrapDatabase();
    await closePollAndTally();
    res.status(200).json({ ok: true });
  } catch (err) {
    log.error(err, "[cron] daily failed");
    res.status(500).json({ ok: false });
  }
}


