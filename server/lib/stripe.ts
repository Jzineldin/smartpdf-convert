import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';

// Only initialize Stripe if API key is available
let stripe: Stripe | null = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  });
}

export { stripe };

export const getStripeConfig = () => ({
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  proPriceId: STRIPE_PRO_PRICE_ID,
});

// Create a checkout session for Pro subscription
export async function createCheckoutSession(
  userId: number,
  userEmail: string,
  successUrl: string,
  cancelUrl: string
) {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRO_PRICE_ID,
          quantity: 1,
        },
      ],
      customer_email: userEmail,
      metadata: {
        userId: userId.toString(),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return { success: true, sessionId: session.id, url: session.url };
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    return { success: false, error: 'Failed to create checkout session' };
  }
}

// Create a customer portal session for managing subscription
export async function createPortalSession(customerId: string, returnUrl: string) {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { success: true, url: session.url };
  } catch (error) {
    console.error('Stripe portal session error:', error);
    return { success: false, error: 'Failed to create portal session' };
  }
}

// Verify webhook signature
export function verifyWebhookSignature(payload: string, signature: string) {
  if (!stripe) {
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return null;
  }
}

// Get subscription details
export async function getSubscription(subscriptionId: string) {
  if (!stripe) {
    return null;
  }

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('Failed to get subscription:', error);
    return null;
  }
}

// Cancel subscription
export async function cancelSubscription(subscriptionId: string) {
  if (!stripe) {
    return { success: false, error: 'Stripe not configured' };
  }

  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return { success: true, subscription };
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    return { success: false, error: 'Failed to cancel subscription' };
  }
}
