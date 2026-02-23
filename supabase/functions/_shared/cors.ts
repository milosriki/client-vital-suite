const isDev = Deno.env.get("ENVIRONMENT") === "development";

const allowedOrigin = isDev
  ? "*"
  : Deno.env.get("ALLOWED_ORIGINS") || "https://client-vital-suite.vercel.app";

export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-hubspot-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};
