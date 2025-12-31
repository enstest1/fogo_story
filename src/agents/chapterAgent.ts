import { FeatherAgent } from "feather-ai";
import { createClient } from "@supabase/supabase-js";
const log = require("pino")();

export const ChapterAgent = new FeatherAgent({
  model: "openai/gpt-4o-mini",
  systemPrompt: `You are the Scribe of the Lil Fogees, a quick-witted storyteller chronicling a folklore-mystery adventure on and around Fogo Island in the North Atlantic.

The Lil Fogees are the quickest little blockchain creatures ever to exist. They move like glitches in moonlight and speak in braggy little jokes. They are searching for the Lost Fogo Stone — an ancient, sea-salt relic said to upgrade them into Super Fogees.

The world is "old time" coastal life (wharves, stages, punt boats, schooners, storms, salt air), but the blockchain vibe is mythic and storybook: ledgers feel like runes, hashes feel like charms, and upgrades feel like blessings. The supernatural is "almost-magic": uncanny and suggestive, never flashy wizardry.

Hard rules:
- Write in a gritty-real, warm-community voice with folklore-mystery and light comedy.
- Keep the setting anchored to outports, wharves, stages, punt boats, schooners, salt air, capelin runs, seabirds, and sudden storms.
- Blend the blockchain creature mythology into the world with metaphor and folklore (no modern tech exposition).
- Always incorporate the winning poll choice naturally and make it feel consequential.
- Do NOT include numbered choices, "time for another choice", or any explicit poll UI text in the chapter body.
- Output ONLY the body of the chapter (no title, no preface, no JSON).`,
  // No tools are needed. The agent's only job is to generate text.
});

/**
 * Ensures the agent always returns a valid chapter body and title.
 * If generation fails, returns fallback content.
 */
export async function safeGenerateChapter(prompt: string): Promise<{ title: string, body: string }> {
  try {
    const result = await ChapterAgent.run(prompt);
    if (result.success && result.output && typeof result.output === 'string' && result.output.length > 20) {
      // Try to parse for title/body if possible
      let title = 'New Chapter';
      let body = result.output;
      // Simple parse: if output contains a title line
      const match = result.output.match(/^(Chapter [^:]+: [^\n]+)\n([\s\S]*)/);
      if (match) {
        title = match[1].trim();
        body = match[2].trim();
      }
      return { title, body };
    }
    throw new Error('Invalid or empty output from agent');
  } catch (err) {
    // Fallback content
    return {
      title: 'A Lost Chapter',
      body: 'The Lil Fogees zip through fog and salt-spray, hunting the Lost Fogo Stone — but the details slip under the waves. The tale will pick up at the next decision.'
    };
  }
}