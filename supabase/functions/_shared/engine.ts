import { WhatsAppProvider, IncomingMessage, EngineResult } from "./types.ts";

export class ResponseEngine {
  constructor(private provider: WhatsAppProvider) {}

  async processMessage(message: IncomingMessage): Promise<EngineResult> {
    try {
      // 1. Detect Intent (Mocked for now)
      const intent = this.mockDetectIntent(message.text);

      // 2. Generate Response (Mocked for now)
      const response = this.mockGenerateResponse(intent);

      // 3. Send Response via Provider
      await this.provider.sendMessage(message.phone, response);

      return {
        intent,
        responseSent: true,
      };
    } catch (error: any) {
      console.error("Engine processing error:", error);
      return {
        intent: "error",
        responseSent: false,
        error: error.message,
      };
    }
  }

  private mockDetectIntent(text: string): string {
    if (
      text.toLowerCase().includes("fit") ||
      text.toLowerCase().includes("goal")
    ) {
      return "discover_fitness_goals";
    }
    return "default_fallback";
  }

  private mockGenerateResponse(intent: string): string {
    switch (intent) {
      case "discover_fitness_goals":
        return "Hey! 💪 I'd love to help you reach your goals. What are you looking to achieve?";
      default:
        return "I'm not sure I understand. Can you tell me more about your fitness goals?";
    }
  }
}
