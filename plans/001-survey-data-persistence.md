# Plan 001: Persist survey responses to Supabase

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6c12730..HEAD -- server.ts src/components/Survey.tsx`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6c12730`, 2026-06-28
- **Issue**: (none)

## Why this matters

The survey feature collects 7 sections of personal data (CNIC, PNC license
number, income, safety concerns, etc.) from nurses — but **none of it is ever
saved**. `Survey.tsx:42` simply calls `setIsSubmitted(true)` and shows a
success screen. On page refresh, all data is gone. This means the entire survey
feature is non-functional: every nurse who fills out the 8–12 minute survey has
their effort wasted, and the product research data the survey was built to
collect is lost.

## Current state

- **`server.ts`** — Express backend. Has two POST endpoints (`/api/extract` at
  line 23, `/api/apply` at line 72) that follow a consistent pattern: multer
  file handling, Supabase client creation from env vars, JSON response with
  `{ success, data, message }`. The Supabase insert pattern at lines 155–164
  uses `nursing_applications` table with typed columns.

- **`src/components/Survey.tsx`** — React component with 7 sections of form
  inputs. Current `handleSubmit` at lines 33–43 only checks the consent
  checkbox and sets `isSubmitted = true`. No network call. Form data lives
  entirely in uncontrolled DOM inputs — the component tracks no state for most
  fields, uses raw DOM queries (`document.querySelectorAll`, `classList`
  mutations) for `toggleTag` and `setScale`, and reads field values from the
  DOM via `updateProgress()` at line 21.

- **Existing Supabase project**: `hcmmdzcbekbenyfsenze.supabase.co` — no
  migrations applied yet (`supabase list_migrations` returns empty), no tables
  in public schema. `nursing_applications` table (used by `/api/apply`) does
  not exist either and will need to be created separately or as part of this
  work.

