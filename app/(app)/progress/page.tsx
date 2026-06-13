import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient, getProfileByClerkId, getParentChildren } from '@/lib/supabase/client';
import ProgressClient from './ProgressClient';

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const profile = await getProfileByClerkId(userId);
  if (!profile) redirect('/sign-in');
  const children = await getParentChildren(profile.id);
  if (!children.length) redirect('/children/new');

  const sp = await searchParams;
  const childId = sp.child ?? children[0].id;
  const selectedChild = children.find(c => c.id === childId) ?? children[0];

  const db = createAdminClient();
  const { data: progress } = await db.from('progress').select('*').eq('child_id', selectedChild.id);
  const { data: badges } = await db.from('child_badges').select('badge_id, earned_at').eq('child_id', selectedChild.id);
  const { data: allBadges } = await db.from('badges').select('*');
  const { data: activity } = await db.from('daily_activity').select('*')
    .eq('child_id', selectedChild.id).gte('day', new Date(Date.now() - 84 * 86400000).toISOString().split('T')[0])
    .order('day', { ascending: true });

  return (
    <ProgressClient
      children={children}
      selectedChild={selectedChild}
      progress={progress ?? []}
      earnedBadgeIds={new Set((badges ?? []).map((b: any) => b.badge_id))}
      allBadges={allBadges ?? []}
      activity={activity ?? []}
    />
  );
}
