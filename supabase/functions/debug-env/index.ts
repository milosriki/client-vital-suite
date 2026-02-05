import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.16.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  
  if (!geminiKey) {
    return new Response("GEMINI_API_KEY is missing", { status: 500 });
  }

  try {
    // We can't easily list models via the simple SDK wrapper in this version without a fetch
    // So we'll just try a raw fetch to the models endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const data = await response.json();
    
    return new Response(JSON.stringify({ 
      success: true, 
      provider: "gemini_list", 
      models: data 
    }), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      provider: "gemini",
      error: error.message,
      stack: error.stack
    }), { headers: { "Content-Type": "application/json" } });
  }
});
