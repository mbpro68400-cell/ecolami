import Link from 'next/link';
import { Check, ArrowRight, MessageSquare, Shield, Users, Zap, Mic, BookOpen } from 'lucide-react';

const FEATURES = [
  { icon: MessageSquare, color: '#10B981', title: 'Méthode socratique', desc: "L'IA ne donne jamais la réponse. Elle guide par questions pour faire émerger la compréhension." },
  { icon: Shield,        color: '#2563EB', title: 'Données protégées', desc: 'RGPD strict, hébergement France, pseudonymisation côté enseignant.' },
  { icon: Users,         color: '#F97316', title: 'Parents & profs',   desc: 'Rapport hebdo, recommandations ciblées, boucle collaborative unique.' },
  { icon: Zap,           color: '#8B5CF6', title: 'Neuro-adaptatif',   desc: 'Dys, TDAH, HPI — format et rythme adaptés à chaque enfant.' },
  { icon: BookOpen,      color: '#EC4899', title: 'Gamification douce', desc: 'Streaks, XP, badges — encourage sans pression.' },
  { icon: Mic,           color: '#FBBF24', title: 'Voix & scan',       desc: 'Parle à voix haute, scanne ton cahier — EcoLami comprend.' },
];

const PLANS = [
  { name: 'Gratuit', price: '0€', features: ['1 enfant', '15 min/jour', 'Mode professeur'], cta: 'Commencer' },
  { name: 'Famille', price: '9,99€/mois', features: ['3 enfants', '60 min/jour', '5 modes', 'Rapports PDF'], cta: 'Essai 14j', popular: true },
  { name: 'Famille +', price: '14,99€/mois', features: ['6 enfants', 'Illimité', 'Neuro-adaptatif', 'Audio premium'], cta: 'Essai 14j' },
];

export default function LandingPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 bg-white/90 backdrop-blur border-b border-surface-border z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-green-400 flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-display font-bold text-lg tracking-tight">EcoLami</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-500">
            <a href="#features">Fonctionnalités</a>
            <a href="#pricing">Tarifs</a>
            <Link href="/sign-in" className="text-slate-700">Se connecter</Link>
          </div>
          <Link href="/sign-up" className="btn btn-primary">
            Essai gratuit <ArrowRight size={15} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="pill-green pill mb-6 text-sm">Disponible — Tuteur socratique IA</div>
          <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tighter leading-[1.05] mb-6">
            L'IA qui apprend à votre enfant{' '}
            <span className="text-brand relative">
              à réfléchir.
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 8" fill="none">
                <path d="M2 5 Q75 0 150 4 T298 3" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </span>
          </h1>
          <p className="text-lg text-slate-500 mb-8 leading-relaxed max-w-lg">
            EcoLami guide vos enfants de 6 à 18 ans par des questions — jamais par des réponses. La méthode qui développe vraiment l'intelligence.
          </p>
          <div className="flex gap-3 flex-wrap mb-6">
            <Link href="/sign-up" className="btn btn-primary btn-lg">
              Commencer gratuitement <ArrowRight size={16} />
            </Link>
            <Link href="/sign-in" className="btn btn-outline btn-lg">Voir la démo</Link>
          </div>
          <div className="flex gap-5 text-sm text-slate-400">
            {['14 jours gratuits', 'Sans carte bancaire', 'RGPD · France'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <Check size={14} className="text-brand" strokeWidth={3} /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Chat preview */}
        <div className="hidden md:block">
          <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-elevated">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-slate-400 text-xs ml-2">EcoLami · Mathématiques · Mme Sophie</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {[
                { role: 'user', text: "Je comprends pas comment faire cette fraction..." },
                { role: 'ai', text: "D'accord. Avant les fractions, rappelle-toi : quand tu partages une pizza en 4 parts égales, comment appelle-t-on chaque part ?" },
                { role: 'user', text: "Un quart ?" },
                { role: 'ai', text: "Exactement ! Et comment l'écrit-on en chiffres ?" },
              ].map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 text-sm rounded-2xl leading-relaxed
                    ${m.role === 'user' ? 'bg-brand text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-slate-950 py-14">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[['12 000', 'familles actives'], ['94%', 'de réussite en session'], ['3,2×', 'plus efficace'], ['A+', 'certification']].map(([v, l]) => (
            <div key={l}>
              <p className="font-display text-4xl font-bold text-white">{v}</p>
              <p className="text-slate-400 text-sm mt-1">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Fonctionnalités</p>
          <h2 className="font-display text-4xl font-bold tracking-tight">Pensé pour vraiment apprendre</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="card card-p hover:shadow-card transition-shadow">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: f.color + '15', color: f.color }}>
                <f.icon size={22} />
              </div>
              <h3 className="font-bold text-base mb-1.5">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-surface py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold tracking-tight">Tarifs simples</h2>
            <p className="text-slate-500 mt-3">14 jours gratuits sur tous les plans. Sans carte bancaire.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANS.map(p => (
              <div key={p.name} className={`card p-6 flex flex-col ${p.popular ? 'border-brand border-2 bg-green-50 relative' : ''}`}>
                {p.popular && <span className="pill-green pill absolute -top-3 left-5 text-xs">Populaire</span>}
                <p className="font-bold text-base">{p.name}</p>
                <p className="font-display text-3xl font-bold mt-1 mb-4">{p.price}</p>
                <div className="flex flex-col gap-2 flex-1 mb-5">
                  {p.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm">
                      <Check size={14} className="text-brand" strokeWidth={3} />
                      <span className="text-slate-600">{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/sign-up" className={`btn justify-center ${p.popular ? 'btn-primary' : 'btn-outline'}`}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand py-16 text-center">
        <div className="max-w-xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-white mb-3">Prêt à commencer ?</h2>
          <p className="text-white/80 mb-6">Rejoignez 12 000 familles qui apprennent autrement.</p>
          <Link href="/sign-up" className="btn btn-lg bg-white text-brand font-bold hover:bg-green-50">
            Créer un compte gratuit <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center">
              <span className="text-white text-xs font-bold">E</span>
            </div>
            <span className="font-display text-white font-bold">EcoLami</span>
          </div>
          <p className="text-slate-500 text-xs">© 2026 EcoLami · Hébergé en France · RGPD · COPPA</p>
          <div className="flex gap-4 text-xs text-slate-500">
            <a href="#">CGU</a><a href="#">Confidentialité</a><a href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
