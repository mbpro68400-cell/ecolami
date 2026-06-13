import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateProfile } from '@/lib/supabase/client';
import { completeOnboarding } from '@/lib/supabase/auth';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const clerkUser = await currentUser();
  if (!clerkUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const profile = await getOrCreateProfile(
    userId,
    clerkUser.emailAddresses[0]?.emailAddress ?? '',
    `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
  );
  await completeOnboarding(profile.id);
  return NextResponse.json({ success: true });
}
