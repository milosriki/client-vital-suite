import {
  WhatsAppProvider,
  IncomingMessage,
  SendMessageOptions,
} from "../types.ts";

export class HubSpotProvider implements WhatsAppProvider {
  private baseApiUrl = "https://api.hubapi.com/conversations/v3/conversations";

  constructor(private apiKey: string) {}

  getName(): string {
    return "hubspot";
  }

  async sendMessage(
    phone: string,
    message: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    const threadId = options?.threadId || (await this.lookupThreadId(phone));
    if (!threadId) {
      throw new Error(`Thread ID required for HubSpot messaging to ${phone}`);
    }

    const url = `${this.baseApiUrl}/threads/${threadId}/messages`;

    const payload = {
      type: "MESSAGE",
      text: message,
      senderActorId: options?.senderActorId || "A-default",
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error("Unauthorized: Invalid HubSpot API Key");
      }
      throw new Error(
        `HubSpot API Error: ${response.status} ${JSON.stringify(errorData)}`,
      );
    }
  }

  async receiveWebhook(payload: any): Promise<IncomingMessage> {
    const event = Array.isArray(payload) ? payload[0] : payload;
    return {
      phone: event.senderId || "",
      text: event.text || "",
      name: event.senderName || "Unknown",
      timestamp: event.timestamp || Date.now(),
      rawPayload: event,
    };
  }

  async verifySignature(
    _request: Request,
    signature: string,
  ): Promise<boolean> {
    return Promise.resolve(!!signature);
  }

  formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, "");
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }
    return cleaned;
  }

  private async lookupThreadId(_phone: string): Promise<string | null> {
    return null;
  }
}
