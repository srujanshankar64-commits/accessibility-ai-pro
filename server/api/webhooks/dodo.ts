import crypto from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Nitro API route handler for Dodo Payments webhooks
// This file handles webhook events from Dodo Payments
export default defineEventHandler(async (event) => {
  try {
    // Get the raw body as text for signature verification
    const rawBody = await readRawBody(event);
    
    // Get the signature from headers
    const signature = getHeader(event, "dodo-signature");
    
    if (!signature) {
      throw createError({
        statusCode: 401,
        statusMessage: "Missing signature header",
      });
    }

    // Get the webhook secret from environment
    const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw createError({
        statusCode: 500,
        statusMessage: "Webhook secret not configured",
      });
    }

    // Verify the signature
    // Dodo Payments uses HMAC-SHA256 for signature verification
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    // Compare signatures (constant-time comparison to prevent timing attacks)
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (signatureBuffer.length !== expectedBuffer.length || 
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      throw createError({
        statusCode: 401,
        statusMessage: "Invalid signature",
      });
    }

    // Parse the webhook payload
    const payload = JSON.parse(rawBody);
    const { event_type, data } = payload;

    // Handle different event types
    switch (event_type) {
      case "subscription.active": {
        console.log("Subscription activated:", data);
        
        // Find user by customer email or metadata
        const { data: userData, error: userError } = await supabaseAdmin
          .auth.admin.listUsers();
        
        if (userError) {
          console.error("Error fetching users:", userError);
          throw createError({ statusCode: 500, statusMessage: "Failed to fetch users" });
        }

        // Match user by email from customer data
        const user = userData.users.find(u => u.email === data.customer_email);
        
        if (!user) {
          console.error("User not found for email:", data.customer_email);
          throw createError({ statusCode: 404, statusMessage: "User not found" });
        }

        // Update or create subscription
        const { error: subError } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: user.id,
            dodo_subscription_id: data.subscription_id,
            dodo_customer_id: data.customer_id,
            tier: data.metadata?.tier || 'starter',
            status: "active",
            current_period_start: data.current_period_start ? new Date(data.current_period_start).toISOString() : null,
            current_period_end: data.current_period_end ? new Date(data.current_period_end).toISOString() : null,
            metadata: data.metadata || {},
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "dodo_subscription_id"
          });

        if (subError) {
          console.error("Error updating subscription:", subError);
          throw createError({ statusCode: 500, statusMessage: "Failed to update subscription" });
        }

        break;
      }

      case "payment.succeeded": {
        console.log("Payment succeeded:", data);
        
        // Find user by customer email
        const { data: userData, error: userError } = await supabaseAdmin
          .auth.admin.listUsers();
        
        if (userError) {
          console.error("Error fetching users:", userError);
          throw createError({ statusCode: 500, statusMessage: "Failed to fetch users" });
        }

        const user = userData.users.find(u => u.email === data.customer_email);
        
        if (!user) {
          console.error("User not found for email:", data.customer_email);
          throw createError({ statusCode: 404, statusMessage: "User not found" });
        }

        // Get subscription for this user
        const { data: subscription } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Record payment
        const { error: paymentError } = await supabaseAdmin
          .from("payments")
          .insert({
            user_id: user.id,
            subscription_id: subscription?.id || null,
            dodo_payment_id: data.payment_id,
            dodo_checkout_id: data.checkout_id,
            amount: data.amount,
            currency: data.currency || "USD",
            status: "succeeded",
            tier: data.metadata?.tier,
            metadata: data.metadata || {},
          });

        if (paymentError) {
          console.error("Error recording payment:", paymentError);
          throw createError({ statusCode: 500, statusMessage: "Failed to record payment" });
        }

        break;
      }

      case "subscription.cancelled": {
        console.log("Subscription cancelled:", data);
        
        const { error: subError } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("dodo_subscription_id", data.subscription_id);

        if (subError) {
          console.error("Error cancelling subscription:", subError);
          throw createError({ statusCode: 500, statusMessage: "Failed to cancel subscription" });
        }

        break;
      }

      case "payment.failed": {
        console.log("Payment failed:", data);
        
        // Find user by customer email
        const { data: userData, error: userError } = await supabaseAdmin
          .auth.admin.listUsers();
        
        if (userError) {
          console.error("Error fetching users:", userError);
          throw createError({ statusCode: 500, statusMessage: "Failed to fetch users" });
        }

        const user = userData.users.find(u => u.email === data.customer_email);
        
        if (!user) {
          console.error("User not found for email:", data.customer_email);
          // Don't throw for failed payments, just log
          break;
        }

        // Record failed payment
        const { error: paymentError } = await supabaseAdmin
          .from("payments")
          .insert({
            user_id: user.id,
            dodo_payment_id: data.payment_id,
            dodo_checkout_id: data.checkout_id,
            amount: data.amount,
            currency: data.currency || "USD",
            status: "failed",
            tier: data.metadata?.tier,
            metadata: data.metadata || {},
          });

        if (paymentError) {
          console.error("Error recording failed payment:", paymentError);
        }

        break;
      }

      default:
        console.log("Unhandled webhook event:", event_type);
    }

    // Return success response
    return { success: true };
  } catch (error) {
    console.error("Webhook processing error:", error);
    
    if (error instanceof Error && "statusCode" in error) {
      throw error;
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : "Webhook processing failed",
    });
  }
});
