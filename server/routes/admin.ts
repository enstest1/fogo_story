import express from "express";
import { createClient } from "@supabase/supabase-js";
import { FIRST_POLL, GENESIS_CHAPTER_BODY } from "../../src/lib/constants";
const log = require("pino")();

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

function getPollDurationSeconds() {
  const defaultSeconds = process.env.NODE_ENV === "production" ? 24 * 60 * 60 : 120;
  return Number.parseInt(process.env.POLL_DURATION_SECONDS || "", 10) || defaultSeconds;
}

/**
 * Resets the story state in Supabase:
 * - deletes votes, polls, beats
 * - inserts genesis beat + first poll from constants
 *
 * This is intended for local/dev re-seeding during rebrands.
 * Protected by the existing /api bearer token middleware (server.ts).
 */
router.post("/reset-story", async (req, res) => {
  try {
    log.info("[admin] resetting story state...");
    const requestedSeconds = Number.isFinite(req.body?.pollDurationSeconds)
      ? Number(req.body.pollDurationSeconds)
      : undefined;
    const durationSeconds = requestedSeconds && requestedSeconds > 0 ? requestedSeconds : getPollDurationSeconds();
    const closesAt = new Date(Date.now() + durationSeconds * 1000);

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
    res.json({ ok: true, poll, beat });
  } catch (err) {
    log.error(err, "[admin] reset failed");
    res.status(500).json({ ok: false, error: "Reset failed" });
  }
});

export default router;


