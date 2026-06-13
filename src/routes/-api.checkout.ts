import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import DodoPayments from "dodopayments";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .validator(z.object({
    priceId: z.string().min(1),
    tier: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    try {
      const { priceId, tier } = data;

      const client = new DodoPayments({
        bearerToken: process.env.DODO_PAYMENTS_API_KEY || "",
      });

      const checkout = await client.checkoutSessions.create({
        product_cart: [{ product_id: priceId, quantity: 1 }],
        customer: { create_new_customer: true },
        success_url: "https://accessibility-ai-pro.lovable.app/audit?checkout=success",
        cancel_url: "https://accessibility-ai-pro.lovable.app/?checkout=cancelled",
        metadata: { tier: tier || "starter" },
      });

      return { success: true, checkout_url: checkout.url };
    } catch (error) {
      console.error("Checkout error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
      return { success: false, error: errorMessage };
    }
  });
