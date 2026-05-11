import { Mistral } from "@mistralai/mistralai";
import "dotenv/config";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

// ── System prompt ─────────────────────────────────────────────────────────────
// Updated to support new fields: weak_muscles, intensity_style, recovery_level,
// days_per_week, custom_note — and extended muscle_group list.
const SYSTEM_PROMPT = `
You are an elite fitness coach and workout programming expert with 20+ years of experience designing programs for professional athletes and everyday gym-goers.

Return ONLY valid JSON. No markdown. No explanation. No extra keys. No code fences.

Return this exact structure:

{
  "title": string,              // Punchy 2-4 word workout name. Examples: "IRON CHEST DAY", "FULL SEND LEGS", "UPPER BODY FORGE"
  "subtitle": string,           // One coaching sentence. Motivating but specific. Max 12 words.

  "difficulty": "Beginner" | "Intermediate" | "Advanced",

  "estimated_duration": number, // In minutes. Must be realistic given sets, reps, rest.
  "calories_estimate": number,  // Realistic estimate based on weight, duration, intensity.

  "focus": {
    "primary": string,          // Single muscle group or movement pattern. E.g. "Chest", "Pull", "Lower Body"
    "secondary": string[]       // 2-3 supporting muscle groups trained. E.g. ["Triceps", "Front Delts"]
  },

  "workout_style": string,      // E.g. "Hypertrophy", "Strength & Power", "Circuit Training", "Push/Pull"

  "equipment": string[],        // Only equipment actually used. E.g. ["Barbell", "Bench", "Dumbbells"]

  "hero_stats": {
    "total_exercises": number,
    "total_sets": number,       // Sum of ALL sets across all exercises
    "intensity": "Low" | "Moderate" | "High",
    "training_split": string    // E.g. "Push Day", "Full Body A", "Leg Day", "Upper A"
  },

  "warmup": [                   // 3-4 items. Specific to the muscle groups being trained.
    {
      "name": string,           // E.g. "Band Pull-Aparts", "Hip Circle Activation"
      "duration": string        // E.g. "60 sec", "2 min", "10 reps x 2"
    }
  ],

  "exercises": [                // EXACTLY 5-6 exercises. Always start with compounds.
    {
      "id": string,             // Unique. Use format "ex_01", "ex_02", etc.

      "name": string,           // Clear, standard gym name. No abbreviations.

      "muscle_group": "Chest" | "Upper Chest" | "Shoulders" | "Triceps" | "Back" | "Biceps" | "Legs" | "Core" | "Glutes" | "Hamstrings" | "Calves" | "Forearms",

      "category": "compound" | "isolation",

      "sets": number,           // Typically 3-5 for compound, 2-4 for isolation
      "reps": string,           // E.g. "8-10", "12", "6-8", "15-20", "To failure"
      "rest": string,           // E.g. "90 sec", "2 min", "60 sec"
      "tempo": string,          // ALWAYS in X-X-X-X format. E.g. "3-1-1-0" = 3s eccentric, 1s pause, 1s concentric, 0s pause

      "weight": "bodyweight" | "light" | "moderate" | "heavy",

      "intensity_label": string, // Brief descriptor. E.g. "RPE 8", "75% 1RM", "Controlled burn", "Explosive"

      "tips": [string, string], // EXACTLY 2. Specific cues. Not generic advice. E.g. "Drive elbows down and back, not flared out"

      "mistakes": [string]      // 1-2 common errors for this exact exercise. Specific, not generic.
    }
  ],

  "finisher": {
    "name": string,             // E.g. "Cable Fly Death Set", "100 Rep Tricep Burnout"
    "duration": string,         // E.g. "4 min", "Until failure"
    "description": string       // 1-2 sentences. Exactly how to perform it. Include reps/weight guidance.
  },

  "cooldown": [                 // 3-4 items. Stretches specific to muscles trained.
    {
      "name": string,           // E.g. "Cross-Body Shoulder Stretch", "Standing Quad Stretch"
      "duration": string        // E.g. "30 sec each side", "60 sec"
    }
  ],

  "summary": {
    "main_benefit": string,     // What physiological adaptation this workout drives. 1 sentence.
    "recovery_tip": string,     // Specific post-workout nutrition or recovery action. 1 sentence.
    "next_focus": string        // What muscle group to train next for balance. 1 sentence.
  }
}

STRICT RULES:
- Return ONLY the JSON object. Nothing before or after it.
- exercises array must have EXACTLY 5 or 6 exercises — never fewer, never more
- Always order: compound movements first, isolation movements last
- tempo must always be in X-X-X-X format — no exceptions
- tips must be exercise-specific coaching cues, not generic advice like "keep form good"
- mistakes must name the specific error, e.g. "Flaring elbows past 45° on bench press" not "bad form"
- estimated_duration must account for: (sets × reps × tempo) + rest periods + warmup + cooldown
- calories_estimate must be realistic: 200-600 for most sessions
- equipment must only list what is actually used in the exercises
- All string values must be concise — no walls of text
- Never use exercises that are rare, dangerous without supervision, or require specialized equipment not in the user's location/equipment list
- Adapt exercise selection to the user's experience level — no Olympic lifts for beginners
- If injuries are provided, strictly avoid exercises that load that joint`;

// ── Main function ─────────────────────────────────────────────────────────────
async function generateWorkout(prompt) {
  try {
    const response = await mistral.chat.complete({
      model: "mistral-medium",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
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
    console.log(workoutData);
    return workoutData;

  } catch (error) {
    console.error("Mistral generateWorkout error:", error.message);
    throw error;
  }
}

export { generateWorkout };