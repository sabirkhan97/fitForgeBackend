import { Mistral } from "@mistralai/mistralai";
import "dotenv/config";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

// ── System prompt ─────────────────────────────────────────────────────────────
// Updated to support new fields: weak_muscles, intensity_style, recovery_level,
// days_per_week, custom_note — and extended muscle_group list.
const SYSTEM_PROMPT = `You are an elite personal trainer and sports scientist.

Return ONLY valid JSON. No markdown, no backticks, no explanation, no extra keys.

Produce a single workout object that strictly follows this shape:

{
  "day": string,               // e.g. "Push Day" or "Monday"
  "focus": string,             // e.g. "Chest & Shoulders – Hypertrophy"
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "total_duration": number,    // minutes (integer) — must match user's requested duration
  "calories_estimate": number, // rough kcal (integer). ~6-8 kcal/min for weights
  "equipment": string[],       // equipment actually used in this workout
  "warmup": string,            // one-line warmup instruction
  "cooldown": string,          // one-line cooldown instruction
  "notes": string,             // overall coaching tip, max 140 chars
  "exercises": [
    {
      "id": string,            // "e1", "e2", "e3" …
      "name": string,          // exercise name — if targeting a weak muscle, suffix with "– [Muscle] Focus"
      "muscle_group": string,  // see allowed values below
      "sets": number,
      "reps": string,          // e.g. "8-12" | "15" | "failure" | "30s"
      "rest": string,          // e.g. "45s" | "90s" | "2 min"
      "weight": "bodyweight" | "light" | "moderate" | "heavy",
      "tips": string           // one coaching cue, max 100 chars
    }
  ]
}

Rules:
- exercises array: 4–8 items
- total_duration must be realistic given sets × (avg set time + rest) + warmup + cooldown
- calories_estimate: ~6–8 kcal/min for resistance training
- Follow all GENERATION RULES listed in the user message
- muscle_group must be ONE of:
    Chest | Upper Chest | Shoulders | Triceps | Back | Biceps |
    Legs | Core | Glutes | Hamstrings | Calves | Forearms
- All string values must be concise and in English`;

// ── Main function ─────────────────────────────────────────────────────────────
async function generateWorkout(prompt) {
  try {
    const response = await mistral.chat.complete({
      model: "mistral-medium",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1200,  // increased from 800 — new fields need more tokens
    });

    let content = response.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Empty AI response");
    }

    // Strip markdown fences if model adds them despite instructions
    content = content.replace(/```json|```/gi, "").trim();

    // Fix smart/curly quotes
    content = content.replace(/[""]/g, '"').replace(/['']/g, "'");

    // Extract the JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in AI response");
    }

    const workoutData = JSON.parse(jsonMatch[0]);

    // ── Basic shape validation ─────────────────────────────────────────────
    if (!workoutData.exercises || !Array.isArray(workoutData.exercises)) {
      throw new Error("AI response missing exercises array");
    }
    if (workoutData.exercises.length < 1) {
      throw new Error("AI returned empty exercises array");
    }

    return workoutData;

  } catch (error) {
    console.error("Mistral generateWorkout error:", error.message);
    throw error;
  }
}

export { generateWorkout };