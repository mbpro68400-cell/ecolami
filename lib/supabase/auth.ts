/**
 * EcoLami — Auth helpers (Clerk ↔ Supabase sync)
 */

import { createAdminClient } from './client';
import type { Profile, Child, PlanTier, SchoolLevel, NeuroProfile } from './client';

export interface CreateChildInput {
  name: string; age: number; grade: SchoolLevel;
  avatar?: string; neuro_profile?: NeuroProfile; preferred_tutor?: string;
}

/** Créer ou mettre à jour un profil depuis Clerk */
export async function syncClerkUser(opts: {
  clerkId: string; email: string; fullName: string; avatarUrl?: string;
}): Promise<Profile> {
  const db = createAdminClient();

  const { data: existing } = await db
    .from('profiles').select('*').eq('clerk_id', opts.clerkId).maybeSingle();

  if (existing) {
    const { data } = await db.from('profiles').update({
      email: opts.email, full_name: opts.fullName,
      avatar_url: opts.avatarUrl ?? existing.avatar_url,
    }).eq('clerk_id', opts.clerkId).select().single();
    return data as Profile;
  }

  // Créer user Supabase Auth
  const { data: authUser, error: authErr } = await db.auth.admin.createUser({
    email: opts.email, email_confirm: true,
    user_metadata: { clerk_id: opts.clerkId, full_name: opts.fullName },
  });

  let userId: string;
  if (authErr) {
    // L'utilisateur auth existe peut-être déjà
    const { data: list } = await db.auth.admin.listUsers();
    const found = list?.users.find(u => u.email === opts.email);
    if (!found) throw new Error(`Auth sync failed: ${authErr.message}`);
    userId = found.id;
  } else {
    userId = authUser.user.id;
  }

  const { data: profile } = await db.from('profiles').upsert({
    id: userId, clerk_id: opts.clerkId,
    email: opts.email, full_name: opts.fullName,
    avatar_url: opts.avatarUrl, role: 'parent', plan: 'free',
  }, { onConflict: 'clerk_id' }).select().single();

  // Créer abonnement trial
  await db.from('subscriptions').upsert({
    profile_id: userId, plan: 'free', status: 'trialing',
  }, { onConflict: 'profile_id' });

  return profile as Profile;
}

/** Ajouter un enfant (avec vérification limite plan) */
export async function addChild(parentId: string, input: CreateChildInput): Promise<Child> {
  const db = createAdminClient();

  const { data: profile } = await db.from('profiles').select('plan').eq('id', parentId).single();
  const plan = (profile?.plan ?? 'free') as PlanTier;
  const maxChildren = { free: 1, famille: 3, famille_plus: 6, ecole: 200 }[plan] ?? 1;

  const { count } = await db.from('children').select('id', { count: 'exact', head: true }).eq('parent_id', parentId);
  if ((count ?? 0) >= maxChildren) {
    throw new Error(`Limite de ${maxChildren} enfant(s) avec le plan ${plan}.`);
  }

  const { data, error } = await db.from('children').insert({
    parent_id: parentId, name: input.name, age: input.age, grade: input.grade,
    avatar: input.avatar ?? '🧒', neuro_profile: input.neuro_profile ?? 'normal',
    preferred_tutor: input.preferred_tutor ?? 'sophie',
  }).select().single();

  if (error) throw new Error(`addChild: ${error.message}`);
  return data as Child;
}

/** Marquer l'onboarding comme terminé */
export async function completeOnboarding(profileId: string): Promise<void> {
  const db = createAdminClient();
  await db.from('profiles').update({ onboarding_done: true }).eq('id', profileId);
}
