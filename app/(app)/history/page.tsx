import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient, getProfileByClerkId, getParentChildren } from '@/lib/supabase/client';
import { Clock, BookOpen, ChevronRight } from 'lucide-react';

const MODE_LABELS: Record<string, string> = {
  tutor:'Professeur', scan:'Scan', recitation:'Récitation', dictee:'Dictée', devoir:'Devoir'
};
const SUBJECT_COLORS: Record<string, string> = {
  mathematiques: '#10B981', francais: '#EC4899', sciences: '#2563EB',
  'histoire-geo': '#8B5CF6', anglais: '#F97316', philosophie: '#6366F1',
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400 text-sm">—</span>;
  const c = score >= 80 ? 'bg-green-100 text-green-700' : score >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <span className={`pill ${c} font-bold text-xs`}>{score}%</span>;
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const profile = await getProfileByClerkId(userId);
  if (!profile) redirect('/sign-in');
  const children = await getParentChildren(profile.id);
  const sp = await searchParams;
  const childFilter = sp.child;

  const db = createAdminClient();
  let query = db.from('sessions').select('*')
    .eq('parent_id', profile.id).order('started_at', { ascending: false }).limit(50);
  if (childFilter) query = query.eq('child_id', childFilter);
  const { data: sessions } = await query;

  const childMap = new Map(children.map(c => [c.id, c]));
  const totalSessions = sessions?.length ?? 0;
  const totalTime = Math.round((sessions ?? []).reduce((s: number, x: any) => s + (x.duration_sec ?? 0), 0) / 60);
  const completedWithScore = (sessions ?? []).filter((s: any) => s.accuracy != null);
  const avgScore = completedWithScore.length > 0 ? Math.round(completedWithScore.reduce((s: number, x: any) => s + x.accuracy, 0) / completedWithScore.length) : null;

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Historique</h1>
        <p className="text-slate-500 text-sm mt-1">Toutes les sessions de la famille</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Sessions', value: String(totalSessions) },
          { label: 'Temps total', value: `${totalTime} min` },
          { label: 'Score moyen', value: avgScore ? `${avgScore}%` : '—' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className="font-display text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <a href="/history" className={`pill cursor-pointer ${!childFilter ? 'bg-brand text-white' : 'hover:border-slate-400'}`}>
            Tous
          </a>
          {children.map(c => (
            <a key={c.id} href={`/history?child=${c.id}`}
              className={`pill cursor-pointer ${childFilter === c.id ? 'bg-brand text-white' : 'hover:border-slate-400'}`}>
              {c.avatar} {c.name}
            </a>
          ))}
        </div>
      )}

      {/* Sessions list */}
      {!sessions?.length ? (
        <div className="card p-12 text-center">
          <BookOpen size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600 mb-1">Aucune session encore</p>
          <p className="text-slate-400 text-sm">Les sessions apparaîtront ici après avoir démarré la première.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(sessions as any[]).map(s => {
            const child = childMap.get(s.child_id);
            const color = SUBJECT_COLORS[s.subject] ?? '#10B981';
            return (
              <div key={s.id} className="card p-4 flex items-center gap-3 hover:shadow-card transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: color + '15' }}>
                  <BookOpen size={18} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">
                      {s.subject.charAt(0).toUpperCase() + s.subject.slice(1)}
                      {s.topic ? ` · ${s.topic}` : ''}
                    </p>
                    <span className="pill text-xs shrink-0" style={{ background: color + '15', color }}>{MODE_LABELS[s.mode] ?? s.mode}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                    <span>{child?.avatar} {child?.name ?? '—'}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {s.duration_sec ? `${Math.round(s.duration_sec / 60)} min` : '—'}
                    </span>
                    <span>{new Date(s.started_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ScoreBadge score={s.accuracy} />
                  {s.xp_earned > 0 && (
                    <span className="pill text-xs bg-yellow-50 text-yellow-700">+{s.xp_earned} XP</span>
                  )}
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
