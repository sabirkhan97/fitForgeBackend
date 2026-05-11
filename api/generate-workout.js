import { createClient } from '@supabase/supabase-js';
import { generateWorkout } from "../utils/mistral.js";

// Initialize Supabase admin client (bypasses RLS – safe on backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const {
      age, gender, height, weight, goal, experience, workout_duration, focus,
      injuries, cardio, location, equipment, weak_muscles, intensity_style,
      recovery_level, days_per_week, custom_note,
      user_id,          // optional – from frontend
      access_token      // optional – from frontend
    } = body;

    // Basic validation (required fields for generation)
    if (!age || !gender || !goal || !experience || !workout_duration || !location) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ----- Build the prompt (unchanged) -----
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

    const weakSection = Array.isArray(weak_muscles) && weak_muscles.length > 0
      ? `Weak muscles:\n${weak_muscles.map(m => `- ${m.replace(/_/g, " ")}`).join("\n")}`
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

    // ----- Generate workout -----
    const workout = await generateWorkout(prompt);

    // ----- Save to Supabase IF user is logged in and token is valid -----
    let verifiedUserId = null;
    if (user_id && access_token) {
      try {
        const { data: { user }, error: tokenError } = await supabase.auth.getUser(access_token);
        if (!tokenError && user && user.id === user_id) {
          verifiedUserId = user_id;
        } else {
          console.warn(`Token verification failed for user ${user_id}`);
        }
      } catch (err) {
        console.error("Token verification error:", err.message);
      }
    }

    // Insert asynchronously (do NOT await – don't block response)
    if (verifiedUserId) {
      const inputParameters = {
        age, gender, height, weight, goal, experience, workout_duration, focus,
        injuries, cardio, location, equipment, weak_muscles, intensity_style,
        recovery_level, days_per_week, custom_note
      };

      supabase.from('workouts').insert({
        user_id: verifiedUserId,
        workout_data: workout,
        input_parameters: inputParameters,
        focus: focus || "full_body",
        duration: workout_duration,
        goal: goal
      }).then(({ error }) => {
        if (error) console.error("Supabase insert error:", error.message);
        else console.log(`Workout saved for user ${verifiedUserId}`);
      }).catch(err => console.error("Insert promise failed:", err));
    }

    // ----- Return workout to frontend (always, even if save fails) -----
    return res.status(200).json(workout);

  } catch (error) {
    console.error("Generator error:", error);
    return res.status(500).json({
      error: "Workout generation failed",
      details: error.message,
    });
  }
}