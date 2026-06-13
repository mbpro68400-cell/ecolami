import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'EcoLami — L\'assistant IA qui apprend à réfléchir',
  description: 'Tuteur socratique IA pour enfants 6-18 ans. Guide par questions, jamais par réponses.',
  keywords: ['éducation', 'IA', 'tuteur', 'enfants', 'socratique', 'apprentissage'],
  openGraph: {
    title: 'EcoLami',
    description: 'Tuteur IA qui pose les bonnes questions.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="fr" className={inter.variable}>
        <body className="font-sans antialiased">
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: { fontFamily: 'Inter, sans-serif', fontSize: 14 },
              success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
