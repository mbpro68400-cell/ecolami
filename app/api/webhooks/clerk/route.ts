/**
 * POST /api/webhooks/clerk
 * Sync Clerk users → Supabase profiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncClerkUser } from '@/lib/supabase/auth';

export async function POST(req: NextRequest) {
  // Vérification optionnelle de la signature Svix
  const payload = await req.json();
  const { type, data } = payload;

  if (type === 'user.created' || type === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = data;
    const email = email_addresses?.[0]?.email_address;
    if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 });

    try {
      await syncClerkUser({
        clerkId: id,
        email,
        fullName: `${first_name ?? ''} ${last_name ?? ''}`.trim() || email.split('@')[0],
        avatarUrl: image_url,
      });
    } catch (err) {
      console.error('[clerk webhook]', err);
      return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
