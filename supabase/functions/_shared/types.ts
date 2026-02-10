export interface SendMessageOptions {
  threadId?: string;
  senderActorId?: string;
  campaignName?: string;
  projectId?: string;
  template?: {
    name: string;
    language?: string;
    params?: string[];
  };
  [key: string]: any;
}

export interface IncomingMessage {
  phone: string;
  text: string;
  name?: string;
  timestamp: number;
  rawPayload: any;
}

export interface EngineResult {
  intent: string;
  responseSent: boolean;
  error?: string;
}

export enum ConversationStage {
  DISCOVERY = "discovery",
  QUALIFICATION = "qualification",
  OBJECTION = "objection",
  BOOKING = "booking",
}

export interface WhatsAppProvider {
  /** Provider identifier */
  getName(): string;

  /** Send message to customer */
  sendMessage(
    phone: string,
    message: string,
    options?: SendMessageOptions,
  ): Promise<void>;

  /** Parse incoming webhook payload */
  receiveWebhook(payload: any): Promise<IncomingMessage>;

  /** Verify webhook signature (security) */
  verifySignature(request: Request, signature: string): Promise<boolean>;
}
