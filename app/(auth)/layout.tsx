// app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-green-400 flex items-center justify-center">
              <span className="text-white font-bold text-base">E</span>
            </div>
            <span className="font-display font-bold text-xl tracking-tight">EcoLami</span>
          </div>
          <p className="text-slate-500 text-sm">L'assistant IA qui apprend à réfléchir</p>
        </div>
        {children}
      </div>
    </div>
  );
}
