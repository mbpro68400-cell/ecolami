import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient, getProfileByClerkId, getParentChildren } from '@/lib/supabase/client';
import TeachersClient from './TeachersClient';

export default async function TeachersPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const profile = await getProfileByClerkId(userId);
  if (!profile) redirect('/sign-in');
  const children = await getParentChildren(profile.id);
  const db = createAdminClient();

  const { data: invitations } = await db.from('teacher_invitations')
    .select('*, teacher_accounts(name, email, school_name, subject)')
    .eq('parent_id', profile.id).order('created_at', { ascending: false });

  const childIds = children.map(c => c.id);
  const invIds = (invitations ?? []).map((i: any) => i.id);

  const { data: recommendations } = invIds.length > 0
    ? await db.from('teacher_recommendations').select('*')
        .in('invitation_id', invIds).order('created_at', { ascending: false }).limit(20)
    : { data: [] };

  return (
    <TeachersClient
      profile={profile}
      children={children}
      invitations={invitations ?? []}
      recommendations={recommendations ?? []}
    />
  );
}
