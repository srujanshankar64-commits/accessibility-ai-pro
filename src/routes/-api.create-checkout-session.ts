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

      if (!process.env.DODO_PAYMENTS_API_KEY) {
        throw new Error("DODO_PAYMENTS_API_KEY environment variable is not configured");
      }

      // Import Dodo Payments SDK
      const DodoPayments = (await import("dodopayments")).default;
      
      // Initialize Dodo Payments client with API key from environment
      const client = new DodoPayments({
        bearerToken: process.env.DODO_PAYMENTS_API_KEY,
        environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as any) || (process.env.NODE_ENV === 'production' ? 'live_mode' : 'test_mode'),
      });

      // Create a checkout session
      const checkoutSession = await client.checkoutSessions.create({
        product_cart: [{ product_id: priceId, quantity: 1 }],
        return_url: `${process.env.VITE_SUPABASE_URL || 'http://localhost:5173'}/audit?checkout=success`,
        metadata: {
          tier: tier || 'starter',
        },
      } as any);

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
