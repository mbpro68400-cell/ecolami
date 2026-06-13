import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient, getProfileByClerkId } from '@/lib/supabase/client';
import { Users, AlertCircle, Lightbulb, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { createHash } from 'crypto';

function generateChildPseudo(childId: string, teacherId: string): string {
  return 'Élève-' + createHash('sha256').update(`${childId}:${teacherId}`).digest('hex').slice(0, 4).toUpperCase();
}

export default async function TeacherDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const profile = await getProfileByClerkId(userId);
  if (!profile) redirect('/sign-in');
  const db = createAdminClient();

  const { data: teacherAccount } = await db.from('teacher_accounts').select('*').eq('profile_id', profile.id).maybeSingle();
  if (!teacherAccount) redirect('/dashboard');

  const { data: invitations } = await db.from('teacher_invitations').select('id, child_id, consent_scope')
    .eq('teacher_id', teacherAccount.id).eq('status', 'accepted').is('revoked_at', null);

  const students = await Promise.all((invitations ?? []).map(async (inv: any) => {
    const pseudo = generateChildPseudo(inv.child_id, teacherAccount.id);
    const { data: reports } = await db.from('weekly_teacher_reports')
      .select('avg_comprehension_score, week_start, trend, weeks_in_red, weak_notions, strong_notions')
      .eq('invitation_id', inv.id).order('week_start', { ascending: false }).limit(1);
    const report = reports?.[0] ?? null;
    const { count: recoCount } = await db.from('teacher_recommendations').select('id', { count: 'exact', head: true }).eq('invitation_id', inv.id);
    return { pseudo, invitation_id: inv.id, consent_scope: inv.consent_scope, report, recoCount: recoCount ?? 0 };
  }));

  const alertCount = students.filter(s => (s.report?.weeks_in_red ?? 0) >= 3).length;
  const totalRecos = students.reduce((s, x) => s + x.recoCount, 0);

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto" style={{ fontFamily: 'var(--font-inter, Inter, sans-serif)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Tableau de bord enseignant</h1>
          <p className="text-slate-500 text-sm mt-1">{teacherAccount.school_name} · Données pseudonymisées RGPD</p>
        </div>
        <Link href="/dashboard" className="btn btn-ghost btn-sm">Vue parent</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: Users, label: 'Élèves suivis', value: students.length, color: '#2563EB' },
          { icon: AlertCircle, label: 'Alertes actives', value: alertCount, color: '#EF4444' },
          { icon: Lightbulb, label: 'Recommandations', value: totalRecos, color: '#10B981' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: s.color + '15', color: s.color }}>
              <s.icon size={16} />
            </div>
            <p className="font-display text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Students table */}
      {students.length === 0 ? (
        <div className="card p-12 text-center">
          <Users size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 mb-1">Aucun élève encore</p>
          <p className="text-slate-400 text-sm">Les élèves apparaîtront ici une fois que des parents vous auront invité.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface">
              <tr>
                {['Élève (anonyme)', 'Score moyen', 'Tendance', 'Semaines en rouge', 'Notions faibles', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const score = s.report?.avg_comprehension_score ?? null;
                const trend = s.report?.trend ?? 'stable';
                const weeksRed = s.report?.weeks_in_red ?? 0;
                const scoreColor = score == null ? '#94A3B8' : score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
                return (
                  <tr key={s.pseudo} className={`border-t border-surface-border ${weeksRed >= 3 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-sm">{s.pseudo}</p>
                      {weeksRed >= 3 && (
                        <span className="pill-red pill text-xs mt-1 inline-flex"><AlertCircle size={10} /> {weeksRed} sem. en difficulté</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-sm" style={{ color: scoreColor }}>
                        {score != null ? `${score}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {trend === 'improving' ? <TrendingUp size={16} className="text-green-500" />
                        : trend === 'declining' ? <TrendingDown size={16} className="text-red-500" />
                        : <Minus size={16} className="text-slate-400" />}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{weeksRed > 0 ? `${weeksRed}` : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(s.report?.weak_notions ?? []).slice(0, 2).map((n: string) => (
                          <span key={n} className="pill-red pill text-xs">{n}</span>
                        ))}
                        {!(s.report?.weak_notions?.length) && <span className="text-xs text-green-600">Aucune</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button className="btn btn-ghost btn-sm">
                        <Lightbulb size={13} /> Recommander
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
