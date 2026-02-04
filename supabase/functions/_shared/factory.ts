import { WhatsAppProvider } from "./types.ts";
import { MockProvider } from "./providers/mock_provider.ts";
import { HubSpotProvider } from "./providers/hubspot_provider.ts";
import { AISensyProvider } from "./providers/aisensy_provider.ts";

export function createWhatsAppProvider(): WhatsAppProvider {
  const type = Deno.env.get("WHATSAPP_PROVIDER") || "mock";

  switch (type) {
    case "hubspot":
      return new HubSpotProvider(Deno.env.get("HUBSPOT_API_KEY") || "");
    case "aisensy":
      return new AISensyProvider(
        Deno.env.get("AISENSY_API_KEY") || "",
        Deno.env.get("AISENSY_WEBHOOK_SECRET") || "",
      );
    default:
      return new MockProvider();
  }
}
