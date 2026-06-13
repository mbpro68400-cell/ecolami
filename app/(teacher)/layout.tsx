import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <nav className="bg-white border-b border-surface-border px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-green-400 flex items-center justify-center">
            <span className="text-white font-bold text-xs">E</span>
          </div>
          <span className="font-display font-bold text-base">EcoLami</span>
          <span className="pill-blue pill text-xs ml-2">Enseignant</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="btn btn-ghost btn-sm">Vue parent</Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
