import { Request, Response } from 'express';
import { stripe, verifyWebhookSignature } from '../lib/stripe';
import { updateUserSubscription, getUserByStripeCustomerId } from '../db';
import Stripe from 'stripe';

export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    console.error('No Stripe signature found');
    return res.status(400).json({ error: 'No signature' });
  }

  // Get raw body for signature verification
  const rawBody = req.body;
  
  const event = verifyWebhookSignature(
    typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody),
    signature
  );

  if (!event) {
    console.error('Invalid webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('No userId in checkout session metadata');
    return;
  }

  console.log(`Checkout completed for user ${userId}`);

  // Get subscription details
  if (stripe && subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const periodEnd = (subscription as any).current_period_end;
    
    await updateUserSubscription(parseInt(userId), {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: subscription.items.data[0]?.price.id || null,
      subscriptionStatus: 'pro',
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    });
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  console.log(`Subscription updated for user ${user.id}: ${subscription.status}`);

  let subscriptionStatus: 'free' | 'pro' | 'canceled' | 'past_due' = 'free';
  
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      subscriptionStatus = 'pro';
      break;
    case 'past_due':
      subscriptionStatus = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
      subscriptionStatus = 'canceled';
      break;
    default:
      subscriptionStatus = 'free';
  }

  const periodEnd = (subscription as any).current_period_end;
  await updateUserSubscription(user.id, {
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id || null,
    subscriptionStatus,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  console.log(`Subscription deleted for user ${user.id}`);

  await updateUserSubscription(user.id, {
    stripeSubscriptionId: null,
    stripePriceId: null,
    subscriptionStatus: 'canceled',
    currentPeriodEnd: null,
  });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.log(`No user found for customer ${customerId} (may be new customer)`);
    return;
  }

  console.log(`Payment succeeded for user ${user.id}`);

  // Ensure subscription is active
  const invoiceSubscription = (invoice as any).subscription;
  if (invoiceSubscription) {
    await updateUserSubscription(user.id, {
      subscriptionStatus: 'pro',
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`No user found for customer ${customerId}`);
    return;
  }

  console.log(`Payment failed for user ${user.id}`);

  await updateUserSubscription(user.id, {
    subscriptionStatus: 'past_due',
  });
}
