import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { generateWorkout } from "./utils/mistral.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl ?? "", serviceRoleKey ?? "", {
  auth: { persistSession: false },
});

async function verifySupabaseAccessToken(accessToken) {
  if (!accessToken) return null;

  // Verify via Supabase Auth REST API using the provided JWT.
  // This avoids SDK signature mismatches and works consistently.
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!resp.ok) return null;

  const json = await resp.json();
  // json.user.id is the UUID.
  return json?.user?.id ?? null;
}

function withNullable(value) {
  if (value === undefined) return null;
  return value;
}


app.post("/generate-workout", async (req, res) => {
  try {
    const {
      // ── existing required ──────────────────────────────────────────────────
      age,
      gender,
      height,
      weight,
      goal,
      experience,
      workout_duration,
      focus,
      injuries,
      cardio,
      location,
      equipment,
      // ── 🆕 new optional ───────────────────────────────────────────────────
      weak_muscles,     // string[]  e.g. ["lower_chest", "rear_delts"]
      intensity_style,  // string    "pump" | "strength" | "circuit" | "balanced" | "explosive"
      recovery_level,   // string    "fresh" | "normal" | "tired" | "very_tired"
      days_per_week,    // number    how many days/week user trains
      custom_note,      // string?   free-text from user
      // ── 🆕 auth context (optional) ─────────────────────────────────────────
      user_id,
      access_token,
    } = req.body;

    // ── Validation (only required fields) ────────────────────────────────────
    if (!age || !gender || !goal || !experience || !workout_duration || !location) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ── Recovery → volume instruction ─────────────────────────────────────────
    const recoveryNote = {
      fresh:      "Energy: FRESH — push max volume and intensity today",
      normal:     "Energy: NORMAL — standard session",
      tired:      "Energy: TIRED — reduce total sets ~20%, avoid failure sets",
      very_tired: "Energy: VERY TIRED — deload style: light weight, 60% normal volume",
    }[recovery_level] ?? "Energy: NORMAL — standard session";

    // ── Intensity → rep/rest instruction ──────────────────────────────────────
    const intensityNote = {
      pump:      "Style: PUMP — 12-20 reps, 30-45s rest, supersets encouraged",
      strength:  "Style: STRENGTH — 3-6 reps, 2-3 min rest, compound-first",
      circuit:   "Style: CIRCUIT — back-to-back exercises, <30s rest, full-body flow",
      explosive: "Style: EXPLOSIVE — power movements, plyometrics, speed focus",
      balanced:  "Style: BALANCED — compound strength (5-8 rep) + hypertrophy (10-15 rep)",
    }[intensity_style] ?? "Style: BALANCED — compound strength (5-8 rep) + hypertrophy (10-15 rep)";

    // ── Weak muscles section ──────────────────────────────────────────────────
    const weakSection = Array.isArray(weak_muscles) && weak_muscles.length > 0
      ? `Lagging / Weak Muscles — ADD 1-2 extra targeted exercises for each:\n` +
        weak_muscles.map(m => `  • ${m.replace(/_/g, " ")}`).join("\n")
      : "Weak muscles: none specified";

    // ── Build prompt ──────────────────────────────────────────────────────────
    const prompt = `
═══════════════════════════════════════
USER PROFILE
═══════════════════════════════════════
Age:            ${age} years
Gender:         ${gender}
Height:         ${height || "unknown"} cm
Weight:         ${weight || "unknown"} kg
Experience:     ${experience}
Trains:         ${days_per_week ?? 4}× per week

═══════════════════════════════════════
TODAY'S SESSION
═══════════════════════════════════════
Primary Goal:   ${goal}
Today's Focus:  ${focus || "full body"}
Duration:       ${workout_duration} minutes
Cardio:         ${cardio || "none"}
Location:       ${location}
Equipment:      ${equipment?.join(", ") || "bodyweight"}

${recoveryNote}
${intensityNote}

═══════════════════════════════════════
PERSONALISATION
═══════════════════════════════════════
Injuries / Limitations:
  ${injuries?.join(", ") || "none"}

${weakSection}

${custom_note ? `User's custom instructions:\n  "${custom_note}"` : ""}

═══════════════════════════════════════
GENERATION RULES
═══════════════════════════════════════
1. If weak muscles overlap with today's focus → include 1-2 EXTRA isolation exercises.
   Name them to reflect the benefit: e.g. "Low Cable Fly – Lower Chest Emphasis".
2. If injury listed → substitute/remove exercises that stress that area. Add a warning in the tip field.
3. Match total volume to recovery level (fewer sets if tired, more if fresh).
4. Match rep ranges and rest periods to intensity style.
5. Fit ALL exercises within the exact duration — do not exceed it.
6. If custom instructions are provided, follow them precisely.
`.trim();

    const workout = await generateWorkout(prompt);

    // ── Supabase save (optional; only for authenticated users) ─────────
    if (user_id && access_token) {
      try {
        const verifiedUserId = await verifySupabaseAccessToken(access_token);
        if (verifiedUserId && verifiedUserId === user_id) {
          await supabaseAdmin
            .from('workouts')
            .insert({
              user_id,
              focus: focus ?? null,
              duration: workout_duration ?? null,
              goal: goal ?? null,
              workout_data: workout,
              // store the exact generator inputs inside workout_data (keeps schema stable)
              // so the app can later show what generated it.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              input_parameters: {
                age,
                gender,
                height,
                weight,
                experience,
                focus,
                location,
                injuries,
                cardio,
                equipment,
                weak_muscles,
                intensity_style,
                recovery_level,
                days_per_week,
                custom_note,
              },
            });
        }
      } catch (saveErr) {
        // Don't break generation for any storage failure
        console.warn('Workout save failed:', saveErr?.message ?? saveErr);
      }
    }

    res.json(workout);

  } catch (error) {
    console.error("Workout generation failed:", error.message);
    res.status(500).json({
      error: "Failed to generate workout",
      details: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("FitForge API running");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`FitForge Backend running on port ${PORT}`);
});