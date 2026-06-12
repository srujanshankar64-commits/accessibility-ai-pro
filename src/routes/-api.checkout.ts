import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const createCheckoutSession = createServerFn({ method: "POST" })
  .validator(z.object({
    priceId: z.string().min(1),
    tier: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    try {
      const { priceId, tier } = data;

      console.log("Creating checkout session with:", { priceId, tier });

      if (!process.env.DODO_PAYMENTS_API_KEY) {
        throw new Error("Dodo Payments API key not configured");
      }

      const appUrl = "https://accessibility-ai-pro.lovable.app";

      const response = await fetch("https://test.dodopayments.com/v1/checkout_sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
        },
        body: JSON.stringify({
          product_cart: [{
            product_id: priceId,
            quantity: 1,
          }],
          success_url: `${appUrl}/audit?checkout=success`,
          cancel_url: `${appUrl}/?checkout=cancelled`,
          webhook_url: `https://zkpwpumjacihcjisshod.supabase.co/functions/v1/dodo-webhook`,
          metadata: {
            tier: tier || 'starter',
          },
        }),
      });

      console.log("Dodo Payments API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Dodo Payments API error:", errorData);
        throw new Error(`Dodo Payments API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const checkoutSession = await response.json();
      console.log("Checkout session created:", checkoutSession);

      return {
        success: true,
        checkout_url: checkoutSession.checkout_url,
      };
    } catch (error) {
      console.error("Error creating checkout session:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
      return {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      };
    }
  });
