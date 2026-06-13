'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  X, ChevronLeft, ChevronRight, Send, Mic, Camera, Clock, Trophy, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Data ───────────────────────────────────────────
const MODES = [
  { id: 'tutor',      label: 'Professeur',   desc: 'Guide par questions',   color: '#10B981', emoji: '🎓' },
  { id: 'practice',   label: "S'entraîner",  desc: 'Consolider les acquis', color: '#2563EB', emoji: '🎯' },
  { id: 'homework',   label: 'Devoirs',      desc: 'Résoudre un exercice',  color: '#8B5CF6', emoji: '📖' },
  { id: 'recitation', label: 'Récitation',   desc: 'Mémoriser une leçon',   color: '#F97316', emoji: '📝' },
  { id: 'scan',       label: 'Scanner',      desc: 'Prendre une photo',     color: '#FBBF24', emoji: '📸' },
];

const SUBJECTS = [
  { id: 'mathematiques', label: 'Maths',    color: '#10B981', emoji: '🔢' },
  { id: 'francais',      label: 'Français', color: '#EC4899', emoji: '📖' },
  { id: 'sciences',      label: 'Sciences', color: '#2563EB', emoji: '🧪' },
  { id: 'histoire-geo',  label: 'Histoire', color: '#8B5CF6', emoji: '🌍' },
  { id: 'anglais',       label: 'Anglais',  color: '#F97316', emoji: '🇬🇧' },
  { id: 'philosophie',   label: 'Philo',    color: '#6366F1', emoji: '💭' },
];

const TUTORS = [
  { id: 'sophie',  name: 'Mme Sophie',  emoji: '👩‍🏫', bg: '#FEF3C7' },
  { id: 'karim',   name: 'M. Karim',    emoji: '👨‍🏫', bg: '#DBEAFE' },
  { id: 'cosmos',  name: 'Cosmos',      emoji: '🤖', bg: '#E0E7FF' },
  { id: 'renard',  name: 'Renard Sage', emoji: '🦊', bg: '#FFEDD5' },
  { id: 'archi',   name: 'Archimède',   emoji: '🧙', bg: '#F5F3FF' },
  { id: 'stella',  name: 'Stella',      emoji: '🧑‍🚀', bg: '#1E1B4B' },
];

type Phase = 'setup' | 'chat' | 'end';
interface Message { role: 'user' | 'assistant'; text: string; timestamp: number; }

function SessionContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useUser();

  const [phase, setPhase] = useState<Phase>('setup');
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('tutor');
  const [subject, setSubject] = useState('mathematiques');
  const [tutor, setTutor] = useState('sophie');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [childId] = useState(params.get('child') ?? '');

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [endData, setEndData] = useState<{ xp: number; accuracy: number | null } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer
  useEffect(() => {
    if (phase === 'chat') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Start session
  const startSession = async () => {
    if (!childId) { toast.error('Sélectionnez un enfant d\'abord'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/session?action=start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, mode, subject }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error?.message ?? 'Erreur'); return; }
      setSessionId(data.session_id);
      setPhase('chat');
      // Message de bienvenue
      setMessages([{
        role: 'assistant',
        text: `Bonjour ! Je suis là pour t'aider avec ${SUBJECTS.find(s => s.id === subject)?.label}. Qu'est-ce qu'on travaille aujourd'hui ?`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (text = input) => {
    if (!text.trim() || !sessionId || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text, timestamp: Date.now() }]);
    setTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text, child_id: childId }),
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = '';
      setTyping(false);
      setMessages(m => [...m, { role: 'assistant', text: '', timestamp: Date.now() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === 'token') {
              aiText += parsed.content;
              setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, text: aiText } : msg));
            }
            if (parsed.type === 'error') toast.error(parsed.message);
          } catch {}
        }
      }
    } finally {
      setTyping(false);
      inputRef.current?.focus();
    }
  };

  // End session
  const endSession = async () => {
    if (!sessionId) { setPhase('end'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/session?action=end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, correct_count: 3, partial_count: 1, incorrect_count: 1 }),
      });
      const data = await res.json();
      setEndData({ xp: data.xp_earned ?? 0, accuracy: data.accuracy });
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase('end');
    }
  };

  const tutorData = TUTORS.find(t => t.id === tutor)!;
  const subjectData = SUBJECTS.find(s => s.id === subject)!;
  const modeData = MODES.find(m => m.id === mode)!;

  // ═══ SETUP ═══
  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-surface p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">Prépare ta session</h1>
              <p className="text-slate-500 text-sm mt-1">Choisis comment tu veux travailler aujourd'hui.</p>
            </div>
            <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>
              <X size={16} /> Annuler
            </button>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-2 mb-8">
            {['Mode', 'Matière', 'Tuteur'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${i <= step ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-sm font-semibold ${i === step ? 'text-slate-800' : 'text-slate-400'}`}>{s}</span>
                {i < 2 && <div className={`flex-1 h-0.5 w-8 ${i < step ? 'bg-brand' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          <div className="card card-p rounded-2xl anim-up" key={step}>
            {/* Step 0: Mode */}
            {step === 0 && (
              <div>
                <h2 className="font-bold text-xl mb-1">Quel mode ?</h2>
                <p className="text-slate-500 text-sm mb-5">Chaque mode offre une façon différente de travailler.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {MODES.map(m => (
                    <button key={m.id} onClick={() => setMode(m.id)}
                      className={`p-4 text-left rounded-2xl border-2 transition-all hover:shadow-card
                        ${mode === m.id ? 'border-current shadow-soft' : 'border-surface-border'}`}
                      style={{ borderColor: mode === m.id ? m.color : undefined }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
                        style={{ background: m.color + '20' }}>{m.emoji}</div>
                      <p className="font-bold text-base">{m.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1: Matière */}
            {step === 1 && (
              <div>
                <h2 className="font-bold text-xl mb-1">Quelle matière ?</h2>
                <p className="text-slate-500 text-sm mb-5">Tu pourras changer en cours de session.</p>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map(s => (
                    <button key={s.id} onClick={() => setSubject(s.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 font-semibold text-sm transition-all
                        ${subject === s.id ? 'text-white border-transparent' : 'bg-white border-surface-border text-slate-700 hover:border-slate-300'}`}
                      style={{ background: subject === s.id ? s.color : undefined }}>
                      <span>{s.emoji}</span> {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Tuteur */}
            {step === 2 && (
              <div>
                <h2 className="font-bold text-xl mb-1">Avec quel tuteur ?</h2>
                <p className="text-slate-500 text-sm mb-5">Chacun a son style, tous sont bienveillants.</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {TUTORS.map(t => (
                    <button key={t.id} onClick={() => setTutor(t.id)}
                      className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all
                        ${tutor === t.id ? 'border-brand bg-green-50' : 'border-surface-border bg-white hover:border-slate-300'}`}>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-3xl"
                        style={{ background: t.bg }}>
                        {t.emoji}
                      </div>
                      <span className="text-xs font-semibold text-slate-600 leading-tight text-center">
                        {t.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {step > 0 && (
                <button className="btn btn-ghost" onClick={() => setStep(s => s - 1)}>
                  <ChevronLeft size={16} /> Retour
                </button>
              )}
              {step < 2 ? (
                <button className="btn btn-primary flex-1 justify-center" onClick={() => setStep(s => s + 1)}>
                  Continuer <ChevronRight size={16} />
                </button>
              ) : (
                <button className="btn btn-primary flex-1 justify-center" onClick={startSession} disabled={loading || !childId}>
                  {loading ? 'Démarrage...' : 'Démarrer la session'} <ArrowRight size={16} />
                </button>
              )}
            </div>
            {!childId && step === 2 && (
              <p className="text-xs text-red-500 mt-2 text-center">Vous devez sélectionner un enfant. Allez dans "Mes enfants" d'abord.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══ END ═══
  if (phase === 'end') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center rounded-3xl">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <Trophy size={40} className="text-brand" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight mb-2">Bravo !</h2>
          <p className="text-slate-500 mb-6">
            Session terminée · {subjectData.label} · {modeData.label} · {formatTime(timer)}
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'XP gagné', value: `+${endData?.xp ?? 0}`, color: '#FBBF24' },
              { label: 'Score', value: endData?.accuracy ? `${endData.accuracy}%` : '—', color: '#10B981' },
              { label: 'Messages', value: String(messages.filter(m => m.role === 'user').length), color: '#8B5CF6' },
            ].map(s => (
              <div key={s.label} className="card p-3 text-center">
                <p className="font-display text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button className="btn btn-outline flex-1" onClick={() => { setPhase('setup'); setStep(0); setMessages([]); setTimer(0); }}>
              <ArrowRight size={14} /> Nouvelle session
            </button>
            <button className="btn btn-primary flex-1" onClick={() => router.push('/dashboard')}>
              Tableau de bord
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ CHAT ═══
  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-border">
        <button className="btn-icon" onClick={() => router.push('/dashboard')}>
          <ChevronLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
          style={{ background: tutorData.bg }}>{tutorData.emoji}</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{tutorData.name}</p>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-brand rounded-full inline-block" />
            {subjectData.label} · {modeData.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill text-xs flex items-center gap-1">
            <Clock size={11} /> {formatTime(timer)}
          </span>
          <button className="btn btn-outline btn-sm" onClick={endSession} disabled={loading}>
            Terminer
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-surface">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start items-end gap-2'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: tutorData.bg }}>{tutorData.emoji}</div>
            )}
            <div className={`max-w-[75%] px-4 py-3 text-sm leading-relaxed
              ${m.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}
              dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') || '...' }}
            />
          </div>
        ))}
        {typing && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: tutorData.bg }}>{tutorData.emoji}</div>
            <div className="bubble-ai px-4 py-3 flex items-center gap-1">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-surface-border p-3">
        <div className="flex items-center gap-2">
          <button className={`btn-icon ${recording ? 'bg-red-50 text-red-500' : ''}`}
            onClick={() => setRecording(!recording)}>
            <Mic size={18} />
          </button>
          <button className="btn-icon"><Camera size={18} /></button>
          <input
            ref={inputRef}
            className="input flex-1"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Réponds ou pose une question..."
          />
          <button
            className="btn btn-primary"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Send size={16} />
          </button>
        </div>
        {recording && (
          <p className="text-xs text-red-500 mt-2 text-center">
            Écoute en cours... (STT Whisper nécessite NEXT_PUBLIC_OPENAI_API_KEY)
          </p>
        )}
      </div>
    </div>
  );
}

export default function SessionPage() {
  return <Suspense fallback={<div className="flex items-center justify-center h-screen"><p className="text-slate-400">Chargement...</p></div>}>
    <SessionContent />
  </Suspense>;
}
