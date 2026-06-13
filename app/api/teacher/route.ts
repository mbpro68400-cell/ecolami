/**
 * EcoLami — API Enseignants
 * POST /api/teacher/invite   → parent invite un prof
 * GET  /api/teacher/accept?token=xxx → prof accepte
 * DELETE /api/teacher/revoke → parent révoque
 * GET  /api/teacher/dashboard → dashboard prof
 * POST /api/teacher/recommendation → prof envoie une reco
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { createAdminClient, getProfileByClerkId } from '@/lib/supabase/client';
import { createHash } from 'crypto';

function generateChildPseudo(childId: string, teacherId: string): string {
  return 'Élève-' + createHash('sha256').update(`${childId}:${teacherId}`).digest('hex').slice(0, 4).toUpperCase();
}

function err(msg: string, code: string, status = 400) {
  return NextResponse.json({ error: { message: msg, code } }, { status });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return err('Non authentifié', 'UNAUTHORIZED', 401);
  const profile = await getProfileByClerkId(userId);
  if (!profile) return err('Profil introuvable', 'NOT_FOUND', 404);

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();
  const db = createAdminClient();
  const body = await req.json();

  // ═══ INVITE ═══
  if (action === 'invite') {
    const schema = z.object({
      teacher_email: z.string().email(),
      child_id: z.string().uuid(),
      subjects: z.array(z.string()).min(1),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 'VALIDATION');

    const { teacher_email, child_id, subjects } = parsed.data;

    // Vérifier ownership enfant
    const { data: child } = await db.from('children').select('id').eq('id', child_id).eq('parent_id', profile.id).single();
    if (!child) return err('Enfant introuvable', 'NOT_FOUND', 404);

    // Invitation existante ?
    const { data: existing } = await db.from('teacher_invitations').select('id, status')
      .eq('parent_id', profile.id).eq('child_id', child_id).eq('teacher_email', teacher_email).maybeSingle();
    if (existing?.status === 'accepted') return err('Cet enseignant suit déjà cet enfant.', 'ALREADY_ACTIVE');
    if (existing?.status === 'pending') return err('Invitation déjà en attente.', 'PENDING');

    const { data: invitation, error } = await db.from('teacher_invitations').insert({
      parent_id: profile.id, teacher_email, child_id,
      consent_scope: subjects, consent_granted_at: new Date().toISOString(), status: 'pending',
    }).select('id, invite_token').single();

    if (error) return err('Erreur création invitation', 'DB_ERROR', 500);

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/teacher/accept?token=${invitation.invite_token}`;

    // TODO: sendTeacherInvitationEmail(teacher_email, profile.full_name, subjects, inviteLink)
    console.log('[teacher/invite] Link:', inviteLink);

    return NextResponse.json({ invitation_id: invitation.id, invite_link: inviteLink }, { status: 201 });
  }

  // ═══ RECOMMENDATION ═══
  if (action === 'recommendation') {
    if (profile.role !== 'teacher') return err('Accès enseignant requis', 'FORBIDDEN', 403);

    const schema = z.object({
      invitation_id: z.string().uuid(),
      subject: z.string().min(1),
      notion: z.string().min(1).max(200),
      text: z.string().min(10).max(2000),
      type: z.enum(['exercise', 'method', 'alert']),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 'VALIDATION');

    const { data: teacherAccount } = await db.from('teacher_accounts').select('id').eq('profile_id', profile.id).single();
    if (!teacherAccount) return err('Compte enseignant introuvable', 'NOT_FOUND', 404);

    const { data: inv } = await db.from('teacher_invitations').select('child_id, teacher_id, consent_scope, status, revoked_at, consent_granted_at')
      .eq('id', parsed.data.invitation_id).eq('teacher_id', teacherAccount.id).single();
    if (!inv || inv.status !== 'accepted' || inv.revoked_at || !inv.consent_granted_at) {
      return err('Consentement inactif', 'NO_CONSENT', 403);
    }
    if (inv.consent_scope?.length && !inv.consent_scope.includes(parsed.data.subject)) {
      return err(`Matière "${parsed.data.subject}" non autorisée.`, 'SUBJECT_BLOCKED', 403);
    }

    const pseudo = generateChildPseudo(inv.child_id, teacherAccount.id);
    const { data: reco, error } = await db.from('teacher_recommendations').insert({
      teacher_id: teacherAccount.id, invitation_id: parsed.data.invitation_id,
      child_pseudo_id: pseudo, subject: parsed.data.subject, notion: parsed.data.notion,
      recommendation_text: parsed.data.text, recommendation_type: parsed.data.type,
    }).select('id').single();

    if (error) return err('Erreur création recommandation', 'DB_ERROR', 500);
    return NextResponse.json({ recommendation_id: reco.id }, { status: 201 });
  }

  return err('Action inconnue', 'UNKNOWN_ACTION');
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();
  const token = url.searchParams.get('token');

  // ═══ ACCEPT ═══
  if (action === 'accept' && token) {
    const db = createAdminClient();
    const { data: invitation } = await db.from('teacher_invitations').select('*')
      .eq('invite_token', token).eq('status', 'pending').single();

    if (!invitation) return err('Invitation invalide ou expirée', 'INVALID_TOKEN', 404);
    if (invitation.token_expires_at && new Date(invitation.token_expires_at) < new Date()) {
      await db.from('teacher_invitations').update({ status: 'expired' }).eq('id', invitation.id);
      return err('Cette invitation a expiré.', 'EXPIRED');
    }

    // Créer ou trouver le compte enseignant
    let teacherAccount = await db.from('teacher_accounts').select('id').eq('email', invitation.teacher_email).maybeSingle().then(r => r.data);
    if (!teacherAccount) {
      const { data: newAcc } = await db.from('teacher_accounts').insert({
        email: invitation.teacher_email, name: invitation.teacher_email.split('@')[0], school_name: '—',
      }).select('id').single();
      teacherAccount = newAcc;
    }

    if (!teacherAccount) return err('Erreur création compte', 'DB_ERROR', 500);

    await db.from('teacher_invitations').update({
      teacher_id: teacherAccount.id, status: 'accepted', accepted_at: new Date().toISOString(),
    }).eq('id', invitation.id);

    const pseudo = generateChildPseudo(invitation.child_id, teacherAccount.id);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/teacher/dashboard?welcomed=1&pseudo=${pseudo}`);
  }

  // ═══ DASHBOARD ═══
  if (action === 'dashboard') {
    const { userId } = await auth();
    if (!userId) return err('Non authentifié', 'UNAUTHORIZED', 401);
    const profile = await getProfileByClerkId(userId);
    if (!profile) return err('Profil introuvable', 'NOT_FOUND', 404);
    const db = createAdminClient();
    const { data: teacherAccount } = await db.from('teacher_accounts').select('*').eq('profile_id', profile.id).single();
    if (!teacherAccount) return err('Compte enseignant introuvable', 'NOT_FOUND', 404);

    const { data: invitations } = await db.from('teacher_invitations').select('id, child_id, consent_scope')
      .eq('teacher_id', teacherAccount.id).eq('status', 'accepted').is('revoked_at', null);

    const students = await Promise.all((invitations ?? []).map(async inv => {
      const pseudo = generateChildPseudo(inv.child_id, teacherAccount.id);
      const { data: reports } = await db.from('weekly_teacher_reports')
        .select('avg_comprehension_score, week_start, trend, weeks_in_red')
        .eq('invitation_id', inv.id).order('week_start', { ascending: false }).limit(4);
      const avg = reports?.length ? Math.round(reports.reduce((s: number, r: any) => s + (r.avg_comprehension_score ?? 0), 0) / reports.length) : null;
      return { pseudo, invitation_id: inv.id, avg_score: avg, recent_report: reports?.[0] ?? null };
    }));

    return NextResponse.json({ teacher: teacherAccount, students });
  }

  return err('Action inconnue', 'UNKNOWN_ACTION');
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return err('Non authentifié', 'UNAUTHORIZED', 401);
  const profile = await getProfileByClerkId(userId);
  if (!profile) return err('Profil introuvable', 'NOT_FOUND', 404);

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();
  if (action !== 'revoke') return err('Action inconnue', 'UNKNOWN_ACTION');

  const body = await req.json();
  const { invitation_id } = body;
  if (!invitation_id) return err('invitation_id requis', 'MISSING', 400);

  const db = createAdminClient();
  const { data: inv } = await db.from('teacher_invitations').select('id, parent_id, status')
    .eq('id', invitation_id).single();
  if (!inv || inv.parent_id !== profile.id) return err('Accès refusé', 'FORBIDDEN', 403);
  if (inv.status !== 'accepted') return err('Invitation non active', 'INVALID_STATUS');

  await db.from('teacher_invitations').update({ status: 'revoked', revoke_reason: 'Révoqué par le parent' }).eq('id', invitation_id);
  return NextResponse.json({ success: true });
}
