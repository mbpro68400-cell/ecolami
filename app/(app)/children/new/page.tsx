'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const GRADES = ['cp','ce1','ce2','cm1','cm2','6eme','5eme','4eme','3eme','2nde','1ere','terminale'];
const GRADE_LABELS: Record<string, string> = {
  cp:'CP', ce1:'CE1', ce2:'CE2', cm1:'CM1', cm2:'CM2',
  '6eme':'6e', '5eme':'5e', '4eme':'4e', '3eme':'3e', '2nde':'2nde', '1ere':'1re', terminale:'Terminale'
};
const NEURO = [
  { id: 'normal', label: 'Standard',    desc: 'Profil d\'apprentissage classique' },
  { id: 'dys',    label: 'DYS',         desc: 'Dyslexie, dysorthographie, dyscalculie' },
  { id: 'tdah',   label: 'TDAH',        desc: 'Trouble de l\'attention / hyperactivité' },
  { id: 'hp',     label: 'HPI',         desc: 'Haut potentiel intellectuel' },
];
const TUTORS = [
  { id: 'sophie', name: 'Mme Sophie', emoji: '👩‍🏫', bg: '#FEF3C7', desc: 'Douce et patiente' },
  { id: 'karim',  name: 'M. Karim',   emoji: '👨‍🏫', bg: '#DBEAFE', desc: 'Sportif et motivant' },
  { id: 'cosmos', name: 'Cosmos',      emoji: '🤖', bg: '#E0E7FF', desc: 'Logique et précis' },
  { id: 'renard', name: 'Renard Sage', emoji: '🦊', bg: '#FFEDD5', desc: 'Philosophe et sage' },
  { id: 'archi',  name: 'Archimède',   emoji: '🧙', bg: '#F5F3FF', desc: 'Scientifique et créatif' },
  { id: 'stella', name: 'Stella',      emoji: '🧑‍🚀', bg: '#1E1B4B', desc: 'Aventurière et curieuse' },
];
const AVATARS = ['🧒','👦','👧','🧑','👶','🐣','🦊','🐸','🐧','⭐','🌈','🚀'];

export default function NewChildPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', age: 9, grade: 'cm1', avatar: '🧒',
    neuro_profile: 'normal', preferred_tutor: 'sophie',
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Prénom requis'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? 'Erreur'); return; }
      toast.success(`Profil de ${form.name} créé !`);
      router.push('/children');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <button onClick={() => router.push('/children')} className="btn btn-ghost mb-6">
        <ChevronLeft size={16} /> Retour
      </button>

      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Créer un profil enfant</h1>
      <p className="text-slate-500 text-sm mb-8">Ces informations permettent à EcoLami d'adapter son approche pédagogique.</p>

      <div className="flex flex-col gap-6">
        {/* Prénom + âge */}
        <div className="card card-p">
          <h2 className="font-bold text-base mb-4">Informations de base</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="label">Prénom *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Lou" />
            </div>
            <div>
              <label className="label">Âge</label>
              <input className="input" type="number" min={5} max={19} value={form.age}
                onChange={e => setForm({...form, age: parseInt(e.target.value)})} />
            </div>
          </div>
        </div>

        {/* Niveau scolaire */}
        <div className="card card-p">
          <h2 className="font-bold text-base mb-4">Niveau scolaire</h2>
          <div className="flex flex-wrap gap-2">
            {GRADES.map(g => (
              <button key={g} onClick={() => setForm({...form, grade: g})}
                className={`pill cursor-pointer transition-all ${form.grade === g ? 'bg-brand text-white border-brand' : 'hover:border-slate-400'}`}>
                {GRADE_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        {/* Avatar */}
        <div className="card card-p">
          <h2 className="font-bold text-base mb-4">Avatar</h2>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map(a => (
              <button key={a} onClick={() => setForm({...form, avatar: a})}
                className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all border-2
                  ${form.avatar === a ? 'border-brand bg-green-50 scale-110' : 'border-transparent bg-slate-100 hover:bg-slate-200'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Profil neuro */}
        <div className="card card-p">
          <h2 className="font-bold text-base mb-1">Profil d'apprentissage</h2>
          <p className="text-slate-500 text-sm mb-4">EcoLami adaptera son rythme et ses explications en conséquence.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {NEURO.map(n => (
              <label key={n.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${form.neuro_profile === n.id ? 'border-brand bg-green-50' : 'border-surface-border hover:border-slate-300'}`}>
                <input type="radio" name="neuro" value={n.id} checked={form.neuro_profile === n.id}
                  onChange={() => setForm({...form, neuro_profile: n.id})}
                  className="mt-0.5" style={{ accentColor: '#10B981' }} />
                <div>
                  <p className="font-semibold text-sm">{n.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Tuteur préféré */}
        <div className="card card-p">
          <h2 className="font-bold text-base mb-1">Tuteur préféré</h2>
          <p className="text-slate-500 text-sm mb-4">Votre enfant pourra changer à tout moment dans les paramètres.</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {TUTORS.map(t => (
              <button key={t.id} onClick={() => setForm({...form, preferred_tutor: t.id})}
                className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all
                  ${form.preferred_tutor === t.id ? 'border-brand bg-green-50' : 'border-surface-border hover:border-slate-300'}`}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: t.bg }}>{t.emoji}</div>
                <p className="text-xs font-semibold leading-tight text-center">{t.name.split(' ')[0]}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button className="btn btn-primary btn-lg justify-center" onClick={handleSubmit} disabled={loading || !form.name.trim()}>
          {loading ? 'Création en cours...' : <>Créer le profil <Check size={16} /></>}
        </button>
      </div>
    </div>
  );
}
