import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server function to create a Dodo Payments checkout session
export const createCheckoutSession = createServerFn({ method: "POST" })
  .validator(z.object({ 
    priceId: z.string().min(1),
    tier: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    try {
      const { priceId, tier } = data;

      // Import Dodo Payments SDK
      const DodoPayments = (await import("dodopayments")).default;
      
      // Initialize Dodo Payments client with API key from environment
      const client = new DodoPayments(process.env.DODO_PAYMENTS_API_KEY);

      // Create a checkout session
      const checkoutSession = await client.checkoutSessions.create({
        product_id: priceId, // Use the provided priceId (e.g., 'prod_123')
        success_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:5173'}/audit?checkout=success`,
        cancel_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:5173'}/?checkout=cancelled`,
        webhook_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:5173'}/api/webhooks/dodo`,
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
      throw new Error(
        error instanceof Error ? error.message : "Failed to create checkout session"
      );
    }
  });
