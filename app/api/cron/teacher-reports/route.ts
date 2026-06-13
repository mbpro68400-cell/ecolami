/**
 * GET /api/cron/teacher-reports
 * Vercel Cron — chaque lundi à 7h00 (UTC)
 * vercel.json: { "crons": [{"path":"/api/cron/teacher-reports","schedule":"0 7 * * 1"}] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/client';
import { createHash } from 'crypto';

function generateChildPseudo(childId: string, teacherId: string): string {
  return 'Élève-' + createHash('sha256').update(`${childId}:${teacherId}`).digest('hex').slice(0, 4).toUpperCase();
}

function getLastMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
  d.setDate(diff); d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const weekStart = getLastMonday();
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: invitations } = await db.from('teacher_invitations')
    .select('id, child_id, teacher_id, consent_scope')
    .eq('status', 'accepted').is('revoked_at', null).not('consent_granted_at', 'is', null);

  let generated = 0; const errors: string[] = [];

  for (const inv of invitations ?? []) {
    try {
      if (!inv.teacher_id) continue;
      const pseudo = generateChildPseudo(inv.child_id, inv.teacher_id);

      // Agréger les sessions
      let query = db.from('sessions').select('subject, accuracy, duration_sec, correct_count, incorrect_count')
        .eq('child_id', inv.child_id).eq('status', 'completed')
        .gte('started_at', weekStart).lt('started_at', weekEnd.toISOString());
      if (inv.consent_scope?.length) query = query.in('subject', inv.consent_scope);
      const { data: sessions } = await query;

      const sessionCount = sessions?.length ?? 0;
      const totalTimeMin = Math.round((sessions ?? []).reduce((s: number, x: any) => s + (x.duration_sec ?? 0), 0) / 60);
      const avgScore = sessionCount > 0
        ? Math.round((sessions ?? []).reduce((s: number, x: any) => s + (x.accuracy ?? 0), 0) / sessionCount)
        : null;

      // Notions faibles/fortes
      const { data: progress } = await db.from('progress').select('subject, topic, mastery_level, trend')
        .eq('child_id', inv.child_id);
      const filtered = (progress ?? []).filter((p: any) =>
        !inv.consent_scope?.length || inv.consent_scope.includes(p.subject)
      );

      const weak = filtered.filter((p: any) => p.mastery_level < 50).sort((a: any, b: any) => a.mastery_level - b.mastery_level).slice(0, 5).map((p: any) => `${p.subject}: ${p.topic}`);
      const strong = filtered.filter((p: any) => p.mastery_level >= 75).sort((a: any, b: any) => b.mastery_level - a.mastery_level).slice(0, 5).map((p: any) => `${p.subject}: ${p.topic}`);
      const persistent = filtered.filter((p: any) => p.mastery_level < 40 && (p.attempts ?? 0) >= 3).map((p: any) => `${p.subject}: ${p.topic}`);

      const improving = filtered.filter((p: any) => p.trend === 'up').length;
      const declining = filtered.filter((p: any) => p.trend === 'down').length;
      const trend = improving > declining * 2 ? 'improving' : declining > improving * 2 ? 'declining' : 'stable';

      // Semaines en rouge
      const { data: prevReport } = await db.from('weekly_teacher_reports').select('weeks_in_red')
        .eq('invitation_id', inv.id).order('week_start', { ascending: false }).limit(1).maybeSingle();
      const weeksInRed = (avgScore ?? 100) < 40 ? (prevReport?.weeks_in_red ?? 0) + 1 : 0;

      await db.from('weekly_teacher_reports').upsert({
        invitation_id: inv.id, child_pseudo_id: pseudo, week_start: weekStart,
        session_count: sessionCount, total_time_min: totalTimeMin,
        avg_comprehension_score: avgScore, weak_notions: weak, strong_notions: strong,
        persistent_errors: persistent, trend, weeks_in_red: weeksInRed,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'invitation_id,week_start' });

      generated++;
    } catch (e) {
      errors.push(`${inv.id}: ${(e as Error).message}`);
    }
  }

  // Nettoyage RGPD : supprimer les rapports de consentements révoqués > 90 jours
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: revoked } = await db.from('teacher_invitations').select('id').eq('status', 'revoked');
  if (revoked?.length) {
    await db.from('weekly_teacher_reports').delete()
      .in('invitation_id', revoked.map((r: any) => r.id)).lt('generated_at', ninetyDaysAgo);
  }

  return NextResponse.json({ success: true, generated, errors, week_start: weekStart });
}
