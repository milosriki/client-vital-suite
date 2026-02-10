import {
  WhatsAppProvider,
  IncomingMessage,
  SendMessageOptions,
} from "../types.ts";

export class AISensyProvider implements WhatsAppProvider {
  private apiUrl = "https://backend.aisensy.com/devapi/v1/project";

  constructor(
    private apiKey: string,
    private webhookSecret: string,
  ) {}

  getName(): string {
    return "aisensy";
  }

  async sendMessage(
    phone: string,
    message: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    const projectId = options?.projectId || "default";
    const url = `${this.apiUrl}/${projectId}/messages`;

    // Construct payload based on message type
    let messagePayload: any;

    if (options?.template) {
      // TEMPLATE MESSAGE (Proactive / Re-engagement)
      messagePayload = {
        type: "template",
        template: {
          name: options.template.name,
          language: {
            code: options.template.language || "en",
            policy: "deterministic",
          },
          components: [
            {
              type: "body",
              parameters: (options.template.params || []).map((p) => ({
                type: "text",
                text: p,
              })),
            },
          ],
        },
      };
    } else {
      // TEXT MESSAGE (Session / Daily)
      messagePayload = {
        type: "text",
        text: {
          body: message,
        },
      };
    }

    const payload = {
      apiKey: this.apiKey,
      campaignName: options?.campaignName || "direct_reply",
      destinationNumber: this.formatPhoneNumber(phone),
      ...messagePayload,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `AISensy API Error: ${response.status} ${JSON.stringify(errorData)}`,
      );
    }
  }

  async receiveWebhook(payload: any): Promise<IncomingMessage> {
    return {
      phone: payload.destination || "",
      text: payload.message?.payload?.text || "",
      name: payload.userName || "Customer",
      timestamp: payload.timestamp || Date.now(),
      rawPayload: payload,
    };
  }

  async verifySignature(request: Request, signature: string): Promise<boolean> {
    if (!signature || !this.webhookSecret) return false;

    try {
      const body = await request.clone().text();
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.webhookSecret);
      const data = encoder.encode(body);

      // IMPORTANT: Need 'verify' usage for subtle.verify
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );

      const signatureBuffer = this.hexToBuffer(signature);
      return await crypto.subtle.verify(
        "HMAC",
        key,
        signatureBuffer as any,
        data,
      );
    } catch (error) {
      console.error("Signature verification error:", error);
      return false;
    }
  }

  formatPhoneNumber(phone: string): string {
    return phone.replace(/[^\d]/g, "");
  }

  private hexToBuffer(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  }
}
