'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  Home, Users, MessageSquare, History, BarChart2,
  GraduationCap, Gift, Settings, Bell, Plus
} from 'lucide-react';

const NAV = [
  { href: '/dashboard',  icon: Home,          label: 'Tableau de bord' },
  { href: '/children',   icon: Users,         label: 'Mes enfants' },
  { href: '/session',    icon: MessageSquare, label: 'Session' },
  { href: '/history',    icon: History,       label: 'Historique' },
  { href: '/progress',   icon: BarChart2,     label: 'Progression' },
  { href: '/teachers',   icon: GraduationCap, label: 'Enseignants' },
  { href: '/billing',    icon: Gift,          label: 'Abonnement' },
  { href: '/settings',   icon: Settings,      label: 'Paramètres' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* ─── Sidebar desktop ─── */}
      <aside className="hidden md:flex flex-col w-[220px] min-w-[220px] bg-white border-r border-surface-border">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-green-400 flex items-center justify-center">
              <span className="text-white text-xs font-bold">E</span>
            </div>
            <span className="font-display font-bold text-base tracking-tight">EcoLami</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = path.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`nav-item ${active ? 'active' : ''}`}>
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-surface-border p-4">
          <div className="flex items-center gap-2">
            <UserButton afterSignOutUrl="/" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Mon compte</div>
              <div className="text-xs text-slate-400 truncate">Plan Famille</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-surface-border">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center">
              <span className="text-white text-xs font-bold">E</span>
            </div>
            <span className="font-display font-bold text-sm">EcoLami</span>
          </div>
          <Link href="/session" className="btn btn-primary btn-sm">
            <Plus size={14} /> Session
          </Link>
          <button className="btn btn-ghost btn-sm relative">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
          <UserButton afterSignOutUrl="/" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="md:hidden flex bg-white border-t border-surface-border">
          {NAV.slice(0, 5).map(({ href, icon: Icon, label }) => {
            const active = path.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-semibold
                  ${active ? 'text-brand' : 'text-slate-400'}`}>
                <Icon size={20} />
                <span>{label.split(' ')[0]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
