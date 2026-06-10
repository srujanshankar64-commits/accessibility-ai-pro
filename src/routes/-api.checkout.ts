import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server function to create a Dodo Payments checkout session
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator(z.object({ 
    productId: z.string().min(1),
    tier: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    try {
      const { productId, tier } = data;

      // Check if Dodo Payments API key is configured
      if (!process.env.DODO_PAYMENTS_API_KEY) {
        throw new Error("Dodo Payments API key not configured");
      }

      // Import Dodo Payments SDK
      const DodoPayments = (await import("dodopayments")).default;
      
      // Initialize Dodo Payments client with API key from environment
      const client = new DodoPayments(process.env.DODO_PAYMENTS_API_KEY);

      // Create a checkout session
      const checkoutSession = await client.checkoutSessions.create({
        product_id: productId,
        success_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:8080'}/audit?checkout=success`,
        cancel_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:8080'}/?checkout=cancelled`,
        webhook_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:8080'}/api/webhooks/dodo`,
        metadata: {
          tier: tier || 'starter',
        },
      });

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
