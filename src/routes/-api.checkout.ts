import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server function to create a Dodo Payments checkout session
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ 
    priceId: z.string().min(1),
    tier: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    try {
      const { priceId, tier } = data;

      // Check if Dodo Payments API key is configured
      if (!process.env.DODO_PAYMENTS_API_KEY) {
        throw new Error("Dodo Payments API key not configured");
      }

      // Use REST API directly instead of SDK
      const response = await fetch("https://api.dodopayments.com/v1/checkout_sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
        },
        body: JSON.stringify({
          price_id: priceId,
          success_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:8080'}/audit?checkout=success`,
          cancel_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:8080'}/?checkout=cancelled`,
          webhook_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:8080'}/api/webhooks/dodo`,
          metadata: {
            tier: tier || 'starter',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Dodo Payments API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const checkoutSession = await response.json();

      // Return the checkout URL to redirect the user
      return {
        success: true,
        checkout_url: checkoutSession.checkout_url,
      };
    } catch (error) {
      console.error("Error creating checkout session:", error);
      
      // Return detailed error information
      const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session";
      
      return {
        success: false,
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      };
    }
  });
