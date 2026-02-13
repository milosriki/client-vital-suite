import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

/**
 * Zod Schema Definitions for API Request Validation
 */

// HubSpot Deal Schema
export const HubSpotDealSchema = z.object({
  objectId: z.number(),
  propertyName: z.string(),
  propertyValue: z.string(),
  changeSource: z.string().optional(),
  associations: z
    .object({
      contactIds: z.array(z.number()).optional(),
      companyIds: z.array(z.number()).optional(),
    })
    .optional(),
});

// Stripe Event Schema (simplified for webhook validation)
export const StripeEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z
      .object({
        id: z.string(),
        object: z.string(),
        // Add other common fields as needed, but verify 'object' type matches
      })
      .catchall(z.any()), // Allow other fields in the object
  }),
  livemode: z.boolean(),
  created: z.number(),
});

// Marketing Request Schema
export const MarketingRequestSchema = z.object({
  campaign: z.string().min(1),
  creative: z.string().optional(),
  budget: z.number().min(0).optional(),
  platform: z.enum(["facebook", "google", "instagram", "tiktok"]).optional(),
  target_audience: z.string().optional(),
});

/**
 * Generic Request Validator
 * @param schema Zod schema to validate against
 * @param data Request body data
 * @returns Validated data or throws validation error
 */
export async function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): Promise<T> {
  const result = await schema.safeParseAsync(data);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join(", ");
    throw new Error(`Validation Error: ${errorMessages}`);
  }

  return result.data;
}
