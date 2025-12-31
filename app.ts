import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { publicChaptersRouter, protectedChaptersRouter } from "./server/routes/chapters";
import pollsRouter from "./server/routes/polls";
import adminRouter from "./server/routes/admin";
const log = require("pino")();

import { GENESIS_CHAPTER_BODY, FIRST_POLL } from "./src/lib/constants";

// --- Database Bootstrap Logic ---
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function bootstrapDatabase() {
  log.info("[Bootstrap] Checking if database needs to be initialized...");

  const defaultPollDurationSeconds = process.env.NODE_ENV === "production" ? 24 * 60 * 60 : 120;
  const pollDurationSeconds =
    Number.parseInt(process.env.POLL_DURATION_SECONDS || "", 10) || defaultPollDurationSeconds;
  const closesAt = new Date(Date.now() + pollDurationSeconds * 1000);

  const { count: chapterCount } = await supabase.from("beats").select("*", { count: "exact", head: true });
  if (chapterCount === 0) {
    log.info("[Bootstrap] No chapters found. Inserting genesis chapter.");
    await supabase.from("beats").insert({
      arc_id: "1",
      body: GENESIS_CHAPTER_BODY,
      authored_at: new Date(0)
    });
  }

  const { count: pollCount } = await supabase.from("polls").select("*", { count: "exact", head: true });
  if (pollCount === 0) {
    log.info("[Bootstrap] No polls found. Inserting first poll.");
    await supabase.from("polls").insert({
      question: FIRST_POLL.question,
      options: FIRST_POLL.options,
      closes_at: closesAt,
      processed_at: null
    });
  }

  log.info("[Bootstrap] Database check complete.");
}
// --- End of Bootstrap Logic ---

export function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static("public"));

  const authenticateAPI = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method === "GET" && req.path.startsWith("/polls")) {
      return next();
    }
    const token = req.headers.authorization?.replace("Bearer ", "") || req.headers["x-api-token"];
    const expectedToken = process.env.API_TOKEN;
    if (!expectedToken) {
      log.warn("API_TOKEN not configured - API endpoints are unprotected");
      return next();
    }
    if (!token || token !== expectedToken) {
      log.warn("Unauthorized API access attempt from %s", req.ip);
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Routes
  app.use("/api", authenticateAPI as express.RequestHandler);
  app.use("/api", protectedChaptersRouter);
  app.use("/api/admin", adminRouter);
  app.use("/beats", publicChaptersRouter);
  app.use("/polls", pollsRouter);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/", (_req, res) => res.sendFile("index.html", { root: "public" }));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    log.error(err, "Unhandled error in request");
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}