- **Conventions to follow** (from `/api/apply` endpoint at `server.ts:72-179`):
  - Wrap route handler in try/catch, return `{ success, data, message }` on
    success, `{ error: message }` with status 500 on failure
  - Use `console.warn` for handled errors, `console.error` for unhandled
  - Create Supabase client inline from env vars: `createClient(url, key)`
  - Supabase env vars: `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Dev server | `npm run dev` | Starts on port 3000 |
| Lint | `npm run lint` (if node_modules exist) | exit 0, no errors |

Note: `node_modules` may not be installed. Run `npm install` first if needed.

## Scope

**In scope** (the only files you should modify):
- `server.ts` — add `/api/survey` POST endpoint
- `src/components/Survey.tsx` — wire up form submission to POST to the new endpoint

**Out of scope** (do NOT touch, even though they look related):
- `src/components/Survey.css` — styling changes not needed
- `src/components/Hero.tsx` — landing page form flow is separate
- `src/App.tsx` — routing changes not needed
- Any type strictness fixes or refactoring (save for another plan)

## Git workflow

- Branch: `advisor/001-survey-persistence`
- Commit per step; message style: conventional commits (`feat:`, `fix:`),
  matching the repo's existing log style (e.g. `feat: implement survey response persistence`)
- Do NOT push or open a PR unless instructed

## Steps

### Step 1: Create `survey_responses` table via Supabase migration

Create a new table to store survey responses with the following schema:

```sql
CREATE TABLE survey_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  applicant_name TEXT,
  applicant_email TEXT,
  applicant_phone TEXT,
  survey_data JSONB NOT NULL
);
```

Use `supabase_apply_migration` (the MCP tool) to apply this migration with the
name `create_survey_responses`. If that tool is unavailable, use
`supabase_execute_sql` instead.

The `survey_data` JSONB column will hold the full structured survey response
as a JSON object with these top-level keys:

```
{
  "personal": { gender, dateOfBirth, cnicNumber, whatsappNumber, city, area, transport },
  "credentials": { pncLicenseNumber, pncLicenseExpiry, qualification, specializations[], yearsExperience, homeNursingExperience, institutions },
  "employment": { status, monthlyIncome, supplementalIncome, supplementalIncomeAmount, expectedShiftPay },
  "availability": { weeklyHours, shifts[], travelWillingness, transitionWillingness, patientPreferences[] },
  "safety": { comfortLevel, challenges[], concerns[], platformSafety, safetyNotes },
  "viability": { platformAwareness, findingWorkChannels[], viabilityRating, importantFeatures[], recommendationRating, adoptionBarrier },
  "finalRemarks": { additionalNotes, followupConsent }
}
```

**Verify**: `supabase_list_tables` shows `survey_responses` in the public schema.

### Step 2: Add `/api/survey` POST endpoint to `server.ts`

Add a new route handler after the existing `/api/apply` block (after line 179
in the current file). Follow the exact pattern of `/api/apply`:

```typescript
app.post("/api/survey", async (req: any, res: any) => {
  try {
    const { fullName, phone, email, ...surveyData } = req.body || {};

    if (!fullName) {
      return res.status(400).json({ error: "Full name is required" });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.json({ success: true, simulated: true, message: "Survey received. (Simulated)" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("survey_responses")
      .insert([{
        applicant_name: fullName,
        applicant_email: email || null,
        applicant_phone: phone || null,
        survey_data: surveyData,
      }]);

    if (error) {
      console.warn("Survey insert error (handled):", error);
      return res.json({ success: true, simulated: true, message: "Survey received. (Database insert failed - Simulated)" });
    }

    res.json({ success: true, data, message: "Survey submitted successfully." });
  } catch (error: any) {
    console.error("Survey error:", error);
    res.status(500).json({ error: error.message || "Failed to submit survey" });
  }
});
```

Key details:
- The endpoint accepts JSON (`Content-Type: application/json`) — NOT
  multipart/form-data — since there are no file uploads in the survey
- Validate that `fullName` is provided (minimum required field)
- Extract `fullName`, `phone`, `email` from the body for indexed columns;
  everything else goes into `survey_data` as a JSON blob
- Follow the same simulated/success pattern as `/api/apply` for consistency

**Verify**: `npm run dev` starts without syntax errors. Use curl to test:
```bash
curl -X POST http://localhost:3000/api/survey \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Test Nurse","phone":"+92 300 1234567","email":"test@example.com","personal":{"gender":"Female","city":"Karachi"}}'
```
Expected: `{"success":true,"data":null,"message":"Survey submitted successfully."}` (or
simulated variant if Supabase env vars aren't set locally).

### Step 3: Wire `Survey.tsx` to collect and submit form data

This is the most involved step. The current `Survey.tsx` uses uncontrolled
inputs (reads from DOM in `updateProgress()`) and direct classList mutations
for toggle tags and scale buttons.

**Approach**: Collect all form data from the DOM at submit time (matching the
existing uncontrolled-input pattern) rather than refactoring to controlled
state. This minimizes risk of breaking existing UI behavior.

Modify the `handleSubmit` function at line 33. Replace the current body with
logic that:

1. Checks consent checkbox (keep existing validation)
2. Collects all field values by reading DOM elements directly (using the same
   `document.querySelector` pattern that `updateProgress` already uses)
3. Structures the data into the JSON shape expected by `/api/survey`
4. POSTs it to `/api/survey` via `fetch`
5. On success, sets `isSubmitted(true)` (same as now)
6. On failure, shows an alert or inline error
7. Also captures the `extractedData` values that were passed via route state

Keep `handleSubmit` as an `async` function. Use `try/catch`. Follow the
fetch/response pattern from `Hero.tsx:89-106` as a reference.

The data collection should read (all via DOM queries):

**Section 1 — Personal info:**
- `input[type="text"]` at `field-row` position 0 → fullName (also first name
  input), gender (select), dateOfBirth (date input), cnicNumber (text input)
- `input[type="tel"]` at positions → phone, whatsappNumber
- `input[type="email"]` → email
- `select` for city and transport
- `input[type="text"]` for area/neighbourhood

**Section 2 — Credentials:**
- Inputs for pncLicenseNumber, pncLicenseExpiry, qualification, yearsExperience,
  homeNursingExperience, institutions
- `.tag-btn.selected` elements → specializations array (read innerText)

**Section 3 — Employment:**
- Radio inputs named "emp" (checked value's label text), "supp" (yes/no)
- Selects for monthlyIncome, suppIncome amount, expectedShiftPay
- Hidden supplemental income field visibility

**Section 4 — Availability:**
- Select for weeklyHours, travelWillingness
- Checked checkboxes for shifts (read label text)
- Radio inputs named "transition" (checked label text)
- Checked checkboxes for patientPreferences (label text)

**Section 5 — Safety:**
- `.scale-btn.active` in `#scale1` → comfortLevel (1–5)
- Checked checkboxes for challenges and concerns (label texts)
- Radio inputs named "safer" (checked label text)
- Textarea for safetyNotes

**Section 6 — Viability:**
- Radio named "aware" (checked label text)
- Checked checkboxes for findingWorkChannels (label texts)
- `.scale-btn.active` in `#scale2` → viabilityRating (1–5)
- Checked checkboxes for importantFeatures (label texts)
- `.scale-btn.active` in `#scale3` → recommendationRating (1–5)
- Textarea for adoptionBarrier

**Section 7 — Final remarks:**
- Textarea for additionalNotes
- Radio named "followup" (checked label text)

After collecting, build a payload object matching the JSON shape from Step 1
and POST it. Include `extractedData` from route state as a separate field
so the backend has the AI-extracted info too.

**Verify**: Fill out the survey in the browser, submit it, then check the
Supabase table:
- `supabase_execute_sql("SELECT COUNT(*) FROM survey_responses")` → 1 row
- The `survey_data` JSONB column contains all the filled sections
- `applicant_name` matches what was entered

## Test plan

- Manual test: Complete the full survey flow from the landing page
  (submit application → click survey link → fill fields → submit → verify
  data appears in Supabase)
- There is no test framework in this project yet, so automated tests are out
  of scope. A future plan should add a test framework.

## Done criteria

ALL must hold:

- [ ] `survey_responses` table exists in Supabase public schema
- [ ] `GET http://localhost:3000/api/survey` (POST with curl) returns 200
- [ ] Survey.tsx submits data to `/api/survey` on form submit
- [ ] A completed survey produces a row in `survey_responses` with
      non-empty `survey_data` JSONB
- [ ] No out-of-scope files modified (`git status` shows only
      `server.ts` and `src/components/Survey.tsx`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- `supabase_apply_migration` or `supabase_execute_sql` returns an error
  creating the table.
- The curl test in Step 2 fails — diagnose and report.
- The survey data collection reveals a field that cannot be located by DOM
  query (the selectors above are heuristic — adjust as needed based on
  actual DOM structure but stop if the approach fundamentally doesn't work).
- You discover the assumption that the Supabase project is accessible
  (env vars set, network reachable) is false.

## Maintenance notes

- The uncontrolled-input / DOM-scraping approach in Step 3 is fragile:
  if the Survey component's HTML structure changes (reordering, wrapping in
  new containers), the data collection will silently miss fields. A future
  refactor to controlled React state with proper refs would be more robust.
- The JSONB `survey_data` schema is intentionally flexible — new sections
  can be added without migration. However, if you ever need to query
  individual fields at scale (e.g. "average comfort level by city"),
  consider promoting those fields to indexed columns.
- The `/api/survey` endpoint reuses the same connection
  (`SUPABASE_SERVICE_ROLE_KEY`) as `/api/apply`. If auth/RLS is added later,
  this endpoint may need its own access control.
