import express from "express";
import cors from "cors";
import { generateWorkout } from "./utils/mistral.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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