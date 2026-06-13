/**
 * POST /api/webhooks/stripe
 * Gestion abonnements : activate, update, cancel, payment_failed
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_FAMILLE_MONTHLY ?? '']: 'famille',
  [process.env.STRIPE_PRICE_FAMILLE_ANNUAL ?? '']:  'famille',
  [process.env.STRIPE_PRICE_FAMILLE_PLUS_MONTHLY ?? '']: 'famille_plus',
  [process.env.STRIPE_PRICE_FAMILLE_PLUS_ANNUAL ?? '']: 'famille_plus',
  [process.env.STRIPE_PRICE_ECOLE_MONTHLY ?? '']: 'ecole',
};

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = createAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = session.subscription as string;
      if (!subId) break;

      const sub = await stripe.subscriptions.retrieve(subId);
      const priceId = sub.items.data[0]?.price?.id ?? '';
      const plan = PRICE_TO_PLAN[priceId] ?? 'famille';
      const profileId = session.metadata?.profile_id;
      if (!profileId) break;

      await db.from('subscriptions').upsert({
        profile_id: profileId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subId,
        plan, status: 'active',
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      }, { onConflict: 'profile_id' });

      await db.from('profiles').update({ plan }).eq('id', profileId);
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price?.id ?? '';
      const plan = PRICE_TO_PLAN[priceId] ?? 'famille';
      const { data: existing } = await db.from('subscriptions')
        .select('profile_id').eq('stripe_subscription_id', sub.id).single();
      if (existing) {
        await db.from('subscriptions').update({ plan, status: sub.status as any }).eq('profile_id', existing.profile_id);
        await db.from('profiles').update({ plan }).eq('id', existing.profile_id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const { data: existing } = await db.from('subscriptions')
        .select('profile_id').eq('stripe_subscription_id', sub.id).single();
      if (existing) {
        await db.from('subscriptions').update({ plan: 'free', status: 'canceled' }).eq('profile_id', existing.profile_id);
        await db.from('profiles').update({ plan: 'free' }).eq('id', existing.profile_id);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const { data: existing } = await db.from('subscriptions')
        .select('profile_id').eq('stripe_customer_id', invoice.customer as string).single();
      if (existing) {
        await db.from('subscriptions').update({ status: 'past_due' }).eq('profile_id', existing.profile_id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
