'use client';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Flame, Clock, Target, MessageSquare, Bell, Plus,
         AlertCircle, Info, ChevronRight, Download, ArrowRight, BarChart2 } from 'lucide-react';
import type { Profile, Child, Session } from '@/lib/supabase/client';

interface Props {
  profile: Profile;
  children: Child[];
  recentSessions: Session[];
  alerts: any[];
  weeklyStats: { totalSessions: number; totalTime: number; avgScore: number; maxStreak: number };
  subscription: { plan: string; status: string; current_period_end: string | null };
}

const PLAN_LIMITS: Record<string, number> = { free: 3, famille: Infinity, famille_plus: Infinity, ecole: Infinity };

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400 text-sm">—</span>;
  const cls = score >= 80 ? 'pill-green' : score >= 60 ? 'pill-yellow' : 'pill-red';
  return <span className={`pill ${cls} font-bold`}>{score}%</span>;
}

function StatCard({ icon: Icon, iconColor, label, value, delta, deltaDir, sub }: {
  icon: any; iconColor: string; label: string; value: string;
  delta?: string; deltaDir?: 'up'|'down'|'flat'; sub?: string;
}) {
  return (
    <div className="card card-p">
      <div className="flex justify-between items-start">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-opacity-10`}
          style={{ background: `${iconColor}15`, color: iconColor }}>
          <Icon size={16} />
        </div>
      </div>
      <p className="font-display text-3xl font-bold tracking-tighter mt-1">{value}</p>
      {(delta || sub) && (
        <div className="flex items-center gap-1.5 mt-1">
          {delta && deltaDir && (
            <span className={`text-xs font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full
              ${deltaDir === 'up' ? 'bg-green-50 text-green-700' : deltaDir === 'down' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
              {deltaDir === 'up' && <ArrowUp size={10} strokeWidth={3} />}
              {deltaDir === 'down' && <ArrowDown size={10} strokeWidth={3} />}
              {delta}
            </span>
          )}
          {sub && <span className="text-xs text-slate-400">{sub}</span>}
        </div>
      )}
    </div>
  );
}

