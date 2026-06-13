import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Types ──────────────────────────────────────────────
export type PlanTier = 'free' | 'famille' | 'famille_plus' | 'ecole';
export type UserRole = 'parent' | 'teacher' | 'admin';
export type SchoolLevel = 'cp'|'ce1'|'ce2'|'cm1'|'cm2'|'6eme'|'5eme'|'4eme'|'3eme'|'2nde'|'1ere'|'terminale';
export type NeuroProfile = 'normal'|'dys'|'tdah'|'hp'|'multi';
export type SessionMode = 'tutor'|'scan'|'recitation'|'dictee'|'devoir';

export interface Profile {
  id: string; clerk_id: string | null; email: string; full_name: string;
  avatar_url: string | null; role: UserRole; plan: PlanTier;
  onboarding_done: boolean; created_at: string; updated_at: string;
}
export interface Child {
  id: string; parent_id: string; name: string; age: number;
  grade: SchoolLevel; avatar: string; neuro_profile: NeuroProfile;
  preferred_tutor: string; parental_lock: boolean; allowed_subjects: string[];
  total_xp: number; current_streak: number; longest_streak: number;
  total_sessions: number; last_session_at: string | null;
  created_at: string; updated_at: string;
}
export interface Session {
  id: string; child_id: string; parent_id: string; mode: SessionMode;
  subject: string; topic: string | null; status: 'active'|'completed'|'abandoned';
  exercise_text: string | null; difficulty: number; hints_given: number;
  msg_count: number; correct_count: number; partial_count: number;
  incorrect_count: number; accuracy: number | null; xp_earned: number;
  started_at: string; ended_at: string | null; duration_sec: number | null;
}
export interface Message {
  id: string; session_id: string; role: 'user'|'assistant'|'system';
  content: string; hint_level: number; quality: string | null;
  tokens_in: number | null; tokens_out: number | null; model: string | null;
  created_at: string;
}
export interface Progress {
  id: string; child_id: string; subject: string; topic: string;
  mastery_level: number; mastery_label: string; trend: 'up'|'stable'|'down';
  attempts: number; correct: number; last_practiced: string | null;
  next_review: string | null; updated_at: string;
}

// ─── Clients ────────────────────────────────────────────

/** Client browser — composants React */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** Client serveur — Server Components, API routes */
export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }); } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }); } catch {}
      },
    },
  });
}

/** Client admin — bypass RLS, côté serveur uniquement */
export function createAdminClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

// ─── Helpers ────────────────────────────────────────────

export async function getProfileByClerkId(clerkId: string) {
  const db = createAdminClient();
  const { data } = await db.from('profiles').select('*').eq('clerk_id', clerkId).single();
  return data as Profile | null;
}

export async function getParentChildren(parentId: string) {
  const db = createAdminClient();
  const { data } = await db.from('children').select('*').eq('parent_id', parentId).order('name');
  return (data ?? []) as Child[];
}

export async function getWeeklySessionCount(childId: string): Promise<number> {
  const db = createAdminClient();
  const { data } = await db.rpc('get_weekly_session_count', { p_child_id: childId });
  return (data as number) ?? 0;
}

export async function saveMessage(
  sessionId: string, role: 'user'|'assistant'|'system', content: string,
  meta?: { model?: string; tokens_in?: number; tokens_out?: number; hint_level?: number }
) {
  const db = createAdminClient();
  const { data } = await db.from('messages').insert({
    session_id: sessionId, role, content,
    hint_level: meta?.hint_level ?? 0,
    model: meta?.model, tokens_in: meta?.tokens_in, tokens_out: meta?.tokens_out,
  }).select().single();
  return data as Message;
}

export async function getSessionMessages(sessionId: string) {
  const db = createAdminClient();
  const { data } = await db.from('messages').select('*')
    .eq('session_id', sessionId).neq('role', 'system')
    .order('created_at', { ascending: true }).limit(60);
  return (data ?? []) as Message[];
}

export async function updateMastery(
  childId: string, subject: string, topic: string,
  masteryLevel: number, opts?: { trend?: 'up'|'stable'|'down'; attempts?: number; correct?: number }
) {
  const db = createAdminClient();
  await db.from('progress').upsert({
    child_id: childId, subject, topic, mastery_level: masteryLevel,
    trend: opts?.trend ?? 'stable',
    attempts: opts?.attempts ?? 1, correct: opts?.correct ?? 0,
    last_practiced: new Date().toISOString(),
  }, { onConflict: 'child_id,subject,topic' });
}

export async function getOrCreateProfile(
  clerkId: string, email: string, fullName: string
): Promise<Profile> {
  const db = createAdminClient();
  const { data: existing } = await db
    .from('profiles').select('*').eq('clerk_id', clerkId).maybeSingle();
  if (existing) return existing as Profile;

  const { data: authData } = await db.auth.admin.createUser({
    email, email_confirm: true,
    user_metadata: { clerk_id: clerkId },
  });
  const userId = authData?.user?.id;
  if (!userId) throw new Error('Erreur Supabase');

  const { data: profile } = await db.from('profiles').insert({
    id: userId, clerk_id: clerkId, email, full_name: fullName,
    role: 'parent', plan: 'free', onboarding_done: false,
  }).select().single();

  await db.from('subscriptions').insert({
    profile_id: userId, plan: 'free', status: 'trialing',
  });

  return profile as Profile;
}
