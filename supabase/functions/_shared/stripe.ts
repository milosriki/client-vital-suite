/**
 * Shared Stripe Client Configuration
 *
 * Centralizes Stripe SDK instantiation across all edge functions.
 * Ensures consistent API version and configuration.
 *
 * Usage:
 *   import { getStripeClient, verifyWebhookSignature, STRIPE_API_VERSION } from "../_shared/stripe.ts";
 *   const stripe = getStripeClient();
 */

import Stripe from "https://esm.sh/stripe@18.5.0";

// Standardized API version for all functions
export const STRIPE_API_VERSION = "2024-12-18.acacia" as const;

// Environment variable names (standardized)
export const STRIPE_ENV_VARS = {
  SECRET_KEY: "STRIPE_SECRET_KEY",
  WEBHOOK_SECRET: "STRIPE_WEBHOOK_SECRET",
  // Legacy support - maps to SECRET_KEY
  API_KEY: "STRIPE_API_KEY",
} as const;

/**
 * Get the Stripe secret key from environment
 * Supports both STRIPE_SECRET_KEY and legacy STRIPE_API_KEY
 */
export function getStripeSecretKey(): string {
  const secretKey = Deno.env.get(STRIPE_ENV_VARS.SECRET_KEY);
  if (secretKey) return secretKey;

  // Legacy fallback
  const legacyKey = Deno.env.get(STRIPE_ENV_VARS.API_KEY);
  if (legacyKey) {
    console.warn("Using legacy STRIPE_API_KEY - please migrate to STRIPE_SECRET_KEY");
    return legacyKey;
  }

  throw new Error("STRIPE_SECRET_KEY not configured");
}

/**
 * Get the Stripe webhook signing secret
 */
export function getWebhookSecret(): string | null {
  return Deno.env.get(STRIPE_ENV_VARS.WEBHOOK_SECRET) || null;
}

/**
 * Create a configured Stripe client instance
 */
export function getStripeClient(): Stripe {
  const secretKey = getStripeSecretKey();
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    // TypeScript needs this for Deno
    httpClient: Stripe.createFetchHttpClient(),
  });
}

/**
 * Verify Stripe webhook signature using constructEvent
 *
 * @param body - Raw request body as string
 * @param signature - stripe-signature header value
 * @returns Verified Stripe event object
 * @throws Error if signature verification fails
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string | null
): Promise<Stripe.Event> {
  const webhookSecret = getWebhookSecret();

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured - webhook signature verification is required");
  }

  if (!signature) {
    throw new Error("Missing stripe-signature header");
  }

  const stripe = getStripeClient();

  try {
    // Use Stripe's official signature verification
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
    return event;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    throw new Error(`Webhook signature verification failed: ${message}`);
  }
}

/**
 * Helper to safely parse amounts from Stripe (cents to dollars)
 */
export function parseStripeAmount(amount: number | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  return amount / 100;
}

/**
 * Helper to convert Unix timestamp to ISO string
 */
export function parseStripeTimestamp(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}
