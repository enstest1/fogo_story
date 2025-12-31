import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { ChapterAgent } from "../../src/agents/chapterAgent";
const log = require("pino")();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

let isProcessingPollClosure = false;

function getPollDurationSeconds() {
  const defaultSeconds = process.env.NODE_ENV === "production" ? 24 * 60 * 60 : 120;
  return Number.parseInt(process.env.POLL_DURATION_SECONDS || "", 10) || defaultSeconds;
}

function getNextPollTemplate() {
  return {
    question: "What happens next?",
    options: ["Chase the glitch-light toward the Lost Fogo Stone", "Lay low and gather clues on the wharf"]
  };
}

export async function closePollAndTally() {
  if (isProcessingPollClosure) {
    log.warn("[Scheduler] Cycle already running. Skipping.");
    return;
  }
  isProcessingPollClosure = true;
  log.info("--- [Scheduler] Starting Cycle ---");

  try {
    const { data: pollToProcess, error } = await supabase
        .from('polls')
        .select('*')
        .lt('closes_at', new Date().toISOString())
        .is('processed_at', null)
        .order('closes_at', { ascending: true })
        .limit(1)
        .single();

    if (error || !pollToProcess) {
        log.info("[Scheduler] No closed polls to process. Ending cycle.");
    } else {
        log.info(`[Scheduler] Processing poll ID ${pollToProcess.id}`);
        await supabase.from('polls').update({ processed_at: new Date().toISOString() }).eq('id', pollToProcess.id);
        
        const { data: votes } = await supabase.from("votes").select("choice").eq("poll_id", pollToProcess.id);
        const voteCounts = (pollToProcess.options as string[]).map((option, index) => ({ option, count: votes?.filter(v => v.choice === index).length || 0 }));
        
        // Handle no-vote scenarios by defaulting to the first option
        const winner = voteCounts.length > 0 ? voteCounts.reduce((a, b) => (b.count >= a.count ? b : a)) : { option: pollToProcess.options[0], count: 0 };
        log.info(`[Scheduler] Poll winner is "${winner.option}" with ${winner.count} votes.`);

        // --- DYNAMIC AI CHAPTER GENERATION ---
        // 1. Get the most recent story beat for context.
        const { data: lastChapter } = await supabase.from("beats").select("body").order("authored_at", { ascending: false }).limit(1).single();
        const storyContext = lastChapter?.body || "The story has just begun.";

        // 2. Choose the next poll first, then force the chapter ending to match it.
        const nextPoll = getNextPollTemplate();

        // 3. Construct a detailed prompt for the AI.
        const prompt = `The last chapter ended like this:
"${storyContext}"

The community voted for the following to happen next:
"${winner.option}"

Write the next chapter of the Lil Fogees chronicles.

Constraints:
- Length: 250–450 words total.
- 3–6 short paragraphs.
- Folklore-mystery + light comedy. No modern tech exposition.
- Do NOT include a numbered list, "time for another choice", or any explicit poll UI text.
- The final paragraph must smoothly tee up the next decision using EXACTLY these two option strings (verbatim, in quotes):
  1) "${nextPoll.options[0]}"
  2) "${nextPoll.options[1]}"`

        log.info("[Scheduler] Generating new chapter with AI...");
        // 3. Run the AI agent to generate the next chapter.
        const result = await ChapterAgent.run(prompt);

        // 4. Use the AI-generated body, with a fallback if it fails.
        let newChapterBody = "The fog thickens and the sea keeps its counsel, but the Lil Fogees' tale goes on. A new choice will soon present itself.";
        if (result.success && typeof result.output === 'string' && result.output.length > 20) {
            newChapterBody = result.output;
            log.info("[Scheduler] AI chapter generated successfully.");
        } else {
            log.warn("[Scheduler] AI chapter generation failed or returned empty. Using fallback text.");
        }
        // --- END OF DYNAMIC LOGIC ---

        await supabase.from("beats").insert({ arc_id: "1", body: newChapterBody });
        log.info("[Scheduler] New chapter saved.");

        // Create the next poll using the exact options the chapter was forced to tee up.
        await supabase.from("polls").insert({
          question: nextPoll.question,
          options: nextPoll.options,
          closes_at: new Date(Date.now() + getPollDurationSeconds() * 1000),
          processed_at: null
        });
        log.info("[Scheduler] Next poll has been created with options: %o", nextPoll.options);
    }
  } catch (e) {
    if(e instanceof Error) log.error(e, "[Scheduler] Unhandled error in scheduler cycle.");
  } finally {
    isProcessingPollClosure = false;
    log.info("--- [Scheduler] Cycle Finished ---");
  }
}

export function startPollScheduler() {
  if (process.env.NODE_ENV === "production") {
    const cronIntervalMinutes = 5;
    log.info(`[Scheduler] Initializing. Polling interval: ${cronIntervalMinutes} minutes.`);
    cron.schedule(`*/${cronIntervalMinutes} * * * *`, closePollAndTally);
    log.info("[Scheduler] Poll scheduler started.");
    return;
  }

  // Dev: run frequently so you can watch full cycles locally (vote -> close -> chapter -> new poll).
  const cronIntervalSeconds = Number.parseInt(process.env.POLL_CRON_SECONDS || "", 10) || 5;
  const expr = `*/${cronIntervalSeconds} * * * * *`;
  log.info(`[Scheduler] Initializing (dev). Polling interval: ${cronIntervalSeconds}s.`);

  try {
    cron.schedule(expr, closePollAndTally);
    log.info("[Scheduler] Poll scheduler started.");
  } catch (err) {
    // Fallback if seconds-based cron isn't supported in this runtime.
    log.warn(err, "[Scheduler] Seconds cron unsupported; falling back to 1-minute polling.");
    cron.schedule("*/1 * * * *", closePollAndTally);
    log.info("[Scheduler] Poll scheduler started (fallback).");
  }
}

// Allow manual execution for testing
if (require.main === module) {
  log.info("Running poll closure manually");
  closePollAndTally().then(() => {
    log.info("Manual poll closure completed");
    process.exit(0);
  }).catch((error) => {
    log.error(error instanceof Error ? error.message : String(error), "Manual poll closure failed");
    process.exit(1);
  });
}

// Poll duration is configured via getPollDurationSeconds(); kept centralized there.