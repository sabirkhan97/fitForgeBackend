import { generateWorkout } from "../utils/mistral.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
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
      weak_muscles,
      intensity_style,
      recovery_level,
      days_per_week,
      custom_note,
    } = req.body;

    if (!age || !gender || !goal || !experience || !workout_duration || !location) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const recoveryNote = {
      fresh: "Energy: FRESH — push max volume and intensity today",
      normal: "Energy: NORMAL — standard session",
      tired: "Energy: TIRED — reduce total sets ~20%, avoid failure sets",
      very_tired: "Energy: VERY TIRED — deload style",
    }[recovery_level] ?? "Energy: NORMAL — standard session";

    const intensityNote = {
      pump: "Style: PUMP — 12-20 reps, 30-45s rest",
      strength: "Style: STRENGTH — 3-6 reps, 2-3 min rest",
      circuit: "Style: CIRCUIT — back-to-back exercises",
      explosive: "Style: EXPLOSIVE — power movements",
      balanced: "Style: BALANCED — strength + hypertrophy",
    }[intensity_style] ?? "Style: BALANCED — strength + hypertrophy";

    const weakSection =
      Array.isArray(weak_muscles) && weak_muscles.length > 0
        ? `Weak muscles:\n${weak_muscles.map(m => `- ${m.replace(/_/g," ")}`).join("\n")}`
        : "Weak muscles: none";

    const prompt = `
USER PROFILE
Age: ${age}
Gender: ${gender}
Height: ${height || "unknown"} cm
Weight: ${weight || "unknown"} kg
Experience: ${experience}
Days/week: ${days_per_week ?? 4}

WORKOUT
Goal: ${goal}
Focus: ${focus || "full body"}
Duration: ${workout_duration} min
Location: ${location}
Equipment: ${equipment?.join(", ") || "bodyweight"}

${recoveryNote}
${intensityNote}

Injuries: ${injuries?.join(", ") || "none"}

${weakSection}

${custom_note ? `Custom: ${custom_note}` : ""}
`.trim();

    const workout = await generateWorkout(prompt);

    return res.status(200).json(workout);

  } catch (error) {
    return res.status(500).json({
      error: "Workout generation failed",
      details: error.message,
    });
  }
}