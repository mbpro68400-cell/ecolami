'use client';

import { useState } from 'react';
import { Shield, Plus, X, Check, AlertCircle, MessageSquare, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Profile, Child } from '@/lib/supabase/client';

const SUBJECTS = ['mathematiques','francais','sciences','histoire-geo','anglais','philosophie'];
const SUBJECT_LABELS: Record<string, string> = {
  mathematiques: 'Maths', francais: 'Français', sciences: 'Sciences',
  'histoire-geo': 'Histoire-Géo', anglais: 'Anglais', philosophie: 'Philo',
};

interface Props {
  profile: Profile;
  children: Child[];
  invitations: any[];
  recommendations: any[];
}

export default function TeachersClient({ profile, children, invitations, recommendations }: Props) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteChild, setInviteChild] = useState(children[0]?.id ?? '');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [rgpdConsent, setRgpdConsent] = useState(false);
  const [sending, setSending] = useState(false);

  const activeInvitations = invitations.filter((i: any) => i.status === 'accepted' && !i.revoked_at);
  const pendingInvitations = invitations.filter((i: any) => i.status === 'pending');
  const unreadRecs = recommendations.filter((r: any) => !r.seen_by_parent_at);

  const toggleSubject = (s: string) => setSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleInvite = async () => {
    if (!inviteEmail || subjects.length === 0 || !rgpdConsent) return;
    setSending(true);
    try {
      const res = await fetch('/api/teacher/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_email: inviteEmail, child_id: inviteChild, subjects }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? 'Erreur'); return; }
      toast.success('Invitation envoyée !');
      setShowInvite(false); setInviteEmail(''); setSubjects([]); setRgpdConsent(false);
    } finally { setSending(false); }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!confirm('Révoquer l\'accès de cet enseignant ? Cette action est immédiate et irréversible.')) return;
    const res = await fetch('/api/teacher/revoke', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: invitationId }),
    });
    if (res.ok) { toast.success('Accès révoqué'); window.location.reload(); }
    else toast.error('Erreur lors de la révocation');
  };

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">Lien avec les enseignants</h1>
        <p className="text-slate-500 text-sm mt-1">Partagez la progression de vos enfants avec leurs professeurs.</p>
      </div>

      {/* RGPD banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex gap-3">
        <Shield size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm text-blue-800 mb-1">Protection RGPD garantie</p>
          <p className="text-sm text-blue-700 leading-relaxed">
            L'enseignant ne voit <strong>jamais le vrai nom</strong> de votre enfant — uniquement un identifiant anonyme (ex: Élève-7F3K). 
            Seuls les indicateurs agrégés sont partagés. Vous pouvez révoquer l'accès à tout moment.
          </p>
        </div>
      </div>

      {/* Active connections */}
      {activeInvitations.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-base mb-3">Connexions actives</h2>
          <div className="flex flex-col gap-3">
            {activeInvitations.map((inv: any) => {
              const child = children.find(c => c.id === inv.child_id);
              return (
                <div key={inv.id} className="card card-p">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm">{inv.teacher_accounts?.name ?? inv.teacher_email}</span>
                        <span className="pill-green pill text-xs">Actif</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {inv.teacher_accounts?.school_name ?? ''} · {inv.teacher_accounts?.subject ?? ''}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="pill text-xs">Élève pour {child?.name ?? '—'}</span>
                        <span className="pill text-xs">{(inv.consent_scope ?? []).join(', ')}</span>
                      </div>
                    </div>
                    <button onClick={() => handleRevoke(inv.id)} className="btn btn-danger btn-sm shrink-0">
                      <X size={13} /> Révoquer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending */}
      {pendingInvitations.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-base mb-3">En attente</h2>
          {pendingInvitations.map((inv: any) => (
            <div key={inv.id} className="card p-4 bg-amber-50 border-amber-200 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{inv.teacher_email}</p>
                <p className="text-xs text-slate-500">Invitation envoyée · expire dans 7 jours</p>
              </div>
              <AlertCircle size={18} className="text-amber-500" />
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold text-base">Recommandations reçues</h2>
            {unreadRecs.length > 0 && <span className="pill-red pill text-xs">{unreadRecs.length} nouvelles</span>}
          </div>
          <div className="flex flex-col gap-2">
            {recommendations.slice(0, 5).map((r: any) => (
              <div key={r.id} className={`card p-4 border-l-4 ${r.seen_by_parent_at ? 'border-slate-200' : 'border-brand'}`}>
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-sm">{r.subject} · {r.notion}</span>
                  <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{r.recommendation_text}</p>
                <span className={`pill text-xs mt-2 inline-flex ${r.recommendation_type === 'alert' ? 'pill-red' : r.recommendation_type === 'exercise' ? 'pill-blue' : 'pill-green'}`}>
                  {r.recommendation_type === 'exercise' ? 'Exercice' : r.recommendation_type === 'alert' ? 'Alerte' : 'Méthode'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      {!showInvite ? (
        <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
          <Plus size={15} /> Inviter un enseignant
        </button>
      ) : (
        <div className="card card-p">
          <h2 className="font-bold text-base mb-4">Inviter un enseignant</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="label">Enfant concerné</label>
              <select className="input" value={inviteChild} onChange={e => setInviteChild(e.target.value)}>
                {children.map(c => <option key={c.id} value={c.id}>{c.name} · {c.grade}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Email de l'enseignant</label>
              <input className="input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="prof@ecole.fr" />
            </div>
            <div>
              <label className="label">Matières à partager</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {SUBJECTS.map(s => (
                  <button key={s} onClick={() => toggleSubject(s)}
                    className={`pill cursor-pointer transition-all ${subjects.includes(s) ? 'bg-brand text-white border-transparent' : 'hover:border-slate-400'}`}>
                    {subjects.includes(s) && <Check size={11} />}
                    {SUBJECT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={rgpdConsent} onChange={e => setRgpdConsent(e.target.checked)}
                className="mt-0.5" style={{ accentColor: '#10B981' }} />
              <span className="text-sm text-slate-600 leading-relaxed">
                J'autorise le partage des <strong>indicateurs de progression agrégés et anonymisés</strong> de cet enfant avec cet enseignant.
                Son vrai nom ne sera jamais partagé. Je peux révoquer cet accès à tout moment. <span className="text-brand font-semibold">Conforme RGPD.</span>
              </span>
            </label>
            <div className="flex gap-3">
              <button className="btn btn-primary flex-1 justify-center" onClick={handleInvite}
                disabled={!inviteEmail || subjects.length === 0 || !rgpdConsent || sending}>
                {sending ? 'Envoi...' : 'Envoyer l\'invitation'}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowInvite(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
