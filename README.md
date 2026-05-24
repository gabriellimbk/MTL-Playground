# MTL Feedback Playground

A separate prompt-testing app for classroom-writer feedback experiments.

## Local Setup

1. Copy `.env.example` to `.env` and use the same Supabase/Gemini values as `classroom-writer`.
2. Run `supabase_schema.sql` once in the Supabase SQL editor.
3. Install dependencies with `npm install`.
4. Start locally with `npm run dev`.

The app runs on `http://localhost:3001` by default so it can sit beside the current classroom app.

Teacher login matches the current app:

- Email must end with `@ri.edu.sg`
- Password is `Password1` unless `TEACHER_SHARED_PASSWORD` is changed

The Gemini model uses `GEMINI_MODEL`, falling back to `gemini-3.1-flash-lite-preview`, matching the current classroom-writer default.
