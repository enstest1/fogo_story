import express from "express";
import { ChapterAgent } from "../../src/agents/chapterAgent";
import { getSupabase } from "../lib/supabase";
const log = require("pino")();

// Create two separate routers
const publicChaptersRouter = express.Router();
const protectedChaptersRouter = express.Router();

// This is our hardcoded first chapter, which acts as the genesis block.
const GENESIS_CHAPTER = {
  title: "Chapter 1: Fog at First Light",
  body: "Fog lay low over the stages and wharves like a blanket that forgot to leave. The boards were slick with salt, and every rope had its own opinion about your fingers. The Lil Fogees—quick as gossip, smug as a cat—skittered between planks like living sparks, leaving the faintest taste of ozone and old sea-salt behind them.\n\nAda Pike watched them with the tired patience of a woman who’d seen too much and still had chores. “Don’t you lot start,” she warned, and then immediately realized warning the Lil Fogees was like scolding wind.\n\nOld Man Keel came tapping along with his cane. Tap-tap. Like a ledger closing. Like a judgement.\n\n“You heard it too?” Ada asked him.\n\nKeel didn’t look at her. He stared out at the fog beyond the harbour mouth. “Aye,” he said. “The sea’s been hashing again.”\n\nAda blinked. “Hashing.”\n\nKeel shrugged, as if it were a normal thing to say before breakfast. “That’s what my father called it. When the fog folds over itself just right and the world… verifies.”\n\nThe Fogees loved that word. Verify. They buzzed in a pleased circle, as if somebody had praised their best feature.\n\nThen a sound rang out—bright, clean, impossible—like a spoon against a teacup where no teacup had any business being. Once. Twice.\n\nA buoy drifted in from nowhere that should have a buoy: white as bone, too clean, too close. On its side: a mark like a fishhook crossed with a star.\n\nThe Lil Fogees went dead still.\n\nKeel’s cane tapped once. “That mark’s older than the charts,” he muttered. “And it don’t mean luck.”\n\nAda swallowed. “Whose buoy is it?”\n\n“Not a man’s,” Keel said.\n\nThe Fogees practically vibrated with greedy excitement. Somewhere in their quick little cores lived one belief above all others: upgrades exist, and they belong to whoever gets there first.\n\n“The Lost Fogo Stone,” Ada whispered, and immediately wished she hadn’t said it out loud.\n\nBecause the fog answered.\n\nNot with a voice—nothing so polite—but with a flicker of pale light that skipped across the water like a stone that refused to sink. Glitch-light. Fast. Smug. Beckoning.\n\nThe Lil Fogees leaned toward it like flowers toward sun.\n\nAda grabbed the nearest sleeve of reality—Keel’s coat. “If they go,” she said, “they’ll drag trouble back here.”\n\nKeel’s eyes stayed on the water. “If they don’t go,” he replied, “they’ll drag regret.”\n\nOut beyond the buoy, something tall shifted—like a mast… except it moved like it was breathing.\n\nThe sea, hidden under its blanket, waited without hurrying."
};

// This endpoint is for generating new chapters and should be protected.
protectedChaptersRouter.post("/worlds/:id/arcs/:arcId/progress", async (req, res) => {
  try {
    log.info("Starting chapter generation for arc %s", req.params.arcId);
    const supabase = getSupabase();
    
    // For simplicity in testing, we'll use a hardcoded response here too.
    const hardcodedBody = "A new chapter unfolds, born from a direct call to the progress endpoint.";
    
    const { data, error } = await supabase.from("beats").insert({
      arc_id: req.params.arcId,
      body: hardcodedBody,
      authored_at: new Date()
    }).select().single();

    if (error) {
      log.error(error, "Failed to save chapter to Supabase");
      return res.status(500).json({ error: "Failed to save chapter" });
    }

    log.info("Chapter successfully saved to database with ID %s", data.id);
    res.json({ ok: true, body: hardcodedBody, id: data.id });
  } catch (error) {
    log.error(error, "Error in chapter generation endpoint");
    res.status(500).json({ error: "Internal server error" });
  }
});

// This endpoint gets the latest chapter and should be public.
publicChaptersRouter.get("/latest", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { data: chapters, error } = await supabase
      .from("beats")
      .select("id, body")
      .order("authored_at", { ascending: false })
      .limit(1);

    if (error) {
      log.error(error, "Failed to fetch latest chapter, serving genesis.");
      return res.status(200).json(GENESIS_CHAPTER);
    }
    
    if (!chapters || chapters.length === 0) {
      log.info("No chapters found in DB, serving genesis chapter.");
      return res.status(200).json(GENESIS_CHAPTER);
    }
    
    const { count } = await supabase.from("beats").select('*', { count: 'exact', head: true });
    const chapterNumber = (count ?? 0);
    
    res.json({ title: `Chapter ${chapterNumber}: The Lil Fogees Chronicles Continue`, body: chapters[0].body });
  } catch (err) {
    log.error(err, "Unhandled error fetching latest chapter, serving genesis as fallback.");
    res.status(200).json(GENESIS_CHAPTER);
  }
});

// Export both routers
export { publicChaptersRouter, protectedChaptersRouter };