import {
  WhatsAppProvider,
  IncomingMessage,
  SendMessageOptions,
} from "../types.ts";

export class MockProvider implements WhatsAppProvider {
  getName(): string {
    return "mock";
  }

  async sendMessage(
    phone: string,
    message: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    console.log(`[MockProvider] Sending to ${phone}: ${message}`);
    return Promise.resolve();
  }

  async receiveWebhook(payload: any): Promise<IncomingMessage> {
    return {
      phone: payload.phone || "+1234567890",
      text: payload.text || "Hello from mock",
      name: payload.name || "Test User",
      timestamp: Date.now(),
      rawPayload: payload,
    };
  }

  async verifySignature(
    _request: Request,
    signature: string,
  ): Promise<boolean> {
    return Promise.resolve(signature === "valid-mock-signature");
  }
}
