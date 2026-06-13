'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Child, Progress } from '@/lib/supabase/client';

interface Props {
  children: Child[];
  selectedChild: Child;
  progress: Progress[];
  earnedBadgeIds: Set<string>;
  allBadges: any[];
  activity: any[];
}

const SUBJECT_META: Record<string, { color: string; emoji: string }> = {
  mathematiques: { color: '#10B981', emoji: '🔢' },
  francais:      { color: '#EC4899', emoji: '📖' },
  sciences:      { color: '#2563EB', emoji: '🧪' },
  'histoire-geo':{ color: '#8B5CF6', emoji: '🌍' },
  anglais:       { color: '#F97316', emoji: '🇬🇧' },
  philosophie:   { color: '#6366F1', emoji: '💭' },
};

const MAIN_SUBJECTS = Object.keys(SUBJECT_META);

type Tab = 'overview' | 'subjects' | 'badges' | 'heatmap';

// Simple SVG radar chart
function RadarChart({ data }: { data: { label: string; value: number }[] }) {
  const size = 220; const cx = size / 2; const cy = size / 2; const r = size / 2 - 32;
  const n = data.length;
  const pts = data.map((d, i) => {
    const a = -Math.PI / 2 + i * (2 * Math.PI / n);
    const rr = (d.value / 100) * r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
  const axisPts = data.map((_, i) => {
    const a = -Math.PI / 2 + i * (2 * Math.PI / n);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[.25, .5, .75, 1].map((ring, k) => (
        <polygon key={k} points={axisPts.map(([x, y]) => `${cx + (x - cx) * ring},${cy + (y - cy) * ring}`).join(' ')}
          fill="none" stroke="#E2E8F0" strokeWidth="1" />
      ))}
      {axisPts.map(([x, y], i) => <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#E2E8F0" strokeWidth="1" />)}
      <polygon points={pts.map(p => p.join(',')).join(' ')} fill="rgba(16,185,129,.15)" stroke="#10B981" strokeWidth="2" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#10B981" stroke="#fff" strokeWidth="2" />)}
      {data.map((d, i) => {
        const a = -Math.PI / 2 + i * (2 * Math.PI / n);
        return <text key={i} x={cx + (r + 16) * Math.cos(a)} y={cy + (r + 16) * Math.sin(a) + 4}
          fontSize="11" fontWeight="600" fill="#64748B" textAnchor="middle">{d.label}</text>;
      })}
    </svg>
  );
}

export default function ProgressClient({ children, selectedChild, progress, earnedBadgeIds, allBadges, activity }: Props) {
  const [tab, setTab] = useState<Tab>('overview');

  // Radar data
  const radarData = MAIN_SUBJECTS.map(s => {
    const progs = progress.filter(p => p.subject === s);
    const avg = progs.length > 0 ? Math.round(progs.reduce((sum, p) => sum + p.mastery_level, 0) / progs.length) : 0;
    return { label: SUBJECT_META[s]?.emoji + ' ' + s.slice(0, 4), value: avg };
  });

  // Subjects with topics
  const subjectData = MAIN_SUBJECTS.map(s => {
    const progs = progress.filter(p => p.subject === s);
    const avg = progs.length ? Math.round(progs.reduce((sum, p) => sum + p.mastery_level, 0) / progs.length) : 0;
    const meta = SUBJECT_META[s] ?? { color: '#10B981', emoji: '📚' };
    return { subject: s, avg, progs, ...meta };
  }).filter(s => s.progs.length > 0);

  // Activity heatmap
  const actMap = new Map((activity as any[]).map(a => [a.day, a.sessions]));
  const today = new Date();
  const heatCells = [];
  for (let w = 11; w >= 0; w--) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - w * 7 - (6 - d));
      const key = date.toISOString().split('T')[0];
      const cnt = actMap.get(key) ?? 0;
      const cls = cnt === 0 ? '' : cnt === 1 ? 'heat-1' : cnt <= 3 ? 'heat-2' : cnt <= 5 ? 'heat-3' : 'heat-4';
      week.push(<div key={d} className={`heat-cell ${cls}`} title={`${key}: ${cnt} session(s)`} />);
    }
    heatCells.push(<div key={w} className="flex flex-col gap-1">{week}</div>);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Vue globale' },
    { id: 'subjects', label: 'Matières' },
    { id: 'badges', label: 'Badges' },
    { id: 'heatmap', label: 'Activité' },
  ];

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Progression</h1>
        <p className="text-slate-500 text-sm mt-1">Suivi détaillé et spaced repetition</p>
      </div>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {children.map(c => (
            <Link key={c.id} href={`/progress?child=${c.id}`}
              className={`pill cursor-pointer ${selectedChild.id === c.id ? 'bg-brand text-white border-transparent' : 'hover:border-slate-400'}`}>
              {c.avatar} {c.name}
            </Link>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all
              ${tab === t.id ? 'bg-white shadow-soft text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-5">
          <div className="card card-p">
            <h3 className="font-bold text-base mb-4">Radar de compétences</h3>
            <div className="flex justify-center">
              <RadarChart data={radarData} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="card card-p">
              <div className="flex justify-between text-sm font-semibold mb-2">
                <span>Niv. {Math.floor(selectedChild.total_xp / 500) + 1} · Explorateur</span>
                <span className="text-slate-400">{selectedChild.total_xp % 1000}/1000 XP</span>
              </div>
              <div className="xp-bar mb-3"><div className="xp-fill" style={{ width: `${(selectedChild.total_xp % 1000) / 10}%` }} /></div>
              <div className="grid grid-cols-2 gap-2">
                {[['Sessions', selectedChild.total_sessions], ['Streak max', selectedChild.longest_streak + 'j'],
                  ['Streak actuel', selectedChild.current_streak + 'j'], ['XP total', selectedChild.total_xp]].map(([l, v]) => (
                  <div key={l as string} className="bg-surface rounded-xl p-3 text-center">
                    <p className="font-display font-bold text-lg text-brand">{v}</p>
                    <p className="text-xs text-slate-400">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card card-p">
              <h3 className="font-bold text-sm mb-3">À réviser bientôt</h3>
              {progress.filter(p => p.next_review && new Date(p.next_review) <= new Date()).slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-2 py-2 border-b last:border-0 border-surface-border">
                  <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                  <span className="text-sm flex-1">{p.subject} · {p.topic}</span>
                  <span className="text-xs text-slate-400">{p.mastery_label}</span>
                </div>
              ))}
              {!progress.some(p => p.next_review && new Date(p.next_review) <= new Date()) && (
                <p className="text-sm text-slate-400">Rien à réviser pour l'instant</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subjects */}
      {tab === 'subjects' && (
        <div className="flex flex-col gap-4">
          {subjectData.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-slate-400">Aucune donnée de progression encore. Commencez des sessions !</p>
            </div>
          ) : subjectData.map(s => (
            <div key={s.subject} className="card card-p">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">{s.emoji}</span>
                <span className="font-bold capitalize">{s.subject}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-2">
                  <div className="h-full rounded-full" style={{ width: `${s.avg}%`, background: s.color }} />
                </div>
                <span className="font-bold text-sm" style={{ color: s.color }}>{s.avg}%</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.progs.slice(0, 8).map(p => {
                  const bg = p.mastery_level >= 70 ? '#D1FAE5' : p.mastery_level >= 40 ? '#FEF3C7' : '#FEE2E2';
                  const col = p.mastery_level >= 70 ? '#059669' : p.mastery_level >= 40 ? '#D97706' : '#DC2626';
                  return (
                    <span key={p.id} className="pill text-xs" style={{ background: bg, color: col, border: 'none' }}>
                      {p.topic} · {p.mastery_level}%
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Badges */}
      {tab === 'badges' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {allBadges.map((b: any) => {
            const earned = earnedBadgeIds.has(b.id);
            return (
              <div key={b.id} className={`card p-4 text-center transition-all ${earned ? '' : 'opacity-40 grayscale'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mx-auto mb-2
                  ${earned ? 'bg-yellow-50' : 'bg-slate-100'}`}>
                  {b.icon ?? '🏅'}
                </div>
                <p className="font-bold text-sm">{b.name}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">{b.description}</p>
                {earned && <span className="pill-green pill text-xs mt-2 inline-flex">Obtenu</span>}
                {!earned && <span className="text-xs text-slate-300 mt-2 block">+{b.xp_reward} XP</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Heatmap */}
      {tab === 'heatmap' && (
        <div className="card card-p">
          <h3 className="font-bold text-base mb-6">Activité sur 12 semaines</h3>
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max">{heatCells}</div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3">
            <span>Il y a 12 semaines</span>
            <span className="flex items-center gap-1">
              Moins
              <div className="heat-cell" /><div className="heat-cell heat-1" /><div className="heat-cell heat-2" />
              <div className="heat-cell heat-3" /><div className="heat-cell heat-4" />
              Plus
            </span>
            <span>Aujourd'hui</span>
          </div>
        </div>
      )}
    </div>
  );
}
