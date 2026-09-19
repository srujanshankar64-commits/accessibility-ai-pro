import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import DodoPayments from "dodopayments";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      priceId: z.string().min(1),
      tier: z.string().optional(),
      userId: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const { priceId, tier, userId } = data;

      const apiKey = process.env.DODO_PAYMENTS_API_KEY || process.env.VITE_DODO_PAYMENTS_API_KEY;
      if (!apiKey) {
        throw new Error("Missing DODO_PAYMENTS_API_KEY environment variable");
      }

      const client = new DodoPayments({
        bearerToken: apiKey,
        environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as any) || 'live_mode',
      });

      const checkout = await client.checkoutSessions.create({
        product_cart: [{ product_id: priceId, quantity: 1 }],
        return_url: "https://accessibility-ai-pro.lovable.app/audit?checkout=success",
        metadata: { tier: tier || "starter", user_id: userId || "" },
      } as any);

      return { success: true, checkout_url: (checkout as any).checkout_url ?? (checkout as any).url };
    } catch (error) {
      console.error("Checkout error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
      return { success: false, error: errorMessage };
    }
  });