function ChildCard({ child }: { child: Child }) {
  const pct = Math.min(100, Math.round((child.total_xp % 1000) / 10));
  const levelTitle = child.current_streak < 5 ? 'Débutant' : child.current_streak < 15 ? 'Explorateur' : 'Savant';
  return (
    <div className="card card-p hover:shadow-card transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center text-2xl">
            {child.avatar}
          </div>
          <div>
            <p className="font-bold text-base">{child.name}, {child.age} ans</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="pill text-xs">{child.grade}</span>
              <span className="text-xs text-slate-400">{child.last_session_at ? 'Actif récemment' : 'Pas encore de session'}</span>
            </div>
          </div>
        </div>
        <span className="pill-orange pill text-xs">
          <Flame size={11} /> {child.current_streak}j
        </span>
      </div>
      <div className="mb-3">
        <div className="flex justify-between text-xs font-semibold mb-1">
          <span className="text-slate-600">Niv. {Math.floor(child.total_xp / 500) + 1} · {levelTitle}</span>
          <span className="text-slate-400">{child.total_xp % 1000}<span className="text-slate-300">/1000 XP</span></span>
        </div>
        <div className="xp-bar"><div className="xp-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <Link href={`/session?child=${child.id}`}
        className="btn btn-primary w-full justify-center text-sm">
        Nouvelle session <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export default function DashboardClient({ profile, children, recentSessions, alerts, weeklyStats, subscription }: Props) {
  const planLimit = PLAN_LIMITS[subscription.plan] ?? 3;
  const isFreeLimitClose = subscription.plan === 'free' && weeklyStats.totalSessions >= 2;

  return (
    <div className="p-5 md:p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Bonjour, {profile.full_name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {children.length === 0 ? 'Créez votre premier profil enfant pour commencer' :
             `Suivi de ${children.length} enfant${children.length > 1 ? 's' : ''} cette semaine`}
          </p>
        </div>
        <Link href="/session" className="btn btn-primary hidden md:inline-flex">
          <Plus size={15} /> Nouvelle session
        </Link>
      </div>

      {/* ═ Section 1 : Stats ═ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={MessageSquare} iconColor="#10B981" label="Sessions" value={String(weeklyStats.totalSessions)} delta="+4" deltaDir="up" sub="cette semaine" />
        <StatCard icon={Clock} iconColor="#2563EB" label="Temps étude" value={`${weeklyStats.totalTime}min`} delta="+28min" deltaDir="up" />
        <StatCard icon={Target} iconColor="#8B5CF6" label="Score moyen" value={weeklyStats.avgScore ? `${weeklyStats.avgScore}%` : '—'} />
        <StatCard icon={Flame} iconColor="#F97316" label="Meilleur streak" value={`${weeklyStats.maxStreak}j`} />
      </div>

      {/* ═ Section 2 : Enfants ═ */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-base">Mes enfants</h2>
        <Link href="/children" className="text-sm font-semibold text-brand">Gérer les profils</Link>
      </div>

      {children.length === 0 ? (
        <div className="card p-10 text-center mb-6">
          <div className="text-5xl mb-3">🧒</div>
          <p className="font-bold text-lg mb-1">Aucun enfant encore</p>
          <p className="text-slate-500 text-sm mb-4">Créez le profil de votre premier enfant pour commencer.</p>
          <Link href="/children/new" className="btn btn-primary inline-flex mx-auto">
            <Plus size={14} /> Ajouter un enfant
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {children.map(c => <ChildCard key={c.id} child={c} />)}
          {children.length < (subscription.plan === 'free' ? 1 : 3) && (
            <Link href="/children/new"
              className="card p-5 flex flex-col items-center justify-center gap-3 border-dashed border-2 hover:border-brand transition-colors group min-h-[180px]">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-green-50">
                <Plus size={20} className="text-slate-400 group-hover:text-brand" />
              </div>
              <span className="text-sm font-semibold text-slate-400 group-hover:text-brand">Ajouter un enfant</span>
            </Link>
          )}
        </div>
      )}

      {/* ═ Sections 3+4 : Activité + Alertes ═ */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {/* Activité récente */}
        <div className="md:col-span-3 card card-p">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base">Activité récente</h3>
            <Link href="/history" className="text-xs font-semibold text-brand">Tout voir →</Link>
          </div>
          {recentSessions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-slate-400 text-sm">Aucune session encore</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentSessions.slice(0, 6).map((s: any) => {
                const child = children.find(c => c.id === s.child_id);
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-100 to-blue-100 flex items-center justify-center text-lg">
                      {child?.avatar ?? '🧒'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{s.subject}{s.topic ? ` · ${s.topic}` : ''}</p>
                      <p className="text-xs text-slate-400">
                        {child?.name} · {s.duration_sec ? `${Math.round(s.duration_sec / 60)} min` : '—'} · {s.mode}
                      </p>
                    </div>
                    <ScorePill score={s.accuracy} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alertes */}
        <div className="md:col-span-2 card card-p">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-bold text-base">Alertes</h3>
            {alerts.length > 0 && (
              <span className="pill-red pill text-xs">{alerts.length}</span>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-slate-400 text-sm">Aucune alerte non lue</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {alerts.slice(0, 5).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{a.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═ Section 6 : Abonnement ═ */}
      <div className="card card-p flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`pill text-xs font-bold ${subscription.plan === 'free' ? '' : 'pill-green'}`}>
            {subscription.plan}
          </span>
          <div>
            <p className="text-sm font-semibold">
              {weeklyStats.totalSessions} / {planLimit === Infinity ? '∞' : planLimit} sessions cette semaine
            </p>
            {subscription.plan !== 'free' && subscription.current_period_end && (
              <p className="text-xs text-slate-400">
                Renouvellement le {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
          {subscription.plan !== 'free' && (
            <div className="h-1.5 w-28 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand rounded-full"
                style={{ width: `${Math.min(100, (weeklyStats.totalSessions / 30) * 100)}%` }} />
            </div>
          )}
        </div>
        {isFreeLimitClose && (
          <Link href="/billing" className="btn btn-primary btn-sm">
            Passer à Famille →
          </Link>
        )}
      </div>
    </div>
  );
}
