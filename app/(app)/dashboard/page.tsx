import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient, getOrCreateProfile, getParentChildren } from '@/lib/supabase/client';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const clerkUser = await currentUser();
  if (!clerkUser) redirect('/sign-in');

  const profile = await getOrCreateProfile(
    userId,
    clerkUser.emailAddresses[0]?.emailAddress ?? '',
    `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()
  );
  if (!profile.onboarding_done) redirect('/onboarding');

  const db = createAdminClient();
  const children = await getParentChildren(profile.id);

  // Sessions récentes
  const { data: sessions } = await db.from('sessions').select('*')
    .eq('parent_id', profile.id).order('started_at', { ascending: false }).limit(10);

  // Alertes non lues
  const { data: alerts } = await db.from('alerts').select('*')
    .eq('parent_id', profile.id).eq('is_read', false).order('created_at', { ascending: false }).limit(10);

  // Stats semaine
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const { data: weeklyActivity } = await db.from('daily_activity')
    .select('*').in('child_id', children.map(c => c.id))
    .gte('day', weekStart.toISOString().split('T')[0]);

  const totalSessions = (weeklyActivity ?? []).reduce((s: number, d: any) => s + (d.sessions ?? 0), 0);
  const totalTime = (weeklyActivity ?? []).reduce((s: number, d: any) => s + (d.time_min ?? 0), 0);
  const maxStreak = Math.max(...children.map(c => c.current_streak), 0);
  const completedWithScore = (sessions ?? []).filter((s: any) => s.status === 'completed' && s.accuracy != null);
  const avgScore = completedWithScore.length > 0
    ? Math.round(completedWithScore.reduce((s: number, x: any) => s + (x.accuracy ?? 0), 0) / completedWithScore.length)
    : 0;

  // Subscription
  const { data: sub } = await db.from('subscriptions').select('plan, status, current_period_end').eq('profile_id', profile.id).maybeSingle();

  return (
    <DashboardClient
      profile={profile}
      children={children}
      recentSessions={sessions ?? []}
      alerts={alerts ?? []}
      weeklyStats={{ totalSessions, totalTime, avgScore, maxStreak }}
      subscription={sub ?? { plan: profile.plan, status: 'trialing', current_period_end: null }}
    />
  );
}
