'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Check, ArrowRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const GRADES = ['cp','ce1','ce2','cm1','cm2','6eme','5eme','4eme','3eme','2nde','1ere','terminale'];
const GRADE_LABELS: Record<string, string> = { cp:'CP',ce1:'CE1',ce2:'CE2',cm1:'CM1',cm2:'CM2','6eme':'6e','5eme':'5e','4eme':'4e','3eme':'3e','2nde':'2nde','1ere':'1re',terminale:'Terminale' };
const TUTORS = [
  { id: 'sophie', name: 'Mme Sophie', emoji: '👩‍🏫', bg: '#FEF3C7' },
  { id: 'karim', name: 'M. Karim', emoji: '👨‍🏫', bg: '#DBEAFE' },
  { id: 'cosmos', name: 'Cosmos', emoji: '🤖', bg: '#E0E7FF' },
  { id: 'renard', name: 'Renard', emoji: '🦊', bg: '#FFEDD5' },
  { id: 'archi', name: 'Archimède', emoji: '🧙', bg: '#F5F3FF' },
  { id: 'stella', name: 'Stella', emoji: '🧑‍🚀', bg: '#1E1B4B' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('parent');
  const [child, setChild] = useState({ name: '', age: 9, grade: 'cm1', tutor: 'sophie' });
  const [loading, setLoading] = useState(false);

  const complete = async () => {
    if (!child.name.trim()) { toast.error('Prénom requis'); return; }
    setLoading(true);
    try {
      // Create child
      const res = await fetch('/api/children', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: child.name, age: child.age, grade: child.grade, preferred_tutor: child.tutor, avatar: '🧒' }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error?.message ?? 'Erreur'); return; }
      // Mark onboarding done
      await fetch('/api/onboarding', { method: 'POST' });
      toast.success(`Bienvenue, ${child.name} est prêt !`);
      router.push('/dashboard');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-green-400 flex items-center justify-center">
              <span className="text-white font-bold">E</span>
            </div>
            <span className="font-display font-bold text-xl">EcoLami</span>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8">
          {['Profil','Enfant','C\'est parti !'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${i <= step ? 'bg-brand text-white' : 'bg-slate-200 text-slate-400'}`}>
                {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
              </div>
              <span className={`text-sm font-semibold ${i === step ? 'text-slate-800' : 'text-slate-400'}`}>{s}</span>
              {i < 2 && <div className={`flex-1 h-0.5 w-8 ${i < step ? 'bg-brand' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        <div className="card p-7 rounded-2xl anim-up" key={step}>
          {/* Step 0: Role */}
          {step === 0 && (
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight mb-1">
                Bienvenue, {user?.firstName ?? 'cher parent'} !
              </h1>
              <p className="text-slate-500 mb-6">Vous êtes ...</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'parent', emoji: '👨‍👩‍👧', title: 'Parent', desc: 'Je veux aider mon enfant à la maison.' },
                  { id: 'teacher', emoji: '🏫', title: 'Enseignant(e)', desc: 'Je veux recommander EcoLami à mes élèves.' },
                ].map(o => (
                  <button key={o.id} onClick={() => setRole(o.id)}
                    className={`p-5 text-left rounded-xl border-2 transition-all
                      ${role === o.id ? 'border-brand bg-green-50' : 'border-surface-border hover:border-slate-300'}`}>
                    <div className="text-3xl mb-3">{o.emoji}</div>
                    <p className="font-bold">{o.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{o.desc}</p>
                  </button>
                ))}
              </div>
              <button className="btn btn-primary w-full justify-center mt-6" onClick={() => setStep(1)}>
                Continuer <ArrowRight size={15} />
              </button>
            </div>
          )}

          {/* Step 1: Child */}
          {step === 1 && (
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Votre enfant</h1>
              <p className="text-slate-500 mb-6">Vous pourrez ajouter d'autres profils plus tard.</p>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="label">Prénom *</label>
                    <input className="input" value={child.name} onChange={e => setChild({...child, name: e.target.value})} placeholder="Lou" />
                  </div>
                  <div>
                    <label className="label">Âge</label>
                    <input className="input" type="number" min={5} max={19} value={child.age}
                      onChange={e => setChild({...child, age: parseInt(e.target.value)})} />
                  </div>
                </div>
                <div>
                  <label className="label">Niveau scolaire</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {GRADES.map(g => (
                      <button key={g} onClick={() => setChild({...child, grade: g})}
                        className={`pill cursor-pointer transition-all ${child.grade === g ? 'bg-brand text-white border-transparent' : 'hover:border-slate-400'}`}>
                        {GRADE_LABELS[g]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Tuteur préféré</label>
                  <div className="grid grid-cols-6 gap-2 mt-1">
                    {TUTORS.map(t => (
                      <button key={t.id} onClick={() => setChild({...child, tutor: t.id})}
                        className={`p-2 rounded-xl border-2 flex flex-col items-center gap-1 transition-all
                          ${child.tutor === t.id ? 'border-brand bg-green-50' : 'border-surface-border'}`}>
                        <span className="text-xl">{t.emoji}</span>
                        <span className="text-xs font-semibold">{t.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button className="btn btn-ghost" onClick={() => setStep(0)}><ChevronLeft size={15} /> Retour</button>
                <button className="btn btn-primary flex-1 justify-center" onClick={() => setStep(2)}>Continuer <ArrowRight size={15} /></button>
              </div>
            </div>
          )}

          {/* Step 2: Start */}
          {step === 2 && (
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Tout est prêt !</h1>
              <p className="text-slate-500 mb-2">EcoLami est configuré pour <strong>{child.name}</strong>.</p>
              <p className="text-slate-500 text-sm mb-6">Commencez votre première session gratuitement. Vous avez 14 jours d'essai sur le plan Famille.</p>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-left">
                {['3 sessions/semaine gratuites', 'Mode Professeur socratique', 'Dashboard parent inclus', 'Aucune carte bancaire requise'].map(f => (
                  <div key={f} className="flex items-center gap-2 py-1">
                    <Check size={14} className="text-brand" strokeWidth={3} /> <span className="text-sm">{f}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button className="btn btn-ghost" onClick={() => setStep(1)}><ChevronLeft size={15} /></button>
                <button className="btn btn-primary flex-1 justify-center btn-lg" onClick={complete} disabled={loading || !child.name.trim()}>
                  {loading ? 'Configuration...' : 'Accéder au tableau de bord →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
