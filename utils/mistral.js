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
  "day": string,
  "focus": string,
  "difficulty": "Beginner" | "Intermediate" | "Advanced",

  "meta": {
    "confidence_score": number,                 // 0–100
    "goal_alignment": "Low" | "Medium" | "High",
    "estimated_fatigue": "Low" | "Moderate" | "High"
  },

  "user_context": {
    "goal": string,
    "experience": "beginner" | "intermediate" | "advanced",
    "recovery_level": "fresh" | "normal" | "tired" | "very_tired",
    "intensity_style": "pump" | "strength" | "circuit" | "explosive" | "balanced",
    "days_per_week": number
  },

  "decision_engine": {
    "primary_goal": string,
    "secondary_focus": string,
    "fatigue_management": string,
    "exercise_selection_logic": string,
    "intensity_reason": string,
    "why_this_order": string
  },

  "adaptation": {
    "is_progression_day": boolean,
    "load_adjustment": string,
    "volume_adjustment": string,
    "variation_type": string,
    "recovery_based_adjustment": string
  },

  "optimization": {
    "reasoning": string,                        // max 120 chars
    "variation_applied": boolean,
    "progression_strategy": string              // max 100 chars
  },

  "muscle_stimulation": {
    "primary": string,
    "secondary": string[],
    "focus_area": string,
    "activation_level": "Low" | "Moderate" | "High"
  },

  "total_duration": number,
  "calories_estimate": number,

  "time_distribution": {
    "warmup": number,
    "workout": number,
    "cooldown": number,
    "per_exercise_avg": number
  },

  "equipment": string[],

  "structure": {
    "split_type": string,
    "training_style": string,
    "intensity_level": "Low" | "Moderate" | "High"
  },

  "warmup": {
    "duration": number,
    "steps": string[]                           // 2–4 items
  },

  "cooldown": {
    "duration": number,
    "steps": string[]                           // 2–4 items
  },

  "notes": string,                              // max 140 chars

  "exercises": [
    {
      "id": string,
      "name": string,
      "muscle_group":
        "Chest" | "Upper Chest" | "Shoulders" | "Triceps" |
        "Back" | "Biceps" | "Legs" | "Core" |
        "Glutes" | "Hamstrings" | "Calves" | "Forearms",

      "category": "compound" | "isolation",
      "priority": number,                       // unique (1,2,3...)

      "sets": number,
      "reps": string,
      "rest": string,
      "tempo": string,                          // e.g. "2-1-1"

      "weight": "bodyweight" | "light" | "moderate" | "heavy",

      "intensity_hint": string,                 // max 60 chars
      "progression_tip": string,                // max 80 chars

      "form_cues": string[],                    // 2–3 items
      "common_mistakes": string[]               // 1–2 items
    }
  ],

  "summary": {
    "total_sets": number,
    "primary_muscles": string[],
    "secondary_muscles": string[],
    "fatigue_score": number                    // 1–10
  },

  "consistency_signal": {
    "streak_message": string,
    "session_type": string,
    "program_phase": string
  },

  "user_feedback_hook": {
    "expected_feeling": string,
    "difficulty_feedback_request": string,
    "next_adjustment_hint": string
  },

  "next_session_hint": {
    "focus": string,
    "adjustment": string
  }
}

Rules:
- exercises array: 4–8 items
- total_duration must be realistic given sets × (avg set time + rest) + warmup + cooldown
- calories_estimate: ~6–8 kcal/min for resistance training
- Follow all GENERATION RULES listed in the user message
- muscle_group must be ONE of:
    Chest | Upper Chest | Shoulders | Triceps | Back | Biceps |
    Legs | Core | Glutes | Hamstrings | Calves | Forearms
- All string values must be concise and in English

STRICT RULES:
- Return ONLY valid JSON. No markdown, no explanation.
- Use proper capitalization for all exercise names (e.g. "Barbell Bench Press")
- Do NOT generate uncommon or rare exercises
- Prefer standard gym exercises only
- exercises array must contain 4–6 items
- priority must be unique and start from 1
- All arrays must be non-empty
- Keep all text concise and realistic
- Respect character limits strictly
- total_duration must be realistic based on sets and rest
- Avoid repeating similar exercises
`;

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