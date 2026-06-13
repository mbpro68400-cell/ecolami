'use client';

import { useState } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { Check, LogOut, Shield, Bell, User, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [notifs, setNotifs] = useState({ weekly: true, realtime: false, monthly: true });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    toast.success('Paramètres enregistrés');
  };

  const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
    <button onClick={onChange} className="relative shrink-0"
      style={{ width: 44, height: 24, borderRadius: 999, background: on ? '#10B981' : '#D1D5DB', border: 'none', cursor: 'pointer', transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.15)', transition: 'left .2s' }} />
    </button>
  );

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-8">Paramètres</h1>

      {/* Account */}
      <div className="card card-p mb-4">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-slate-400" />
          <h2 className="font-bold text-base">Compte</h2>
        </div>
        <div className="flex flex-col gap-0">
          {[
            { label: 'Nom complet', value: user?.fullName ?? '—' },
            { label: 'Email', value: user?.primaryEmailAddress?.emailAddress ?? '—' },
            { label: 'Compte créé', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '—' },
          ].map((item, i, arr) => (
            <div key={item.label} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? 'border-b border-surface-border' : ''}`}>
              <div>
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{item.value}</p>
              </div>
              <button className="btn btn-ghost btn-sm">Modifier</button>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="card card-p mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-slate-400" />
          <h2 className="font-bold text-base">Notifications</h2>
        </div>
        <div className="flex flex-col gap-0">
          {[
            { key: 'weekly', label: 'Rapport hebdomadaire', desc: 'Résumé chaque lundi matin' },
            { key: 'realtime', label: 'Alertes session', desc: 'Notifications quand une session se termine' },
            { key: 'monthly', label: 'Bilan mensuel', desc: 'Email récapitulatif chaque mois' },
          ].map((item, i, arr) => (
            <div key={item.key} className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? 'border-b border-surface-border' : ''}`}>
              <div>
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
              </div>
              <Toggle on={notifs[item.key as keyof typeof notifs]}
                onChange={() => setNotifs(n => ({ ...n, [item.key]: !n[item.key as keyof typeof notifs] }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="card card-p mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-slate-400" />
          <h2 className="font-bold text-base">Sécurité & RGPD</h2>
        </div>
        <div className="flex flex-col gap-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
            Vos données sont hébergées en France et conformes au RGPD. Les données de vos enfants ne sont jamais vendues.
          </div>
          <button className="btn btn-outline w-full justify-start">
            <Shield size={14} /> Exporter mes données (RGPD)
          </button>
          <button className="btn btn-outline w-full justify-start text-red-600 hover:border-red-300">
            <Trash2 size={14} /> Supprimer mon compte et toutes les données
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement...' : <><Check size={14} /> Sauvegarder</>}
        </button>
        <button className="btn btn-ghost" onClick={() => signOut({ redirectUrl: '/' })}>
          <LogOut size={14} /> Se déconnecter
        </button>
      </div>
    </div>
  );
}
