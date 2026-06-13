/**
 * POST /api/session?action=start|end
 * GET  /api/session?action=report&id=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient, getProfileByClerkId, getWeeklySessionCount, updateMastery } from '@/lib/supabase/client';
import type { SessionMode } from '@/lib/supabase/client';

const PLAN_LIMITS: Record<string, { weekly: number; modes: string[]; maxMsg: number }> = {
  free:         { weekly: 3,        modes: ['tutor'],                                         maxMsg: 20  },
  famille:      { weekly: Infinity, modes: ['tutor','scan','recitation','dictee','devoir'],    maxMsg: 100 },
  famille_plus: { weekly: Infinity, modes: ['tutor','scan','recitation','dictee','devoir'],    maxMsg: 200 },
  ecole:        { weekly: Infinity, modes: ['tutor','scan','recitation','dictee','devoir'],    maxMsg: 200 },
};

const XP_REWARDS = {
  correct_no_hint: 20, correct_hint: 12, partial: 5, attempt: 2,
  session_bonus: 25, streak_bonus: 15,
};

function err(msg: string, code: string, status = 400) {
  return NextResponse.json({ error: { message: msg, code } }, { status });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return err('Non authentifié', 'UNAUTHORIZED', 401);

  const action = req.nextUrl.searchParams.get('action');
  const db = createAdminClient();
  const profile = await getProfileByClerkId(userId);
  if (!profile) return err('Profil introuvable', 'NOT_FOUND', 404);
  const plan = profile.plan ?? 'free';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const body = await req.json();

  // ════ START ════
  if (action === 'start') {
    const { child_id, mode, subject, topic, exercise_text } = body;
    if (!child_id || !mode || !subject) return err('child_id, mode, subject requis', 'MISSING', 400);

    const { data: child } = await db.from('children').select('id, parental_lock').eq('id', child_id).eq('parent_id', profile.id).single();
    if (!child) return err('Enfant introuvable', 'NOT_FOUND', 404);
    if (child.parental_lock) return err('Validation parentale requise.', 'PARENTAL_LOCK', 403);

    if (!limits.modes.includes(mode)) {
      return err(`Mode "${mode}" non disponible avec le plan ${plan}.`, 'MODE_LOCKED', 403);
    }

    const weekCount = await getWeeklySessionCount(child_id);
    if (weekCount >= limits.weekly) {
      return err(`Limite de ${limits.weekly} sessions/semaine atteinte.`, 'WEEKLY_LIMIT', 429);
    }

    // Fermer sessions orphelines > 2h
    await db.from('sessions').update({ status: 'abandoned' }).eq('child_id', child_id)
      .eq('status', 'active').lt('started_at', new Date(Date.now() - 7200000).toISOString());

    const { data: active } = await db.from('sessions').select('id').eq('child_id', child_id).eq('status', 'active');
    if (active?.length) return err('Session déjà en cours.', 'SESSION_ACTIVE', 409);

    const { data: session, error } = await db.from('sessions').insert({
      child_id, parent_id: profile.id, mode, subject, topic: topic ?? null,
      exercise_text: exercise_text ?? null, status: 'active',
    }).select().single();

    if (error) { console.error('[session/start]', error); return err('Erreur création', 'DB_ERROR', 500); }

    return NextResponse.json({
      session_id: session.id, mode, subject,
      limits: { messages_max: limits.maxMsg, sessions_remaining: limits.weekly === Infinity ? 'unlimited' : limits.weekly - weekCount - 1 },
    }, { status: 201 });
  }

  // ════ END ════
  if (action === 'end') {
    const { session_id, correct_count = 0, partial_count = 0, incorrect_count = 0,
            hints_given = 0, difficulty = 3, topics_covered = [] } = body;
    if (!session_id) return err('session_id requis', 'MISSING', 400);

    const { data: session } = await db.from('sessions').select('*')
      .eq('id', session_id).eq('parent_id', profile.id).eq('status', 'active').single();
    if (!session) return err('Session introuvable ou déjà terminée', 'NOT_FOUND', 404);

    const total = correct_count + partial_count + incorrect_count;
    const accuracy = total > 0 ? Math.round((correct_count / total) * 1000) / 10 : null;
    const durationSec = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000);

    // Calculer XP
    const xp = (correct_count * (hints_given > 0 ? XP_REWARDS.correct_hint : XP_REWARDS.correct_no_hint))
      + (partial_count * XP_REWARDS.partial)
      + (incorrect_count * XP_REWARDS.attempt)
      + XP_REWARDS.session_bonus;

    await db.from('sessions').update({
      status: 'completed', correct_count, partial_count, incorrect_count,
      hints_given, difficulty, xp_earned: xp, accuracy,
    }).eq('id', session_id);

    // Rapport parent
    const { data: child } = await db.from('children').select('name').eq('id', session.child_id).single();
    const emoji = (accuracy ?? 0) >= 80 ? '🌟' : (accuracy ?? 0) >= 50 ? '👍' : '💪';
    const parentSummary = `${emoji} ${child?.name} a travaillé ${Math.round(durationSec / 60)} min sur ${session.subject}. ${correct_count}/${total} correct (${accuracy ?? 0}%). +${xp} XP.`;

    await db.from('session_reports').insert({
      session_id, child_id: session.child_id,
      summary_json: { topics_covered, correct_count, partial_count, incorrect_count, hints_given },
      parent_summary: parentSummary, xp_earned: xp,
      difficulty_start: session.difficulty ?? 3, difficulty_end: difficulty,
      parent_notified: true, notified_at: new Date().toISOString(),
    });

    // Mettre à jour mastery pour les topics couverts
    for (const topic of topics_covered) {
      await updateMastery(session.child_id, session.subject, topic,
        Math.min(100, Math.round((correct_count / Math.max(total, 1)) * 100)),
        { trend: correct_count > incorrect_count ? 'up' : 'stable', attempts: total, correct: correct_count }
      );
    }

    return NextResponse.json({ success: true, session_id, xp_earned: xp, accuracy, duration_sec: durationSec, parent_summary: parentSummary });
  }

  return err(`Action "${action}" inconnue`, 'UNKNOWN_ACTION');
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return err('Non authentifié', 'UNAUTHORIZED', 401);

  const action = req.nextUrl.searchParams.get('action');
  const id = req.nextUrl.searchParams.get('id');
  if (action !== 'report' || !id) return err('action=report&id=xxx requis', 'MISSING', 400);

  const db = createAdminClient();
  const profile = await getProfileByClerkId(userId);
  if (!profile) return err('Profil introuvable', 'NOT_FOUND', 404);

  const { data: report } = await db.from('session_reports').select(`
    *, sessions!inner(subject, mode, started_at, ended_at, accuracy, parent_id),
    children!inner(name, grade, avatar)
  `).eq('id', id).single();

  if (!report || (report as any).sessions?.parent_id !== profile.id) {
    return err('Rapport introuvable', 'NOT_FOUND', 404);
  }

  return NextResponse.json({ report });
}
