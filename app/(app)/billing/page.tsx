import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient, getProfileByClerkId } from '@/lib/supabase/client';
import { Check } from 'lucide-react';

const PLANS = [
  {
    id: 'free', name: 'Découverte', price: 0, period: 'gratuit',
    features: ['1 enfant', '15 min / jour', 'Mode Professeur uniquement', 'Historique 7 jours'],
    cta: 'Plan actuel',
  },
  {
    id: 'famille', name: 'Famille', price: 9.99, period: 'par mois',
    features: ["Jusqu'à 3 enfants", '60 min / jour', 'Tous les modes', 'Rapports hebdo PDF', 'Dashboard parent complet', 'Recommandations enseignant'],
    cta: 'Choisir Famille',
    popular: true,
  },
  {
    id: 'famille_plus', name: 'Famille +', price: 14.99, period: 'par mois',
    features: ["Jusqu'à 6 enfants", 'Temps illimité', 'Profils neuro-adaptés', 'Accès prioritaire', 'Audio ElevenLabs', 'Coach IA personnalisé'],
    cta: 'Choisir Famille +',
  },
  {
    id: 'ecole', name: 'École', price: null, period: 'sur devis',
    features: ['Classes complètes', 'ENT compatible', 'Dashboard enseignant', 'RGPD renforcé', 'Formation équipe', 'API'],
    cta: 'Nous contacter',
  },
];

export default async function BillingPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const profile = await getProfileByClerkId(userId);
  if (!profile) redirect('/sign-in');
  const db = createAdminClient();
  const { data: sub } = await db.from('subscriptions').select('*').eq('profile_id', profile.id).maybeSingle();
  const currentPlan = sub?.plan ?? profile.plan ?? 'free';

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight">Abonnement</h1>
        <p className="text-slate-500 mt-1">
          Plan actuel : <strong>{currentPlan}</strong>
          {sub?.current_period_end && ` · Renouvellement le ${new Date(sub.current_period_end).toLocaleDateString('fr-FR')}`}
        </p>
      </div>

      {/* Trial banner */}
      {sub?.status === 'trialing' && (
        <div className="card card-p mb-8 border-brand border-2 bg-green-50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="pill-green pill mb-2">Essai gratuit actif</span>
              <p className="font-bold">Profitez de toutes les fonctionnalités pendant 14 jours</p>
              <p className="text-slate-500 text-sm mt-1">Sans carte bancaire · Résiliable à tout moment</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display font-bold text-brand">0€</p>
              <p className="text-xs text-slate-400">jusqu'à {sub.trial_end ? new Date(sub.trial_end).toLocaleDateString('fr-FR') : '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {PLANS.map(plan => (
          <div key={plan.id} className={`card p-5 relative flex flex-col
            ${plan.popular ? 'border-brand border-2 bg-green-50' : ''}
            ${plan.id === currentPlan ? 'ring-2 ring-brand' : ''}`}>
            {plan.popular && (
              <span className="pill-green pill absolute -top-3 left-4 text-xs">
                Populaire
              </span>
            )}
            {plan.id === currentPlan && (
              <span className="pill absolute -top-3 right-4 text-xs bg-slate-800 text-white">
                Plan actuel
              </span>
            )}
            <div className="mb-4">
              <p className="font-bold text-base">{plan.name}</p>
              <div className="flex items-baseline gap-1 mt-1">
                {plan.price === null ? (
                  <span className="font-display text-2xl font-bold">Sur devis</span>
                ) : plan.price === 0 ? (
                  <span className="font-display text-2xl font-bold">Gratuit</span>
                ) : (
                  <>
                    <span className="font-display text-3xl font-bold">{plan.price}€</span>
                    <span className="text-slate-400 text-sm">/{plan.period.replace('par ', '')}</span>
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-surface-border pt-4 mb-4 flex flex-col gap-2 flex-1">
              {plan.features.map(f => (
                <div key={f} className="flex items-start gap-2 text-sm">
                  <Check size={15} className="text-brand mt-0.5 shrink-0" strokeWidth={3} />
                  <span className="text-slate-600">{f}</span>
                </div>
              ))}
            </div>
            <button
              className={`btn w-full justify-center mt-auto text-sm
                ${plan.popular ? 'btn-primary' : 'btn-outline'}
                ${plan.id === currentPlan ? 'opacity-50 cursor-default' : ''}`}
              disabled={plan.id === currentPlan}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="mt-10 card card-p">
        <h3 className="font-bold text-base mb-4">Questions fréquentes</h3>
        <div className="flex flex-col gap-4">
          {[
            ['Puis-je changer de plan à tout moment ?', 'Oui, vous pouvez upgrader ou downgrader à tout moment. Les changements prennent effet immédiatement.'],
            ['Y a-t-il un engagement ?', 'Non, tous les plans sont sans engagement. Vous pouvez résilier à tout moment depuis cette page.'],
            ['Les données de mes enfants sont-elles sécurisées ?', 'Oui, toutes les données sont hébergées en France, chiffrées, et conformes au RGPD. Les enseignants ne voient jamais les vrais noms.'],
          ].map(([q, a]) => (
            <div key={q as string}>
              <p className="font-semibold text-sm mb-1">{q}</p>
              <p className="text-slate-500 text-sm">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
