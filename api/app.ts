import express from "express";
import * as dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "2mb" }));

const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const PLAYGROUND_TABLE = "MTL_PLAYGROUND_FEEDBACK";
const TEACHER_EMAIL_DOMAIN = "@ri.edu.sg";
const TEACHER_SHARED_PASSWORD = process.env.TEACHER_SHARED_PASSWORD || "Password1";
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

function getSupabaseAdmin() {
  if (!supabaseAdmin) throw new Error("Supabase server credentials are not configured");
  return supabaseAdmin;
}

function getBearerToken(req: express.Request) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
}

async function getAuthenticatedTeacher(req: express.Request) {
  const admin = getSupabaseAdmin();
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing authorization token");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authorization token");

  const email = data.user.email?.toLowerCase() || "";
  const isAnonymous = Boolean((data.user as any).is_anonymous || data.user.app_metadata?.provider === "anonymous");
  if (isAnonymous || !email.endsWith(TEACHER_EMAIL_DOMAIN)) {
    throw new Error("Teacher authorization required");
  }

  return data.user;
}

function normalizeText(value: unknown) {
  return String(value || "").replace(/\r/g, "").trim();
}

function tryParseJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function isMissingPlaygroundTable(error: any) {
  return error?.code === "42P01" || String(error?.message || "").includes(PLAYGROUND_TABLE);
}

function playgroundTableError() {
  return new Error(`Supabase table ${PLAYGROUND_TABLE} is missing. Run MTL playground/supabase_schema.sql in the Supabase SQL editor.`);
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/teacher/provision", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeText(email).toLowerCase();

  if (!normalizedEmail.endsWith(TEACHER_EMAIL_DOMAIN)) {
    return res.status(403).json({ error: `Teacher email must end with ${TEACHER_EMAIL_DOMAIN}` });
  }

  if (password !== TEACHER_SHARED_PASSWORD) {
    return res.status(403).json({ error: "Invalid login credentials" });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;

    const users = (data?.users || []) as Array<any>;
    const existing = users.find(user => user.email?.toLowerCase() === normalizedEmail);

    if (existing) {
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password: TEACHER_SHARED_PASSWORD,
        email_confirm: true,
        user_metadata: { ...(existing.user_metadata || {}), role: "teacher" },
      });
      if (updateError) throw updateError;

      return res.json({ success: true, userId: existing.id });
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: TEACHER_SHARED_PASSWORD,
      email_confirm: true,
      user_metadata: { role: "teacher" },
    });

    if (createError) throw createError;

    res.json({ success: true, userId: created.user.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/playground/runs", async (req, res) => {
  try {
    const admin = getSupabaseAdmin();
    const user = await getAuthenticatedTeacher(req);

    const { data, error } = await admin
      .from(PLAYGROUND_TABLE)
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ success: true, runs: data || [] });
  } catch (error: any) {
    if (isMissingPlaygroundTable(error)) {
      error = playgroundTableError();
    }
    const status = error.message?.includes("authorization") ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post("/api/playground/feedback", async (req, res) => {
  const essayTitle = normalizeText(req.body.essayTitle);
  const essayDescription = normalizeText(req.body.essayDescription);
  const writingText = normalizeText(req.body.writingText);
  const aiPrompt = normalizeText(req.body.aiPrompt);

  if (!essayTitle || !writingText || !aiPrompt) {
    return res.status(400).json({ error: "Essay title, writing text, and AI prompt are required" });
  }

  if (!gemini) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
  }

  try {
    const admin = getSupabaseAdmin();
    const user = await getAuthenticatedTeacher(req);
    const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;

    const systemInstruction = [
      "You are a writing feedback generator in a teacher prompt playground.",
      "Follow the teacher's prompt closely and base feedback only on the supplied title, description, and student writing.",
      "Do not invent missing essay content, quotations, or student intent.",
    ].join(" ");

    const contents = `Teacher Prompt:
${aiPrompt}

Essay Title:
${essayTitle}

Essay Description:
${essayDescription || "No description supplied."}

Student Writing:
${writingText}`;

    const response = await gemini.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
      },
    });

    const feedbackText = response.text || "";
    const feedbackJson = tryParseJsonObject(feedbackText);

    const { data, error } = await admin
      .from(PLAYGROUND_TABLE)
      .insert({
        teacher_id: user.id,
        teacher_email: user.email || null,
        essay_title: essayTitle,
        essay_description: essayDescription,
        writing_text: writingText,
        ai_prompt: aiPrompt,
        model,
        feedback_text: feedbackText,
        feedback_json: feedbackJson,
        request_payload: {
          systemInstruction,
          contents,
        },
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, run: data });
  } catch (error: any) {
    if (isMissingPlaygroundTable(error)) {
      error = playgroundTableError();
    }
    console.error("Playground feedback error:", error);
    const status = error.message?.includes("authorization") ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

export default app;
