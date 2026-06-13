import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getOrCreateProfile } from '@/lib/supabase/client';
import { addChild } from '@/lib/supabase/auth';
import type { SchoolLevel, NeuroProfile } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const clerkUser = await currentUser();
  if (!clerkUser) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const profile = await getOrCreateProfile(
    userId,
    clerkUser.emailAddresses[0]?.emailAddress ?? '',
    `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
  );
  const body = await req.json();
  const { name, age, grade, avatar, neuro_profile, preferred_tutor } = body;
  if (!name || !age || !grade) return NextResponse.json({ error: 'name, age, grade requis' }, { status: 400 });
  try {
    const child = await addChild(profile.id, {
      name, age, grade: grade as SchoolLevel,
      avatar, neuro_profile: neuro_profile as NeuroProfile, preferred_tutor,
    });
    return NextResponse.json({ child }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: { message: (e as Error).message, code: 'CREATE_ERROR' } }, { status: 400 });
  }
}
