/**
 * POST /api/scan
 * Analyse une photo de devoir avec Gemini Vision.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient, getProfileByClerkId } from '@/lib/supabase/client';
import { analyzeImage } from '@/lib/ai/geminiClient';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const db = createAdminClient();
  const profile = await getProfileByClerkId(userId);
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });

  if (profile.plan === 'free') {
    return NextResponse.json({ error: 'Le mode Scan nécessite le plan Famille.', code: 'PLAN_REQUIRED' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  const childId = formData.get('child_id') as string | null;

  if (!file || !childId) return NextResponse.json({ error: 'image et child_id requis' }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: `Format non supporté : ${file.type}` }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fichier trop volumineux. Maximum 5 MB.' }, { status: 400 });

  const { data: child } = await db.from('children').select('id, name, age, grade').eq('id', childId).eq('parent_id', profile.id).single();
  if (!child) return NextResponse.json({ error: 'Enfant introuvable' }, { status: 404 });

  try {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const analysis = await analyzeImage(base64, file.type);

    // Upload dans Supabase Storage
    const fileName = `${childId}/${Date.now()}.${file.type.split('/')[1]}`;
    const { data: uploaded } = await db.storage.from('homework-scans')
      .upload(fileName, Buffer.from(buffer), { contentType: file.type });

    const photoUrl = uploaded?.path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/homework-scans/${uploaded.path}`
      : null;

    // Créer le devoir
    const { data: homework } = await db.from('homework').insert({
      child_id: childId,
      title: analysis.title || `Devoir ${analysis.subject}`,
      subject: analysis.subject,
      description: analysis.exercises.map((e, i) => `${i + 1}. ${e.text}`).join('\n'),
      photo_url: photoUrl, status: 'pending',
      subtasks: analysis.exercises.map((e, i) => ({ id: i + 1, text: e.text, type: e.type, done: false })),
    }).select().single();

    return NextResponse.json({ analysis, homework_id: homework?.id ?? null, photo_url: photoUrl });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur analyse';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
