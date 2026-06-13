import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfileByClerkId, getParentChildren } from '@/lib/supabase/client';
import { Plus, Flame, ArrowRight, Trophy, Clock } from 'lucide-react';

export default async function ChildrenPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const profile = await getProfileByClerkId(userId);
  if (!profile) redirect('/sign-in');
  const children = await getParentChildren(profile.id);

  const maxByPlan: Record<string, number> = { free: 1, famille: 3, famille_plus: 6, ecole: 200 };
  const maxChildren = maxByPlan[profile.plan] ?? 1;

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Mes enfants</h1>
          <p className="text-slate-500 text-sm mt-1">
            {children.length} / {maxChildren} profil{children.length > 1 ? 's' : ''} actif{children.length > 1 ? 's' : ''}
          </p>
        </div>
        {children.length < maxChildren && (
          <Link href="/children/new" className="btn btn-primary">
            <Plus size={15} /> Ajouter un enfant
          </Link>
        )}
      </div>

      {children.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-6xl mb-4">🧒</div>
          <h2 className="font-bold text-xl mb-2">Aucun enfant encore</h2>
          <p className="text-slate-500 mb-6">Créez le profil de votre premier enfant pour commencer les sessions.</p>
          <Link href="/children/new" className="btn btn-primary btn-lg mx-auto">
            <Plus size={16} /> Créer un profil enfant
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {children.map(child => {
            const pct = Math.min(100, (child.total_xp % 1000) / 10);
            const level = Math.floor(child.total_xp / 500) + 1;
            const title = level < 3 ? 'Débutant' : level < 6 ? 'Explorateur' : level < 10 ? 'Savant' : 'Expert';
            return (
              <div key={child.id} className="card card-p">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center text-3xl">
                      {child.avatar}
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">{child.name}</h2>
                      <p className="text-slate-500 text-sm">{child.age} ans · {child.grade}</p>
                      <div className="flex gap-1.5 mt-1.5">
                        {child.neuro_profile !== 'normal' && (
                          <span className="pill-blue pill text-xs">{child.neuro_profile.toUpperCase()}</span>
                        )}
                        <span className="pill text-xs">{child.preferred_tutor}</span>
                      </div>
                    </div>
                  </div>
                  <span className="pill-orange pill text-xs">
                    <Flame size={11} /> {child.current_streak}j
                  </span>
                </div>

                {/* XP bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-semibold mb-1.5">
                    <span>Niv. {level} · {title}</span>
                    <span className="text-slate-400">{child.total_xp % 1000}/1000 XP</span>
                  </div>
                  <div className="xp-bar">
                    <div className="xp-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: Trophy, value: String(child.total_sessions), label: 'Sessions', color: '#10B981' },
                    { icon: Clock, value: child.last_session_at ? 'Récent' : '—', label: 'Dernière session', color: '#2563EB' },
                    { icon: Flame, value: `${child.longest_streak}j`, label: 'Meilleur streak', color: '#F97316' },
                  ].map(s => (
                    <div key={s.label} className="bg-surface rounded-xl p-3 text-center">
                      <s.icon size={14} className="mx-auto mb-1" style={{ color: s.color }} />
                      <p className="font-bold text-sm">{s.value}</p>
                      <p className="text-xs text-slate-400 leading-tight mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link href={`/session?child=${child.id}`} className="btn btn-primary flex-1 justify-center">
                    Session <ArrowRight size={14} />
                  </Link>
                  <button className="btn btn-outline px-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add child card */}
          {children.length < maxChildren && (
            <Link href="/children/new"
              className="card p-8 flex flex-col items-center justify-center gap-4 border-dashed border-2 hover:border-brand transition-colors group min-h-[280px]">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-green-50 transition-colors">
                <Plus size={24} className="text-slate-400 group-hover:text-brand" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-600 group-hover:text-brand transition-colors">Ajouter un enfant</p>
                <p className="text-xs text-slate-400 mt-1">{maxChildren - children.length} place{maxChildren - children.length > 1 ? 's' : ''} disponible{maxChildren - children.length > 1 ? 's' : ''}</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {children.length >= maxChildren && profile.plan !== 'ecole' && (
        <div className="mt-6 card card-p bg-gradient-to-r from-green-50 to-blue-50 border-brand border-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-bold">Besoin de plus de profils ?</p>
              <p className="text-slate-500 text-sm">Le plan {profile.plan === 'free' ? 'Famille' : 'Famille+'} permet jusqu'à {profile.plan === 'free' ? '3' : '6'} enfants.</p>
            </div>
            <Link href="/billing" className="btn btn-primary shrink-0">Passer au plan supérieur</Link>
          </div>
        </div>
      )}
    </div>
  );
}
