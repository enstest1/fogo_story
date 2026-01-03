// Ensure Vercel bundles this dependency. `feather-ai` references it by string in pino transport config.
import "pino-pretty";
import { getSupabase } from "../../server/lib/supabase";
import { FIRST_POLL, GENESIS_CHAPTER_BODY } from "../../src/lib/constants";
const log = require("pino")();

function getPollDurationSeconds(body: any) {
  const requestedSeconds = Number.isFinite(body?.pollDurationSeconds) ? Number(body.pollDurationSeconds) : undefined;
  if (requestedSeconds && requestedSeconds > 0) return requestedSeconds;
  const defaultSeconds = process.env.NODE_ENV === "production" ? 24 * 60 * 60 : 120;
  return Number.parseInt(process.env.POLL_DURATION_SECONDS || "", 10) || defaultSeconds;
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const token =
      (req.headers?.authorization || "").replace("Bearer ", "") ||
      req.headers?.["x-api-token"];
    const expected = process.env.API_TOKEN;
    if (expected && token !== expected) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const supabase = getSupabase();
    const closesAt = new Date(Date.now() + getPollDurationSeconds(req.body) * 1000);

    log.info("[admin] resetting story state (vercel function)...");

    // Delete votes first to avoid FK issues.
    const { error: votesErr } = await supabase
      .from("votes")
      .delete()
      .neq("client_id", "00000000-0000-0000-0000-000000000000");
    if (votesErr) throw votesErr;

    const { error: pollsErr } = await supabase
      .from("polls")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (pollsErr) throw pollsErr;

    const { error: beatsErr } = await supabase
      .from("beats")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (beatsErr) throw beatsErr;

    const { data: beat, error: insertBeatErr } = await supabase
      .from("beats")
      .insert({
        arc_id: "1",
        body: GENESIS_CHAPTER_BODY,
        authored_at: new Date(0).toISOString()
      })
      .select()
      .single();
    if (insertBeatErr) throw insertBeatErr;

    const { data: poll, error: insertPollErr } = await supabase
      .from("polls")
      .insert({
        question: FIRST_POLL.question,
        options: FIRST_POLL.options,
        closes_at: closesAt,
        processed_at: null
      })
      .select()
      .single();
    if (insertPollErr) throw insertPollErr;

    log.info("[admin] reset complete (poll=%s beat=%s)", poll.id, beat.id);
    return res.status(200).json({ ok: true, poll, beat });
  } catch (err) {
    log.error(err, "[admin] reset failed (vercel function)");
    return res.status(500).json({ ok: false, error: "Reset failed" });
  }
}


