import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
// We import the Google Generative AI SDK directly for multimodal support if unified-client is text-only
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.3";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    verifyAuth(req);

    const { imageUrl, prompt, type } = await req.json();

    if (!imageUrl) throw new Error("Image URL is required");

    console.log(
      `👁️ Vision Analysis Request: ${type || "General"} - ${imageUrl}`,
    );

    const genAI = new GoogleGenerativeAI(Deno.env.get("GOOGLE_API_KEY") || "");
    // Upgrade to Gemini 3 Pro for Multimodal Reasoning
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Fetch the image
    const imageResp = await fetch(imageUrl);
    if (!imageResp.ok)
      throw new Error(`Failed to fetch image: ${imageResp.statusText}`);
    const imageBlob = await imageResp.blob();
    const arrayBuffer = await imageBlob.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: imageResp.headers.get("content-type") || "image/jpeg",
      },
    };

    let systemPrompt = "Analyze this image.";
    if (type === "meal") {
      systemPrompt = `
        You are a Nutritionist. Analyze this meal photo.
        1. Estimate calories and macros (Protein, Carbs, Fats).
        2. Rate the "Health Score" (0-100).
        3. Identify ingredients.
        Output JSON: { "calories": number, "macros": { "p": number, "c": number, "f": number }, "score": number, "ingredients": string[] }
      `;
    } else if (type === "form_check") {
      systemPrompt = `
        You are a Biomechanics Coach. Analyze this exercise form.
        1. Identify the exercise.
        2. Detect form faults (e.g., knee valgus, rounded back).
        3. Provide actionable corrections.
        Output JSON: { "exercise": string, "faults": string[], "corrections": string[], "grade": "A" | "B" | "C" | "F" }
      `;
    } else {
      systemPrompt =
        prompt || "Describe this image in detail and extract key insights.";
    }

    const guardedPrompt = `${getConstitutionalSystemMessage()}\n\n${systemPrompt}`;
    const result = await model.generateContent([guardedPrompt, imagePart]);

    const response = result.response;
    const text = response.text();

    // Try parsing JSON if specific type requested
    let data = text;
    if (type) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) data = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.warn("Failed to parse Vision JSON", e);
      }
    }

    return apiSuccess({
      generated_at: new Date().toISOString(),
      analysis: data,
      type: type || "general",
    });
  } catch (error: unknown) {
    console.error("Vision Analytics Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
});
